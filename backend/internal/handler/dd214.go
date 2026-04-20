package handler

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"sort"
	"strings"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
	"github.com/higor-franco/second-mission/backend/internal/dd214"
)

// Max size for an uploaded DD-214. 10 MB is generous — real DD-214s are almost
// always under 2 MB. We enforce this before reading the body into memory to
// avoid OOM on hostile uploads.
const dd214MaxUploadBytes = 10 * 1024 * 1024

// Maximum number of civilian role matches returned to the UI.
const dd214MaxRoleResults = 20

// Extractor is the minimum surface area of dd214.Extractor the handler
// needs. Accepting an interface keeps the handler testable without a live
// Anthropic API key.
type Extractor interface {
	Extract(ctx context.Context, pdf []byte) (*dd214.ExtractedProfile, error)
}

// DD214Handler processes DD Form 214 PDF uploads.
//
// The handler is stateless: it reads the PDF into memory, sends it to the
// Anthropic API for extraction, aggregates civilian role matches across
// every MOS code on the form, and returns the combined result. The PDF is
// never persisted and is released for GC as soon as extraction completes.
type DD214Handler struct {
	queries   *sqlc.Queries
	extractor Extractor
}

// NewDD214Handler constructs a handler. If ext is nil the endpoint returns
// 503 — callers should register the route only when the Anthropic API key
// is configured.
func NewDD214Handler(queries *sqlc.Queries, ext Extractor) *DD214Handler {
	return &DD214Handler{
		queries:   queries,
		extractor: ext,
	}
}

// dd214Response is what the frontend consumes. The Profile carries the
// full extraction result so the UI can show the user what was read off the
// form; MOSList describes which codes we recognized in our crosswalk; and
// Roles is the aggregated civilian role match list.
type dd214Response struct {
	Profile dd214.ExtractedProfile `json:"profile"`
	MOSList []mosInfo              `json:"mos_list"`
	Roles   []dd214Role            `json:"roles"`
}

type mosInfo struct {
	Code        string `json:"code"`
	Title       string `json:"title"`
	Branch      string `json:"branch"`
	Description string `json:"description"`
	Primary     bool   `json:"primary"`
	Found       bool   `json:"found"` // whether the MOS is in our crosswalk
}

type dd214Role struct {
	OnetCode           string   `json:"onet_code"`
	Title              string   `json:"title"`
	Description        string   `json:"description"`
	Sector             string   `json:"sector"`
	SalaryMin          int32    `json:"salary_min"`
	SalaryMax          int32    `json:"salary_max"`
	MatchScore         int32    `json:"match_score"`
	TransferableSkills []string `json:"transferable_skills"`
	// BestMOS is the MOS code that produced the highest match for this role.
	BestMOS string `json:"best_mos"`
}

// Translate handles POST /api/dd214/translate.
//
// Accepts multipart/form-data with a single "file" field containing the
// DD-214 PDF. Returns the extracted profile and an aggregated list of
// civilian role matches across every MOS found on the form.
func (h *DD214Handler) Translate(w http.ResponseWriter, r *http.Request) {
	if h.extractor == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "DD-214 extraction is not configured on this server",
		})
		return
	}

	// Enforce a hard ceiling on body size before parsing multipart.
	r.Body = http.MaxBytesReader(w, r.Body, dd214MaxUploadBytes)
	if err := r.ParseMultipartForm(dd214MaxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "file is too large or not a valid multipart upload (max 10 MB)",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "file field is required",
		})
		return
	}
	defer file.Close()

	if !isLikelyPDF(header.Filename, header.Header.Get("Content-Type")) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "only PDF uploads are supported",
		})
		return
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		slog.Error("dd214: failed to read uploaded file", "err", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "could not read uploaded file",
		})
		return
	}

	profile, err := h.extractor.Extract(r.Context(), pdfBytes)
	if err != nil {
		slog.Error("dd214: extraction failed", "err", err, "size", len(pdfBytes))
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "we couldn't read your DD-214. Please try a clearer scan or use the manual MOS entry.",
		})
		return
	}
	// Drop the PDF as soon as we can.
	pdfBytes = nil

	mosList, roles := h.aggregateMatches(r, profile)

	writeJSON(w, http.StatusOK, dd214Response{
		Profile: *profile,
		MOSList: mosList,
		Roles:   roles,
	})
}

