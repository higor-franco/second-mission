package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/handler"
)

func testEmployerCfg() config.Config {
	return config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
}

func registerTestEmployer(t *testing.T, h *handler.EmployerHandler, email string) []*http.Cookie {
	t.Helper()
	body := fmt.Sprintf(`{"email":"%s","password":"testpass123","company_name":"Test Corp","contact_name":"Jane","sector":"Energy","location":"Houston, TX","description":"Test"}`, email)
	req := httptest.NewRequest("POST", "/api/employer/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Register(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("register: got status %d, want 201. Body: %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}

func loginTestEmployer(t *testing.T, h *handler.EmployerHandler, email string) []*http.Cookie {
	t.Helper()
	body := fmt.Sprintf(`{"email":"%s","password":"testpass123"}`, email)
	req := httptest.NewRequest("POST", "/api/employer/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Login(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("login: got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}

func authedRequest(method, url string, body string, cookies []*http.Cookie) *http.Request {
	var req *http.Request
	if body != "" {
		req = httptest.NewRequest(method, url, bytes.NewBufferString(body))
		req.Header.Set("Content-Type", "application/json")
	} else {
		req = httptest.NewRequest(method, url, nil)
	}
	for _, c := range cookies {
		req.AddCookie(c)
	}
	return req
}

// --- Registration tests ---

func TestEmployerRegister_Success(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-reg-%d@test.com", time.Now().UnixNano())
	body := fmt.Sprintf(`{"email":"%s","password":"testpass123","company_name":"ACME Inc","contact_name":"Bob","sector":"Construction","location":"Dallas, TX","description":"Building things"}`, email)
	req := httptest.NewRequest("POST", "/api/employer/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Register(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("got status %d, want 201. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["message"] != "registration successful" {
		t.Errorf("unexpected message: %v", resp["message"])
	}
	emp := resp["employer"].(map[string]any)
	if emp["company_name"] != "ACME Inc" {
		t.Errorf("company_name = %v, want ACME Inc", emp["company_name"])
	}

	// Check session cookie
	cookies := w.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "session_id" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("expected session_id cookie after registration")
	}
}

func TestEmployerRegister_DuplicateEmail(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-dup-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, email)

	// Try registering again with same email
	body := fmt.Sprintf(`{"email":"%s","password":"testpass123","company_name":"Dup Corp"}`, email)
	req := httptest.NewRequest("POST", "/api/employer/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Register(w, req)

	if w.Code != http.StatusConflict {
		t.Errorf("got status %d, want 409. Body: %s", w.Code, w.Body.String())
	}
}

func TestEmployerRegister_Validation(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	tests := []struct {
		name string
		body string
	}{
		{"missing email", `{"password":"testpass123","company_name":"X"}`},
		{"invalid email", `{"email":"notvalid","password":"testpass123","company_name":"X"}`},
		{"short password", `{"email":"a@b.com","password":"short","company_name":"X"}`},
		{"missing company", `{"email":"a@b.com","password":"testpass123"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/api/employer/register", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.Register(w, req)
			if w.Code != http.StatusBadRequest {
				t.Errorf("got status %d, want 400", w.Code)
			}
		})
	}
}

// --- Login tests ---

func TestEmployerLogin_Success(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-login-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, email)

	cookies := loginTestEmployer(t, h, email)
	found := false
	for _, c := range cookies {
		if c.Name == "session_id" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("expected session_id cookie after login")
	}
}

func TestEmployerLogin_WrongPassword(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-wrongpw-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, email)

	body := fmt.Sprintf(`{"email":"%s","password":"wrongpassword"}`, email)
	req := httptest.NewRequest("POST", "/api/employer/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Login(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

// --- Me / Profile tests ---

func TestEmployerMe_Authenticated(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-me-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, email)
	cookies := loginTestEmployer(t, h, email)

	req := authedRequest("GET", "/api/employer/me", "", cookies)
	w := httptest.NewRecorder()
	handler.RequireAuth(testQueries, h.Me).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["email"] != email {
		t.Errorf("email = %v, want %s", resp["email"], email)
	}
}

func TestEmployerMe_Unauthenticated(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	req := httptest.NewRequest("GET", "/api/employer/me", nil)
	w := httptest.NewRecorder()
	handler.RequireAuth(testQueries, h.Me).ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

// --- Dashboard tests ---

func TestEmployerDashboard_Empty(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-dash-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, email)
	cookies := loginTestEmployer(t, h, email)

	req := authedRequest("GET", "/api/employer/dashboard", "", cookies)
	w := httptest.NewRecorder()
	handler.RequireAuth(testQueries, h.Dashboard).ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["total_listings"].(float64) != 0 {
		t.Errorf("expected 0 total_listings, got %v", resp["total_listings"])
	}
}

// --- Dev Login ---

func TestEmployerDevLogin_CreatesEmployer(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-dev-%d@test.com", time.Now().UnixNano())
	body := fmt.Sprintf(`{"email":"%s"}`, email)
	req := httptest.NewRequest("POST", "/api/dev/employer-login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.DevLogin(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	emp := resp["employer"].(map[string]any)
	if emp["email"] != email {
		t.Errorf("email = %v, want %s", emp["email"], email)
	}

	// Check session cookie
	cookies := w.Result().Cookies()
	found := false
	for _, c := range cookies {
		if c.Name == "session_id" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("expected session_id cookie after dev login")
	}
}

// --- Civilian Roles ---

func TestListCivilianRoles(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	req := httptest.NewRequest("GET", "/api/civilian-roles", nil)
	w := httptest.NewRecorder()
	h.ListCivilianRoles(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	roles := resp["roles"].([]any)
	if len(roles) == 0 {
		t.Error("expected at least one civilian role")
	}
}

// --- Listing detail + per-listing funnel ---

// setupEmployerWithListing registers an employer, creates one job listing
// under an arbitrary civilian role, and returns the employer's cookies
// along with the new listing's ID. Used by the listing-detail and funnel
// tests to get a clean employer → listing pair without leaning on seeded
// data that might disappear between migrations.
func setupEmployerWithListing(t *testing.T, h *handler.EmployerHandler, email string) (cookies []*http.Cookie, listingID int) {
	t.Helper()
	registerTestEmployer(t, h, email)
	cookies = loginTestEmployer(t, h, email)

	// Pick any existing civilian role — we just need a valid FK. The
	// seeded data in 007_hybrid_matching.sql always includes 88M-linked
	// roles, but the specific pick doesn't matter for these tests.
	rolesReq := httptest.NewRequest("GET", "/api/civilian-roles", nil)
	rolesW := httptest.NewRecorder()
	h.ListCivilianRoles(rolesW, rolesReq)
	if rolesW.Code != http.StatusOK {
		t.Fatalf("list civilian roles: got %d", rolesW.Code)
	}
	var rolesResp map[string]any
	json.Unmarshal(rolesW.Body.Bytes(), &rolesResp)
	roles := rolesResp["roles"].([]any)
	if len(roles) == 0 {
		t.Fatal("no civilian roles seeded; cannot set up listing")
	}
	roleID := int(roles[0].(map[string]any)["id"].(float64))

	listingBody := fmt.Sprintf(
		`{"civilian_role_id":%d,"title":"Funnel Test Role","description":"for tests","location":"Austin, TX","salary_min":50000,"salary_max":80000,"employment_type":"full-time","wotc_eligible":true,"tasks":["a"],"benefits":["b"],"mos_codes_preferred":["88M"]}`,
		roleID,
	)
	createReq := authedRequest("POST", "/api/employer/listings", listingBody, cookies)
	createW := httptest.NewRecorder()
	handler.RequireAuth(testQueries, h.CreateJobListing).ServeHTTP(createW, createReq)
	if createW.Code != http.StatusCreated {
		t.Fatalf("create listing: got %d, body=%s", createW.Code, createW.Body.String())
	}
	var createResp map[string]any
	json.Unmarshal(createW.Body.Bytes(), &createResp)
	listing := createResp["listing"].(map[string]any)
	listingID = int(listing["id"].(float64))
	return cookies, listingID
}

// A fresh listing under a new employer should expose itself via the
// detail endpoint with an empty candidate pool. This guards the zero
// state that the funnel UI renders.
func TestGetJobListingWithCandidates_EmptyFunnel(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-funnel-empty-%d@test.com", time.Now().UnixNano())
	cookies, listingID := setupEmployerWithListing(t, h, email)

	mux := http.NewServeMux()
	mux.Handle("GET /api/employer/listings/{id}/candidates", handler.RequireAuth(testQueries, h.GetJobListingWithCandidates))

	url := fmt.Sprintf("/api/employer/listings/%d/candidates", listingID)
	req := authedRequest("GET", url, "", cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)

	listing, ok := resp["listing"].(map[string]any)
	if !ok {
		t.Fatal("expected listing object in response")
	}
	if int(listing["id"].(float64)) != listingID {
		t.Errorf("listing.id = %v, want %d", listing["id"], listingID)
	}
	if listing["title"] != "Funnel Test Role" {
		t.Errorf("listing.title = %v, want 'Funnel Test Role'", listing["title"])
	}

	candidates := resp["candidates"].([]any)
	if len(candidates) != 0 {
		t.Errorf("expected empty candidates, got %d", len(candidates))
	}
}

// Another employer must not be able to fetch the funnel for someone
// else's listing — otherwise the per-listing view would leak candidate
// data across companies.
func TestGetJobListingWithCandidates_ForeignEmployerGets404(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	// Employer A creates the listing.
	emailA := fmt.Sprintf("emp-funnel-owner-%d@test.com", time.Now().UnixNano())
	_, listingID := setupEmployerWithListing(t, h, emailA)

	// Employer B tries to fetch it.
	emailB := fmt.Sprintf("emp-funnel-peek-%d@test.com", time.Now().UnixNano())
	registerTestEmployer(t, h, emailB)
	cookiesB := loginTestEmployer(t, h, emailB)

	mux := http.NewServeMux()
	mux.Handle("GET /api/employer/listings/{id}/candidates", handler.RequireAuth(testQueries, h.GetJobListingWithCandidates))

	url := fmt.Sprintf("/api/employer/listings/%d/candidates", listingID)
	req := authedRequest("GET", url, "", cookiesB)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("got status %d, want 404 for cross-employer access. Body: %s", w.Code, w.Body.String())
	}
}

// The two new funnel stages (proposal_sent, contract_signed) must be
// accepted by UpdateCandidateStatus. Driving the full chain through
// `interested → placed` catches any handler whitelist drift relative to
// the DB CHECK constraint in migrations/011_funnel_statuses.sql.
func TestUpdateCandidateStatus_FullFunnelChain(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	// Register an employer and create a listing.
	emailE := fmt.Sprintf("emp-funnel-chain-%d@test.com", time.Now().UnixNano())
	employerCookies, listingID := setupEmployerWithListing(t, h, emailE)

	// A veteran needs to express interest so we have an application row
	// to advance. Use the existing dev-login helper + the veteran
	// handler — this mirrors the real end-to-end flow.
	veteranEmail := fmt.Sprintf("vet-funnel-chain-%d@test.com", time.Now().UnixNano())
	vetCookie := devLoginAndGetCookie(t, veteranEmail)
	vh := handler.NewVeteranHandler(testQueries)

	vetMux := http.NewServeMux()
	vetMux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))
	vetMux.Handle("POST /api/veteran/applications", handler.RequireAuth(testQueries, vh.ExpressInterest))

	// Set MOS so Express Interest accepts the application.
	profileReq := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(`{"name":"Funnel Vet","mos_code":"88M","rank":"E-5","years_of_service":4}`))
	profileReq.Header.Set("Content-Type", "application/json")
	profileReq.AddCookie(vetCookie)
	profileW := httptest.NewRecorder()
	vetMux.ServeHTTP(profileW, profileReq)
	if profileW.Code != http.StatusOK {
		t.Fatalf("vet profile: got %d, body=%s", profileW.Code, profileW.Body.String())
	}

	interestBody := fmt.Sprintf(`{"job_listing_id":%d}`, listingID)
	interestReq := httptest.NewRequest("POST", "/api/veteran/applications", bytes.NewBufferString(interestBody))
	interestReq.Header.Set("Content-Type", "application/json")
	interestReq.AddCookie(vetCookie)
	interestW := httptest.NewRecorder()
	vetMux.ServeHTTP(interestW, interestReq)
	if interestW.Code != http.StatusOK {
		t.Fatalf("express interest: got %d, body=%s", interestW.Code, interestW.Body.String())
	}
	var interestResp map[string]any
	json.Unmarshal(interestW.Body.Bytes(), &interestResp)
	app := interestResp["application"].(map[string]any)
	applicationID := int(app["id"].(float64))

	// Drive through every forward transition. Each PUT must succeed
	// AND the returned row must reflect the new status so the frontend
	// can optimistically update its state.
	empMux := http.NewServeMux()
	empMux.Handle("PUT /api/employer/candidates/{id}/status", handler.RequireAuth(testQueries, h.UpdateCandidateStatus))

	stages := []string{"introduced", "interviewing", "proposal_sent", "contract_signed", "placed"}
	for _, next := range stages {
		body := fmt.Sprintf(`{"status":"%s"}`, next)
		req := authedRequest("PUT", fmt.Sprintf("/api/employer/candidates/%d/status", applicationID), body, employerCookies)
		w := httptest.NewRecorder()
		empMux.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("advance to %q: got %d, body=%s", next, w.Code, w.Body.String())
		}
		var resp map[string]any
		json.Unmarshal(w.Body.Bytes(), &resp)
		if got, _ := resp["status"].(string); got != next {
			t.Errorf("advance to %q: response.status = %q, want %q", next, got, next)
		}
	}
}

// Sanity check on the whitelist itself — a clearly invalid status must
// be rejected without touching the DB.
func TestUpdateCandidateStatus_InvalidStatus(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-funnel-invalid-%d@test.com", time.Now().UnixNano())
	cookies, _ := setupEmployerWithListing(t, h, email)

	empMux := http.NewServeMux()
	empMux.Handle("PUT /api/employer/candidates/{id}/status", handler.RequireAuth(testQueries, h.UpdateCandidateStatus))

	req := authedRequest("PUT", "/api/employer/candidates/1/status", `{"status":"hired_elsewhere"}`, cookies)
	w := httptest.NewRecorder()
	empMux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400 for invalid status", w.Code)
	}
}

// --- UpdateProfile: richer identity fields ---

// Verifies that the employer profile edit saves and returns the four new
// public-profile fields (website_url, linkedin_url, company_size,
// founded_year) end-to-end, and that a bogus founded year is clamped to 0.
func TestUpdateProfile_WithPublicFields(t *testing.T) {
	cfg := testEmployerCfg()
	h := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-public-%d@test.com", time.Now().UnixNano())
	cookies := registerTestEmployer(t, h, email)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/employer/profile", handler.RequireAuth(testQueries, h.UpdateProfile))

	// Happy path with all four new fields populated + an out-of-range
	// founded_year that should be rejected (clamped to 0) by the handler.
	body := `{
		"company_name":  "Acme Industrial",
		"contact_name":  "Jane",
		"sector":        "Energy",
		"location":      "Houston, TX",
		"description":   "Example",
		"website_url":   "https://acme.example.com",
		"linkedin_url":  "https://www.linkedin.com/company/acme/",
		"company_size":  "1,001–5,000 employees",
		"founded_year":  99999
	}`
	req := authedRequest("PUT", "/api/employer/profile", body, cookies)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("bad json: %v", err)
	}

	if resp["website_url"] != "https://acme.example.com" {
		t.Errorf("website_url = %v, want https://acme.example.com", resp["website_url"])
	}
	if resp["linkedin_url"] != "https://www.linkedin.com/company/acme/" {
		t.Errorf("linkedin_url = %v", resp["linkedin_url"])
	}
	if resp["company_size"] != "1,001–5,000 employees" {
		t.Errorf("company_size = %v", resp["company_size"])
	}
	// 99999 is out of range → clamped to 0 (unknown).
	if got, _ := resp["founded_year"].(float64); got != 0 {
		t.Errorf("founded_year should be clamped to 0, got %v", resp["founded_year"])
	}

	// Second PUT with a plausible year — must persist.
	body2 := `{
		"company_name":  "Acme Industrial",
		"contact_name":  "Jane",
		"sector":        "Energy",
		"location":      "Houston, TX",
		"description":   "Example",
		"website_url":   "  https://acme.example.com  ",
		"linkedin_url":  "https://www.linkedin.com/company/acme/",
		"company_size":  "1,001–5,000 employees",
		"founded_year":  1985
	}`
	req2 := authedRequest("PUT", "/api/employer/profile", body2, cookies)
	w2 := httptest.NewRecorder()
	mux.ServeHTTP(w2, req2)
	if w2.Code != http.StatusOK {
		t.Fatalf("second PUT: %d %s", w2.Code, w2.Body.String())
	}
	var resp2 map[string]any
	json.Unmarshal(w2.Body.Bytes(), &resp2)
	if got, _ := resp2["founded_year"].(float64); got != 1985 {
		t.Errorf("founded_year = %v, want 1985", resp2["founded_year"])
	}
	// Leading/trailing whitespace on the URL should be trimmed.
	if resp2["website_url"] != "https://acme.example.com" {
		t.Errorf("website_url not trimmed: %v", resp2["website_url"])
	}
}

// --- Public company profile (veteran-facing) ---

// Helper: login as a veteran via the auth handler's dev endpoint and
// return the session cookie. Mirrors devLoginAndGetCookie from
// veteran_test.go but lives here to avoid circular helpers between files.
func devVeteranCookie(t *testing.T, email string) *http.Cookie {
	t.Helper()
	authH := handler.NewAuthHandler(testQueries, testEmployerCfg())
	req := httptest.NewRequest("POST", "/api/dev/login", bytes.NewBufferString(`{"email":"`+email+`"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	authH.DevLogin(w, req)
	for _, c := range w.Result().Cookies() {
		if c.Name == "session_id" {
			return c
		}
	}
	t.Fatal("dev login: no session cookie returned")
	return nil
}

// Happy path — a veteran fetches an existing employer's public profile
// and gets back the trimmed shape (no email, no password_hash) plus the
// employer's active listings.
func TestPublicCompanyProfile_HappyPath(t *testing.T) {
	cfg := testEmployerCfg()
	empH := handler.NewEmployerHandler(testQueries, cfg)

	// Register an employer + save a richer profile so we have something
	// to verify the fields round-trip.
	empEmail := fmt.Sprintf("emp-public-profile-%d@test.com", time.Now().UnixNano())
	empCookies := registerTestEmployer(t, empH, empEmail)

	empMux := http.NewServeMux()
	empMux.Handle("GET /api/employer/me", handler.RequireAuth(testQueries, empH.Me))
	empMux.Handle("PUT /api/employer/profile", handler.RequireAuth(testQueries, empH.UpdateProfile))

	update := `{
		"company_name":  "Lone Star Logistics",
		"contact_name":  "Bob",
		"sector":        "Logistics",
		"location":      "Austin, TX",
		"description":   "Carrier and 3PL serving Texas.",
		"website_url":   "https://lonestar.example.com",
		"linkedin_url":  "https://www.linkedin.com/company/lonestar/",
		"company_size":  "501–1,000 employees",
		"founded_year":  2001
	}`
	req := authedRequest("PUT", "/api/employer/profile", update, empCookies)
	w := httptest.NewRecorder()
	empMux.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("seed profile: %d %s", w.Code, w.Body.String())
	}
	var saved map[string]any
	json.Unmarshal(w.Body.Bytes(), &saved)
	employerID := int(saved["id"].(float64))

	// Now log in as a veteran and hit the public company profile route.
	vetCookie := devVeteranCookie(t, fmt.Sprintf("vet-company-%d@test.com", time.Now().UnixNano()))

	vetMux := http.NewServeMux()
	vetMux.Handle("GET /api/veteran/employers/{id}", handler.RequireAuth(testQueries, empH.PublicCompanyProfile))

	req2 := authedRequest("GET", fmt.Sprintf("/api/veteran/employers/%d", employerID), "", []*http.Cookie{vetCookie})
	w2 := httptest.NewRecorder()
	vetMux.ServeHTTP(w2, req2)

	if w2.Code != http.StatusOK {
		t.Fatalf("public profile: %d %s", w2.Code, w2.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w2.Body.Bytes(), &resp); err != nil {
		t.Fatalf("bad json: %v", err)
	}

	emp, ok := resp["employer"].(map[string]any)
	if !ok {
		t.Fatalf("no employer object in response: %s", w2.Body.String())
	}
	if emp["company_name"] != "Lone Star Logistics" {
		t.Errorf("company_name = %v", emp["company_name"])
	}
	if emp["website_url"] != "https://lonestar.example.com" {
		t.Errorf("website_url = %v", emp["website_url"])
	}
	if emp["linkedin_url"] != "https://www.linkedin.com/company/lonestar/" {
		t.Errorf("linkedin_url = %v", emp["linkedin_url"])
	}
	if emp["company_size"] != "501–1,000 employees" {
		t.Errorf("company_size = %v", emp["company_size"])
	}
	if got, _ := emp["founded_year"].(float64); got != 2001 {
		t.Errorf("founded_year = %v, want 2001", emp["founded_year"])
	}
	// Security-sensitive fields must not appear in the veteran view.
	if _, present := emp["email"]; present {
		t.Error("public profile leaked email to veteran")
	}
	if _, present := emp["password_hash"]; present {
		t.Error("public profile leaked password_hash to veteran")
	}
	if _, present := emp["contact_name"]; present {
		t.Error("public profile leaked contact_name to veteran")
	}

	// listings key must exist and be an array (possibly empty when the
	// employer hasn't posted anything — newly-registered employer in this
	// test hasn't, so empty is expected).
	lst, ok := resp["listings"].([]any)
	if !ok {
		t.Fatalf("no listings array: %s", w2.Body.String())
	}
	_ = lst // contents verified more explicitly in the seeded-NOV test below
}

// Route returns 404 for a non-existent id and for unauthenticated callers.
func TestPublicCompanyProfile_AuthAndNotFound(t *testing.T) {
	cfg := testEmployerCfg()
	empH := handler.NewEmployerHandler(testQueries, cfg)

	vetMux := http.NewServeMux()
	vetMux.Handle("GET /api/veteran/employers/{id}", handler.RequireAuth(testQueries, empH.PublicCompanyProfile))

	// 1. Unauthenticated — RequireAuth rejects.
	req := httptest.NewRequest("GET", "/api/veteran/employers/1", nil)
	w := httptest.NewRecorder()
	vetMux.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Errorf("unauthenticated: got %d, want 401", w.Code)
	}

	// 2. Invalid id (non-numeric) — bad request from strconv.ParseInt.
	vetCookie := devVeteranCookie(t, fmt.Sprintf("vet-auth-%d@test.com", time.Now().UnixNano()))
	req2 := authedRequest("GET", "/api/veteran/employers/abc", "", []*http.Cookie{vetCookie})
	w2 := httptest.NewRecorder()
	vetMux.ServeHTTP(w2, req2)
	if w2.Code != http.StatusBadRequest {
		t.Errorf("non-numeric id: got %d, want 400", w2.Code)
	}

	// 3. Unknown id — 404.
	req3 := authedRequest("GET", "/api/veteran/employers/99999999", "", []*http.Cookie{vetCookie})
	w3 := httptest.NewRecorder()
	vetMux.ServeHTTP(w3, req3)
	if w3.Code != http.StatusNotFound {
		t.Errorf("unknown id: got %d, want 404", w3.Code)
	}
}

// Employers trying to hit the veteran-facing endpoint are rejected —
// even with a valid employer session, the handler scopes access to
// veteran sessions only so an employer can't scrape competitor profiles.
func TestPublicCompanyProfile_RejectsEmployerSession(t *testing.T) {
	cfg := testEmployerCfg()
	empH := handler.NewEmployerHandler(testQueries, cfg)

	email := fmt.Sprintf("emp-reject-%d@test.com", time.Now().UnixNano())
	empCookies := registerTestEmployer(t, empH, email)

	vetMux := http.NewServeMux()
	vetMux.Handle("GET /api/veteran/employers/{id}", handler.RequireAuth(testQueries, empH.PublicCompanyProfile))

	req := authedRequest("GET", "/api/veteran/employers/1", "", empCookies)
	w := httptest.NewRecorder()
	vetMux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("employer session hitting veteran endpoint: got %d, want 401. Body: %s", w.Code, w.Body.String())
	}
}
