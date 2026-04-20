package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/higor-franco/second-mission/backend/internal/dd214"
	"github.com/higor-franco/second-mission/backend/internal/handler"
)

// fakeExtractor implements handler.Extractor without calling Anthropic.
type fakeExtractor struct {
	profile *dd214.ExtractedProfile
	err     error
	called  bool
	gotPDF  []byte
}

func (f *fakeExtractor) Extract(ctx context.Context, pdf []byte) (*dd214.ExtractedProfile, error) {
	f.called = true
	f.gotPDF = pdf
	if f.err != nil {
		return nil, f.err
	}
	return f.profile, nil
}

// makeMultipartPDF returns a multipart request body + content type, simulating
// a browser uploading a file with name and type "application/pdf".
func makeMultipartPDF(t *testing.T, filename string, pdfBytes []byte) (*bytes.Buffer, string) {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := part.Write(pdfBytes); err != nil {
		t.Fatalf("part.Write: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("writer.Close: %v", err)
	}
	return &buf, w.FormDataContentType()
}

// A fake PDF — the extractor is mocked, so the actual bytes aren't parsed.
var fakePDF = []byte("%PDF-1.4\n%fakepdf\n%%EOF\n")

func TestDD214_NoExtractorConfigured(t *testing.T) {
	h := handler.NewDD214Handler(testQueries, nil)

	body, ct := makeMultipartPDF(t, "form.pdf", fakePDF)
	req := httptest.NewRequest("POST", "/api/dd214/translate", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when extractor is nil, got %d", w.Code)
	}
}

func TestDD214_RejectsNonPDF(t *testing.T) {
	ext := &fakeExtractor{profile: &dd214.ExtractedProfile{}}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "form.txt", []byte("not a pdf"))
	req := httptest.NewRequest("POST", "/api/dd214/translate", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 for non-PDF, got %d", w.Code)
	}
	if ext.called {
		t.Error("extractor should not be called on non-PDF rejection")
	}
}

func TestDD214_MissingFileField(t *testing.T) {
	ext := &fakeExtractor{profile: &dd214.ExtractedProfile{}}
	h := handler.NewDD214Handler(testQueries, ext)

	// Multipart form with no "file" field.
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	w.WriteField("note", "no file here")
	w.Close()

	req := httptest.NewRequest("POST", "/api/dd214/translate", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	rr := httptest.NewRecorder()
	h.Translate(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 when file field missing, got %d", rr.Code)
	}
}

func TestDD214_ExtractorFailure(t *testing.T) {
	ext := &fakeExtractor{err: errors.New("claude unavailable")}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "form.pdf", fakePDF)
	req := httptest.NewRequest("POST", "/api/dd214/translate", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 when extractor fails, got %d", w.Code)
	}
}

