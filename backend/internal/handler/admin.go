package handler

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgtype"
	"golang.org/x/crypto/bcrypt"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

type AdminHandler struct {
	queries *sqlc.Queries
	cfg     config.Config
}

func NewAdminHandler(queries *sqlc.Queries, cfg config.Config) *AdminHandler {
	return &AdminHandler{queries: queries, cfg: cfg}
}

// --- Response types ---

type adminMeResponse struct {
	ID    int32  `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
}

type platformStatsResponse struct {
	TotalVeterans     int64 `json:"total_veterans"`
	TotalEmployers    int64 `json:"total_employers"`
	ActiveListings    int64 `json:"active_listings"`
	TotalApplications int64 `json:"total_applications"`
	TotalPlacements   int64 `json:"total_placements"`
}

type veteranListItem struct {
	ID             int32    `json:"id"`
	Email          string   `json:"email"`
	Name           string   `json:"name"`
	MosCode        string   `json:"mos_code"`
	Rank           string   `json:"rank"`
	YearsOfService int32    `json:"years_of_service"`
	SeparationDate string   `json:"separation_date"`
	Location       string   `json:"location"`
	JourneyStep    string   `json:"journey_step"`
	Sectors        []string `json:"preferred_sectors"`
	CreatedAt      string   `json:"created_at"`
}

type employerListItem struct {
	ID          int32  `json:"id"`
	Email       string `json:"email"`
	CompanyName string `json:"company_name"`
	ContactName string `json:"contact_name"`
	Sector      string `json:"sector"`
	Location    string `json:"location"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at"`
}

type activityLogItem struct {
	ID        int64  `json:"id"`
	UserType  string `json:"user_type"`
	UserID    int32  `json:"user_id"`
	SessionID string `json:"session_id"`
	Action    string `json:"action"`
	Details   any    `json:"details"`
	IPAddress string `json:"ip_address"`
	CreatedAt string `json:"created_at"`
}

type sessionSummary struct {
	SessionID    string `json:"session_id"`
	SessionStart string `json:"session_start"`
	SessionEnd   string `json:"session_end"`
	ActionCount  int64  `json:"action_count"`
}

type applicationListItem struct {
	ID           int32  `json:"id"`
	Status       string `json:"status"`
	MatchScore   int32  `json:"match_score"`
	CreatedAt    string `json:"created_at"`
	VeteranID    int32  `json:"veteran_id"`
	VeteranName  string `json:"veteran_name"`
	VeteranEmail string `json:"veteran_email"`
	MosCode      string `json:"mos_code"`
	JobListingID int32  `json:"job_listing_id"`
	JobTitle     string `json:"job_title"`
	CompanyName  string `json:"company_name"`
}

type jobListingListItem struct {
	ID             int32  `json:"id"`
	Title          string `json:"title"`
	Location       string `json:"location"`
	SalaryMin      int32  `json:"salary_min"`
	SalaryMax      int32  `json:"salary_max"`
	EmploymentType string `json:"employment_type"`
	WotcEligible   bool   `json:"wotc_eligible"`
	IsActive       bool   `json:"is_active"`
	PostedAt       string `json:"posted_at"`
	CompanyName    string `json:"company_name"`
	RoleTitle      string `json:"role_title"`
	Sector         string `json:"sector"`
}

// --- Auth ---

type adminLoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// POST /api/admin/login
func (h *AdminHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req adminLoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "email is required"})
		return
	}
	if req.Password == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password is required"})
		return
	}

	admin, err := h.queries.GetAdminByEmail(r.Context(), email)
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.PasswordHash), []byte(req.Password)); err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid email or password"})
		return
	}

	// Create session
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		slog.Error("admin login: failed to generate session ID", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	sessionID := hex.EncodeToString(b)

	sessExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(sessionExpiry), Valid: true}
	_, err = h.queries.CreateSession(r.Context(), sqlc.CreateSessionParams{
		ID:        sessionID,
		UserType:  "admin",
		UserID:    admin.ID,
		ExpiresAt: sessExpiresAt,
	})
	if err != nil {
		slog.Error("admin login: failed to create session", "err", err)
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
		Secure:   !h.cfg.DevMode,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "logged in",
		"admin":   adminMeResponse{ID: admin.ID, Email: admin.Email, Name: admin.Name},
	})
}

// GET /api/admin/me
func (h *AdminHandler) Me(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	admin, err := h.queries.GetAdminByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("admin me: failed to get admin", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, adminMeResponse{
		ID:    admin.ID,
		Email: admin.Email,
		Name:  admin.Name,
	})
}

