package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
	"github.com/higor-franco/second-mission/backend/internal/linkedin"
)

// LinkedInExtractor is the minimum surface area of linkedin.Extractor
// the handler needs. Accepting an interface keeps this file testable
// without a live Anthropic API key — mirrors the Extractor abstraction
// already used by the DD-214 handler.
type LinkedInExtractor interface {
	Extract(ctx context.Context, sourceText string) (*linkedin.ExtractedProfile, error)
}

// LinkedInFetcher is the fetcher interface the handler calls when the
// request carries a URL. Same intent as LinkedInExtractor — tests swap
// in a fake so they don't hit real LinkedIn.
type LinkedInFetcher interface {
	Fetch(ctx context.Context, linkedinURL string) (string, error)
}

// LinkedInHandler powers POST /api/employer/linkedin/extract. It fronts
// two input paths — URL fetch + extract, or direct text extract — and
// normalizes both into a single response shape the employer form can
// pre-fill from.
type LinkedInHandler struct {
	queries   *sqlc.Queries
	extractor LinkedInExtractor
	fetcher   LinkedInFetcher
}

// NewLinkedInHandler constructs the handler. If ext is nil the endpoint
// responds 503 — callers should register the route only when the
// Anthropic API key is configured. fetch may be nil in environments that
// want to force the paste path (tests, air-gapped builds); when nil, a
// URL in the request body returns a clear error pointing at the paste
// fallback.
func NewLinkedInHandler(queries *sqlc.Queries, ext LinkedInExtractor, fetch LinkedInFetcher) *LinkedInHandler {
	return &LinkedInHandler{queries: queries, extractor: ext, fetcher: fetch}
}

// maxPasteBytes caps the size of user-pasted text. A real LinkedIn About
// section maxes out around 2-3 KB; we give 10x headroom and reject
// anything wildly larger so we don't forward a 1 MB paste to Claude.
const maxPasteBytes = 32 * 1024

type linkedinExtractRequest struct {
	URL  string `json:"url"`
	Text string `json:"text"`
}

// linkedinExtractResponse is the payload the employer form uses to
// pre-fill. Source tells the UI which input path actually produced the
// profile so it can render the right "Imported from LinkedIn URL" vs
// "Imported from pasted text" banner.
type linkedinExtractResponse struct {
	Profile linkedin.ExtractedProfile `json:"profile"`
	Source  string                    `json:"source"` // "url" or "text"
}

// Extract handles POST /api/employer/linkedin/extract.
//
// Accepts either a LinkedIn URL or raw text. Tries the URL fetch first
// when both are given; if it's blocked, falls through to the text if
// present. Returns the extracted profile + source indicator.
func (h *LinkedInHandler) Extract(w http.ResponseWriter, r *http.Request) {
	session, ok := GetSession(r)
	if !ok || session.UserType != "employer" {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated as employer"})
		return
	}

	if h.extractor == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "LinkedIn import is not configured on this server",
		})
		return
	}

	// Cap the body so a hostile client can't force a huge JSON decode.
	r.Body = http.MaxBytesReader(w, r.Body, maxPasteBytes+2048)

	var req linkedinExtractRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "invalid request body",
		})
		return
	}

	url := strings.TrimSpace(req.URL)
	text := strings.TrimSpace(req.Text)

	if url == "" && text == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "provide either a LinkedIn URL or pasted About text",
		})
		return
	}
	if len(text) > maxPasteBytes {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": "pasted text is too long — trim it to the About section",
		})
		return
	}

	// Try the URL path first when provided. If it returns ErrFetchBlocked
	// or ErrInvalidURL and we have paste text to fall back on, keep going
	// with the paste path silently — the user shouldn't have to click
	// anything to retry. Only surface the fetch error when there's no
	// paste text to rescue us.
	var (
		sourceText string
		sourceKind string
		fetchErr   error
	)

	if url != "" {
		if h.fetcher == nil {
			// Agent config never wired a fetcher; tell the user to paste.
			if text == "" {
				writeJSON(w, http.StatusUnprocessableEntity, map[string]string{
					"error": "URL fetch is not enabled — paste the About section instead",
				})
				return
			}
			// Fall through to text.
		} else {
			sourceText, fetchErr = h.fetcher.Fetch(r.Context(), url)
			if fetchErr == nil {
				sourceKind = "url"
			} else if text == "" {
				// No rescue available — report the fetch error clearly so
				// the frontend knows to surface the paste textarea.
				status, msg := mapFetchError(fetchErr)
				slog.Warn("linkedin: fetch failed", "url", url, "err", fetchErr)
				writeJSON(w, status, map[string]string{"error": msg})
				return
			}
			// else: fetch failed, but we have paste text — try that path.
		}
	}

	if sourceKind == "" {
		// URL path either wasn't used or failed; use the pasted text.
		sourceText = text
		sourceKind = "text"
	}

	profile, err := h.extractor.Extract(r.Context(), sourceText)
	if err != nil {
		status, msg := mapExtractError(err)
		slog.Warn("linkedin: extraction failed", "source", sourceKind, "err", err)
		writeJSON(w, status, map[string]string{"error": msg})
		return
	}

	// Log activity for admin observability. The URL is safe to log; we
	// deliberately do NOT log the pasted text body or the extracted
	// description — both may contain content the employer considers
	// sensitive before they've hit Save.
	LogActivity(h.queries, r, "employer", session.UserID, "linkedin_import", map[string]any{
		"source": sourceKind,
		"url":    url,
	})

	writeJSON(w, http.StatusOK, linkedinExtractResponse{
		Profile: *profile,
		Source:  sourceKind,
	})
}

// mapFetchError converts a fetcher error into an HTTP status + message
// tailored to what the employer form should do next. Kept separate from
// mapExtractError because the two failure modes need different copy.
func mapFetchError(err error) (int, string) {
	switch {
	case errors.Is(err, linkedin.ErrInvalidURL):
		return http.StatusBadRequest, "Only public LinkedIn URLs are supported. Paste the About section instead if that's easier."
	case errors.Is(err, linkedin.ErrFetchBlocked):
		return http.StatusUnprocessableEntity, "LinkedIn didn't let us read that page. Paste the About section from the page and we'll pre-fill the form from that."
	default:
		// Network errors / timeouts / DNS. Same UX: offer the paste path.
		return http.StatusBadGateway, "We couldn't reach LinkedIn. Paste the About section from the page and we'll pre-fill the form from that."
	}
}

// mapExtractError converts an extractor error into an HTTP status + copy
// for the employer-facing banner. The empty-content case gets its own
// message because it's the most common "the page rendered but Claude
// saw nothing useful" failure — typically a login wall that isLoginWall
// didn't catch.
func mapExtractError(err error) (int, string) {
	switch {
	case errors.Is(err, linkedin.ErrEmptyInput):
		return http.StatusBadRequest, "No source text to read."
	case errors.Is(err, linkedin.ErrNoUsefulContent):
		return http.StatusUnprocessableEntity, "We couldn't find company info on that page. Paste the About section here and we'll try again."
	case errors.Is(err, linkedin.ErrInvalidJSON), errors.Is(err, linkedin.ErrNoTextResponse):
		return http.StatusBadGateway, "The AI response didn't come back in a usable shape. Please try again."
	default:
		return http.StatusBadGateway, "Something went wrong while reading the page. Please try again or paste the About section."
	}
}
