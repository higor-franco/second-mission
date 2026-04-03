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

func testAdminCfg() config.Config {
	return config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
}

func devAdminLogin(t *testing.T, h *handler.AdminHandler) []*http.Cookie {
	t.Helper()
	email := fmt.Sprintf("admin-test-%d@test.com", time.Now().UnixNano())
	body := fmt.Sprintf(`{"email":"%s"}`, email)
	req := httptest.NewRequest("POST", "/api/dev/admin-login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.DevLogin(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("dev admin login: got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}
	return w.Result().Cookies()
}

// serveWithAuth wraps a handler function through RequireAuth middleware
func serveWithAuth(handlerFunc http.HandlerFunc, cookies []*http.Cookie, method, url, body string) *httptest.ResponseRecorder {
	wrapped := handler.RequireAuth(testQueries, handlerFunc)
	req := authedRequest(method, url, body, cookies)
	w := httptest.NewRecorder()
	wrapped.ServeHTTP(w, req)
	return w
}

// --- Login tests ---

func TestAdminLogin_InvalidCredentials(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	body := `{"email":"nonexistent@test.com","password":"wrongpass"}`
	req := httptest.NewRequest("POST", "/api/admin/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Login(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

func TestAdminLogin_MissingEmail(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	body := `{"email":"","password":"test"}`
	req := httptest.NewRequest("POST", "/api/admin/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.Login(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", w.Code)
	}
}

func TestAdminDevLogin_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	if len(cookies) == 0 {
		t.Fatal("expected session cookie")
	}

	found := false
	for _, c := range cookies {
		if c.Name == "session_id" && c.Value != "" {
			found = true
		}
	}
	if !found {
		t.Error("session_id cookie not found")
	}
}

// --- Me endpoint tests ---

func TestAdminMe_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.Me, cookies, "GET", "/api/admin/me", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if resp["email"] == nil || resp["email"] == "" {
		t.Error("expected email in response")
	}
}

func TestAdminMe_Unauthenticated(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	w := serveWithAuth(h.Me, nil, "GET", "/api/admin/me", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

// --- Stats endpoint tests ---

func TestAdminStats_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.Stats, cookies, "GET", "/api/admin/stats", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if _, ok := resp["total_veterans"]; !ok {
		t.Error("expected total_veterans in response")
	}
	if _, ok := resp["total_employers"]; !ok {
		t.Error("expected total_employers in response")
	}
}

func TestAdminStats_Unauthenticated(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	w := serveWithAuth(h.Stats, nil, "GET", "/api/admin/stats", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

// --- Veterans list tests ---

func TestAdminListVeterans_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.ListVeterans, cookies, "GET", "/api/admin/veterans", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp []map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp) == 0 {
		t.Error("expected at least one veteran")
	}
}

// --- Employers list tests ---

func TestAdminListEmployers_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.ListEmployers, cookies, "GET", "/api/admin/employers", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp []map[string]any
	json.Unmarshal(w.Body.Bytes(), &resp)
	if len(resp) == 0 {
		t.Error("expected at least one employer")
	}
}

// --- Activity logs tests ---

func TestAdminActivityLogs_AllUsers(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.ActivityLogs, cookies, "GET", "/api/admin/activity", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp []map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("expected JSON array, got: %s", w.Body.String())
	}
}

func TestAdminActivityLogs_PerUser(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.ActivityLogs, cookies, "GET", "/api/admin/activity?user_type=veteran&user_id=1&sessions=10", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}
}

func TestAdminActivityLogs_InvalidUserType(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.ActivityLogs, cookies, "GET", "/api/admin/activity?user_type=invalid&user_id=1", "")

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", w.Code)
	}
}

func TestAdminActivityLogs_Unauthenticated(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	w := serveWithAuth(h.ActivityLogs, nil, "GET", "/api/admin/activity", "")
	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

// --- Sessions endpoint tests ---

func TestAdminUserSessions_Success(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.UserSessions, cookies, "GET", "/api/admin/sessions?user_type=veteran&user_id=1&limit=10", "")

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}
}

func TestAdminUserSessions_MissingParams(t *testing.T) {
	cfg := testAdminCfg()
	h := handler.NewAdminHandler(testQueries, cfg)

	cookies := devAdminLogin(t, h)
	w := serveWithAuth(h.UserSessions, cookies, "GET", "/api/admin/sessions", "")

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400", w.Code)
	}
}

// --- Non-admin session rejected ---

func TestAdminEndpoints_RejectNonAdmin(t *testing.T) {
	cfg := testAdminCfg()
	adminH := handler.NewAdminHandler(testQueries, cfg)

	// Create a veteran session
	authH := handler.NewAuthHandler(testQueries, config.Config{DevMode: true, BaseURL: "http://localhost:5173"})
	email := fmt.Sprintf("vet-admin-reject-%d@test.com", time.Now().UnixNano())
	body := fmt.Sprintf(`{"email":"%s"}`, email)
	req := httptest.NewRequest("POST", "/api/dev/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	authH.DevLogin(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("dev login: got %d", w.Code)
	}
	vetCookies := w.Result().Cookies()

	// Try admin endpoints with veteran cookies — should be rejected
	tests := []struct {
		name    string
		handler http.HandlerFunc
	}{
		{"me", adminH.Me},
		{"stats", adminH.Stats},
		{"veterans", adminH.ListVeterans},
		{"employers", adminH.ListEmployers},
		{"activity", adminH.ActivityLogs},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := serveWithAuth(tc.handler, vetCookies, "GET", "/api/admin/"+tc.name, "")
			if w.Code != http.StatusUnauthorized {
				t.Errorf("%s: got status %d, want 401", tc.name, w.Code)
			}
		})
	}
}
