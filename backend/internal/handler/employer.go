package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/smtp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

type EmployerHandler struct {
	queries *sqlc.Queries
	cfg     config.Config
}

func NewEmployerHandler(queries *sqlc.Queries, cfg config.Config) *EmployerHandler {
	return &EmployerHandler{queries: queries, cfg: cfg}
}

// --- Response types ---

type employerMeResponse struct {
	ID          int32  `json:"id"`
	Email       string `json:"email"`
	CompanyName string `json:"company_name"`
	ContactName string `json:"contact_name"`
	Sector      string `json:"sector"`
	Location    string `json:"location"`
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
	LinkedinURL string `json:"linkedin_url"`
	CompanySize string `json:"company_size"`
	FoundedYear int32  `json:"founded_year"`
	IsActive    bool   `json:"is_active"`
}

// publicEmployerResponse is the veteran-facing view of an employer. Omits
// password hash, account email, and updated_at — veterans only need what
// helps them decide whether to apply.
type publicEmployerResponse struct {
	ID          int32  `json:"id"`
	CompanyName string `json:"company_name"`
	Sector      string `json:"sector"`
	Location    string `json:"location"`
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
	LinkedinURL string `json:"linkedin_url"`
	CompanySize string `json:"company_size"`
	FoundedYear int32  `json:"founded_year"`
	IsActive    bool   `json:"is_active"`
}

type jobListingResponse struct {
	ID                int32    `json:"id"`
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	Requirements      []string `json:"requirements"`
	Location          string   `json:"location"`
	SalaryMin         int32    `json:"salary_min"`
	SalaryMax         int32    `json:"salary_max"`
	EmploymentType    string   `json:"employment_type"`
	WotcEligible      bool     `json:"wotc_eligible"`
	IsActive          bool     `json:"is_active"`
	PostedAt          string   `json:"posted_at"`
	Tasks             []string `json:"tasks"`
	Benefits          []string `json:"benefits"`
	MosCodesPreferred []string `json:"mos_codes_preferred"`
	OnetCode          string   `json:"onet_code"`
	RoleTitle         string   `json:"role_title"`
	Sector            string   `json:"sector"`
	CivilianRoleID    int32    `json:"civilian_role_id,omitempty"`
}

type candidateResponse struct {
	ApplicationID   int32  `json:"application_id"`
	Status          string `json:"status"`
	MatchScore      int32  `json:"match_score"`
	AppliedAt       string `json:"applied_at"`
	VeteranID       int32  `json:"veteran_id"`
	Name            string `json:"name"`
	MosCode         string `json:"mos_code"`
	Rank            string `json:"rank"`
	YearsOfService  int32  `json:"years_of_service"`
	SeparationDate  string `json:"separation_date"`
	VeteranLocation string `json:"veteran_location"`
	JobListingID    int32  `json:"job_listing_id"`
	JobTitle        string `json:"job_title"`
	Sector          string `json:"sector"`
}

// --- Registration ---

type registerEmployerRequest struct {
	Email       string `json:"email"`
	Password    string `json:"password"`
	CompanyName string `json:"company_name"`
	ContactName string `json:"contact_name"`
	Sector      string `json:"sector"`
	Location    string `json:"location"`
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
	LinkedinURL string `json:"linkedin_url"`
	CompanySize string `json:"company_size"`
	FoundedYear int32  `json:"founded_year"`
}

