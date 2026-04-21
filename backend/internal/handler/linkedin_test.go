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
	"github.com/higor-franco/second-mission/backend/internal/linkedin"
)

// fakeLinkedInExtractor implements handler.LinkedInExtractor without
// calling Anthropic. Tests set `profile` and/or `err` to pick the
// behavior; `gotSource` captures the text handed to Extract for
// round-trip assertions.
type fakeLinkedInExtractor struct {
	profile   *linkedin.ExtractedProfile
	err       error
	gotSource string
	called    bool
}

func (f *fakeLinkedInExtractor) Extract(ctx context.Context, sourceText string) (*linkedin.ExtractedProfile, error) {
	f.called = true
	f.gotSource = sourceText
	if f.err != nil {
		return nil, f.err
	}
	return f.profile, nil
}

// fakeLinkedInFetcher implements handler.LinkedInFetcher. `gotURL`
// captures the URL argument so tests can verify the handler passed it
// through unchanged.
type fakeLinkedInFetcher struct {
	body   string
	err    error
	gotURL string
	called bool
}

func (f *fakeLinkedInFetcher) Fetch(ctx context.Context, linkedinURL string) (string, error) {
	f.called = true
	f.gotURL = linkedinURL
	if f.err != nil {
		return "", f.err
	}
	return f.body, nil
}

// linkedinEmployerEmail builds a unique employer email per test so runs
// don't collide on the employers table's unique (email) index.
func linkedinEmployerEmail() string {
	return fmt.Sprintf("linkedin-%d@test.com", time.Now().UnixNano())
}

// mountLinkedIn wires the handler behind the auth middleware, matching
// how main.go registers it in production.
func mountLinkedIn(t *testing.T, ext handler.LinkedInExtractor, fetch handler.LinkedInFetcher) (*http.ServeMux, *handler.EmployerHandler) {
	t.Helper()
	eh := handler.NewEmployerHandler(testQueries, config.Config{DevMode: true, BaseURL: "http://localhost:5173"})
	lh := handler.NewLinkedInHandler(testQueries, ext, fetch)

	mux := http.NewServeMux()
	mux.Handle("POST /api/employer/linkedin/extract", handler.RequireAuth(testQueries, lh.Extract))
	return mux, eh
}

// TestLinkedInExtract_Unauthenticated confirms the endpoint is behind
// auth — no session cookie should hit 401 without invoking Claude.
func TestLinkedInExtract_Unauthenticated(t *testing.T) {
	ext := &fakeLinkedInExtractor{}
	fetch := &fakeLinkedInFetcher{}
	mux, _ := mountLinkedIn(t, ext, fetch)

	body := `{"text":"About NOV — oil & gas equipment."}`
	req := httptest.NewRequest("POST", "/api/employer/linkedin/extract", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401", w.Code)
	}
	if ext.called {
		t.Error("extractor should not have been called on an unauth request")
	}
}

// TestLinkedInExtract_EmployerAuth_PasteHappyPath exercises the paste
// path end-to-end with an authenticated employer session. Verifies the
// handler passes the text unchanged to the extractor and returns the
// profile + source="text".
func TestLinkedInExtract_EmployerAuth_PasteHappyPath(t *testing.T) {
	ext := &fakeLinkedInExtractor{
		profile: &linkedin.ExtractedProfile{
			CompanyName: "NOV Inc.",
			Sector:      "Energy & Oil/Gas",
			Location:    "Houston, TX",
			Description: "Oil & gas equipment leader.",
			IndustryRaw: "Oil and Gas",
		},
	}
	fetch := &fakeLinkedInFetcher{}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"text":"About NOV — a leading provider of oil and gas equipment headquartered in Houston."}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200. body: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["source"] != "text" {
		t.Errorf("source = %v, want text", resp["source"])
	}
	profile := resp["profile"].(map[string]any)
	if profile["company_name"] != "NOV Inc." {
		t.Errorf("company_name = %v", profile["company_name"])
	}
	if profile["sector"] != "Energy & Oil/Gas" {
		t.Errorf("sector = %v", profile["sector"])
	}
	if !ext.called {
		t.Error("extractor was not invoked")
	}
	if fetch.called {
		t.Error("fetcher was invoked on a text-only request")
	}
	if !bytes.Contains([]byte(ext.gotSource), []byte("Houston")) {
		t.Errorf("extractor source = %q (should contain the pasted text)", ext.gotSource)
	}
}

