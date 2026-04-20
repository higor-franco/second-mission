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