// POST /api/employer/register
func (h *EmployerHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerEmployerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" || !strings.Contains(email, "@") {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "valid email is required"})
		return
	}
	if req.Password == "" || len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}
	if req.CompanyName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "company_name is required"})
		return
	}

	// Check if employer already exists
	_, err := h.queries.GetEmployerByEmail(r.Context(), email)
	if err == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "an account with this email already exists"})
		return
	}

	// Hash password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash password", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	employer, err := h.queries.CreateEmployer(r.Context(), sqlc.CreateEmployerParams{
		Email:        email,
		CompanyName:  req.CompanyName,
		ContactName:  req.ContactName,
		Sector:       req.Sector,
		Location:     req.Location,
		Description:  req.Description,
		WebsiteUrl:   strings.TrimSpace(req.WebsiteURL),
		LinkedinUrl:  strings.TrimSpace(req.LinkedinURL),
		CompanySize:  strings.TrimSpace(req.CompanySize),
		FoundedYear:  clampFoundedYear(req.FoundedYear),
		PasswordHash: string(hash),
	})
	if err != nil {
		slog.Error("failed to create employer", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Create session
	sessionID, err := h.createEmployerSession(r, w, employer.ID)
	if err != nil {
		slog.Error("failed to create session after registration", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	_ = sessionID

	// Log activity
	LogActivity(h.queries, r, "employer", employer.ID, "register", map[string]any{
		"company_name": employer.CompanyName,
	})

	writeJSON(w, http.StatusCreated, map[string]any{
		"message":  "registration successful",
		"employer": toEmployerMeResponseFromCreate(employer),
	})
}

// --- Login ---

type loginEmployerRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/employer/login
func (h *EmployerHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginEmployerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}

	employer, err := h.queries.GetEmployerByEmail(r.Context(), email)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(employer.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	_, err = h.createEmployerSession(r, w, employer.ID)
	if err != nil {
		slog.Error("failed to create session", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Log activity
	LogActivity(h.queries, r, "employer", employer.ID, "login", map[string]any{"method": "password"})

	writeJSON(w, http.StatusOK, map[string]any{
		"message":  "logged in",
		"employer": toEmployerMeResponseFromGetByEmail(employer),
	})
}

// POST /api/dev/employer-login — dev-only login endpoint for employers
func (h *EmployerHandler) DevLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
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

	// Find or create employer
	employer, err := h.queries.GetEmployerByEmail(ctx, email)
	if err != nil {
		// Create a new employer for dev testing
		hash, _ := bcrypt.GenerateFromPassword([]byte("devpassword"), bcrypt.DefaultCost)
		created, createErr := h.queries.CreateEmployer(ctx, sqlc.CreateEmployerParams{
			Email:        email,
			CompanyName:  "Dev Company",
			ContactName:  "Dev User",
			Sector:       "Technology",
			Location:     "Houston, TX",
			Description:  "Development test employer",
			PasswordHash: string(hash),
		})
		if createErr != nil {
			employer, err = h.queries.GetEmployerByEmail(ctx, email)
			if err != nil {
				slog.Error("dev employer login: failed to find or create employer", "err", err)
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
				return
			}
		} else {
			employer = sqlc.GetEmployerByEmailRow{
				ID:          created.ID,
				Email:       created.Email,
				CompanyName: created.CompanyName,
				ContactName: created.ContactName,
				Sector:      created.Sector,
				Location:    created.Location,
				Description: created.Description,
				WebsiteUrl:  created.WebsiteUrl,
				LinkedinUrl: created.LinkedinUrl,
				CompanySize: created.CompanySize,
				FoundedYear: created.FoundedYear,
				IsActive:    created.IsActive,
			}
		}
	}

	_, err = h.createEmployerSession(r, w, employer.ID)
	if err != nil {
		slog.Error("dev employer login: failed to create session", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":  "logged in",
		"employer": toEmployerMeResponseFromGetByEmail(employer),
	})
}

// --- Forgot / Reset Password ---

type forgotPasswordRequest struct {
	Email string `json:"email"`
}

// POST /api/employer/forgot-password
func (h *EmployerHandler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	var req forgotPasswordRequest
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

	// Always return success to prevent email enumeration
	successMsg := "If that email is registered, you'll receive a password reset link shortly. Check your inbox."

	// Check if employer exists
	_, err := h.queries.GetEmployerByEmail(ctx, email)
	if err != nil {
		// Employer not found — return success anyway (no enumeration)
		writeJSON(w, http.StatusOK, map[string]string{"message": successMsg})
		return
	}

	// Generate random token
	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		slog.Error("failed to generate reset token", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	token := hex.EncodeToString(tokenBytes)

	// Store the token (reuse magic_tokens table with user_type = 'employer')
	expiresAt := pgtype.Timestamptz{Time: time.Now().Add(tokenExpiry), Valid: true}
	_, err = h.queries.CreateMagicToken(ctx, sqlc.CreateMagicTokenParams{
		Email:     email,
		Token:     token,
		UserType:  "employer",
		ExpiresAt: expiresAt,
	})
	if err != nil {
		slog.Error("failed to create reset token", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	resetLink := fmt.Sprintf("%s/employer/reset-password?token=%s", h.cfg.BaseURL, token)

	if h.cfg.DevMode {
		slog.Info("password reset link generated (dev mode)", "email", email, "link", resetLink)
		writeJSON(w, http.StatusOK, map[string]string{
			"message":  "Dev mode: use the link below to reset your password.",
			"dev_link": resetLink,
		})
		return
	}

	if err := h.sendResetEmail(email, resetLink); err != nil {
		slog.Error("failed to send reset email", "email", email, "err", err)
		// Still return success — don't reveal if email sending failed
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": successMsg})
}

type resetPasswordRequest struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// POST /api/employer/reset-password
func (h *EmployerHandler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	var req resetPasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	token := strings.TrimSpace(req.Token)
	if token == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "token is required"})
		return
	}
	if req.Password == "" || len(req.Password) < 8 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password must be at least 8 characters"})
		return
	}

	ctx := r.Context()

	// Look up the token
	magicToken, err := h.queries.GetMagicToken(ctx, token)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired reset link"})
		return
	}

	// Ensure it's an employer token
	if magicToken.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid or expired reset link"})
		return
	}

	// Mark token as used
	if err := h.queries.MarkTokenUsed(ctx, magicToken.ID); err != nil {
		slog.Error("failed to mark reset token used", "err", err)
	}

	// Find the employer
	employer, err := h.queries.GetEmployerByEmail(ctx, magicToken.Email)
	if err != nil {
		slog.Error("employer not found for reset token", "email", magicToken.Email, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Hash new password
	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		slog.Error("failed to hash new password", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Update the password
	if err := h.queries.UpdateEmployerPassword(ctx, sqlc.UpdateEmployerPasswordParams{
		ID:           employer.ID,
		PasswordHash: string(hash),
	}); err != nil {
		slog.Error("failed to update employer password", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	slog.Info("employer password reset successfully", "email", magicToken.Email)
	writeJSON(w, http.StatusOK, map[string]string{"message": "Password reset successfully. You can now sign in with your new password."})
}

func (h *EmployerHandler) sendResetEmail(to, resetLink string) error {
	from := h.cfg.SMTPFrom
	if from == "" {
		from = h.cfg.SMTPUser
	}

	subject := "Reset Your Second Mission Password"
	body := fmt.Sprintf(`Hello,

You requested a password reset for your Second Mission employer account.

Click the link below to set a new password:

%s

This link expires in 15 minutes. If you didn't request this, you can safely ignore this email — your password will remain unchanged.

— Second Mission Team`, resetLink)

	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		from, to, subject, body)

	auth := smtp.PlainAuth("", h.cfg.SMTPUser, h.cfg.SMTPPassword, h.cfg.SMTPHost)
	addr := fmt.Sprintf("%s:%s", h.cfg.SMTPHost, h.cfg.SMTPPort)

	return smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
}

// --- Profile ---

// GET /api/employer/me
func (h *EmployerHandler) Me(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	employer, err := h.queries.GetEmployerByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get employer", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, toEmployerMeResponseFromGetByID(employer))
}

type updateEmployerProfileRequest struct {
	CompanyName string `json:"company_name"`
	ContactName string `json:"contact_name"`
	Sector      string `json:"sector"`
	Location    string `json:"location"`
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
	LinkedinURL string `json:"linkedin_url"`
	CompanySize string `json:"company_size"`
	FoundedYear int32  `json:"founded_year"`
}

// PUT /api/employer/profile
func (h *EmployerHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	var req updateEmployerProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.CompanyName == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "company_name is required"})
		return
	}

	employer, err := h.queries.UpdateEmployerProfile(r.Context(), sqlc.UpdateEmployerProfileParams{
		ID:          session.UserID,
		CompanyName: req.CompanyName,
		ContactName: req.ContactName,
		Sector:      req.Sector,
		Location:    req.Location,
		Description: req.Description,
		WebsiteUrl:  strings.TrimSpace(req.WebsiteURL),
		LinkedinUrl: strings.TrimSpace(req.LinkedinURL),
		CompanySize: strings.TrimSpace(req.CompanySize),
		FoundedYear: clampFoundedYear(req.FoundedYear),
	})
	if err != nil {
		slog.Error("failed to update employer profile", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, toEmployerMeResponseFromUpdate(employer))
}

// --- Public company profile (veteran-facing) ---

// publicCompanyJobListing is the trimmed listing shape the company profile
// page renders. We reuse existing pieces where possible (role_title, sector,
// salary bands) but drop employer-only fields like expires_at / is_active
// because the query already filters to active roles.
type publicCompanyJobListing struct {
	ID                int32    `json:"id"`
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	Requirements      []string `json:"requirements"`
	Location          string   `json:"location"`
	SalaryMin         int32    `json:"salary_min"`
	SalaryMax         int32    `json:"salary_max"`
	EmploymentType    string   `json:"employment_type"`
	WotcEligible      bool     `json:"wotc_eligible"`
	PostedAt          string   `json:"posted_at"`
	Tasks             []string `json:"tasks"`
	Benefits          []string `json:"benefits"`
	MosCodesPreferred []string `json:"mos_codes_preferred"`
	OnetCode          string   `json:"onet_code"`
	RoleTitle         string   `json:"role_title"`
	Sector            string   `json:"sector"`
}

// GET /api/veteran/employers/{id}
// Returns the public company profile plus the employer's active roles.
// Session-gated: only signed-in veterans can browse employer profiles.
// This is the destination when a veteran clicks a company name on the
// Opportunities or My Pipeline pages.
func (h *EmployerHandler) PublicCompanyProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "veteran" {
		// Deliberately veteran-only. Employers viewing another company's
		// profile is out of scope for v1 — the feature ships to close the
		// information gap the candidate side has.
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "sign in as a veteran to view company profiles"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid employer id"})
		return
	}

	row, err := h.queries.GetPublicEmployerByID(r.Context(), int32(id))
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "company not found"})
		return
	}

	// Don't expose deactivated companies to veterans. This is a soft
	// delete-ish mechanism — an admin could flip is_active to hide a
	// company while preserving the row. 404 keeps the surface consistent
	// with a non-existent id.
	if !row.IsActive {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "company not found"})
		return
	}

	employerID := pgtype.Int4{Int32: int32(id), Valid: true}
	listingRows, err := h.queries.ListActiveJobListingsForEmployer(r.Context(), employerID)
	if err != nil {
		slog.Error("failed to list active listings for public company profile", "employer_id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	listings := make([]publicCompanyJobListing, len(listingRows))
	for i, row := range listingRows {
		listings[i] = publicCompanyJobListing{
			ID:                row.ID,
			Title:             row.Title,
			Description:       row.Description,
			Requirements:      nullableSlice(row.Requirements),
			Location:          row.Location,
			SalaryMin:         row.SalaryMin,
			SalaryMax:         row.SalaryMax,
			EmploymentType:    row.EmploymentType,
			WotcEligible:      row.WotcEligible,
			PostedAt:          formatTimestamptz(row.PostedAt),
			Tasks:             nullableSlice(row.Tasks),
			Benefits:          nullableSlice(row.Benefits),
			MosCodesPreferred: nullableSlice(row.MosCodesPreferred),
			OnetCode:          row.OnetCode,
			RoleTitle:         row.RoleTitle,
			Sector:            row.Sector,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"employer": publicEmployerResponse{
			ID:          row.ID,
			CompanyName: row.CompanyName,
			Sector:      row.Sector,
			Location:    row.Location,
			Description: row.Description,
			WebsiteURL:  row.WebsiteUrl,
			LinkedinURL: row.LinkedinUrl,
			CompanySize: row.CompanySize,
			FoundedYear: row.FoundedYear,
			IsActive:    row.IsActive,
		},
		"listings": listings,
	})
}

// --- Dashboard ---

// GET /api/employer/dashboard
func (h *EmployerHandler) Dashboard(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}

	stats, err := h.queries.GetEmployerDashboardStats(r.Context(), employerID)
	if err != nil {
		slog.Error("failed to get dashboard stats", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	candidateCount, err := h.queries.CountCandidatesForEmployer(r.Context(), employerID)
	if err != nil {
		slog.Error("failed to count candidates", "err", err)
		candidateCount = 0
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"active_listings":   stats.ActiveListings,
		"inactive_listings": stats.InactiveListings,
		"total_listings":    stats.TotalListings,
		"total_candidates":  candidateCount,
	})
}

// --- Job Listings CRUD ---

// GET /api/employer/listings
func (h *EmployerHandler) ListJobListings(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	rows, err := h.queries.ListEmployerJobListings(r.Context(), employerID)
	if err != nil {
		slog.Error("failed to list employer job listings", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	listings := make([]jobListingResponse, len(rows))
	for i, row := range rows {
		listings[i] = jobListingResponse{
			ID:                row.ID,
			Title:             row.Title,
			Description:       row.Description,
			Requirements:      nullableSlice(row.Requirements),
			Location:          row.Location,
			SalaryMin:         row.SalaryMin,
			SalaryMax:         row.SalaryMax,
			EmploymentType:    row.EmploymentType,
			WotcEligible:      row.WotcEligible,
			IsActive:          row.IsActive,
			PostedAt:          formatTimestamptz(row.PostedAt),
			Tasks:             nullableSlice(row.Tasks),
			Benefits:          nullableSlice(row.Benefits),
			MosCodesPreferred: nullableSlice(row.MosCodesPreferred),
			OnetCode:          row.OnetCode,
			RoleTitle:         row.RoleTitle,
			Sector:            row.Sector,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"listings": listings})
}

// GET /api/employer/listings/{id}
func (h *EmployerHandler) GetJobListing(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid listing id"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	row, err := h.queries.GetEmployerJobListing(r.Context(), sqlc.GetEmployerJobListingParams{
		ID:         int32(id),
		EmployerID: employerID,
	})
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "listing not found"})
		return
	}

	writeJSON(w, http.StatusOK, jobListingResponse{
		ID:                row.ID,
		Title:             row.Title,
		Description:       row.Description,
		Requirements:      nullableSlice(row.Requirements),
		Location:          row.Location,
		SalaryMin:         row.SalaryMin,
		SalaryMax:         row.SalaryMax,
		EmploymentType:    row.EmploymentType,
		WotcEligible:      row.WotcEligible,
		IsActive:          row.IsActive,
		PostedAt:          formatTimestamptz(row.PostedAt),
		Tasks:             nullableSlice(row.Tasks),
		Benefits:          nullableSlice(row.Benefits),
		MosCodesPreferred: nullableSlice(row.MosCodesPreferred),
		OnetCode:          row.OnetCode,
		RoleTitle:         row.RoleTitle,
		Sector:            row.Sector,
		CivilianRoleID:    row.CivilianRoleID,
	})
}