func TestDD214_HappyPath_AggregatesAcrossMOS(t *testing.T) {
	// The fake extractor pretends it read this off the DD-214.
	ext := &fakeExtractor{
		profile: &dd214.ExtractedProfile{
			PrimaryMOS: dd214.MOSEntry{Code: "88M", Title: "Motor Transport Operator"},
			SecondaryMOS: []dd214.MOSEntry{
				{Code: "92Y", Title: "Unit Supply Specialist"},
			},
			AdditionalSkills: []string{"Air Assault"},
			Rank:             "Staff Sergeant",
			Paygrade:         "E-6",
			YearsOfService:   8,
			Branch:           "Army",
		},
	}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	req := httptest.NewRequest("POST", "/api/dd214/translate", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}
	if !ext.called {
		t.Fatal("extractor should have been called")
	}
	if !bytes.Equal(ext.gotPDF, fakePDF) {
		t.Error("extractor should have received the uploaded PDF bytes")
	}

	// Parse response.
	var resp struct {
		Profile struct {
			PrimaryMOS struct {
				Code  string `json:"code"`
				Title string `json:"title"`
			} `json:"primary_mos"`
			SecondaryMOS []struct {
				Code string `json:"code"`
			} `json:"secondary_mos"`
		} `json:"profile"`
		MOSList []struct {
			Code    string `json:"code"`
			Primary bool   `json:"primary"`
			Found   bool   `json:"found"`
		} `json:"mos_list"`
		Roles []struct {
			OnetCode   string `json:"onet_code"`
			MatchScore int    `json:"match_score"`
			BestMOS    string `json:"best_mos"`
			Title      string `json:"title"`
		} `json:"roles"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if resp.Profile.PrimaryMOS.Code != "88M" {
		t.Errorf("expected primary 88M, got %q", resp.Profile.PrimaryMOS.Code)
	}
	if len(resp.MOSList) != 2 {
		t.Fatalf("expected 2 MOS entries, got %d", len(resp.MOSList))
	}
	var foundCount int
	for _, m := range resp.MOSList {
		if m.Found {
			foundCount++
		}
	}
	if foundCount != 2 {
		t.Errorf("expected both MOSes to be found in crosswalk, got %d", foundCount)
	}

	if len(resp.Roles) == 0 {
		t.Fatal("expected at least one matched civilian role")
	}
	// Sorted desc by score.
	for i := 1; i < len(resp.Roles); i++ {
		if resp.Roles[i].MatchScore > resp.Roles[i-1].MatchScore {
			t.Errorf("roles should be sorted desc by score: %d > %d at index %d",
				resp.Roles[i].MatchScore, resp.Roles[i-1].MatchScore, i)
		}
	}
	// Every role should cite a BestMOS from the profile.
	for _, r := range resp.Roles {
		if r.BestMOS != "88M" && r.BestMOS != "92Y" {
			t.Errorf("role %q has unexpected best_mos=%q", r.Title, r.BestMOS)
		}
	}
}

func TestDD214_UnknownMOS_StillReturnsProfile(t *testing.T) {
	// A veteran whose MOS isn't in our crosswalk. We still want to show
	// the extracted profile and a friendly empty roles list — not an error.
	ext := &fakeExtractor{
		profile: &dd214.ExtractedProfile{
			PrimaryMOS: dd214.MOSEntry{Code: "ZZ9", Title: "Fictional Specialty"},
			Branch:     "Army",
		},
	}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	req := httptest.NewRequest("POST", "/api/dd214/translate", body)
	req.Header.Set("Content-Type", ct)
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 even for unknown MOS, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		MOSList []struct {
			Code  string `json:"code"`
			Found bool   `json:"found"`
		} `json:"mos_list"`
		Roles []any `json:"roles"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(resp.MOSList) != 1 || resp.MOSList[0].Code != "ZZ9" || resp.MOSList[0].Found {
		t.Errorf("expected single unfound MOS ZZ9, got %+v", resp.MOSList)
	}
	if len(resp.Roles) != 0 {
		t.Errorf("expected 0 roles for unknown MOS, got %d", len(resp.Roles))
	}
}

// ---------- Authenticated import endpoint (/api/veteran/dd214/import) ----------

// makeDD214ImportRequest builds a POST /api/veteran/dd214/import request
// with a single "file" part, reusing the session cookie returned by the
// dev-login helper. Returns the recorded response.
func runImport(t *testing.T, h *handler.DD214Handler, cookie *http.Cookie, body *bytes.Buffer, ct string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest("POST", "/api/veteran/dd214/import", body)
	req.Header.Set("Content-Type", ct)
	if cookie != nil {
		req.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	wrapped := handler.RequireAuth(testQueries, h.Import)
	wrapped.ServeHTTP(w, req)
	return w
}

func TestDD214Import_RequiresAuth(t *testing.T) {
	ext := &fakeExtractor{profile: &dd214.ExtractedProfile{
		PrimaryMOS: dd214.MOSEntry{Code: "88M"},
	}}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	w := runImport(t, h, nil /* no cookie */, body, ct)

	if w.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 without auth, got %d", w.Code)
	}
	if ext.called {
		t.Error("extractor should not be called when request is unauthenticated")
	}
}

func TestDD214Import_HappyPath_ReturnsProfileSuggestion(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "dd214-import-happy@example.com")

	ext := &fakeExtractor{
		profile: &dd214.ExtractedProfile{
			Name:             "John A. Doe",
			PrimaryMOS:       dd214.MOSEntry{Code: "88M", Title: "Motor Transport Operator"},
			SecondaryMOS:     []dd214.MOSEntry{{Code: "92Y", Title: "Unit Supply Specialist"}},
			AdditionalSkills: []string{"Air Assault"},
			Rank:             "Staff Sergeant",
			Paygrade:         "E-6",
			YearsOfService:   8,
			Branch:           "Army",
			SeparationDate:   "2023-06-15",
		},
	}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	w := runImport(t, h, cookie, body, ct)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", w.Code, w.Body.String())
	}

	var resp struct {
		Profile struct {
			Name           string `json:"name"`
			SeparationDate string `json:"separation_date"`
		} `json:"profile"`
		ProfileSuggestion struct {
			Name             string   `json:"name"`
			MosCode          string   `json:"mos_code"`
			Rank             string   `json:"rank"`
			YearsOfService   int32    `json:"years_of_service"`
			SeparationDate   string   `json:"separation_date"`
			Location         string   `json:"location"`
			PreferredSectors []string `json:"preferred_sectors"`
		} `json:"profile_suggestion"`
		Roles []struct {
			OnetCode   string `json:"onet_code"`
			MatchScore int    `json:"match_score"`
		} `json:"roles"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	// Profile suggestion must be shaped exactly like the PUT /api/veteran/profile body.
	if resp.ProfileSuggestion.Name != "John A. Doe" {
		t.Errorf("suggestion name: got %q", resp.ProfileSuggestion.Name)
	}
	if resp.ProfileSuggestion.MosCode != "88M" {
		t.Errorf("suggestion mos_code: got %q", resp.ProfileSuggestion.MosCode)
	}
	// Rank on the profile form is the paygrade (E-6), not the rank title.
	if resp.ProfileSuggestion.Rank != "E-6" {
		t.Errorf("suggestion rank should be paygrade 'E-6', got %q", resp.ProfileSuggestion.Rank)
	}
	if resp.ProfileSuggestion.YearsOfService != 8 {
		t.Errorf("suggestion years: got %d", resp.ProfileSuggestion.YearsOfService)
	}
	if resp.ProfileSuggestion.SeparationDate != "2023-06-15" {
		t.Errorf("suggestion separation_date: got %q", resp.ProfileSuggestion.SeparationDate)
	}
	// Location isn't on the DD-214; we want an empty string, not garbage.
	if resp.ProfileSuggestion.Location != "" {
		t.Errorf("suggestion location should be empty, got %q", resp.ProfileSuggestion.Location)
	}
	// Preferred sectors must be an empty slice (JSON null would break the frontend).
	if resp.ProfileSuggestion.PreferredSectors == nil {
		t.Error("suggestion preferred_sectors should be an empty slice, not nil")
	}
	if len(resp.ProfileSuggestion.PreferredSectors) != 0 {
		t.Errorf("suggestion preferred_sectors should be empty, got %v", resp.ProfileSuggestion.PreferredSectors)
	}

	// Multi-MOS aggregation still happens on this endpoint too.
	if len(resp.Roles) == 0 {
		t.Error("expected matched civilian roles in import response")
	}
}

func TestDD214Import_RejectsEmployerSession(t *testing.T) {
	// Employers have a separate auth flow; the import endpoint must not
	// accept their sessions even if they somehow land on the route.
	// We fake this by logging in as a veteran, then editing the session
	// row's user_type — but the simpler proof is: the handler should 403
	// any non-veteran session. We assert that contract by calling Import
	// on a freshly-minted veteran cookie and verifying 200, then
	// mutating the session via the queries package.
	cookie := devLoginAndGetCookie(t, "dd214-import-employer-guard@example.com")

	// Flip the user_type on this session to "employer" to simulate.
	_, err := testPool.Exec(context.Background(),
		"UPDATE sessions SET user_type = 'employer' WHERE id = $1", cookie.Value)
	if err != nil {
		t.Fatalf("failed to mutate session: %v", err)
	}

	ext := &fakeExtractor{profile: &dd214.ExtractedProfile{
		PrimaryMOS: dd214.MOSEntry{Code: "88M"},
	}}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	w := runImport(t, h, cookie, body, ct)

	if w.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for non-veteran session, got %d", w.Code)
	}
}

func TestDD214Import_ExtractorFailure(t *testing.T) {
	cookie := devLoginAndGetCookie(t, "dd214-import-fail@example.com")
	ext := &fakeExtractor{err: errors.New("claude unavailable")}
	h := handler.NewDD214Handler(testQueries, ext)

	body, ct := makeMultipartPDF(t, "dd214.pdf", fakePDF)
	w := runImport(t, h, cookie, body, ct)

	if w.Code != http.StatusBadGateway {
		t.Fatalf("expected 502 on extractor failure, got %d", w.Code)
	}
}

func TestDD214_PDFContentTypeCheck(t *testing.T) {
	// Explicitly verify: a file with .pdf extension but text content type
	// is accepted (browsers sometimes send the wrong type).
	ext := &fakeExtractor{profile: &dd214.ExtractedProfile{
		PrimaryMOS: dd214.MOSEntry{Code: "88M"},
	}}
	h := handler.NewDD214Handler(testQueries, ext)

	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	header := make(map[string][]string)
	header["Content-Disposition"] = []string{`form-data; name="file"; filename="form.pdf"`}
	header["Content-Type"] = []string{"application/octet-stream"}
	part, err := mw.CreatePart(header)
	if err != nil {
		t.Fatalf("CreatePart: %v", err)
	}
	part.Write(fakePDF)
	mw.Close()

	req := httptest.NewRequest("POST", "/api/dd214/translate", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	w := httptest.NewRecorder()
	h.Translate(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected 200 for .pdf with octet-stream type, got %d: %s",
			w.Code, strings.TrimSpace(w.Body.String()))
	}
}
