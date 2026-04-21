package jobimport

import (
	"errors"
	"strings"
	"testing"
)

// parseDrafts is the pure parser — hits it directly without needing an
// Anthropic client.

func TestParseDrafts_PlainArray(t *testing.T) {
	raw := `[
		{"title":"Fleet Operations Manager","location":"Houston, TX","salary_min":75000,"salary_max":105000,"employment_type":"full-time","tasks":["Dispatch","Maintenance planning"],"wotc_eligible":true,"civilian_role_id":1},
		{"title":"CDL Driver","location":"Odessa, TX","salary_min":52000,"salary_max":74000,"employment_type":"full-time","tasks":["Route driving"],"wotc_eligible":true,"civilian_role_id":null}
	]`
	drafts, err := parseDrafts(raw)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(drafts) != 2 {
		t.Fatalf("got %d drafts, want 2", len(drafts))
	}
	if drafts[0].Title != "Fleet Operations Manager" {
		t.Errorf("title[0]=%q", drafts[0].Title)
	}
	if drafts[0].CivilianRoleID == nil || *drafts[0].CivilianRoleID != 1 {
		t.Errorf("civilian_role_id[0]=%v", drafts[0].CivilianRoleID)
	}
	if drafts[1].CivilianRoleID != nil {
		t.Errorf("civilian_role_id[1] should be nil, got %v", *drafts[1].CivilianRoleID)
	}
}

// Claude occasionally wraps JSON in a ```json ... ``` fence even though
// we ask it not to. The parser must tolerate that.
func TestParseDrafts_ToleratesCodeFence(t *testing.T) {
	raw := "```json\n" +
		`[{"title":"Warehouse Supervisor","location":"Dallas, TX","salary_min":60000,"salary_max":80000,"employment_type":"full-time","wotc_eligible":true,"civilian_role_id":3}]` +
		"\n```"
	drafts, err := parseDrafts(raw)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(drafts) != 1 || drafts[0].Title != "Warehouse Supervisor" {
		t.Fatalf("unexpected drafts: %+v", drafts)
	}
}

// And sometimes it wraps the array in a one-line prose intro. Still parse.
func TestParseDrafts_ExtractsArrayFromProse(t *testing.T) {
	raw := "Here are the jobs I found: [{\"title\":\"Technician\",\"civilian_role_id\":null}] — let me know if you need more."
	drafts, err := parseDrafts(raw)
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(drafts) != 1 || drafts[0].Title != "Technician" {
		t.Fatalf("unexpected drafts: %+v", drafts)
	}
}

func TestParseDrafts_InvalidJSON(t *testing.T) {
	_, err := parseDrafts("not json")
	if !errors.Is(err, ErrInvalidJSON) {
		t.Fatalf("want ErrInvalidJSON, got %v", err)
	}
}

func TestParseDrafts_EmptyArray(t *testing.T) {
	drafts, err := parseDrafts("[]")
	if err != nil {
		t.Fatalf("unexpected err: %v", err)
	}
	if len(drafts) != 0 {
		t.Errorf("want 0 drafts, got %d", len(drafts))
	}
}

// normalizeDraft is the guardrail layer — catalog validation, enum
// clamping, array cleanup, salary sanity. Exercise each branch.

func TestNormalizeDraft_ClampsEmploymentType(t *testing.T) {
	catalog := map[int32]struct{}{1: {}}
	for _, tt := range []struct {
		in, want string
	}{
		{"full_time", "full-time"},
		{"FULL-TIME", "full-time"},
		{"", "full-time"},
		{"contract", "contract"},
		{"intern", "internship"},
		{"nonsense", "full-time"},
	} {
		d := normalizeDraft(JobDraft{Title: "x", EmploymentType: tt.in}, catalog)
		if d.EmploymentType != tt.want {
			t.Errorf("in=%q: got %q, want %q", tt.in, d.EmploymentType, tt.want)
		}
	}
}

func TestNormalizeDraft_RejectsUnknownCivilianRoleID(t *testing.T) {
	catalog := map[int32]struct{}{1: {}, 2: {}}
	badID := int32(999)
	d := normalizeDraft(JobDraft{Title: "x", CivilianRoleID: &badID}, catalog)
	if d.CivilianRoleID != nil {
		t.Errorf("want civilian_role_id nulled for hallucinated id, got %v", *d.CivilianRoleID)
	}

	goodID := int32(2)
	d = normalizeDraft(JobDraft{Title: "x", CivilianRoleID: &goodID}, catalog)
	if d.CivilianRoleID == nil || *d.CivilianRoleID != 2 {
		t.Errorf("want civilian_role_id=2 preserved, got %v", d.CivilianRoleID)
	}
}

func TestNormalizeDraft_SwapsReversedSalary(t *testing.T) {
	catalog := map[int32]struct{}{}
	d := normalizeDraft(JobDraft{Title: "x", SalaryMin: 100000, SalaryMax: 50000}, catalog)
	if d.SalaryMin != 50000 || d.SalaryMax != 100000 {
		t.Errorf("want swapped salary 50k/100k, got %d/%d", d.SalaryMin, d.SalaryMax)
	}
}

func TestNormalizeDraft_TrimsSliceFields(t *testing.T) {
	catalog := map[int32]struct{}{}
	in := JobDraft{
		Title:        "x",
		Requirements: []string{"  CDL  ", "", "  ", "Team leader"},
		Tasks:        []string{"Drive", "  "},
		MosCodesPreferred: []string{"88m", "", "   92y   ", "logistics operations manager"},
	}
	d := normalizeDraft(in, catalog)
	if len(d.Requirements) != 2 {
		t.Errorf("requirements: %v", d.Requirements)
	}
	if d.Requirements[0] != "CDL" {
		t.Errorf("requirements[0]=%q", d.Requirements[0])
	}
	if len(d.MosCodesPreferred) != 2 || d.MosCodesPreferred[0] != "88M" || d.MosCodesPreferred[1] != "92Y" {
		t.Errorf("mos_codes_preferred=%v (expected [88M, 92Y] — long non-code token dropped)", d.MosCodesPreferred)
	}
}

// Prompt builder smoke test — important because a subtle change to the
// prompt is how Claude drifts; anchor a few required phrases so a
// regression shows up loudly in review.
func TestBuildPrompt_MentionsCatalogAndSchemaRules(t *testing.T) {
	catalog := []CivilianRoleLite{
		{ID: 1, OnetCode: "11-3071.00", Title: "Transportation Manager", Sector: "Logistics"},
	}
	p := buildPrompt("some careers page html here", catalog)

	// The prompt wraps at ~70 cols for readability so we match
	// individual anchor phrases rather than long cross-line substrings.
	for _, phrase := range []string{
		"JSON array",
		"no prose",
		"CIVILIAN_ROLE_CATALOG",
		"Transportation Manager",
		"blue-collar",
		"wotc_eligible",
		"civilian_role_id",
	} {
		if !strings.Contains(p, phrase) {
			t.Errorf("prompt missing required phrase %q", phrase)
		}
	}
	if !strings.Contains(p, "some careers page html here") {
		t.Errorf("source text not embedded in prompt")
	}
}

func TestBuildPrompt_CatalogMarshalsAsCompactJSON(t *testing.T) {
	catalog := []CivilianRoleLite{{ID: 5, OnetCode: "49-9081.00", Title: "Wind Turbine Tech", Sector: "Energy"}}
	p := buildPrompt("x", catalog)
	if !strings.Contains(p, `"id":5`) || !strings.Contains(p, `"onet_code":"49-9081.00"`) {
		t.Errorf("catalog not embedded as compact JSON: %s", p)
	}
}