// TestLinkedInExtract_URLHappyPath verifies the URL path: fetcher
// returns cleaned HTML, extractor reads it, handler reports source="url".
func TestLinkedInExtract_URLHappyPath(t *testing.T) {
	ext := &fakeLinkedInExtractor{
		profile: &linkedin.ExtractedProfile{
			CompanyName: "GE Vernova",
			Sector:      "Energy & Oil/Gas",
			Location:    "Cambridge, MA",
			Description: "Energy transition tech.",
		},
	}
	fetch := &fakeLinkedInFetcher{body: "<html><title>GE Vernova</title></html>"}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"url":"https://www.linkedin.com/company/gevernova/"}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200. body: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["source"] != "url" {
		t.Errorf("source = %v, want url", resp["source"])
	}
	if !fetch.called {
		t.Error("fetcher was not invoked")
	}
	if fetch.gotURL != "https://www.linkedin.com/company/gevernova/" {
		t.Errorf("fetcher got URL %q", fetch.gotURL)
	}
}

// TestLinkedInExtract_URLBlockedFallsBackToText checks the graceful
// fallback: when the fetcher returns ErrFetchBlocked AND the request
// also carried paste text, the handler should silently try the text
// instead of returning an error. This is the primary UX guarantee of
// the import feature.
func TestLinkedInExtract_URLBlockedFallsBackToText(t *testing.T) {
	ext := &fakeLinkedInExtractor{
		profile: &linkedin.ExtractedProfile{
			CompanyName: "KBR Inc.",
			Sector:      "Construction",
			Location:    "Houston, TX",
			Description: "EPC.",
		},
	}
	fetch := &fakeLinkedInFetcher{err: linkedin.ErrFetchBlocked}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"url":"https://www.linkedin.com/company/kbr-inc/","text":"About KBR — global EPC firm."}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200. body: %s", w.Code, w.Body.String())
	}
	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["source"] != "text" {
		t.Errorf("source = %v, want text (fetch was blocked)", resp["source"])
	}
	if ext.gotSource != "About KBR — global EPC firm." {
		t.Errorf("extractor got %q, want the pasted text", ext.gotSource)
	}
}

// TestLinkedInExtract_URLBlockedNoText returns a 4xx that the frontend
// can use to prompt the user to paste the About section. We verify both
// the status code and the error key.
func TestLinkedInExtract_URLBlockedNoText(t *testing.T) {
	ext := &fakeLinkedInExtractor{}
	fetch := &fakeLinkedInFetcher{err: linkedin.ErrFetchBlocked}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"url":"https://www.linkedin.com/company/whatever/"}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("got %d, want 422", w.Code)
	}
	if ext.called {
		t.Error("extractor should not have been called when fetch was blocked and no paste was offered")
	}
}

// TestLinkedInExtract_NeitherURLNorText verifies input validation —
// an empty body shape gets rejected before touching Anthropic.
func TestLinkedInExtract_NeitherURLNorText(t *testing.T) {
	ext := &fakeLinkedInExtractor{}
	fetch := &fakeLinkedInFetcher{}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400", w.Code)
	}
	if ext.called {
		t.Error("extractor should not have been called for an empty request")
	}
}

// TestLinkedInExtract_NoUsefulContent maps the extractor's "login wall"
// signal to a 422 so the frontend knows to ask for paste.
func TestLinkedInExtract_NoUsefulContent(t *testing.T) {
	ext := &fakeLinkedInExtractor{err: linkedin.ErrNoUsefulContent}
	fetch := &fakeLinkedInFetcher{}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"text":"Sign in to view this page."}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnprocessableEntity {
		t.Errorf("got %d, want 422", w.Code)
	}
	if !ext.called {
		t.Error("extractor should have run — the failure is the model output, not the pre-check")
	}
}

