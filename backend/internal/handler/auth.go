package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

const (
	sessionCookieName = "session_id"
	tokenExpiry       = 15 * time.Minute
	sessionExpiry     = 7 * 24 * time.Hour // 7 days
)

type AuthHandler struct {
	queries *sqlc.Queries
	cfg     config.Config
}

func NewAuthHandler(queries *sqlc.Queries, cfg config.Config) *AuthHandler {
	return &AuthHandler{queries: queries, cfg: cfg}
}

type sendMagicLinkRequest struct {
	Email string `json:"email"`
}

type authResponse struct {
	Message string `json:"message"`
}

type meResponse struct {
	ID               int32    `json:"id"`
	Email            string   `json:"email"`
	Name             string   `json:"name"`
	MosCode          string   `json:"mos_code"`
	Rank             string   `json:"rank"`
	YearsOfService   int32    `json:"years_of_service"`
	SeparationDate   string   `json:"separation_date"`
	Location         string   `json:"location"`
	PreferredSectors []string `json:"preferred_sectors"`
	ProfileComplete  bool     `json:"profile_complete"`
	JourneyStep      string   `json:"journey_step"`
}

// POST /auth/magic-link
// Sends a magic link email to the veteran
func (h *AuthHandler) SendMagicLink(w http.ResponseWriter, r *http.Request) {
	var req sendMagicLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid email is required"})
		return
	}

	ctx := r.Context()

	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		slog.Error("failed to generate token", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Store the token
	expiresAt := pgtype.Timestamptz{Time: time.Now().Add(tokenExpiry), Valid: true}
	_, err := h.queries.CreateMagicToken(ctx, sqlc.CreateMagicTokenParams{
		Email:     email,
		Token:     token,
		UserType:  "veteran",
		ExpiresAt: expiresAt,
	})
	if err != nil {
		slog.Error("failed to create magic token", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Build the magic link URL
	magicLink := fmt.Sprintf("%s/auth/verify?token=%s", h.cfg.BaseURL, token)

	// Send the email (in dev mode, return the link directly)
	if h.cfg.DevMode {
		slog.Info("magic link generated (dev mode)", "email", email, "link", magicLink)
		writeJSON(w, http.StatusOK, map[string]string{
			"message":  "Dev mode: use the link below to sign in.",
			"dev_link": magicLink,
		})
		return
	}

	if err := h.sendEmail(email, magicLink); err != nil {
		slog.Error("failed to send magic link email", "email", email, "err", err)
		// Still return success — don't reveal if email sending failed
	}

	writeJSON(w, http.StatusOK, authResponse{
		Message: "If that email is in our system, you'll receive a magic link shortly. Check your inbox.",
	})
}

// GET /auth/verify?token=xxx
// Verifies the magic link token and creates a session
func (h *AuthHandler) VerifyToken(w http.ResponseWriter, r *http.Request) {
	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token is required"})
		return
	}

	ctx := r.Context()

	// Look up the token
	magicToken, err := h.queries.GetMagicToken(ctx, token)
	if err != nil {
		slog.Warn("invalid or expired magic token", "err", err)
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired link"})
		return
	}

	// Mark token as used
	if err := h.queries.MarkTokenUsed(ctx, magicToken.ID); err != nil {
		slog.Error("failed to mark token used", "err", err)
	}

	// Find or create the veteran
	vet, err := h.queries.GetVeteranByEmail(ctx, magicToken.Email)
	if err != nil {
		// New veteran — create one
		created, createErr := h.queries.CreateVeteranByEmail(ctx, magicToken.Email)
		if createErr != nil {
			// Race condition: another request created the veteran. Try fetching again.
			vet, err = h.queries.GetVeteranByEmail(ctx, magicToken.Email)
			if err != nil {
				slog.Error("failed to find or create veteran", "email", magicToken.Email, "err", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
				return
			}
		} else {
			vet = sqlc.GetVeteranByEmailRow{
				ID: created.ID, Email: created.Email, Name: created.Name,
				MosCode: created.MosCode, Rank: created.Rank, YearsOfService: created.YearsOfService,
				SeparationDate: created.SeparationDate, Location: created.Location,
				PreferredSectors: created.PreferredSectors, JourneyStep: created.JourneyStep,
				CreatedAt: created.CreatedAt, UpdatedAt: created.UpdatedAt,
			}
		}
	}

	// Create session
	sessionID, err := generateSessionID()
	if err != nil {
		slog.Error("failed to generate session ID", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	sessExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(sessionExpiry), Valid: true}
	_, err = h.queries.CreateSession(ctx, sqlc.CreateSessionParams{
		ID:        sessionID,
		UserType:  "veteran",
		UserID:    vet.ID,
		ExpiresAt: sessExpiresAt,
	})
	if err != nil {
		slog.Error("failed to create session", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionExpiry.Seconds()),
		Secure:   !h.cfg.DevMode,
	})

	// Redirect to dashboard
	http.Redirect(w, r, "/dashboard", http.StatusFound)
}

// GET /api/auth/me
// Returns the current authenticated veteran's profile
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "veteran" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as veteran"})
		return
	}

	vet, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	mosCode := ""
	if vet.MosCode.Valid {
		mosCode = vet.MosCode.String
	}

	sepDate := ""
	if vet.SeparationDate.Valid {
		sepDate = vet.SeparationDate.Time.Format("2006-01-02")
	}

	profileComplete := vet.Name != "" && mosCode != ""

	writeJSON(w, http.StatusOK, meResponse{
		ID:               vet.ID,
		Email:            vet.Email,
		Name:             vet.Name,
		MosCode:          mosCode,
		Rank:             vet.Rank,
		YearsOfService:   vet.YearsOfService,
		SeparationDate:   sepDate,
		Location:         vet.Location,
		PreferredSectors: vet.PreferredSectors,
		ProfileComplete:  profileComplete,
		JourneyStep:      vet.JourneyStep,
	})
}

