package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
	"github.com/higor-franco/second-mission/backend/internal/jobimport"
)

// JobsExtractor is the minimum surface the handler needs from
// jobimport.Extractor. Defining it as an interface keeps the handler
// tests hermetic — they inject a fake that doesn't touch the Anthropic
// API, matching the pattern used by the linkedin + dd214 handlers.
type JobsExtractor interface {
	Extract(ctx context.Context, sourceText string, catalog []jobimport.CivilianRoleLite) ([]jobimport.JobDraft, error)
}

// JobsFetcher wraps the careers-page fetch. Tests swap a fake in so the
// paste-fallback UX can be exercised without real network I/O.
type JobsFetcher interface {
	Fetch(ctx context.Context, pageURL string) (string, error)
}

// JobImportHandler powers POST /api/employer/jobs/import. Parallel in
// shape to LinkedInHandler: URL-first with a paste-text fallback, and a
// 503 degradation path when the extractor isn't wired (missing API key).
type JobImportHandler struct {
	queries   *sqlc.Queries
	extractor JobsExtractor
	fetcher   JobsFetcher
}

// NewJobImportHandler constructs the handler. Pass ext=nil in
// environments where ANTHROPIC_API_KEY is absent; the endpoint will
// return 503 instead of silently misbehaving.
func NewJobImportHandler(queries *sqlc.Queries, ext JobsExtractor, fetch JobsFetcher) *JobImportHandler {
	return &JobImportHandler{queries: queries, extractor: ext, fetcher: fetch}
}

// maxJobImportPaste is the cap for employer-pasted career text. Real
// Greenhouse/Lever job descriptions max out around 30 KB for a dozen
// postings; 128 KB gives 4x headroom without letting a hostile client
// force a pathological decode.
const maxJobImportPaste = 128 * 1024

type jobImportRequest struct {
	URL  string `json:"url"`
	Text string `json:"text"`
}

type jobImportResponse struct {
	Drafts []jobimport.JobDraft `json:"drafts"`
	Source string               `json:"source"` // "url" or "text"
	// Count is redundant with len(drafts) but is explicit for the UI so
	// the banner can show "6 roles found" without re-counting in JS.
	Count int `json:"count"`
}

// Extract handles POST /api/employer/jobs/import.
//
// Accepts either a URL or pasted text. Tries the URL fetch first when
// both are given; if that comes back blocked AND we have text to fall
// through to, the paste path is used silently — the employer shouldn't
// have to click anything to retry. The only time we surface the fetch
// error is when we have no paste rescue.
//
// Nothing is written to the database here. The response is a list of
// in-memory JobDrafts the frontend renders for review; each draft is
// published via the existing POST /api/employer/listings when the
// employer clicks Publish.
func (h *JobImportHandler) Extract(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	if h.extractor == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "bulk job import is not configured on this server",
		})
		return
	}

	// Cap the JSON decode to keep a hostile body from wedging the process.
	r.Body = http.MaxBytesReader(w, r.Body, maxJobImportPaste+2048)

	var req jobImportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}

	url := strings.TrimSpace(req.URL)
	text := strings.TrimSpace(req.Text)

	if url == "" && text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "provide either a careers-page URL or pasted job text",
		})
		return
	}
	if len(text) > maxJobImportPaste {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "pasted text is too long — trim to the job-listing sections",
		})
		return
	}

	// Pull the civilian-role catalog once per request and hand a trimmed
	// view to Claude in the prompt. If the DB is temporarily unhappy we
	// keep going with an empty catalog — the extractor still returns
	// drafts, the civilian_role_id just comes back null and the employer
	// picks during review.
	var catalog []jobimport.CivilianRoleLite
	roles, err := h.queries.ListCivilianRoles(r.Context())
	if err != nil {
		slog.Warn("jobimport: could not load civilian roles, proceeding with empty catalog", "err", err)
	} else {
		catalog = make([]jobimport.CivilianRoleLite, len(roles))
		for i, r := range roles {
			catalog[i] = jobimport.CivilianRoleLite{
				ID:       r.ID,
				OnetCode: r.OnetCode,
				Title:    r.Title,
				Sector:   r.Sector,
			}
		}
	}

	var (
		sourceText string
		sourceKind string
		fetchErr   error
	)

	if url != "" {
		if h.fetcher == nil {
			// Never happens in production (we always wire a fetcher) but
			// handle it cleanly anyway — mirrors the linkedin handler.
			if text == "" {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
					"error": "URL fetch isn't enabled — paste the job listings instead",
				})
				return
			}
		} else {
			sourceText, fetchErr = h.fetcher.Fetch(r.Context(), url)
			if fetchErr == nil {
				sourceKind = "url"
			} else if text == "" {
				status, msg := mapJobFetchError(fetchErr)
				slog.Warn("jobimport: fetch failed", "url", url, "err", fetchErr)
				writeJSON(w, status, map[string]string{"error": msg})
				return
			}
			// else: fetch failed but we have paste text — fall through.
		}
	}

	if sourceKind == "" {
		sourceText = text
		sourceKind = "text"
	}

	drafts, err := h.extractor.Extract(r.Context(), sourceText, catalog)
	if err != nil {
		status, msg := mapJobExtractError(err)
		slog.Warn("jobimport: extraction failed", "source", sourceKind, "err", err)
		writeJSON(w, status, map[string]string{"error": msg})
		return
	}

	// Activity logging — useful for admin observability. Log the URL
	// when we fetched (public data, safe to record) and the count; we
	// deliberately do NOT log the pasted body or the extracted
	// descriptions because they may include proprietary language the
	// employer hasn't chosen to publish yet.
	LogActivity(h.queries, r, "employer", session.UserID, "jobs_bulk_import", map[string]any{
		"source": sourceKind,
		"url":    url,
		"count":  len(drafts),
	})

	writeJSON(w, http.StatusOK, jobImportResponse{
		Drafts: drafts,
		Source: sourceKind,
		Count:  len(drafts),
	})
}

// mapJobFetchError shapes a fetcher error into a user-facing HTTP status
// + message. Separated from the extractor error mapper because the two
// failure modes deserve distinct UX copy.
func mapJobFetchError(err error) (int, string) {
	switch {
	case errors.Is(err, jobimport.ErrInvalidURL):
		return http.StatusBadRequest, "That URL isn't accepted — only public https careers pages. Paste the listings here if the URL approach isn't working."
	case errors.Is(err, jobimport.ErrFetchBlocked):
		return http.StatusUnprocessableEntity, "The site blocked our fetch. Paste the job listings into the box below and we'll extract them the same way."
	default:
		return http.StatusBadGateway, "We couldn't reach that page. Paste the job listings into the box below and we'll extract them the same way."
	}
}

// mapJobExtractError shapes Claude-side failures into UI copy.
func mapJobExtractError(err error) (int, string) {
	switch {
	case errors.Is(err, jobimport.ErrEmptyInput):
		return http.StatusBadRequest, "No source text to read."
	case errors.Is(err, jobimport.ErrNoUsefulContent):
		return http.StatusUnprocessableEntity, "We didn't find any job postings in that source. Try a careers page or paste specific job descriptions."
	case errors.Is(err, jobimport.ErrInvalidJSON), errors.Is(err, jobimport.ErrNoTextResponse):
		return http.StatusBadGateway, "The AI response didn't come back in a usable shape. Please try again."
	default:
		return http.StatusBadGateway, "Something went wrong while extracting jobs. Please try again or paste specific job descriptions."
	}
}
