package handler_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/higor-franco/second-mission/backend/internal/handler"
)

func TestOpportunities_WithMOS(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "opps-mos-test@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))
	mux.Handle("GET /api/veteran/opportunities", handler.RequireAuth(testQueries, vh.Opportunities))

	// Set MOS code
	profileBody := `{"name": "Ops Test", "mos_code": "88M", "rank": "E-5", "years_of_service": 5}`
	profileReq := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(profileBody))
	profileReq.Header.Set("Content-Type", "application/json")
	profileReq.AddCookie(cookie)
	profileW := httptest.NewRecorder()
	mux.ServeHTTP(profileW, profileReq)
	if profileW.Code != http.StatusOK {
		t.Fatalf("profile setup got %d: %s", profileW.Code, profileW.Body.String())
	}

	// Get opportunities
	req := httptest.NewRequest("GET", "/api/veteran/opportunities", nil)
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

	opps, ok := resp["opportunities"].([]any)
	if !ok {
		t.Fatal("expected opportunities array in response")
	}
	// 88M has job listings seeded — expect at least one
	if len(opps) == 0 {
		t.Error("expected at least one matched opportunity for MOS 88M")
	}

	// Verify journey_step is included in response
	if resp["journey_step"] == nil {
		t.Error("expected journey_step in opportunities response")
	}

	// Verify structure of first opportunity
	first, ok := opps[0].(map[string]any)
	if !ok {
		t.Fatal("expected opportunity to be an object")
	}
	if first["title"] == nil {
		t.Error("expected title in opportunity")
	}
	if first["company_name"] == nil {
		t.Error("expected company_name in opportunity")
	}
	if first["match_score"] == nil {
		t.Error("expected match_score in opportunity")
	}
	if first["wotc_eligible"] == nil {
		t.Error("expected wotc_eligible in opportunity")
	}
}

func TestOpportunities_WithoutMOS(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "opps-nomos@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("GET /api/veteran/opportunities", handler.RequireAuth(testQueries, vh.Opportunities))

	req := httptest.NewRequest("GET", "/api/veteran/opportunities", nil)
	req.AddCookie(cookie)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("got status %d, want 200", w.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse: %v", err)
	}

	opps, ok := resp["opportunities"].([]any)
	if !ok {
		t.Fatal("expected opportunities array")
	}
	if len(opps) != 0 {
		t.Errorf("expected empty opportunities for veteran without MOS, got %d", len(opps))
	}
	if resp["message"] == nil {
		t.Error("expected message when no MOS set")
	}
}

func TestOpportunities_Unauthenticated(t *testing.T) {
	vh := handler.NewVeteranHandler(testQueries)
	mux := http.NewServeMux()
	mux.Handle("GET /api/veteran/opportunities", handler.RequireAuth(testQueries, vh.Opportunities))

	req := httptest.NewRequest("GET", "/api/veteran/opportunities", nil)
	w := httptest.NewRecorder()
	mux.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("got status %d, want 401", w.Code)
	}
}

