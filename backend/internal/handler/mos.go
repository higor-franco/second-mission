package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

type MOSHandler struct {
	queries *sqlc.Queries
}

func NewMOSHandler(queries *sqlc.Queries) *MOSHandler {
	return &MOSHandler{queries: queries}
}

type TranslateResponse struct {
	MOS   sqlc.MosCode         `json:"mos"`
	Roles []TranslatedRole     `json:"roles"`
}

type TranslatedRole struct {
	OnetCode           string   `json:"onet_code"`
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	Sector             string   `json:"sector"`
	SalaryMin          int32    `json:"salary_min"`
	SalaryMax          int32    `json:"salary_max"`
	MatchScore         int32    `json:"match_score"`
	TransferableSkills []string `json:"transferable_skills"`
}

// GET /api/translate?mos=88M
func (h *MOSHandler) Translate(w http.ResponseWriter, r *http.Request) {
	mosCode := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("mos")))
	if mosCode == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "mos parameter is required"})
		return
	}

	ctx := r.Context()

	// Get MOS info
	mos, err := h.queries.GetMOSCode(ctx, mosCode)
	if err != nil {
		slog.Warn("MOS code not found", "code", mosCode, "err", err)
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "MOS code not found"})
		return
	}

	// Get translated roles
	rows, err := h.queries.TranslateMOS(ctx, mosCode)
	if err != nil {
		slog.Error("failed to translate MOS", "code", mosCode, "err", err)
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

	writeJSON(w, http.StatusOK, TranslateResponse{
		MOS:   mos,
		Roles: roles,
	})
}

// GET /api/mos-codes
func (h *MOSHandler) ListMOSCodes(w http.ResponseWriter, r *http.Request) {
	codes, err := h.queries.ListMOSCodes(r.Context())
	if err != nil {
		slog.Error("failed to list MOS codes", "err", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
		return
	}

	writeJSON(w, http.StatusOK, codes)
}

func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		slog.Error("failed to encode JSON response", "err", err)
	}
}