// GET /api/employer/listings/{id}/candidates
// Returns the listing and every candidate who has at least expressed
// interest (status != 'matched') so the detail page can render both the
// listing summary and the hiring funnel in a single request.
func (h *EmployerHandler) GetJobListingWithCandidates(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid listing id"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}

	// First fetch the listing so we can 404 cleanly when the id either
	// doesn't exist or belongs to a different employer.
	listingRow, err := h.queries.GetEmployerJobListing(r.Context(), sqlc.GetEmployerJobListingParams{
		ID:         int32(id),
		EmployerID: employerID,
	})
	if err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "listing not found"})
		return
	}

	rows, err := h.queries.ListCandidatesForListing(r.Context(), sqlc.ListCandidatesForListingParams{
		ID:         int32(id),
		EmployerID: employerID,
	})
	if err != nil {
		slog.Error("failed to list candidates for listing", "listing_id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	type listingCandidate struct {
		ApplicationID   int32  `json:"application_id"`
		Status          string `json:"status"`
		MatchScore      int32  `json:"match_score"`
		AppliedAt       string `json:"applied_at"`
		UpdatedAt       string `json:"updated_at"`
		VeteranID       int32  `json:"veteran_id"`
		Name            string `json:"name"`
		MosCode         string `json:"mos_code"`
		Rank            string `json:"rank"`
		YearsOfService  int32  `json:"years_of_service"`
		SeparationDate  string `json:"separation_date"`
		VeteranLocation string `json:"veteran_location"`
		JourneyStep     string `json:"journey_step"`
	}

	candidates := make([]listingCandidate, len(rows))
	for i, row := range rows {
		mosCode := ""
		if row.MosCode.Valid {
			mosCode = row.MosCode.String
		}
		sepDate := ""
		if row.SeparationDate.Valid {
			sepDate = row.SeparationDate.Time.Format("2006-01-02")
		}
		candidates[i] = listingCandidate{
			ApplicationID:   row.ApplicationID,
			Status:          row.Status,
			MatchScore:      row.MatchScore,
			AppliedAt:       formatTimestamptz(row.AppliedAt),
			UpdatedAt:       formatTimestamptz(row.UpdatedAt),
			VeteranID:       row.VeteranID,
			Name:            row.Name,
			MosCode:         mosCode,
			Rank:            row.Rank,
			YearsOfService:  row.YearsOfService,
			SeparationDate:  sepDate,
			VeteranLocation: row.VeteranLocation,
			JourneyStep:     row.JourneyStep,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"listing": jobListingResponse{
			ID:                listingRow.ID,
			Title:             listingRow.Title,
			Description:       listingRow.Description,
			Requirements:      nullableSlice(listingRow.Requirements),
			Location:          listingRow.Location,
			SalaryMin:         listingRow.SalaryMin,
			SalaryMax:         listingRow.SalaryMax,
			EmploymentType:    listingRow.EmploymentType,
			WotcEligible:      listingRow.WotcEligible,
			IsActive:          listingRow.IsActive,
			PostedAt:          formatTimestamptz(listingRow.PostedAt),
			Tasks:             nullableSlice(listingRow.Tasks),
			Benefits:          nullableSlice(listingRow.Benefits),
			MosCodesPreferred: nullableSlice(listingRow.MosCodesPreferred),
			OnetCode:          listingRow.OnetCode,
			RoleTitle:         listingRow.RoleTitle,
			Sector:            listingRow.Sector,
			CivilianRoleID:    listingRow.CivilianRoleID,
		},
		"candidates": candidates,
	})
}

