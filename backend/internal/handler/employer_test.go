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
