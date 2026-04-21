package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/handler"
	"github.com/higor-franco/second-mission/backend/internal/jobimport"
)

// fakeJobsExtractor lets tests return canned drafts or errors without
// calling Anthropic. Mirrors fakeLinkedInExtractor in spirit.
type fakeJobsExtractor struct {
	drafts     []jobimport.JobDraft
	err        error
	gotSource  string
	gotCatalog []jobimport.CivilianRoleLite
	called     bool
}

func (f *fakeJobsExtractor) Extract(ctx context.Context, sourceText string, catalog []jobimport.CivilianRoleLite) ([]jobimport.JobDraft, error) {
	f.called = true
	f.gotSource = sourceText
	f.gotCatalog = catalog
	if f.err != nil {
		return nil, f.err
	}
	return f.drafts, nil
}

type fakeJobsFetcher struct {
	body   string
	err    error
	gotURL string
	called bool
}

func (f *fakeJobsFetcher) Fetch(ctx context.Context, pageURL string) (string, error) {
	f.called = true
	f.gotURL = pageURL
	if f.err != nil {
		return "", f.err
	}
	return f.body, nil
}

func jobsEmployerEmail() string {
	return fmt.Sprintf("jobs-%d@test.com", time.Now().UnixNano())
}

func mountJobs(t *testing.T, ext handler.JobsExtractor, fetch handler.JobsFetcher) (*http.ServeMux, *handler.EmployerHandler) {
	t.Helper()
	eh := handler.NewEmployerHandler(testQueries, config.Config{DevMode: true, BaseURL: "http://localhost:5173"})
	jh := handler.NewJobImportHandler(testQueries, ext, fetch)

	mux := http.NewServeMux()
	mux.Handle("POST /api/employer/jobs/import", handler.RequireAuth(testQueries, jh.Extract))
	return mux, eh
}

// Unauthenticated callers bounce at RequireAuth without invoking Claude.
func TestJobsImport_Unauthenticated(t *testing.T) {
	ext := &fakeJobsExtractor{}
	fetch := &fakeJobsFetcher{}
	mux, _ := mountJobs(t, ext, fetch)

	req := httptest.NewRequest("POST", "/api/employer/jobs/import", bytes.NewBufferString(`{"text":"some jobs"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401. Body: %s", w.Code, w.Body.String())
	}
	if ext.called || fetch.called {
		t.Error("extractor/fetcher was called for an unauthenticated request")
	}
}

// A nil extractor should 503 — the endpoint is registered but degrades
// gracefully when ANTHROPIC_API_KEY is missing.
func TestJobsImport_NoExtractor_Returns503(t *testing.T) {
	fetch := &fakeJobsFetcher{}
	mux, eh := mountJobs(t, nil, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import", `{"text":"blah"}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("got %d, want 503. Body: %s", w.Code, w.Body.String())
	}
}

// Empty body should be 400, not a silent empty-drafts response.
func TestJobsImport_EmptyBody_Returns400(t *testing.T) {
	ext := &fakeJobsExtractor{}
	fetch := &fakeJobsFetcher{}
	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import", `{}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400. Body: %s", w.Code, w.Body.String())
	}
}

// Happy path: URL supplied, fetcher returns content, extractor returns
// drafts, handler returns 200 with drafts + source=url + count.
func TestJobsImport_URLHappyPath(t *testing.T) {
	drafts := []jobimport.JobDraft{
		{Title: "Fleet Operations Manager", Location: "Houston, TX", EmploymentType: "full-time", WotcEligible: true},
		{Title: "CDL Driver", Location: "Odessa, TX", EmploymentType: "full-time", WotcEligible: true},
	}
	ext := &fakeJobsExtractor{drafts: drafts}
	fetch := &fakeJobsFetcher{body: "<html>mock careers page</html>"}

	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import",
		`{"url":"https://careers.example.com/jobs"}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["source"] != "url" {
		t.Errorf("source = %v, want url", resp["source"])
	}
	if got, _ := resp["count"].(float64); got != 2 {
		t.Errorf("count = %v, want 2", resp["count"])
	}
	if !fetch.called {
		t.Error("fetcher wasn't called for URL path")
	}
	if !ext.called || ext.gotSource == "" {
		t.Error("extractor wasn't called with fetcher's body")
	}
	// Catalog should be non-empty — the handler loads civilian_roles and
	// passes them through. The local test DB seeds 30+ roles so this is
	// a safe floor.
	if len(ext.gotCatalog) == 0 {
		t.Error("civilian role catalog wasn't passed to extractor")
	}
}

// Fetcher blocks, extractor gets called with the paste body as fallback.
// This is the "URL failed but paste rescued us" UX path.
func TestJobsImport_FetchBlocked_FallsBackToPaste(t *testing.T) {
	ext := &fakeJobsExtractor{
		drafts: []jobimport.JobDraft{{Title: "Warehouse Supervisor", WotcEligible: true}},
	}
	fetch := &fakeJobsFetcher{err: jobimport.ErrFetchBlocked}

	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	body := `{"url":"https://blocked.example.com/jobs","text":"Warehouse Supervisor — Dallas, TX\nLead team of 12."}`
	req := authedRequest("POST", "/api/employer/jobs/import", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200. Body: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["source"] != "text" {
		t.Errorf("fallback source = %v, want text", resp["source"])
	}
	if !ext.called {
		t.Fatal("extractor wasn't called on paste fallback")
	}
	if ext.gotSource == "" || ext.gotSource[:9] != "Warehouse" {
		t.Errorf("extractor got wrong source: %q", ext.gotSource)
	}
}

// URL-only + fetcher error + no text fallback surfaces the fetch error
// to the frontend with an HTTP 422 or 502 (mapped by mapJobFetchError).
func TestJobsImport_FetchBlocked_NoTextFallback_Returns422(t *testing.T) {
	ext := &fakeJobsExtractor{}
	fetch := &fakeJobsFetcher{err: jobimport.ErrFetchBlocked}

	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import",
		`{"url":"https://blocked.example.com/jobs"}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("got %d, want 422. Body: %s", w.Code, w.Body.String())
	}
	if ext.called {
		t.Error("extractor shouldn't run when fetch fails with no fallback")
	}
}

// ErrNoUsefulContent → 422. Tells the UI "no job postings found".
func TestJobsImport_ExtractorReturnsNoContent(t *testing.T) {
	ext := &fakeJobsExtractor{err: jobimport.ErrNoUsefulContent}
	fetch := &fakeJobsFetcher{}

	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import",
		`{"text":"this is not a jobs page"}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("got %d, want 422. Body: %s", w.Code, w.Body.String())
	}
}

// When the extractor returns a generic error we still want 502 rather
// than 500 — it's an upstream-dependency failure.
func TestJobsImport_UnexpectedExtractorError_Returns502(t *testing.T) {
	ext := &fakeJobsExtractor{err: errors.New("anthropic 500")}
	fetch := &fakeJobsFetcher{}

	mux, eh := mountJobs(t, ext, fetch)
	cookies := registerTestEmployer(t, eh, jobsEmployerEmail())

	req := authedRequest("POST", "/api/employer/jobs/import",
		`{"text":"some text"}`, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadGateway {
		t.Errorf("got %d, want 502. Body: %s", w.Code, w.Body.String())
	}
}
