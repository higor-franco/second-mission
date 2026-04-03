// Package matcher implements the hybrid AI matching engine for Second Mission.
//
// The engine computes multi-dimensional match scores between veterans and job
// listings by combining five weighted signals:
//
//   - MOS Base Score (35%): Static O*NET crosswalk mapping confidence
//   - Skills Overlap (25%): Transferable skills vs job tasks/requirements
//   - Sector Alignment (15%): Veteran preferred sectors vs listing sector
//   - MOS Preference (15%): Whether the employer requested this MOS code
//   - Location Match (10%): Geographic proximity (Texas region matching)
//
// All scoring is deterministic, explainable, and computed on-the-fly.
package matcher

import (
	"strings"
)

// Weights for each scoring dimension (must sum to 100).
const (
	WeightMOSBase        = 35
	WeightSkillsOverlap  = 25
	WeightSectorAlign    = 15
	WeightMOSPreference  = 15
	WeightLocationMatch  = 10
)

// ScoreBreakdown details each dimension of the hybrid match score.
type ScoreBreakdown struct {
	MOSBaseScore      int      `json:"mos_base_score"`
	SkillsOverlap     int      `json:"skills_overlap"`
	SectorAlignment   int      `json:"sector_alignment"`
	MOSPreference     int      `json:"mos_preference"`
	LocationMatch     int      `json:"location_match"`
	HybridScore       int      `json:"hybrid_score"`
	MatchedSkills     []string `json:"matched_skills"`
	Explanation       string   `json:"explanation"`
}

// VeteranProfile holds the veteran attributes needed for scoring.
type VeteranProfile struct {
	MOSCode          string
	PreferredSectors []string
	Location         string
	YearsOfService   int32
}

// JobListing holds the listing attributes needed for scoring.
type JobListing struct {
	ID                 int32
	Title              string
	Sector             string
	Location           string
	Requirements       []string
	Tasks              []string
	MOSCodesPreferred  []string
	TransferableSkills []string // from the MOS-civilian mapping
	MOSBaseScore       int32   // from mos_civilian_mappings.match_score
}

// ComputeScore calculates the hybrid match score for a veteran-listing pair.
func ComputeScore(vet VeteranProfile, listing JobListing) ScoreBreakdown {
	// 1. MOS Base Score (0-100, from O*NET crosswalk)
	mosBase := int(listing.MOSBaseScore)

	// 2. Skills Overlap: transferable skills vs job tasks + requirements
	matchedSkills, skillsScore := computeSkillsOverlap(
		listing.TransferableSkills,
		listing.Tasks,
		listing.Requirements,
	)

	// 3. Sector Alignment
	sectorScore := computeSectorAlignment(vet.PreferredSectors, listing.Sector)

	// 4. MOS Preference
	mosPreferenceScore := computeMOSPreference(vet.MOSCode, listing.MOSCodesPreferred)

	// 5. Location Match
	locationScore := computeLocationMatch(vet.Location, listing.Location)

	// Weighted hybrid score
	hybrid := (mosBase*WeightMOSBase +
		skillsScore*WeightSkillsOverlap +
		sectorScore*WeightSectorAlign +
		mosPreferenceScore*WeightMOSPreference +
		locationScore*WeightLocationMatch) / 100

	// Clamp to 0-100
	if hybrid > 100 {
		hybrid = 100
	}
	if hybrid < 0 {
		hybrid = 0
	}

	explanation := buildExplanation(mosBase, skillsScore, sectorScore, mosPreferenceScore, locationScore, listing.Title)

	return ScoreBreakdown{
		MOSBaseScore:    mosBase,
		SkillsOverlap:   skillsScore,
		SectorAlignment: sectorScore,
		MOSPreference:   mosPreferenceScore,
		LocationMatch:   locationScore,
		HybridScore:     hybrid,
		MatchedSkills:   matchedSkills,
		Explanation:     explanation,
	}
}

