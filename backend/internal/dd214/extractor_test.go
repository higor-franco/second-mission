package dd214

import (
	"strings"
	"testing"
)

// These tests focus on the pure parsing logic so we don't need a live
// Anthropic API key to exercise them. The Extract() method is covered by
// the handler-level integration tests using a fake Extractor.

func TestParseProfile_CleanJSON(t *testing.T) {
	raw := `{
		"primary_mos": {"code": "88m", "title": "Motor Transport Operator"},
		"secondary_mos": [{"code": "92y", "title": "Unit Supply Specialist"}],
		"additional_skills": ["Air Assault", "5K"],
		"rank": "Staff Sergeant",
		"paygrade": "E-6",
		"years_of_service": 8,
		"military_education": ["Basic Combat Training", "Warrior Leader Course"],
		"decorations": ["Army Commendation Medal", "Good Conduct Medal"],
		"branch": "Army",
		"separation_reason": "Completion of Required Active Service"
	}`

	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("parseProfile returned error: %v", err)
	}

	if p.PrimaryMOS.Code != "88M" {
		t.Errorf("primary MOS code should be uppercased: got %q", p.PrimaryMOS.Code)
	}
	if p.PrimaryMOS.Title != "Motor Transport Operator" {
		t.Errorf("primary MOS title mismatch: %q", p.PrimaryMOS.Title)
	}
	if len(p.SecondaryMOS) != 1 || p.SecondaryMOS[0].Code != "92Y" {
		t.Errorf("secondary MOS should be [92Y], got %+v", p.SecondaryMOS)
	}
	if p.Rank != "Staff Sergeant" {
		t.Errorf("rank mismatch: %q", p.Rank)
	}
	if p.Paygrade != "E-6" {
		t.Errorf("paygrade mismatch: %q", p.Paygrade)
	}
	if p.YearsOfService != 8 {
		t.Errorf("years mismatch: %d", p.YearsOfService)
	}
	if len(p.AdditionalSkills) != 2 {
		t.Errorf("expected 2 additional skills, got %d", len(p.AdditionalSkills))
	}
	if len(p.Decorations) != 2 {
		t.Errorf("expected 2 decorations, got %d", len(p.Decorations))
	}
	if p.Branch != "Army" {
		t.Errorf("branch mismatch: %q", p.Branch)
	}
}

func TestParseProfile_FencedJSON(t *testing.T) {
	// Claude sometimes wraps JSON in a markdown fence despite the prompt.
	raw := "```json\n" + `{
		"primary_mos": {"code": "91B", "title": "Wheeled Vehicle Mechanic"},
		"secondary_mos": [],
		"additional_skills": [],
		"rank": "Sergeant",
		"paygrade": "E-5",
		"years_of_service": 6,
		"military_education": [],
		"decorations": [],
		"branch": "Army",
		"separation_reason": ""
	}` + "\n```"

	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("parseProfile returned error: %v", err)
	}
	if p.PrimaryMOS.Code != "91B" {
		t.Errorf("expected 91B, got %q", p.PrimaryMOS.Code)
	}
}

func TestParseProfile_PaddingBeforeJSON(t *testing.T) {
	// If the model adds a preamble despite instructions, we extract the
	// outermost JSON object and still succeed.
	raw := `Here is the extracted data:

{
  "primary_mos": {"code": "11B", "title": "Infantryman"},
  "secondary_mos": [],
  "additional_skills": [],
  "rank": "",
  "paygrade": "",
  "years_of_service": 0,
  "military_education": [],
  "decorations": [],
  "branch": "Army",
  "separation_reason": ""
}

Let me know if you need anything else.`

	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("parseProfile returned error: %v", err)
	}
	if p.PrimaryMOS.Code != "11B" {
		t.Errorf("expected 11B, got %q", p.PrimaryMOS.Code)
	}
}

func TestParseProfile_InvalidJSON(t *testing.T) {
	_, err := parseProfile("not json at all")
	if err == nil {
		t.Fatal("expected an error for non-JSON input")
	}
	if !strings.Contains(err.Error(), "no JSON object found") {
		t.Errorf("expected 'no JSON object found' error, got: %v", err)
	}
}

func TestParseProfile_MalformedJSON(t *testing.T) {
	_, err := parseProfile(`{"primary_mos": {"code": "88M", "title": "Foo"` /* missing close */)
	if err == nil {
		t.Fatal("expected an error for malformed JSON")
	}
}

func TestAllMOSCodes_PrimaryFirstAndDeduped(t *testing.T) {
	p := ExtractedProfile{
		PrimaryMOS: MOSEntry{Code: "88m"},
		SecondaryMOS: []MOSEntry{
			{Code: "92Y"},
			{Code: "88M"}, // duplicate of primary
			{Code: "  "},  // empty — should be skipped
			{Code: "11B"},
		},
	}
	got := p.AllMOSCodes()
	want := []string{"88M", "92Y", "11B"}
	if len(got) != len(want) {
		t.Fatalf("expected %v, got %v", want, got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("position %d: want %q, got %q", i, want[i], got[i])
		}
	}
}

func TestAllMOSCodes_Empty(t *testing.T) {
	p := ExtractedProfile{}
	got := p.AllMOSCodes()
	if len(got) != 0 {
		t.Errorf("expected empty slice, got %v", got)
	}
}

func TestNewExtractor_RequiresAPIKey(t *testing.T) {
	if _, err := NewExtractor(""); err == nil {
		t.Error("expected error for empty API key")
	}
	if _, err := NewExtractor("   "); err == nil {
		t.Error("expected error for whitespace-only API key")
	}
	if _, err := NewExtractor("sk-ant-xxx"); err != nil {
		t.Errorf("unexpected error for valid key: %v", err)
	}
}