// POST /api/auth/logout
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(sessionCookieName)
	if err == nil {
		_ = h.queries.DeleteSession(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		MaxAge:   -1,
	})

	writeJSON(w, http.StatusOK, authResponse{Message: "logged out"})
}

// POST /api/dev/login — dev-only login endpoint
func (h *AuthHandler) DevLogin(w http.ResponseWriter, r *http.Request) {
	var req sendMagicLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	ctx := r.Context()

	// Find or create veteran
	vet, err := h.queries.GetVeteranByEmail(ctx, email)
	if err != nil {
		created, createErr := h.queries.CreateVeteranByEmail(ctx, email)
		if createErr != nil {
			vet, err = h.queries.GetVeteranByEmail(ctx, email)
			if err != nil {
				slog.Error("dev login: failed to find or create veteran", "err", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
				return
			}
		} else {
			vet = sqlc.GetVeteranByEmailRow{
				ID: created.ID, Email: created.Email, Name: created.Name,
				MosCode: created.MosCode, Rank: created.Rank, YearsOfService: created.YearsOfService,
				SeparationDate: created.SeparationDate, Location: created.Location,
				PreferredSectors: created.PreferredSectors, JourneyStep: created.JourneyStep,
				CreatedAt: created.CreatedAt, UpdatedAt: created.UpdatedAt,
			}
		}
	}

	// Create session — same mechanism as real auth
	sessionID, err := generateSessionID()
	if err != nil {
		slog.Error("dev login: failed to generate session ID", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	sessExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(sessionExpiry), Valid: true}
	_, err = h.queries.CreateSession(ctx, sqlc.CreateSessionParams{
		ID:        sessionID,
		UserType:  "veteran",
		UserID:    vet.ID,
		ExpiresAt: sessExpiresAt,
	})
	if err != nil {
		slog.Error("dev login: failed to create session", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionExpiry.Seconds()),
		Secure:   false, // always false in dev
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "logged in",
		"veteran": meResponse{
			ID:               vet.ID,
			Email:            vet.Email,
			Name:             vet.Name,
			MosCode:          vet.MosCode.String,
			Rank:             vet.Rank,
			YearsOfService:   vet.YearsOfService,
			PreferredSectors: vet.PreferredSectors,
			ProfileComplete:  vet.Name != "",
			JourneyStep:      vet.JourneyStep,
		},
	})
}

func (h *AuthHandler) sendEmail(to, magicLink string) error {
	from := h.cfg.SMTPFrom
	if from == "" {
		from = h.cfg.SMTPUser
	}

	subject := "Your Second Mission Login Link"
	body := fmt.Sprintf(`Hello,

Click the link below to sign in to Second Mission:

%s

This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.

— Second Mission Team`, magicLink)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, subject, body)

	auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPassword, h.cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%s", h.cfg.SMTPHost, h.cfg.SMTPPort)

	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

func generateSessionID() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}