// computeSkillsOverlap scores how well the veteran's transferable skills
// match against the job's tasks and requirements. Uses fuzzy substring matching
// to handle minor phrasing differences.
func computeSkillsOverlap(transferableSkills, tasks, requirements []string) (matched []string, score int) {
	if len(transferableSkills) == 0 {
		return nil, 50 // neutral if no skill data
	}

	// Build a combined target set from tasks + requirements
	targets := make([]string, 0, len(tasks)+len(requirements))
	for _, t := range tasks {
		targets = append(targets, strings.ToLower(t))
	}
	for _, r := range requirements {
		targets = append(targets, strings.ToLower(r))
	}

	if len(targets) == 0 {
		return nil, 50 // neutral if no target data
	}

	matchCount := 0
	for _, skill := range transferableSkills {
		skillLower := strings.ToLower(skill)
		skillWords := strings.Fields(skillLower)

		for _, target := range targets {
			if fuzzyMatch(skillWords, target) {
				matched = append(matched, skill)
				matchCount++
				break
			}
		}
	}

	// Score: ratio of matched skills to total skills, scaled to 0-100
	ratio := float64(matchCount) / float64(len(transferableSkills))

	// Apply a curve: even 40% overlap is a good match
	switch {
	case ratio >= 0.7:
		score = 100
	case ratio >= 0.5:
		score = 85
	case ratio >= 0.3:
		score = 70
	case ratio >= 0.15:
		score = 55
	default:
		score = 30
	}

	return matched, score
}

// fuzzyMatch checks if any word in the skill appears in the target string.
// This handles cases like "safety compliance" matching "safety protocols"
// or "team supervision" matching "crew supervision".
func fuzzyMatch(skillWords []string, target string) bool {
	// Check full substring first
	combined := strings.Join(skillWords, " ")
	if strings.Contains(target, combined) {
		return true
	}

	// Check individual significant words (skip short common words)
	matchedWords := 0
	significantWords := 0
	for _, word := range skillWords {
		if len(word) < 4 {
			continue // skip "and", "of", "the", etc.
		}
		significantWords++
		if strings.Contains(target, word) {
			matchedWords++
		}
	}

	if significantWords == 0 {
		return false
	}

	// If most significant words match, it's a fuzzy match
	return float64(matchedWords)/float64(significantWords) >= 0.5
}

// computeSectorAlignment scores sector match between veteran preferences and listing.
func computeSectorAlignment(preferredSectors []string, listingSector string) int {
	if len(preferredSectors) == 0 {
		return 60 // neutral — no preference expressed
	}

	sectorLower := strings.ToLower(listingSector)
	for _, pref := range preferredSectors {
		if strings.ToLower(pref) == sectorLower {
			return 100 // direct match
		}
	}

	// Check related sectors
	related := sectorRelations[sectorLower]
	for _, pref := range preferredSectors {
		prefLower := strings.ToLower(pref)
		for _, rel := range related {
			if prefLower == rel {
				return 70 // related sector
			}
		}
	}

	return 30 // no alignment
}

// sectorRelations maps sectors to related sectors for partial matching.
var sectorRelations = map[string][]string{
	"energy":        {"construction", "manufacturing", "maintenance"},
	"construction":  {"energy", "maintenance", "manufacturing"},
	"logistics":     {"supply chain", "transportation", "management"},
	"maintenance":   {"construction", "energy", "manufacturing"},
	"manufacturing": {"maintenance", "energy", "construction"},
	"safety":        {"construction", "energy", "healthcare"},
	"healthcare":    {"safety"},
	"supply chain":  {"logistics", "management"},
	"management":    {"logistics", "supply chain"},
	"transportation":{"logistics", "supply chain"},
}

// computeMOSPreference scores whether the employer specifically requested
// the veteran's MOS code.
func computeMOSPreference(vetMOS string, preferredMOS []string) int {
	if len(preferredMOS) == 0 {
		return 50 // no preference expressed — neutral
	}

	vetUpper := strings.ToUpper(vetMOS)
	for _, mos := range preferredMOS {
		if strings.ToUpper(mos) == vetUpper {
			return 100 // employer wants this exact MOS
		}
	}

	return 20 // employer has preferences but this MOS isn't one of them
}

// computeLocationMatch scores geographic proximity using Texas region matching.
func computeLocationMatch(vetLocation, jobLocation string) int {
	if vetLocation == "" || jobLocation == "" {
		return 50 // neutral if location unknown
	}

	vetLower := strings.ToLower(vetLocation)
	jobLower := strings.ToLower(jobLocation)

	// Exact city match
	vetCity := extractCity(vetLower)
	jobCity := extractCity(jobLower)
	if vetCity != "" && jobCity != "" && vetCity == jobCity {
		return 100
	}

	// Same Texas region
	vetRegion := getTexasRegion(vetLower)
	jobRegion := getTexasRegion(jobLower)
	if vetRegion != "" && jobRegion != "" {
		if vetRegion == jobRegion {
			return 90 // same region
		}
		// Adjacent regions
		if areAdjacentRegions(vetRegion, jobRegion) {
			return 65 // neighboring region
		}
		return 40 // different region in Texas
	}

	// Both in Texas but can't determine region
	if strings.Contains(vetLower, "tx") || strings.Contains(vetLower, "texas") {
		if strings.Contains(jobLower, "tx") || strings.Contains(jobLower, "texas") {
			return 60
		}
	}

	return 30 // different state or unknown
}

