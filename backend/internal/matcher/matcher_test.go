package matcher

import (
	"testing"
)

func TestComputeScore_HighMatchAllDimensions(t *testing.T) {
	vet := VeteranProfile{
		MOSCode:          "88M",
		PreferredSectors: []string{"Logistics"},
		Location:         "Houston, TX",
		YearsOfService:   6,
	}
	listing := JobListing{
		ID:                 1,
		Title:              "Fleet Operations Manager",
		Sector:             "Logistics",
		Location:           "Houston, TX",
		Requirements:       []string{"CDL preferred", "Fleet management experience", "Team leadership"},
		Tasks:              []string{"Fleet coordination", "Maintenance scheduling", "Driver assignments"},
		MOSCodesPreferred:  []string{"88M", "92Y"},
		TransferableSkills: []string{"vehicle operation", "fleet management", "safety compliance"},
		MOSBaseScore:       95,
	}

	score := ComputeScore(vet, listing)

	if score.HybridScore < 80 {
		t.Errorf("expected high hybrid score for perfect match, got %d", score.HybridScore)
	}
	if score.MOSBaseScore != 95 {
		t.Errorf("expected MOS base score 95, got %d", score.MOSBaseScore)
	}
	if score.SectorAlignment != 100 {
		t.Errorf("expected sector alignment 100 for direct match, got %d", score.SectorAlignment)
	}
	if score.MOSPreference != 100 {
		t.Errorf("expected MOS preference 100 when MOS is preferred, got %d", score.MOSPreference)
	}
	if score.LocationMatch != 100 {
		t.Errorf("expected location match 100 for same city, got %d", score.LocationMatch)
	}
	if score.Explanation == "" {
		t.Error("expected non-empty explanation")
	}
}

func TestComputeScore_LowMatchDifferentEverything(t *testing.T) {
	vet := VeteranProfile{
		MOSCode:          "68W",
		PreferredSectors: []string{"Healthcare"},
		Location:         "San Antonio, TX",
		YearsOfService:   3,
	}
	listing := JobListing{
		ID:                 2,
		Title:              "Wind Turbine Technician",
		Sector:             "Energy",
		Location:           "Sweetwater, TX",
		Requirements:       []string{"Mechanical aptitude", "Heights work"},
		Tasks:              []string{"Turbine maintenance", "Electrical diagnostics"},
		MOSCodesPreferred:  []string{"15T", "91B"},
		TransferableSkills: []string{"patient care", "emergency response", "triage"},
		MOSBaseScore:       70,
	}

	score := ComputeScore(vet, listing)

	if score.HybridScore >= 80 {
		t.Errorf("expected lower hybrid score for mismatched profile, got %d", score.HybridScore)
	}
	if score.SectorAlignment >= 50 {
		t.Errorf("expected low sector alignment for Healthcare vs Energy, got %d", score.SectorAlignment)
	}
	if score.MOSPreference >= 50 {
		t.Errorf("expected low MOS preference when MOS not preferred, got %d", score.MOSPreference)
	}
}

func TestComputeScore_NoPreferencesNeutral(t *testing.T) {
	vet := VeteranProfile{
		MOSCode:          "88M",
		PreferredSectors: nil, // no preferences
		Location:         "",  // no location
		YearsOfService:   0,
	}
	listing := JobListing{
		ID:                 3,
		Title:              "CDL Driver",
		Sector:             "Logistics",
		Location:           "Houston, TX",
		Requirements:       nil,
		Tasks:              nil,
		MOSCodesPreferred:  nil,
		TransferableSkills: nil,
		MOSBaseScore:       90,
	}

	score := ComputeScore(vet, listing)

	// With no preferences, sector/location/MOS should be neutral (50-60)
	if score.SectorAlignment < 50 || score.SectorAlignment > 70 {
		t.Errorf("expected neutral sector alignment, got %d", score.SectorAlignment)
	}
	if score.LocationMatch < 40 || score.LocationMatch > 60 {
		t.Errorf("expected neutral location match, got %d", score.LocationMatch)
	}
	if score.MOSPreference < 40 || score.MOSPreference > 60 {
		t.Errorf("expected neutral MOS preference, got %d", score.MOSPreference)
	}
}

func TestFuzzyMatch(t *testing.T) {
	tests := []struct {
		name   string
		skill  string
		target string
		want   bool
	}{
		{"exact substring", "safety compliance", "safety compliance training", true},
		{"word overlap", "team leadership", "crew leadership skills", true},
		{"partial word match", "vehicle operation", "vehicle inspection and operation", true},
		{"no match", "patient care", "turbine maintenance", false},
		{"short words only - full substring match", "of the", "of the something", true},
		{"short words only - no substring", "of the", "within these items", false},
		{"single significant word match", "maintenance scheduling", "maintenance planning", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			words := splitWords(tt.skill)
			got := fuzzyMatch(words, tt.target)
			if got != tt.want {
				t.Errorf("fuzzyMatch(%q, %q) = %v, want %v", tt.skill, tt.target, got, tt.want)
			}
		})
	}
}

