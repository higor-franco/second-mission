package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/handler"
)

func TestSendMagicLink_ValidEmail(t *testing.T) {
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	body := `{"email":"test-magic@example.com"}`
	req := httptest.NewRequest("POST", "/auth/magic-link", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.SendMagicLink(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("got status %d, want 200", w.Code)
	}

	var resp map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["message"] == "" {
		t.Error("expected a message in response")
	}
}

func TestSendMagicLink_InvalidEmail(t *testing.T) {
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	tests := []struct {
		name string
		body string
	}{
		{"empty body", `{}`},
		{"empty email", `{"email":""}`},
		{"no @ sign", `{"email":"notanemail"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("POST", "/auth/magic-link", bytes.NewBufferString(tt.body))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			h.SendMagicLink(w, req)

			if w.Code != http.StatusBadRequest {
				t.Errorf("got status %d, want 400", w.Code)
			}
		})
	}
}

func TestDevLogin_CreatesSession(t *testing.T) {
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	body := `{"email":"devlogin-test@example.com"}`
	req := httptest.NewRequest("POST", "/api/dev/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.DevLogin(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	// Check that a session cookie was set
	cookies := w.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "session_id" {
			sessionCookie = c
			break
		}
	}
	if sessionCookie == nil {
		t.Fatal("expected session_id cookie to be set")
	}
	if sessionCookie.Value == "" {
		t.Error("session_id cookie should not be empty")
	}

	// Test /api/auth/me through the auth middleware
	mux := http.NewServeMux()
	mux.Handle("GET /api/auth/me", handler.RequireAuth(testQueries, h.Me))
	meReq2 := httptest.NewRequest("GET", "/api/auth/me", nil)
	meReq2.AddCookie(sessionCookie)
	meW2 := httptest.NewRecorder()
	mux.ServeHTTP(meW2, meReq2)

	if meW2.Code != http.StatusOK {
		t.Errorf("GET /api/auth/me got status %d, want 200. Body: %s", meW2.Code, meW2.Body.String())
	}

	var meResp map[string]any
	if err := json.Unmarshal(meW2.Body.Bytes(), &meResp); err != nil {
		t.Fatalf("failed to parse me response: %v", err)
	}
	if meResp["email"] != "devlogin-test@example.com" {
		t.Errorf("expected email devlogin-test@example.com, got %v", meResp["email"])
	}
}

func TestLogout_ClearsCookie(t *testing.T) {
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	// First login
	body := `{"email":"logout-test@example.com"}`
	loginReq := httptest.NewRequest("POST", "/api/dev/login", bytes.NewBufferString(body))
	loginReq.Header.Set("Content-Type", "application/json")
	loginW := httptest.NewRecorder()
	h.DevLogin(loginW, loginReq)

	var sessionCookie *http.Cookie
	for _, c := range loginW.Result().Cookies() {
		if c.Name == "session_id" {
			sessionCookie = c
			break
		}
	}

	// Now logout
	logoutReq := httptest.NewRequest("POST", "/api/auth/logout", nil)
	logoutReq.AddCookie(sessionCookie)
	logoutW := httptest.NewRecorder()
	h.Logout(logoutW, logoutReq)

	if logoutW.Code != http.StatusOK {
		t.Errorf("logout got status %d, want 200", logoutW.Code)
	}

	// Verify cookie is cleared (MaxAge = -1)
	for _, c := range logoutW.Result().Cookies() {
		if c.Name == "session_id" && c.MaxAge != -1 {
			t.Errorf("expected session cookie MaxAge=-1, got %d", c.MaxAge)
		}
	}
}

func TestMe_Unauthenticated(t *testing.T) {
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	mux := http.NewServeMux()
	mux.Handle("GET /api/auth/me", handler.RequireAuth(testQueries, h.Me))

	req := httptest.NewRequest("GET", "/api/auth/me", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}
