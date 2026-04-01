package handler_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/higor-franco/second-mission/backend/internal/handler"
)

func TestTranslate_ValidMOS(t *testing.T) {
	h := handler.NewMOSHandler(testQueries)

	tests := []struct {
		name       string
		mos        string
		wantStatus int
		wantRoles  bool
	}{
		{"88M returns matches", "88M", http.StatusOK, true},
		{"91B returns matches", "91B", http.StatusOK, true},
		{"92Y returns matches", "92Y", http.StatusOK, true},
		{"12B returns matches", "12B", http.StatusOK, true},
		{"68W returns matches", "68W", http.StatusOK, true},
		{"lowercase input normalized", "88m", http.StatusOK, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/translate?mos="+tt.mos, nil)
			w := httptest.NewRecorder()
			h.Translate(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}

			if tt.wantRoles {
				var resp handler.TranslateResponse
				if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
					t.Fatalf("failed to parse response: %v", err)
				}
				if len(resp.Roles) == 0 {
					t.Error("expected roles, got none")
				}
				// Verify roles are sorted by match_score descending
				for i := 1; i < len(resp.Roles); i++ {
					if resp.Roles[i].MatchScore > resp.Roles[i-1].MatchScore {
						t.Errorf("roles not sorted by match_score: %d > %d at index %d",
							resp.Roles[i].MatchScore, resp.Roles[i-1].MatchScore, i)
					}
				}
				// Verify each role has required fields
				for _, role := range resp.Roles {
					if role.Title == "" {
						t.Error("role has empty title")
					}
					if role.Sector == "" {
						t.Error("role has empty sector")
					}
					if role.MatchScore < 0 || role.MatchScore > 100 {
						t.Errorf("match_score %d out of range [0,100]", role.MatchScore)
					}
					if role.SalaryMin <= 0 || role.SalaryMax <= 0 {
						t.Error("salary values should be positive")
					}
					if len(role.TransferableSkills) == 0 {
						t.Error("role should have transferable skills")
					}
				}
			}
		})
	}
}

func TestTranslate_InvalidMOS(t *testing.T) {
	h := handler.NewMOSHandler(testQueries)

	tests := []struct {
		name       string
		query      string
		wantStatus int
	}{
		{"missing mos param", "/api/translate", http.StatusBadRequest},
		{"empty mos param", "/api/translate?mos=", http.StatusBadRequest},
		{"unknown MOS code", "/api/translate?mos=ZZZZZ", http.StatusNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tt.query, nil)
			w := httptest.NewRecorder()
			h.Translate(w, req)

			if w.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", w.Code, tt.wantStatus)
			}
		})
	}
}

func TestListMOSCodes(t *testing.T) {
	h := handler.NewMOSHandler(testQueries)

	req := httptest.NewRequest("GET", "/api/mos-codes", nil)
	w := httptest.NewRecorder()
	h.ListMOSCodes(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("got status %d, want 200", w.Code)
	}

	var codes []struct {
		Code  string `json:"code"`
		Title string `json:"title"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &codes); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}

	if len(codes) < 6 {
		t.Errorf("expected at least 6 MOS codes, got %d", len(codes))
	}

	// Verify sorted by code
	for i := 1; i < len(codes); i++ {
		if codes[i].Code < codes[i-1].Code {
			t.Errorf("codes not sorted: %s < %s", codes[i].Code, codes[i-1].Code)
		}
	}
}
