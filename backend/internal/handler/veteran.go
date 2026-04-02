package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
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

	veteran, err := h.queries.UpdateVeteranProfile(r.Context(), sqlc.UpdateVeteranProfileParams{
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

	mc := ""
	if veteran.MosCode.Valid {
		mc = veteran.MosCode.String
	}
	sd := ""
	if veteran.SeparationDate.Valid {
		sd = veteran.SeparationDate.Time.Format("2006-01-02")
	}

	writeJSON(w, http.StatusOK, meResponse{
		ID:               veteran.ID,
		Email:            veteran.Email,
		Name:             veteran.Name,
		MosCode:          mc,
		Rank:             veteran.Rank,
		YearsOfService:   veteran.YearsOfService,
		SeparationDate:   sd,
		Location:         veteran.Location,
		PreferredSectors: veteran.PreferredSectors,
		ProfileComplete:  veteran.Name != "" && mc != "",
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

	veteran, err := h.queries.GetVeteranByID(r.Context(), session.UserID)
	if err != nil {
		slog.Error("failed to get veteran", "id", session.UserID, "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	if !veteran.MosCode.Valid || veteran.MosCode.String == "" {
		writeJSON(w, http.StatusOK, map[string]any{
			"roles":   []TranslatedRole{},
			"message": "Set your MOS code in your profile to see matched roles.",
		})
		return
	}

	rows, err := h.queries.TranslateMOS(r.Context(), veteran.MosCode.String)
	if err != nil {
		slog.Error("failed to translate MOS for veteran", "mos", veteran.MosCode.String, "err", err)
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