// GET /api/admin/stats
func (h *AdminHandler) Stats(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	stats, err := h.queries.CountPlatformStats(r.Context())
	if err != nil {
		slog.Error("admin stats: failed to get stats", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, platformStatsResponse{
		TotalVeterans:     stats.TotalVeterans,
		TotalEmployers:    stats.TotalEmployers,
		ActiveListings:    stats.ActiveListings,
		TotalApplications: stats.TotalApplications,
		TotalPlacements:   stats.TotalPlacements,
	})
}

// GET /api/admin/veterans
func (h *AdminHandler) ListVeterans(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	veterans, err := h.queries.ListAllVeterans(r.Context())
	if err != nil {
		slog.Error("admin: failed to list veterans", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	items := make([]veteranListItem, 0, len(veterans))
	for _, v := range veterans {
		mosCode := ""
		if v.MosCode.Valid {
			mosCode = v.MosCode.String
		}
		sepDate := ""
		if v.SeparationDate.Valid {
			sepDate = v.SeparationDate.Time.Format("2006-01-02")
		}
		createdAt := ""
		if v.CreatedAt.Valid {
			createdAt = v.CreatedAt.Time.Format(time.RFC3339)
		}
		items = append(items, veteranListItem{
			ID:             v.ID,
			Email:          v.Email,
			Name:           v.Name,
			MosCode:        mosCode,
			Rank:           v.Rank,
			YearsOfService: v.YearsOfService,
			SeparationDate: sepDate,
			Location:       v.Location,
			JourneyStep:    v.JourneyStep,
			Sectors:        v.PreferredSectors,
			CreatedAt:      createdAt,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

// GET /api/admin/employers
func (h *AdminHandler) ListEmployers(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	employers, err := h.queries.ListAllEmployers(r.Context())
	if err != nil {
		slog.Error("admin: failed to list employers", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	items := make([]employerListItem, 0, len(employers))
	for _, e := range employers {
		createdAt := ""
		if e.CreatedAt.Valid {
			createdAt = e.CreatedAt.Time.Format(time.RFC3339)
		}
		items = append(items, employerListItem{
			ID:          e.ID,
			Email:       e.Email,
			CompanyName: e.CompanyName,
			ContactName: e.ContactName,
			Sector:      e.Sector,
			Location:    e.Location,
			IsActive:    e.IsActive,
			CreatedAt:   createdAt,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

// GET /api/admin/listings
func (h *AdminHandler) ListJobListings(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	listings, err := h.queries.ListAllJobListings(r.Context())
	if err != nil {
		slog.Error("admin: failed to list job listings", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	items := make([]jobListingListItem, 0, len(listings))
	for _, l := range listings {
		postedAt := ""
		if l.PostedAt.Valid {
			postedAt = l.PostedAt.Time.Format(time.RFC3339)
		}
		items = append(items, jobListingListItem{
			ID:             l.ID,
			Title:          l.Title,
			Location:       l.Location,
			SalaryMin:      l.SalaryMin,
			SalaryMax:      l.SalaryMax,
			EmploymentType: l.EmploymentType,
			WotcEligible:   l.WotcEligible,
			IsActive:       l.IsActive,
			PostedAt:       postedAt,
			CompanyName:    l.CompanyName,
			RoleTitle:      l.RoleTitle,
			Sector:         l.Sector,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

// GET /api/admin/applications
func (h *AdminHandler) ListApplications(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	apps, err := h.queries.ListAllApplications(r.Context())
	if err != nil {
		slog.Error("admin: failed to list applications", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	items := make([]applicationListItem, 0, len(apps))
	for _, a := range apps {
		createdAt := ""
		if a.CreatedAt.Valid {
			createdAt = a.CreatedAt.Time.Format(time.RFC3339)
		}
		mosCode := ""
		if a.MosCode.Valid {
			mosCode = a.MosCode.String
		}
		items = append(items, applicationListItem{
			ID:           a.ID,
			Status:       a.Status,
			MatchScore:   a.MatchScore,
			CreatedAt:    createdAt,
			VeteranID:    a.VeteranID,
			VeteranName:  a.VeteranName,
			VeteranEmail: a.VeteranEmail,
			MosCode:      mosCode,
			JobListingID: a.JobListingID,
			JobTitle:     a.JobTitle,
			CompanyName:  a.CompanyName,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

// GET /api/admin/activity?user_type=veteran&user_id=1&sessions=10
func (h *AdminHandler) ActivityLogs(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	userType := r.URL.Query().Get("user_type")
	userIDStr := r.URL.Query().Get("user_id")
	sessionsStr := r.URL.Query().Get("sessions")

	if userType == "" || userIDStr == "" {
		// Return recent activity across all users
		logs, err := h.queries.GetRecentActivityLogs(r.Context(), 200)
		if err != nil {
			slog.Error("admin: failed to get recent activity", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
		writeJSON(w, http.StatusOK, toActivityLogItems(logs))
		return
	}

	if userType != "veteran" && userType != "employer" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_type must be veteran or employer"})
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user_id"})
		return
	}

	sessionCount := int32(10)
	if sessionsStr != "" {
		n, err := strconv.Atoi(sessionsStr)
		if err == nil && n > 0 && n <= 50 {
			sessionCount = int32(n)
		}
	}

	logs, err := h.queries.GetActivityLogsForUserSessions(r.Context(), sqlc.GetActivityLogsForUserSessionsParams{
		UserType: userType,
		UserID:   int32(userID),
		Limit:    sessionCount,
	})
	if err != nil {
		slog.Error("admin: failed to get user activity logs", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, toActivityLogItems(logs))
}

// GET /api/admin/sessions?user_type=veteran&user_id=1&limit=10
func (h *AdminHandler) UserSessions(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "admin" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as admin"})
		return
	}

	userType := r.URL.Query().Get("user_type")
	userIDStr := r.URL.Query().Get("user_id")

	if userType == "" || userIDStr == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "user_type and user_id are required"})
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil || userID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid user_id"})
		return
	}

	limitStr := r.URL.Query().Get("limit")
	limit := int32(10)
	if limitStr != "" {
		n, err := strconv.Atoi(limitStr)
		if err == nil && n > 0 && n <= 50 {
			limit = int32(n)
		}
	}

	sessions, err := h.queries.GetDistinctSessionsForUser(r.Context(), sqlc.GetDistinctSessionsForUserParams{
		UserType: userType,
		UserID:   int32(userID),
		Limit:    limit,
	})
	if err != nil {
		slog.Error("admin: failed to get user sessions", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	items := make([]sessionSummary, 0, len(sessions))
	for _, s := range sessions {
		sid := ""
		if s.SessionID.Valid {
			sid = s.SessionID.String
		}
		start := ""
		if t, ok := s.SessionStart.(time.Time); ok {
			start = t.Format(time.RFC3339)
		}
		end := ""
		if t, ok := s.SessionEnd.(time.Time); ok {
			end = t.Format(time.RFC3339)
		}
		items = append(items, sessionSummary{
			SessionID:    sid,
			SessionStart: start,
			SessionEnd:   end,
			ActionCount:  s.ActionCount,
		})
	}

	writeJSON(w, http.StatusOK, items)
}

// POST /api/dev/admin-login — dev-only admin login endpoint
func (h *AdminHandler) DevLogin(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	email := strings.ToLower(strings.TrimSpace(req.Email))
	if email == "" {
		email = "admin@secondmission.com"
	}

	admin, err := h.queries.GetAdminByEmail(r.Context(), email)
	if err != nil {
		// Create a dev admin on the fly
		hash, _ := bcrypt.GenerateFromPassword([]byte("admin123"), bcrypt.DefaultCost)
		admin, err = h.queries.CreateAdmin(r.Context(), sqlc.CreateAdminParams{
			Email:        email,
			PasswordHash: string(hash),
			Name:         "Dev Admin",
		})
		if err != nil {
			slog.Error("dev admin login: failed to create admin", "err", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
			return
		}
	}

	// Create session
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		slog.Error("dev admin login: failed to generate session ID", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}
	sessionID := hex.EncodeToString(b)

	sessExpiresAt := pgtype.Timestamptz{Time: time.Now().Add(sessionExpiry), Valid: true}
	_, err = h.queries.CreateSession(r.Context(), sqlc.CreateSessionParams{
		ID:        sessionID,
		UserType:  "admin",
		UserID:    admin.ID,
		ExpiresAt: sessExpiresAt,
	})
	if err != nil {
		slog.Error("dev admin login: failed to create session", "err", err)
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
		Secure:   false,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "logged in",
		"admin":   adminMeResponse{ID: admin.ID, Email: admin.Email, Name: admin.Name},
	})
}

func toActivityLogItems(logs []sqlc.ActivityLog) []activityLogItem {
	items := make([]activityLogItem, 0, len(logs))
	for _, l := range logs {
		sid := ""
		if l.SessionID.Valid {
			sid = l.SessionID.String
		}
		ip := ""
		if l.IpAddress.Valid {
			ip = l.IpAddress.String
		}
		createdAt := ""
		if l.CreatedAt.Valid {
			createdAt = l.CreatedAt.Time.Format(time.RFC3339)
		}

		var details any
		if len(l.Details) > 0 {
			_ = json.Unmarshal(l.Details, &details)
		}
		if details == nil {
			details = map[string]any{}
		}

		items = append(items, activityLogItem{
			ID:        l.ID,
			UserType:  l.UserType,
			UserID:    l.UserID,
			SessionID: sid,
			Action:    l.Action,
			Details:   details,
			IPAddress: ip,
			CreatedAt: createdAt,
		})
	}
	return items
}