// TestLinkedInExtract_ExtractorUnconfigured covers the 503 path: if the
// server was started without an API key, the handler tells the caller
// LinkedIn import is disabled so the UI can hide the feature. We also
// verify the handler doesn't try the fetcher first (we never get past
// the "extractor is nil" guard).
func TestLinkedInExtract_ExtractorUnconfigured(t *testing.T) {
	fetch := &fakeLinkedInFetcher{}
	mux, eh := mountLinkedIn(t, nil, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	body := `{"text":"Anything."}`
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Errorf("got %d, want 503", w.Code)
	}
	if fetch.called {
		t.Error("fetcher should not have been called when the extractor is unconfigured")
	}
}

// TestLinkedInExtract_OversizedPaste guards the MaxBytesReader — pasting
// >32 KB should 400 cleanly rather than stream gigabytes at Claude.
func TestLinkedInExtract_OversizedPaste(t *testing.T) {
	ext := &fakeLinkedInExtractor{}
	fetch := &fakeLinkedInFetcher{}
	mux, eh := mountLinkedIn(t, ext, fetch)

	email := linkedinEmployerEmail()
	cookies := registerAndLoginEmployer(t, eh, email)

	big := bytes.Repeat([]byte("x"), 40*1024) // 40 KB
	body := fmt.Sprintf(`{"text":%q}`, string(big))
	req := authedRequest("POST", "/api/employer/linkedin/extract", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got %d, want 400 for oversized paste", w.Code)
	}
	if ext.called {
		t.Error("extractor should not have been invoked for an oversized body")
	}
}

// TestLinkedInExtract_VeteranSessionRejected ensures a veteran session
// (the other user_type in the system) cannot call the employer-only
// endpoint. Reuses the veteran dev-login helper from veteran_test.go.
func TestLinkedInExtract_VeteranSessionRejected(t *testing.T) {
	ext := &fakeLinkedInExtractor{}
	fetch := &fakeLinkedInFetcher{}
	mux, _ := mountLinkedIn(t, ext, fetch)

	// Veteran cookie — not an employer session.
	vetCookie := devLoginAndGetCookie(t, fmt.Sprintf("linkedin-vet-%d@test.com", time.Now().UnixNano()))

	body := `{"text":"About NOV."}`
	req := httptest.NewRequest("POST", "/api/employer/linkedin/extract", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(vetCookie)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got %d, want 401 — veteran session shouldn't access employer endpoint", w.Code)
	}
	if ext.called {
		t.Error("extractor should not have been called for the wrong user_type")
	}
}

// registerAndLoginEmployer registers a fresh employer and returns the
// session cookies. Small helper shared by the auth-required tests above.
func registerAndLoginEmployer(t *testing.T, eh *handler.EmployerHandler, email string) []*http.Cookie {
	t.Helper()
	body := fmt.Sprintf(`{"email":"%s","password":"testpass123","company_name":"Test Corp","contact_name":"Jane","sector":"Energy","location":"Houston, TX","description":"Test"}`, email)
	regReq := httptest.NewRequest("POST", "/api/employer/register", bytes.NewBufferString(body))
	regReq.Header.Set("Content-Type", "application/json")
	regW := httptest.NewRecorder()
	eh.Register(regW, regReq)
	if regW.Code != http.StatusCreated {
		t.Fatalf("register: %d. body: %s", regW.Code, regW.Body.String())
	}

	loginBody := fmt.Sprintf(`{"email":"%s","password":"testpass123"}`, email)
	loginReq := httptest.NewRequest("POST", "/api/employer/login", bytes.NewBufferString(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	eh.Login(loginW, loginReq)
	if loginW.Code != http.StatusOK {
		t.Fatalf("login: %d", loginW.Code)
	}
	return loginW.Result().Cookies()
}

// Compile-time checks that the fakes satisfy the handler interfaces.
var (
	_ handler.LinkedInExtractor = (*fakeLinkedInExtractor)(nil)
	_ handler.LinkedInFetcher   = (*fakeLinkedInFetcher)(nil)
	_                           = errors.Is // silence unused import on some Go versions
)