type createJobListingRequest struct {
	CivilianRoleID    int32    `json:"civilian_role_id"`
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	Requirements      []string `json:"requirements"`
	Location          string   `json:"location"`
	SalaryMin         int32    `json:"salary_min"`
	SalaryMax         int32    `json:"salary_max"`
	EmploymentType    string   `json:"employment_type"`
	WotcEligible      bool     `json:"wotc_eligible"`
	Tasks             []string `json:"tasks"`
	Benefits          []string `json:"benefits"`
	MosCodesPreferred []string `json:"mos_codes_preferred"`
}

// POST /api/employer/listings
func (h *EmployerHandler) CreateJobListing(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	var req createJobListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}
	if req.CivilianRoleID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "civilian_role_id is required"})
		return
	}

	validTypes := map[string]bool{"full-time": true, "part-time": true, "contract": true, "internship": true}
	if req.EmploymentType == "" {
		req.EmploymentType = "full-time"
	}
	if !validTypes[req.EmploymentType] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid employment_type"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	listing, err := h.queries.CreateJobListing(r.Context(), sqlc.CreateJobListingParams{
		EmployerID:        employerID,
		CivilianRoleID:    req.CivilianRoleID,
		Title:             req.Title,
		Description:       req.Description,
		Requirements:      nullableSlice(req.Requirements),
		Location:          req.Location,
		SalaryMin:         req.SalaryMin,
		SalaryMax:         req.SalaryMax,
		EmploymentType:    req.EmploymentType,
		WotcEligible:      req.WotcEligible,
		Tasks:             nullableSlice(req.Tasks),
		Benefits:          nullableSlice(req.Benefits),
		MosCodesPreferred: nullableSlice(req.MosCodesPreferred),
	})
	if err != nil {
		slog.Error("failed to create job listing", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Log activity
	LogActivity(h.queries, r, "employer", session.UserID, "create_listing", map[string]any{
		"listing_id": listing.ID, "title": listing.Title,
	})

	writeJSON(w, http.StatusCreated, map[string]any{
		"message": "listing created",
		"listing": map[string]any{
			"id":        listing.ID,
			"title":     listing.Title,
			"is_active": listing.IsActive,
		},
	})
}

type updateJobListingRequest struct {
	Title             string   `json:"title"`
	Description       string   `json:"description"`
	Requirements      []string `json:"requirements"`
	Location          string   `json:"location"`
	SalaryMin         int32    `json:"salary_min"`
	SalaryMax         int32    `json:"salary_max"`
	EmploymentType    string   `json:"employment_type"`
	WotcEligible      bool     `json:"wotc_eligible"`
	Tasks             []string `json:"tasks"`
	Benefits          []string `json:"benefits"`
	MosCodesPreferred []string `json:"mos_codes_preferred"`
	IsActive          bool     `json:"is_active"`
}

// PUT /api/employer/listings/{id}
func (h *EmployerHandler) UpdateJobListing(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid listing id"})
		return
	}

	var req updateJobListingRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Title == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "title is required"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	listing, err := h.queries.UpdateJobListing(r.Context(), sqlc.UpdateJobListingParams{
		ID:                int32(id),
		EmployerID:        employerID,
		Title:             req.Title,
		Description:       req.Description,
		Requirements:      nullableSlice(req.Requirements),
		Location:          req.Location,
		SalaryMin:         req.SalaryMin,
		SalaryMax:         req.SalaryMax,
		EmploymentType:    req.EmploymentType,
		WotcEligible:      req.WotcEligible,
		Tasks:             nullableSlice(req.Tasks),
		Benefits:          nullableSlice(req.Benefits),
		MosCodesPreferred: nullableSlice(req.MosCodesPreferred),
		IsActive:          req.IsActive,
	})
	if err != nil {
		slog.Error("failed to update job listing", "id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "listing updated",
		"listing": map[string]any{
			"id":        listing.ID,
			"title":     listing.Title,
			"is_active": listing.IsActive,
		},
	})
}

