package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
	"github.com/higor-franco/second-mission/backend/internal/matcher"
)

type VeteranHandler struct {
	queries *sqlc.Queries
}

func NewVeteranHandler(queries *sqlc.Queries) *VeteranHandler {
	return &VeteranHandler{queries: queries}
}

type updateProfileRequest struct {
	Name             string   `json:"name"`
	MosCode          string   `json:"mos_code"`
	Rank             string   `json:"rank"`
	YearsOfService   int32    `json:"years_of_service"`
	SeparationDate   string   `json:"separation_date"`
	Location         string   `json:"location"`
	PreferredSectors []string `json:"preferred_sectors"`
}

// PUT /api/veteran/profile
func (h *VeteranHandler) UpdateProfile(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	var req updateProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	mosCode := pgtype.Text{}
	if req.MosCode != "" {
		mosCode = pgtype.Text{String: req.MosCode, Valid: true}
	}

	sepDate := pgtype.Date{}
	if req.SeparationDate != "" {
		t, err := time.Parse("2006-01-02", req.SeparationDate)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid separation_date format, use YYYY-MM-DD"})
			return
		}
		sepDate = pgtype.Date{Time: t, Valid: true}
	}

	sectors := req.PreferredSectors
	if sectors == nil {
		sectors = []string{}
	}

	vet, err := h.queries.UpdateVeteranProfile(r.Context(), sqlc.UpdateVeteranProfileParams{
		ID:               session.UserID,
		Name:             req.Name,
		MosCode:          mosCode,
		Rank:             req.Rank,
		YearsOfService:   req.YearsOfService,
		SeparationDate:   sepDate,
		Location:         req.Location,
		PreferredSectors: sectors,
	})
	if err != nil {
		slog.Error("failed to update veteran profile", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Auto-advance journey step when MOS is set
	if mosCode.Valid && vet.JourneyStep == "discover" {
		updated, stepErr := h.queries.UpdateVeteranJourneyStep(r.Context(), sqlc.UpdateVeteranJourneyStepParams{
			ID:          session.UserID,
			JourneyStep: "translate",
		})
		if stepErr == nil {
			vet.JourneyStep = updated.JourneyStep
		}

		// Auto-create matched applications for the veteran
		_ = h.queries.EnsureMatchedApplications(r.Context(), sqlc.EnsureMatchedApplicationsParams{
			VeteranID: session.UserID,
			MosCode:   req.MosCode,
		})
	}

	mc := ""
	if vet.MosCode.Valid {
		mc = vet.MosCode.String
	}
	sd := ""
	if vet.SeparationDate.Valid {
		sd = vet.SeparationDate.Time.Format("2006-01-02")
	}

	// Log activity
	LogActivity(h.queries, r, "veteran", session.UserID, "update_profile", map[string]any{
		"mos_code": mc, "location": req.Location,
	})

	writeJSON(w, http.StatusOK, meResponse{
		ID:               vet.ID,
		Email:            vet.Email,
		Name:             vet.Name,
		MosCode:          mc,
		Rank:             vet.Rank,
		YearsOfService:   vet.YearsOfService,
		SeparationDate:   sd,
		Location:         vet.Location,
		PreferredSectors: vet.PreferredSectors,
		ProfileComplete:  vet.Name != "" && mc != "",
		JourneyStep:      vet.JourneyStep,
	})
}

// GET /api/veteran/matches
// Returns the civilian role matches for the authenticated veteran's MOS code
func (h *VeteranHandler) Matches(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	vet, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if !vet.MosCode.Valid || vet.MosCode.String == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"roles":   []TranslatedRole{},
			"message": "Set your MOS code in your profile to see matched roles.",
		})
		return
	}

	rows, err := h.queries.TranslateMOS(r.Context(), vet.MosCode.String)
	if err != nil {
		slog.Error("failed to translate MOS for veteran", "mos", vet.MosCode.String, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	roles := make([]TranslatedRole, len(rows))
	for i, row := range rows {
		roles[i] = TranslatedRole{
			OnetCode:           row.OnetCode,
			Title:              row.Title,
			Description:        row.Description,
			Sector:             row.Sector,
			SalaryMin:          row.AvgSalaryMin,
			SalaryMax:          row.AvgSalaryMax,
			MatchScore:         row.MatchScore,
			TransferableSkills: row.TransferableSkills,
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"roles": roles})
}

// --- Opportunities & Applications ---

type opportunityResponse struct {
	ID                 int32                  `json:"id"`
	Title              string                 `json:"title"`
	Description        string                 `json:"description"`
	Requirements       []string               `json:"requirements"`
	Location           string                 `json:"location"`
	SalaryMin          int32                  `json:"salary_min"`
	SalaryMax          int32                  `json:"salary_max"`
	EmploymentType     string                 `json:"employment_type"`
	WotcEligible       bool                   `json:"wotc_eligible"`
	Sector             string                 `json:"sector"`
	RoleTitle          string                 `json:"role_title"`
	CompanyName        string                 `json:"company_name"`
	CompanyLocation    string                 `json:"company_location"`
	MatchScore         int32                  `json:"match_score"`
	TransferableSkills []string               `json:"transferable_skills"`
	ScoreBreakdown     *matcher.ScoreBreakdown `json:"score_breakdown,omitempty"`
}

type applicationResponse struct {
	ID             int32                  `json:"id"`
	Status         string                 `json:"status"`
	MatchScore     int32                  `json:"match_score"`
	MatchDetails   *matcher.ScoreBreakdown `json:"match_details,omitempty"`
	Notes          string                 `json:"notes"`
	JobListingID   int32                  `json:"job_listing_id"`
	Title          string                 `json:"title"`
	Description    string                 `json:"description"`
	Location       string                 `json:"location"`
	SalaryMin      int32                  `json:"salary_min"`
	SalaryMax      int32                  `json:"salary_max"`
	EmploymentType string                 `json:"employment_type"`
	WotcEligible   bool                   `json:"wotc_eligible"`
	Sector         string                 `json:"sector"`
	RoleTitle      string                 `json:"role_title"`
	CompanyName    string                 `json:"company_name"`
}

// GET /api/veteran/opportunities
// Returns matched job listings for the veteran based on their MOS
func (h *VeteranHandler) Opportunities(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	vet, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if !vet.MosCode.Valid || vet.MosCode.String == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"opportunities": []opportunityResponse{},
			"message":       "Set your MOS code in your profile to see job opportunities.",
		})
		return
	}

	// Ensure matched applications exist
	_ = h.queries.EnsureMatchedApplications(r.Context(), sqlc.EnsureMatchedApplicationsParams{
		VeteranID: session.UserID,
		MosCode:   vet.MosCode.String,
	})

	rows, err := h.queries.ListMatchedJobListings(r.Context(), vet.MosCode.String)
	if err != nil {
		slog.Error("failed to list matched job listings", "mos", vet.MosCode.String, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Build veteran profile for hybrid matching
	vetProfile := matcher.VeteranProfile{
		MOSCode:          vet.MosCode.String,
		PreferredSectors: vet.PreferredSectors,
		Location:         vet.Location,
		YearsOfService:   vet.YearsOfService,
	}

	opps := make([]opportunityResponse, len(rows))
	for i, row := range rows {
		cn := ""
		if row.CompanyName.Valid {
			cn = row.CompanyName.String
		}
		cl := ""
		if row.CompanyLocation.Valid {
			cl = row.CompanyLocation.String
		}

		// Compute hybrid score
		listing := matcher.JobListing{
			ID:                 row.ID,
			Title:              row.Title,
			Sector:             row.Sector,
			Location:           row.Location,
			Requirements:       row.Requirements,
			Tasks:              row.Tasks,
			MOSCodesPreferred:  row.MosCodesPreferred,
			TransferableSkills: row.TransferableSkills,
			MOSBaseScore:       row.MatchScore,
		}
		breakdown := matcher.ComputeScore(vetProfile, listing)

		opps[i] = opportunityResponse{
			ID:                 row.ID,
			Title:              row.Title,
			Description:        row.Description,
			Requirements:       row.Requirements,
			Location:           row.Location,
			SalaryMin:          row.SalaryMin,
			SalaryMax:          row.SalaryMax,
			EmploymentType:     row.EmploymentType,
			WotcEligible:       row.WotcEligible,
			Sector:             row.Sector,
			RoleTitle:          row.RoleTitle,
			CompanyName:        cn,
			CompanyLocation:    cl,
			MatchScore:         int32(breakdown.HybridScore),
			TransferableSkills: row.TransferableSkills,
			ScoreBreakdown:     &breakdown,
		}
	}

	// Sort by hybrid score descending
	sort.Slice(opps, func(i, j int) bool {
		return opps[i].MatchScore > opps[j].MatchScore
	})

	// Auto-advance journey to "match" if they have opportunities
	journeyStep := vet.JourneyStep
	if len(opps) > 0 && (vet.JourneyStep == "discover" || vet.JourneyStep == "translate") {
		updated, stepErr := h.queries.UpdateVeteranJourneyStep(r.Context(), sqlc.UpdateVeteranJourneyStepParams{
			ID:          session.UserID,
			JourneyStep: "match",
		})
		if stepErr == nil {
			journeyStep = updated.JourneyStep
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{"opportunities": opps, "journey_step": journeyStep})
}

// GET /api/veteran/applications
// Returns the veteran's tracked applications with status
func (h *VeteranHandler) Applications(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	rows, err := h.queries.GetVeteranApplications(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran applications", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	apps := make([]applicationResponse, len(rows))
	for i, row := range rows {
		cn := ""
		if row.CompanyName.Valid {
			cn = row.CompanyName.String
		}

		var details *matcher.ScoreBreakdown
		if len(row.MatchDetails) > 0 {
			var bd matcher.ScoreBreakdown
			if json.Unmarshal(row.MatchDetails, &bd) == nil {
				details = &bd
			}
		}

		apps[i] = applicationResponse{
			ID:             row.ID,
			Status:         row.Status,
			MatchScore:     row.MatchScore,
			MatchDetails:   details,
			Notes:          row.Notes,
			JobListingID:   row.JobListingID,
			Title:          row.Title,
			Description:    row.Description,
			Location:       row.Location,
			SalaryMin:      row.SalaryMin,
			SalaryMax:      row.SalaryMax,
			EmploymentType: row.EmploymentType,
			WotcEligible:   row.WotcEligible,
			Sector:         row.Sector,
			RoleTitle:      row.RoleTitle,
			CompanyName:    cn,
		}
	}

	// Get counts by status for the summary
	counts, err := h.queries.CountVeteranApplicationsByStatus(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to count applications", "err", err)
	}
	statusCounts := map[string]int64{}
	for _, c := range counts {
		statusCounts[c.Status] = c.Count
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"applications":  apps,
		"status_counts": statusCounts,
	})
}

type expressInterestRequest struct {
	JobListingID int32 `json:"job_listing_id"`
}

// POST /api/veteran/applications
// Express interest in a job listing
func (h *VeteranHandler) ExpressInterest(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	var req expressInterestRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	if req.JobListingID == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "job_listing_id is required"})
		return
	}

	// Get the job listing to find its match score
	vet, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Find the match score using hybrid matching
	var matchScore int32
	var breakdown *matcher.ScoreBreakdown
	if vet.MosCode.Valid {
		listings, listErr := h.queries.ListMatchedJobListings(r.Context(), vet.MosCode.String)
		if listErr == nil {
			vetProfile := matcher.VeteranProfile{
				MOSCode:          vet.MosCode.String,
				PreferredSectors: vet.PreferredSectors,
				Location:         vet.Location,
				YearsOfService:   vet.YearsOfService,
			}
			for _, l := range listings {
				if l.ID == req.JobListingID {
					listing := matcher.JobListing{
						ID:                 l.ID,
						Title:              l.Title,
						Sector:             l.Sector,
						Location:           l.Location,
						Requirements:       l.Requirements,
						Tasks:              l.Tasks,
						MOSCodesPreferred:  l.MosCodesPreferred,
						TransferableSkills: l.TransferableSkills,
						MOSBaseScore:       l.MatchScore,
					}
					bd := matcher.ComputeScore(vetProfile, listing)
					breakdown = &bd
					matchScore = int32(bd.HybridScore)
					break
				}
			}
		}
	}

	app, err := h.queries.CreateOrGetApplication(r.Context(), sqlc.CreateOrGetApplicationParams{
		VeteranID:    session.UserID,
		JobListingID: req.JobListingID,
		Status:       "interested",
		MatchScore:   matchScore,
	})

	// Store the match details if we computed them
	if err == nil && breakdown != nil {
		detailsJSON, jsonErr := json.Marshal(breakdown)
		if jsonErr == nil {
			_ = h.queries.UpdateApplicationMatchDetails(r.Context(), sqlc.UpdateApplicationMatchDetailsParams{
				ID:           app.ID,
				MatchScore:   matchScore,
				MatchDetails: detailsJSON,
			})
		}
	}
	if err != nil {
		slog.Error("failed to create application", "veteran_id", session.UserID, "job_id", req.JobListingID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	// Advance journey to "place" when they express interest
	journeyStep := vet.JourneyStep
	if vet.JourneyStep != "place" {
		updated, stepErr := h.queries.UpdateVeteranJourneyStep(r.Context(), sqlc.UpdateVeteranJourneyStepParams{
			ID:          session.UserID,
			JourneyStep: "place",
		})
		if stepErr == nil {
			journeyStep = updated.JourneyStep
		}
	}

	// Log activity
	LogActivity(h.queries, r, "veteran", session.UserID, "express_interest", map[string]any{
		"job_listing_id": req.JobListingID, "match_score": matchScore,
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"application":  app,
		"journey_step": journeyStep,
	})
}

// PUT /api/veteran/applications/{id}
// Update application status (for demo/testing purposes)
func (h *VeteranHandler) UpdateApplicationStatus(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid application id"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	validStatuses := map[string]bool{
		"matched": true, "interested": true, "introduced": true, "interviewing": true, "placed": true,
	}
	if !validStatuses[req.Status] {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid status"})
		return
	}

	app, err := h.queries.UpdateApplicationStatus(r.Context(), sqlc.UpdateApplicationStatusParams{
		ID:        int32(id),
		VeteranID: session.UserID,
		Status:    req.Status,
	})
	if err != nil {
		slog.Error("failed to update application status", "id", id, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, app)
}

// GET /api/veteran/journey
// Returns the veteran's current journey step and stats
func (h *VeteranHandler) Journey(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}

	vet, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	counts, _ := h.queries.CountVeteranApplicationsByStatus(r.Context(), session.UserID)
	statusCounts := map[string]int64{}
	var totalApps int64
	for _, c := range counts {
		statusCounts[c.Status] = c.Count
		totalApps += c.Count
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"journey_step":  vet.JourneyStep,
		"has_mos":       vet.MosCode.Valid && vet.MosCode.String != "",
		"has_profile":   vet.Name != "",
		"total_matches": totalApps,
		"status_counts": statusCounts,
	})
}