// ImportResponse is what the authenticated import endpoint returns.
// It mirrors the structure of the public translate response but adds
// profile_suggestion — a convenience mapping of extracted fields onto
// the shape the /profile form expects. The frontend uses this to
// pre-fill inputs without having to translate field names itself.
type importResponse struct {
	Profile           dd214.ExtractedProfile `json:"profile"`
	MOSList           []mosInfo              `json:"mos_list"`
	Roles             []dd214Role            `json:"roles"`
	ProfileSuggestion profileSuggestion      `json:"profile_suggestion"`
}

// profileSuggestion is the shape of the /api/veteran/profile PUT body,
// populated from the extracted DD-214. Fields the form has but the
// DD-214 doesn't carry (location, preferred_sectors) are left blank for
// the veteran to fill in.
type profileSuggestion struct {
	Name             string   `json:"name"`
	MosCode          string   `json:"mos_code"`
	Rank             string   `json:"rank"`
	YearsOfService   int32    `json:"years_of_service"`
	SeparationDate   string   `json:"separation_date"`
	Location         string   `json:"location"`
	PreferredSectors []string `json:"preferred_sectors"`
}

// Import handles POST /api/veteran/dd214/import.
//
// Authenticated variant of Translate: accepts the same multipart PDF,
// runs the same extractor, but additionally returns a `profile_suggestion`
// block shaped like the /api/veteran/profile PUT body so the frontend
// can pre-fill the profile form in one step. Every successful import is
// recorded in activity_logs for admin observability. The PDF is still
// processed in memory and never persisted.
func (h *DD214Handler) Import(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
		return
	}
	// This endpoint is veteran-only. Employers and admins have their own flows.
	if session.UserType != "veteran" {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "veterans only"})
		return
	}

	if h.extractor == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "DD-214 extraction is not configured on this server",
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, dd214MaxUploadBytes)
	if err := r.ParseMultipartForm(dd214MaxUploadBytes); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "file is too large or not a valid multipart upload (max 10 MB)",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "file field is required",
		})
		return
	}
	defer file.Close()

	if !isLikelyPDF(header.Filename, header.Header.Get("Content-Type")) {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "only PDF uploads are supported",
		})
		return
	}

	pdfBytes, err := io.ReadAll(file)
	if err != nil {
		slog.Error("dd214: failed to read uploaded file", "err", err)
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "could not read uploaded file",
		})
		return
	}

	profile, err := h.extractor.Extract(r.Context(), pdfBytes)
	if err != nil {
		slog.Error("dd214: import extraction failed", "err", err, "size", len(pdfBytes))
		writeJSON(w, http.StatusBadGateway, map[string]string{
			"error": "we couldn't read your DD-214. Please try a clearer scan or fill the form manually.",
		})
		return
	}
	pdfBytes = nil

	mosList, roles := h.aggregateMatches(r, profile)

	// Build the profile_suggestion payload. MOS code goes straight through;
	// rank drops the paygrade (e.g. "E-6") because that's what the form's
	// rank dropdown uses as its value.
	suggestion := profileSuggestion{
		Name:           profile.Name,
		MosCode:        strings.ToUpper(strings.TrimSpace(profile.PrimaryMOS.Code)),
		Rank:           strings.TrimSpace(profile.Paygrade),
		YearsOfService: int32(profile.YearsOfService),
		SeparationDate: profile.SeparationDate,
		// Location isn't on the DD-214 (home of record is PII we skip).
		// Preferred sectors aren't on the form — veteran picks these.
		Location:         "",
		PreferredSectors: []string{},
	}

	// Audit trail — consistent with the rest of the platform.
	LogActivity(h.queries, r, "veteran", session.UserID, "dd214_import", map[string]any{
		"mos_codes":         profile.AllMOSCodes(),
		"years_of_service":  profile.YearsOfService,
		"role_matches":      len(roles),
		"had_separation_dt": profile.SeparationDate != "",
	})

	writeJSON(w, http.StatusOK, importResponse{
		Profile:           *profile,
		MOSList:           mosList,
		Roles:             roles,
		ProfileSuggestion: suggestion,
	})
}

