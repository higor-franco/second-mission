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

// devLoginAndGetCookie is a test helper that logs in via dev endpoint and returns the session cookie.
func devLoginAndGetCookie(t *testing.T, email string) *http.Cookie {
	t.Helper()
	cfg := config.Config{DevMode: true, BaseURL: "http://localhost:5173"}
	h := handler.NewAuthHandler(testQueries, cfg)

	body := `{"email":"` + email + `"}`
	req := httptest.NewRequest("POST", "/api/dev/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.DevLogin(w, req)

	for _, c := range w.Result().Cookies() {
		if c.Name == "session_id" {
			return c
		}
	}
	t.Fatal("dev login did not return session cookie")
	return nil
}

func TestUpdateProfile_HappyPath(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "profile-test@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))

	body := `{
		"name": "John Doe",
		"mos_code": "88M",
		"rank": "E-5",
		"years_of_service": 6,
		"separation_date": "2026-09-15",
		"location": "Killeen, TX",
		"preferred_sectors": ["Energy", "Logistics"]
	}`

	req := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200. Body: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if resp["name"] != "John Doe" {
		t.Errorf("expected name John Doe, got %v", resp["name"])
	}
	if resp["mos_code"] != "88M" {
		t.Errorf("expected mos_code 88M, got %v", resp["mos_code"])
	}
	if resp["rank"] != "E-5" {
		t.Errorf("expected rank E-5, got %v", resp["rank"])
	}
	if resp["profile_complete"] != true {
		t.Error("expected profile_complete to be true")
	}
}

func TestUpdateProfile_MissingName(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "profile-noname@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))

	body := `{"name": "", "mos_code": "88M"}`
	req := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("got status %d, want 400. Body: %s", w.Code, w.Body.String())
	}
}

func TestUpdateProfile_Unauthenticated(t *testing.T) {
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))

	body := `{"name": "Test"}`
	req := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

func TestMatches_WithMOS(t *testing.T) {
	// Login and set profile with MOS code
	cookie := devLoginAndGetCookie(t, "matches-test@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))
	mux.Handle("GET /api/veteran/matches", handler.RequireAuth(testQueries, vh.Matches))

	// Set profile with MOS
	profileBody := `{"name": "Match Test", "mos_code": "88M", "rank": "E-5", "years_of_service": 4}`
	profileReq := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(profileBody))
	profileReq.Header.Set("Content-Type", "application/json")
	profileReq.AddCookie(cookie)
	profileW := httptest.NewRecorder()
	mux.ServeHTTP(profileW, profileReq)

	if profileW.Code != http.StatusOK {
		t.Fatalf("profile update got status %d: %s", profileW.Code, profileW.Body.String())
	}

	// Get matches
	matchReq := httptest.NewRequest("GET", "/api/veteran/matches", nil)
	matchReq.AddCookie(cookie)
	matchW := httptest.NewRecorder()
	mux.ServeHTTP(matchW, matchReq)

	if matchW.Code != http.StatusOK {
		t.Fatalf("matches got status %d: %s", matchW.Code, matchW.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(matchW.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	roles, ok := resp["roles"].([]any)
	if !ok {
		t.Fatal("expected roles array in response")
	}
	if len(roles) == 0 {
		t.Error("expected at least one matched role for MOS 88M")
	}
}

func TestMatches_WithoutMOS(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "matches-nomos@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("GET /api/veteran/matches", handler.RequireAuth(testQueries, vh.Matches))

	req := httptest.NewRequest("GET", "/api/veteran/matches", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d: %s", w.Code, w.Body.String())
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	roles, ok := resp["roles"].([]any)
	if !ok {
		t.Fatal("expected roles array")
	}
	if len(roles) != 0 {
		t.Errorf("expected empty roles for veteran without MOS, got %d", len(roles))
	}
}