func TestExpressInterest_HappyPath(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "interest-test@example.com")
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))
	mux.Handle("GET /api/veteran/opportunities", handler.RequireAuth(testQueries, vh.Opportunities))
	mux.Handle("POST /api/veteran/applications", handler.RequireAuth(testQueries, vh.ExpressInterest))
	mux.Handle("GET /api/veteran/applications", handler.RequireAuth(testQueries, vh.Applications))

	// Set MOS code first
	profileBody := `{"name": "Interest Test", "mos_code": "88M", "rank": "E-5", "years_of_service": 4}`
	profileReq := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(profileBody))
	profileReq.Header.Set("Content-Type", "application/json")
	profileReq.AddCookie(cookie)
	profileW := httptest.NewRecorder()
	mux.ServeHTTP(profileW, profileReq)
	if profileW.Code != http.StatusOK {
		t.Fatalf("profile setup got %d", profileW.Code)
	}

	// Get an opportunity to get a valid job listing ID
	oppsReq := httptest.NewRequest("GET", "/api/veteran/opportunities", nil)
	oppsReq.AddCookie(cookie)
	oppsW := httptest.NewRecorder()
	mux.ServeHTTP(oppsW, oppsReq)
	if oppsW.Code != http.StatusOK {
		t.Fatalf("opportunities got %d: %s", oppsW.Code, oppsW.Body.String())
	}

	var oppsResp map[string]any
	if err := json.Unmarshal(oppsW.Body.Bytes(), &oppsResp); err != nil {
		t.Fatalf("failed to parse opportunities: %v", err)
	}
	opps, _ := oppsResp["opportunities"].([]any)
	if len(opps) == 0 {
		t.Skip("no opportunities available for test")
	}
	firstOpp, _ := opps[0].(map[string]any)
	jobID := int(firstOpp["id"].(float64))

	// Express interest
	interestBody, _ := json.Marshal(map[string]any{"job_listing_id": jobID})
	interestReq := httptest.NewRequest("POST", "/api/veteran/applications", bytes.NewReader(interestBody))
	interestReq.Header.Set("Content-Type", "application/json")
	interestReq.AddCookie(cookie)
	interestW := httptest.NewRecorder()
	mux.ServeHTTP(interestW, interestReq)

	if interestW.Code != http.StatusOK {
		t.Fatalf("express interest got %d: %s", interestW.Code, interestW.Body.String())
	}

	var appResp map[string]any
	if err := json.Unmarshal(interestW.Body.Bytes(), &appResp); err != nil {
		t.Fatalf("failed to parse application response: %v", err)
	}
	app, ok := appResp["application"].(map[string]any)
	if !ok {
		t.Fatal("expected application object in response")
	}
	if app["status"] != "interested" {
		t.Errorf("expected status 'interested', got %v", app["status"])
	}
	if appResp["journey_step"] == nil {
		t.Error("expected journey_step in express interest response")
	}
}

func TestJourney_UpdatesOnMOSSet(t *testing.T) {
	cookie := devLoginAndGetCookie(t, fmt.Sprintf("journey-test-%d@example.com", time.Now().UnixNano()))
	vh := handler.NewVeteranHandler(testQueries)

	mux := http.NewServeMux()
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(testQueries, vh.UpdateProfile))
	mux.Handle("GET /api/veteran/journey", handler.RequireAuth(testQueries, vh.Journey))

	// Check initial journey step
	journeyReq1 := httptest.NewRequest("GET", "/api/veteran/journey", nil)
	journeyReq1.AddCookie(cookie)
	journeyW1 := httptest.NewRecorder()
	mux.ServeHTTP(journeyW1, journeyReq1)
	if journeyW1.Code != http.StatusOK {
		t.Fatalf("journey got %d", journeyW1.Code)
	}
	var j1 map[string]any
	json.Unmarshal(journeyW1.Body.Bytes(), &j1)
	if j1["journey_step"] != "discover" {
		t.Errorf("expected initial journey_step 'discover', got %v", j1["journey_step"])
	}

	// Set MOS
	profileBody := `{"name": "Journey Test", "mos_code": "88M", "rank": "E-5", "years_of_service": 3}`
	profileReq := httptest.NewRequest("PUT", "/api/veteran/profile", bytes.NewBufferString(profileBody))
	profileReq.Header.Set("Content-Type", "application/json")
	profileReq.AddCookie(cookie)
	profileW := httptest.NewRecorder()
	mux.ServeHTTP(profileW, profileReq)
	if profileW.Code != http.StatusOK {
		t.Fatalf("profile got %d: %s", profileW.Code, profileW.Body.String())
	}

	// Check journey advanced
	journeyReq2 := httptest.NewRequest("GET", "/api/veteran/journey", nil)
	journeyReq2.AddCookie(cookie)
	journeyW2 := httptest.NewRecorder()
	mux.ServeHTTP(journeyW2, journeyReq2)
	var j2 map[string]any
	json.Unmarshal(journeyW2.Body.Bytes(), &j2)

	step := j2["journey_step"].(string)
	if step == "discover" {
		t.Error("expected journey to advance past 'discover' after setting MOS")
	}
}