// aggregateMatches extracted from Translate so Import can reuse the exact
// same aggregation logic without copy-paste. Returns the per-MOS label list
// and the role list sorted by score desc (truncated to dd214MaxRoleResults).
func (h *DD214Handler) aggregateMatches(r *http.Request, profile *dd214.ExtractedProfile) ([]mosInfo, []dd214Role) {
	codes := profile.AllMOSCodes()
	primaryCode := strings.ToUpper(strings.TrimSpace(profile.PrimaryMOS.Code))

	mosList := make([]mosInfo, 0, len(codes))
	for _, code := range codes {
		info := mosInfo{
			Code:    code,
			Primary: code == primaryCode,
		}
		mos, err := h.queries.GetMOSCode(r.Context(), code)
		if err == nil {
			info.Title = mos.Title
			info.Branch = mos.Branch
			info.Description = mos.Description
			info.Found = true
		} else {
			if code == primaryCode {
				info.Title = profile.PrimaryMOS.Title
			} else {
				for _, sec := range profile.SecondaryMOS {
					if strings.ToUpper(sec.Code) == code {
						info.Title = sec.Title
						break
					}
				}
			}
		}
		mosList = append(mosList, info)
	}

	aggregated := make(map[string]*dd214Role)
	for _, info := range mosList {
		if !info.Found {
			continue
		}
		rows, err := h.queries.TranslateMOS(r.Context(), info.Code)
		if err != nil {
			slog.Warn("dd214: TranslateMOS failed", "code", info.Code, "err", err)
			continue
		}
		for _, row := range rows {
			existing, ok := aggregated[row.OnetCode]
			if !ok {
				aggregated[row.OnetCode] = &dd214Role{
					OnetCode:           row.OnetCode,
					Title:              row.Title,
					Description:        row.Description,
					Sector:             row.Sector,
					SalaryMin:          row.AvgSalaryMin,
					SalaryMax:          row.AvgSalaryMax,
					MatchScore:         row.MatchScore,
					TransferableSkills: append([]string(nil), row.TransferableSkills...),
					BestMOS:            info.Code,
				}
				continue
			}
			if row.MatchScore > existing.MatchScore {
				existing.MatchScore = row.MatchScore
				existing.BestMOS = info.Code
			}
			existing.TransferableSkills = mergeSkills(existing.TransferableSkills, row.TransferableSkills)
		}
	}

	roles := make([]dd214Role, 0, len(aggregated))
	for _, r := range aggregated {
		roles = append(roles, *r)
	}
	sort.Slice(roles, func(i, j int) bool {
		if roles[i].MatchScore != roles[j].MatchScore {
			return roles[i].MatchScore > roles[j].MatchScore
		}
		return roles[i].Title < roles[j].Title
	})
	if len(roles) > dd214MaxRoleResults {
		roles = roles[:dd214MaxRoleResults]
	}
	return mosList, roles
}

// isLikelyPDF does a cheap file-type check. We accept application/pdf and
// any content type whose filename ends in .pdf (browsers occasionally send
// generic octet-stream for PDFs).
func isLikelyPDF(filename, contentType string) bool {
	if strings.EqualFold(contentType, "application/pdf") {
		return true
	}
	return strings.HasSuffix(strings.ToLower(filename), ".pdf")
}

// mergeSkills returns the union of two skill lists, preserving first-seen
// order and de-duping case-insensitively. Used when a civilian role is
// reachable from multiple MOS codes — the veteran effectively brings both
// skill sets to the role.
func mergeSkills(a, b []string) []string {
	if len(b) == 0 {
		return a
	}
	seen := make(map[string]struct{}, len(a)+len(b))
	out := make([]string, 0, len(a)+len(b))
	appendUnique := func(s string) {
		k := strings.ToLower(strings.TrimSpace(s))
		if k == "" {
			return
		}
		if _, ok := seen[k]; ok {
			return
		}
		seen[k] = struct{}{}
		out = append(out, s)
	}
	for _, s := range a {
		appendUnique(s)
	}
	for _, s := range b {
		appendUnique(s)
	}
	return out
}