func extractCity(location string) string {
	// Handle "City, TX" or "City, State" format
	parts := strings.Split(location, ",")
	if len(parts) > 0 {
		return strings.TrimSpace(parts[0])
	}
	return ""
}

// Texas regions for proximity matching
type region = string

const (
	regionHouston      region = "houston"
	regionDFW          region = "dfw"
	regionAustin       region = "austin"
	regionSanAntonio   region = "sanantonio"
	regionCentralTexas region = "centraltexas"
	regionWestTexas    region = "westtexas"
	regionPermianBasin region = "permian"
)

var cityRegions = map[string]region{
	"houston":     regionHouston,
	"sugar land":  regionHouston,
	"katy":        regionHouston,
	"baytown":     regionHouston,
	"pasadena":    regionHouston,
	"dallas":      regionDFW,
	"fort worth":  regionDFW,
	"irving":      regionDFW,
	"arlington":   regionDFW,
	"plano":       regionDFW,
	"austin":      regionAustin,
	"round rock":  regionAustin,
	"san antonio": regionSanAntonio,
	"killeen":     regionCentralTexas,
	"temple":      regionCentralTexas,
	"waco":        regionCentralTexas,
	"odessa":      regionPermianBasin,
	"midland":     regionPermianBasin,
	"sweetwater":  regionWestTexas,
	"abilene":     regionWestTexas,
	"lubbock":     regionWestTexas,
	"johns creek": regionDFW, // Saia HQ mapped to DFW area
	"lisle":       regionDFW, // SunCoke mapped to DFW area
}

func getTexasRegion(location string) region {
	for city, reg := range cityRegions {
		if strings.Contains(location, city) {
			return reg
		}
	}
	return ""
}

var adjacentRegions = map[region][]region{
	regionHouston:      {regionAustin, regionSanAntonio},
	regionDFW:          {regionAustin, regionCentralTexas},
	regionAustin:       {regionHouston, regionDFW, regionSanAntonio, regionCentralTexas},
	regionSanAntonio:   {regionHouston, regionAustin, regionCentralTexas},
	regionCentralTexas: {regionDFW, regionAustin, regionSanAntonio, regionWestTexas},
	regionWestTexas:    {regionCentralTexas, regionPermianBasin},
	regionPermianBasin: {regionWestTexas},
}

func areAdjacentRegions(a, b region) bool {
	for _, adj := range adjacentRegions[a] {
		if adj == b {
			return true
		}
	}
	return false
}

func buildExplanation(mosBase, skills, sector, mosPref, location int, jobTitle string) string {
	parts := []string{}

	if mosBase >= 85 {
		parts = append(parts, "Strong military skills match")
	} else if mosBase >= 70 {
		parts = append(parts, "Good military skills transfer")
	} else {
		parts = append(parts, "Moderate skills transfer")
	}

	if skills >= 85 {
		parts = append(parts, "excellent skills overlap with job tasks")
	} else if skills >= 70 {
		parts = append(parts, "good skills overlap")
	} else if skills >= 55 {
		parts = append(parts, "some relevant skills")
	}

	if mosPref >= 100 {
		parts = append(parts, "employer specifically seeks your MOS")
	}

	if sector >= 100 {
		parts = append(parts, "matches your preferred sector")
	} else if sector >= 70 {
		parts = append(parts, "in a related sector")
	}

	if location >= 90 {
		parts = append(parts, "in your area")
	} else if location >= 65 {
		parts = append(parts, "in a nearby region")
	}

	if len(parts) == 0 {
		return "Potential career match based on your military experience."
	}

	result := strings.ToUpper(parts[0][:1]) + parts[0][1:]
	for i := 1; i < len(parts); i++ {
		if i == len(parts)-1 {
			result += ", and " + parts[i]
		} else {
			result += ", " + parts[i]
		}
	}
	result += "."

	return result
}