// splitWords is a test helper that mirrors what computeSkillsOverlap does internally.
func splitWords(s string) []string {
	var words []string
	for _, w := range splitFields(s) {
		words = append(words, w)
	}
	return words
}

func splitFields(s string) []string {
	var result []string
	current := ""
	for _, c := range s {
		if c == ' ' || c == '\t' || c == '\n' {
			if current != "" {
				result = append(result, current)
				current = ""
			}
		} else {
			current += string(c)
		}
	}
	if current != "" {
		result = append(result, current)
	}
	return result
}

func TestComputeSkillsOverlap(t *testing.T) {
	skills := []string{"vehicle operation", "cargo handling", "safety compliance", "route planning"}
	tasks := []string{"Fleet coordination", "Driver assignments", "Safety protocols"}
	reqs := []string{"CDL preferred", "Route planning experience"}

	matched, score := computeSkillsOverlap(skills, tasks, reqs)

	if score < 50 {
		t.Errorf("expected reasonable skills overlap score, got %d", score)
	}
	if len(matched) == 0 {
		t.Error("expected at least some matched skills")
	}
	t.Logf("Matched skills: %v, score: %d", matched, score)
}

func TestComputeLocationMatch(t *testing.T) {
	tests := []struct {
		name     string
		vetLoc   string
		jobLoc   string
		minScore int
		maxScore int
	}{
		{"same city", "Houston, TX", "Houston, TX", 100, 100},
		{"same region", "Katy, TX", "Houston, TX", 85, 100},
		{"adjacent regions", "Houston, TX", "Austin, TX", 60, 70},
		{"different regions", "Houston, TX", "Odessa, TX", 30, 50},
		{"empty vet location", "", "Houston, TX", 45, 55},
		{"both empty", "", "", 45, 55},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := computeLocationMatch(tt.vetLoc, tt.jobLoc)
			if score < tt.minScore || score > tt.maxScore {
				t.Errorf("computeLocationMatch(%q, %q) = %d, want [%d, %d]",
					tt.vetLoc, tt.jobLoc, score, tt.minScore, tt.maxScore)
			}
		})
	}
}

func TestComputeSectorAlignment(t *testing.T) {
	tests := []struct {
		name     string
		prefs    []string
		sector   string
		expected int
	}{
		{"direct match", []string{"Energy", "Logistics"}, "Energy", 100},
		{"related sector", []string{"Maintenance"}, "Energy", 70},
		{"no match", []string{"Healthcare"}, "Energy", 30},
		{"no preferences", nil, "Energy", 60},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := computeSectorAlignment(tt.prefs, tt.sector)
			if score != tt.expected {
				t.Errorf("computeSectorAlignment(%v, %q) = %d, want %d",
					tt.prefs, tt.sector, score, tt.expected)
			}
		})
	}
}

func TestComputeMOSPreference(t *testing.T) {
	tests := []struct {
		name     string
		vetMOS   string
		prefs    []string
		expected int
	}{
		{"MOS in preferred list", "88M", []string{"88M", "92Y"}, 100},
		{"MOS not in list", "68W", []string{"88M", "92Y"}, 20},
		{"empty preferences", "88M", nil, 50},
		{"case insensitive", "88m", []string{"88M"}, 100},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			score := computeMOSPreference(tt.vetMOS, tt.prefs)
			if score != tt.expected {
				t.Errorf("computeMOSPreference(%q, %v) = %d, want %d",
					tt.vetMOS, tt.prefs, score, tt.expected)
			}
		})
	}
}

func TestBuildExplanation(t *testing.T) {
	explanation := buildExplanation(90, 85, 100, 100, 90, "Fleet Manager")
	if explanation == "" {
		t.Error("expected non-empty explanation")
	}
	t.Log("Explanation:", explanation)
}

func TestHybridScoreClamped(t *testing.T) {
	vet := VeteranProfile{
		MOSCode:          "88M",
		PreferredSectors: []string{"Logistics"},
		Location:         "Houston, TX",
	}
	listing := JobListing{
		MOSBaseScore:       100,
		TransferableSkills: []string{"a", "b", "c"},
		Tasks:              []string{"a", "b", "c"},
		MOSCodesPreferred:  []string{"88M"},
		Sector:             "Logistics",
		Location:           "Houston, TX",
	}
	score := ComputeScore(vet, listing)
	if score.HybridScore > 100 || score.HybridScore < 0 {
		t.Errorf("hybrid score out of bounds: %d", score.HybridScore)
	}
}
