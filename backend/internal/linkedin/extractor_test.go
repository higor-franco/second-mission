package linkedin

import (
	"errors"
	"strings"
	"testing"
)

// TestParseProfile_Clean exercises parseProfile against a tidy,
// well-formed JSON response — the happy path Claude hits when it
// follows the prompt. All fields should land on the struct verbatim.
func TestParseProfile_Clean(t *testing.T) {
	raw := `{
		"company_name": "NOV Inc.",
		"sector": "Energy & Oil/Gas",
		"location": "Houston, TX",
		"description": "NOV is a leading provider of equipment and technology to the global oil and gas industry.",
		"tagline": "Powering the industrials that power the world",
		"industry_raw": "Oil and Gas"
	}`
	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.CompanyName != "NOV Inc." {
		t.Errorf("CompanyName = %q", p.CompanyName)
	}
	if p.Sector != "Energy & Oil/Gas" {
		t.Errorf("Sector = %q", p.Sector)
	}
	if p.Location != "Houston, TX" {
		t.Errorf("Location = %q", p.Location)
	}
	if !strings.Contains(p.Description, "equipment and technology") {
		t.Errorf("Description missing expected substring: %q", p.Description)
	}
	if p.Tagline == "" {
		t.Error("expected Tagline to be set")
	}
	if p.IndustryRaw != "Oil and Gas" {
		t.Errorf("IndustryRaw = %q", p.IndustryRaw)
	}
}

// TestParseProfile_FencedJSON covers the case where Claude wraps its
// response in ```json ... ``` despite the prompt. The parser should
// silently strip the fence so callers don't see a JSON error.
func TestParseProfile_FencedJSON(t *testing.T) {
	raw := "```json\n" +
		`{"company_name": "GE Vernova", "sector": "Energy & Oil/Gas", "location": "Cambridge, MA", "description": "Electrification and renewable power.", "tagline": "", "industry_raw": "Electrical Equipment Manufacturing"}` +
		"\n```"
	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.CompanyName != "GE Vernova" {
		t.Errorf("CompanyName = %q", p.CompanyName)
	}
}

// TestParseProfile_ProseAroundJSON covers the case where Claude emits
// a one-line intro before the JSON object. The parser should extract
// the outermost {...} rather than fail.
func TestParseProfile_ProseAroundJSON(t *testing.T) {
	raw := `Here is the extracted profile:

{"company_name": "KBR Inc.", "sector": "Construction", "location": "Houston, TX", "description": "Global engineering & construction firm.", "tagline": "", "industry_raw": "Construction"}

Let me know if you need anything else.`
	p, err := parseProfile(raw)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if p.CompanyName != "KBR Inc." {
		t.Errorf("CompanyName = %q", p.CompanyName)
	}
}

// TestParseProfile_InvalidJSON verifies the error path — when the
// response is neither JSON nor something we can salvage, the parser
// returns ErrInvalidJSON so the handler can surface a clean message.
func TestParseProfile_InvalidJSON(t *testing.T) {
	_, err := parseProfile("not json at all")
	if !errors.Is(err, ErrInvalidJSON) {
		t.Errorf("got err %v, want wrapped ErrInvalidJSON", err)
	}
}

// TestNormalizeSector verifies the enum-pin behavior: exact matches
// pass through, close-but-not-quite matches are blanked, and the match
// is case-insensitive.
func TestNormalizeSector(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"Energy & Oil/Gas", "Energy & Oil/Gas"},
		{"energy & oil/gas", "Energy & Oil/Gas"}, // case-insensitive
		{"Logistics & Supply Chain", "Logistics & Supply Chain"},
		{"Other", "Other"},
		{"Oil & Gas", ""},      // close but not in enum
		{"Healthcare", ""},     // outside our supported set
		{"", ""},               // empty passes through
		{"   Manufacturing   ", "Manufacturing"}, // padding trimmed
	}
	for _, c := range cases {
		if got := normalizeSector(c.in); got != c.want {
			t.Errorf("normalizeSector(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

// TestIsEmptyProfile ensures the "nothing useful came back" gate fires
// in the cases the handler cares about — LinkedIn login-wall response
// often yields an empty profile or company-name-only.
func TestIsEmptyProfile(t *testing.T) {
	cases := []struct {
		name    string
		profile ExtractedProfile
		empty   bool
	}{
		{"all blank", ExtractedProfile{}, true},
		{"only company name", ExtractedProfile{CompanyName: "X Corp"}, true},
		{"company + description", ExtractedProfile{CompanyName: "X Corp", Description: "We do things."}, false},
		{"company + sector", ExtractedProfile{CompanyName: "X Corp", Sector: "Other"}, false},
		{"company + location only", ExtractedProfile{CompanyName: "X Corp", Location: "Austin, TX"}, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := isEmptyProfile(&c.profile); got != c.empty {
				t.Errorf("isEmptyProfile = %v, want %v", got, c.empty)
			}
		})
	}
}

// TestBuildPrompt is a light guard — it just verifies the source text
// makes it into the prompt and the sector enum is rendered so Claude
// sees the full list. We don't check every byte; the prompt is meant
// to evolve, but the "did I include the user input" and "did I include
// the sector list" invariants should never regress.
func TestBuildPrompt(t *testing.T) {
	src := "About NOV: a leading provider of equipment to the oil and gas industry."
	got := buildPrompt(src)
	if !strings.Contains(got, src) {
		t.Error("prompt missing the source text")
	}
	for _, s := range SectorOptions {
		if !strings.Contains(got, s) {
			t.Errorf("prompt missing sector option %q", s)
		}
	}
}