// POST /api/employer/listings/{id}/toggle
func (h *EmployerHandler) ToggleJobListing(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid listing id"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	listing, err := h.queries.ToggleJobListingActive(r.Context(), sqlc.ToggleJobListingActiveParams{
		ID:         int32(id),
		EmployerID: employerID,
	})
	if err != nil {
		slog.Error("failed to toggle listing", "id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"message":   fmt.Sprintf("listing %s", boolToStatus(listing.IsActive)),
		"is_active": listing.IsActive,
	})
}

// DELETE /api/employer/listings/{id}
func (h *EmployerHandler) DeleteJobListing(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid listing id"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	if err := h.queries.DeleteJobListing(r.Context(), sqlc.DeleteJobListingParams{
		ID:         int32(id),
		EmployerID: employerID,
	}); err != nil {
		slog.Error("failed to delete listing", "id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"message": "listing deleted"})
}

// --- Candidates ---

// GET /api/employer/candidates
func (h *EmployerHandler) ListCandidates(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	rows, err := h.queries.ListCandidatesForEmployer(r.Context(), employerID)
	if err != nil {
		slog.Error("failed to list candidates", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	candidates := make([]candidateResponse, len(rows))
	for i, row := range rows {
		mosCode := ""
		if row.MosCode.Valid {
			mosCode = row.MosCode.String
		}
		sepDate := ""
		if row.SeparationDate.Valid {
			sepDate = row.SeparationDate.Time.Format("2006-01-02")
		}
		candidates[i] = candidateResponse{
			ApplicationID:   row.ApplicationID,
			Status:          row.Status,
			MatchScore:      row.MatchScore,
			AppliedAt:       formatTimestamptz(row.AppliedAt),
			VeteranID:       row.VeteranID,
			Name:            row.Name,
			MosCode:         mosCode,
			Rank:            row.Rank,
			YearsOfService:  row.YearsOfService,
			SeparationDate:  sepDate,
			VeteranLocation: row.VeteranLocation,
			JobListingID:    row.JobListingID,
			JobTitle:        row.JobTitle,
			Sector:          row.Sector,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"candidates": candidates})
}

type updateCandidateStatusRequest struct {
	Status string `json:"status"`
}

// PUT /api/employer/candidates/{id}/status
func (h *EmployerHandler) UpdateCandidateStatus(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid candidate application id"})
		return
	}

	var req updateCandidateStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	// The funnel extends the pipeline with two new stages between
	// interviewing and placed: proposal_sent (offer extended) and
	// contract_signed (signed, awaiting start).
	validStatuses := map[string]bool{
		"interested":      true,
		"introduced":      true,
		"interviewing":    true,
		"proposal_sent":   true,
		"contract_signed": true,
		"placed":          true,
	}
	if !validStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}

	employerID := pgtype.Int4{Int32: session.UserID, Valid: true}
	app, err := h.queries.UpdateCandidateStatus(r.Context(), sqlc.UpdateCandidateStatusParams{
		ID:         int32(id),
		EmployerID: employerID,
		Status:     req.Status,
	})
	if err != nil {
		slog.Error("failed to update candidate status", "id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Log activity
	LogActivity(h.queries, r, "employer", session.UserID, "update_candidate_status", map[string]any{
		"application_id": id, "new_status": req.Status,
	})

	writeJSON(w, http.StatusOK, app)
}

// --- Civilian Roles (public) ---

// GET /api/civilian-roles
func (h *EmployerHandler) ListCivilianRoles(w http.ResponseWriter, r *http.Request) {
	roles, err := h.queries.ListCivilianRoles(r.Context())
	if err != nil {
		slog.Error("failed to list civilian roles", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
}

// --- Helpers ---

func (h *EmployerHandler) createEmployerSession(r *http.Request, w http.ResponseWriter, employerID int32) (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	sessionID := hex.EncodeToString(b)

	sessExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(sessionExpiry), Valid: true}
	_, err := h.queries.CreateSession(r.Context(), sqlc.CreateSessionParams{
		ID:        sessionID,
		UserType:  "employer",
		UserID:    employerID,
		ExpiresAt: sessExpiresAt,
	})
	if err != nil {
		return "", err
	}

	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    sessionID,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionExpiry.Seconds()),
		Secure:   !h.cfg.DevMode,
	})

	return sessionID, nil
}

// toEmployerMeResponseFromGetByEmail builds the employer "me" payload from
// the row returned by GetEmployerByEmail. Kept per-row-type because sqlc
// emits distinct Go structs for each SELECT; a single generic helper would
// force an interface or reflection, which is worse than four tiny adapters.
func toEmployerMeResponseFromGetByEmail(e sqlc.GetEmployerByEmailRow) employerMeResponse {
	return employerMeResponse{
		ID:          e.ID,
		Email:       e.Email,
		CompanyName: e.CompanyName,
		ContactName: e.ContactName,
		Sector:      e.Sector,
		Location:    e.Location,
		Description: e.Description,
		WebsiteURL:  e.WebsiteUrl,
		LinkedinURL: e.LinkedinUrl,
		CompanySize: e.CompanySize,
		FoundedYear: e.FoundedYear,
		IsActive:    e.IsActive,
	}
}

func toEmployerMeResponseFromGetByID(e sqlc.GetEmployerByIDRow) employerMeResponse {
	return employerMeResponse{
		ID:          e.ID,
		Email:       e.Email,
		CompanyName: e.CompanyName,
		ContactName: e.ContactName,
		Sector:      e.Sector,
		Location:    e.Location,
		Description: e.Description,
		WebsiteURL:  e.WebsiteUrl,
		LinkedinURL: e.LinkedinUrl,
		CompanySize: e.CompanySize,
		FoundedYear: e.FoundedYear,
		IsActive:    e.IsActive,
	}
}

func toEmployerMeResponseFromCreate(e sqlc.CreateEmployerRow) employerMeResponse {
	return employerMeResponse{
		ID:          e.ID,
		Email:       e.Email,
		CompanyName: e.CompanyName,
		ContactName: e.ContactName,
		Sector:      e.Sector,
		Location:    e.Location,
		Description: e.Description,
		WebsiteURL:  e.WebsiteUrl,
		LinkedinURL: e.LinkedinUrl,
		CompanySize: e.CompanySize,
		FoundedYear: e.FoundedYear,
		IsActive:    e.IsActive,
	}
}

func toEmployerMeResponseFromUpdate(e sqlc.UpdateEmployerProfileRow) employerMeResponse {
	return employerMeResponse{
		ID:          e.ID,
		Email:       e.Email,
		CompanyName: e.CompanyName,
		ContactName: e.ContactName,
		Sector:      e.Sector,
		Location:    e.Location,
		Description: e.Description,
		WebsiteURL:  e.WebsiteUrl,
		LinkedinURL: e.LinkedinUrl,
		CompanySize: e.CompanySize,
		FoundedYear: e.FoundedYear,
		IsActive:    e.IsActive,
	}
}

// clampFoundedYear rejects obvious junk so we don't store "-3" or "99999".
// 0 stays 0 (meaning "unknown"); anything outside a plausible founding-year
// range resolves back to 0 so the UI can hide it.
func clampFoundedYear(y int32) int32 {
	if y < 1600 || y > 2100 {
		return 0
	}
	return y
}

func nullableSlice(s []string) []string {
	if s == nil {
		return []string{}
	}
	return s
}

func formatTimestamptz(t pgtype.Timestamptz) string {
	if !t.Valid {
		return ""
	}
	return t.Time.Format(time.RFC3339)
}

func boolToStatus(active bool) string {
	if active {
		return "activated"
	}
	return "deactivated"
}
