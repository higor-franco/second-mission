// Package dd214 extracts structured military profile data from a DD Form 214
// PDF using the Anthropic Claude API.
//
// The DD Form 214 (Certificate of Release or Discharge from Active Duty) is
// the U.S. military's official separation document. It contains a wealth of
// career information that the Second Mission matching engine can use to
// produce much richer matches than a single MOS code:
//
//   - Primary MOS (Block 11)
//   - Secondary MOS / duty assignments
//   - ASI / SQI / additional skill identifiers
//   - Rank, paygrade
//   - Total active service years
//   - Military education (Block 14)
//   - Decorations, medals, badges (Block 13)
//
// This package is deliberately small and has a single entry point:
// Extractor.Extract, which accepts raw PDF bytes and returns a validated
// ExtractedProfile. The PDF is sent to Claude's native document input — no
// pre-OCR step is required, and scanned forms work as well as digitally
// generated ones.
//
// The PDF is processed in memory and is never persisted.
package dd214

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// ExtractedProfile is the structured representation of a veteran's military
// experience parsed from a DD Form 214.
//
// Every field is best-effort. Any field that cannot be reliably read is
// returned as its zero value. Callers must handle missing data gracefully —
// notably, a missing PrimaryMOS.Code means the matcher has no deterministic
// O*NET crosswalk to start from and should fall back to the skill signals.
type ExtractedProfile struct {
	// Name is the veteran's full name as written on the form (typically
	// "LAST, FIRST MIDDLE" in Block 1). Extracted to make the match
	// experience feel personal. Never persisted — lives only in the
	// response and is released when the request returns.
	Name string `json:"name"`

	// PrimaryMOS is the veteran's primary military occupational specialty
	// (Block 11 on the form).
	PrimaryMOS MOSEntry `json:"primary_mos"`

	// SecondaryMOS lists any additional MOS codes the veteran held.
	SecondaryMOS []MOSEntry `json:"secondary_mos"`

	// AdditionalSkills lists ASI / SQI / additional skill identifiers
	// present on the form (e.g. "5K" Air Assault, "V" Ranger, "B4" Sniper).
	AdditionalSkills []string `json:"additional_skills"`

	// Rank is the final rank held at separation (e.g. "Sergeant",
	// "Staff Sergeant", "SSG").
	Rank string `json:"rank"`

	// Paygrade is the paygrade at separation (e.g. "E-5", "E-6").
	Paygrade string `json:"paygrade"`

	// YearsOfService is the total active service in years (rounded).
	YearsOfService int `json:"years_of_service"`

	// MilitaryEducation lists formal military schools/courses completed
	// (Block 14 on the form).
	MilitaryEducation []string `json:"military_education"`

	// Decorations lists medals, badges, ribbons, commendations, and
	// citations (Block 13 on the form).
	Decorations []string `json:"decorations"`

	// Branch of service (e.g. "Army", "Marines", "Navy", "Air Force").
	Branch string `json:"branch"`

	// SeparationReason is the type/character of separation if extractable.
	SeparationReason string `json:"separation_reason"`

	// SeparationDate is the date the veteran separated from active duty
	// (Block 12b / 12c on the form), in ISO-8601 YYYY-MM-DD format.
	// Empty string if not present or illegible.
	SeparationDate string `json:"separation_date"`
}

// MOSEntry represents a single military occupational specialty reference as
// it appears on the DD-214. The code is the short alphanumeric identifier
// (e.g. "88M"); the title is the human-readable name if present.
type MOSEntry struct {
	Code  string `json:"code"`
	Title string `json:"title"`
}

// AllMOSCodes returns every MOS code referenced in the profile (primary +
// secondary), uppercased and de-duplicated, preserving primary-first order.
func (p ExtractedProfile) AllMOSCodes() []string {
	seen := make(map[string]struct{})
	out := make([]string, 0, 1+len(p.SecondaryMOS))

	add := func(code string) {
		c := strings.ToUpper(strings.TrimSpace(code))
		if c == "" {
			return
		}
		if _, ok := seen[c]; ok {
			return
		}
		seen[c] = struct{}{}
		out = append(out, c)
	}

	add(p.PrimaryMOS.Code)
	for _, e := range p.SecondaryMOS {
		add(e.Code)
	}
	return out
}

// Extractor wraps the Anthropic client and extraction policy.
type Extractor struct {
	client anthropic.Client
	model  anthropic.Model
}

// NewExtractor constructs an Extractor using the provided API key.
// It returns an error if the key is empty so callers can fail fast at
// server startup rather than on the first upload.
func NewExtractor(apiKey string) (*Extractor, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("dd214: ANTHROPIC_API_KEY is required")
	}
	client := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &Extractor{
		client: client,
		model:  anthropic.ModelClaudeOpus4_7,
	}, nil
}

// extractionPrompt is the instruction sent alongside the PDF. It describes
// the DD-214 layout to the model, specifies the JSON schema, and forbids
// hallucination. The schema matches ExtractedProfile exactly.
const extractionPrompt = `You are a specialized extraction assistant for U.S. military DD Form 214 (Certificate of Release or Discharge from Active Duty) documents.

Read the attached DD-214 document and extract the fields below into a single valid JSON object. Return ONLY the JSON object — no prose, no markdown code fences, no explanation.

Schema:
{
  "name":                "string",
  "primary_mos":         { "code": "string", "title": "string" },
  "secondary_mos":       [ { "code": "string", "title": "string" } ],
  "additional_skills":   [ "string" ],
  "rank":                "string",
  "paygrade":            "string",
  "years_of_service":    0,
  "military_education":  [ "string" ],
  "decorations":         [ "string" ],
  "branch":              "string",
  "separation_reason":   "string",
  "separation_date":     "YYYY-MM-DD"
}

Field guide (reference the DD-214 block numbers shown on the form):
- name: Block 1 — the veteran's full name. Preserve the form's capitalization if natural (e.g. "JOHN A. DOE"); if the form uses "LAST, FIRST MIDDLE" you may normalize to "First Middle Last" for presentation. Empty string if illegible.
- primary_mos: Block 11 — Primary Specialty. Extract the short code (e.g. "88M", "91B", "0311") into "code" and the title into "title". If the form uses a title without a code, leave "code" as "".
- secondary_mos: any additional MOS / rate / AFSC entries found in Block 11, duty assignments, or remarks. Exclude the primary entry.
- additional_skills: ASI, SQI, or other skill identifiers (examples: "5K", "V", "B4", "Airborne", "Air Assault", "Ranger Tab"). Keep them short.
- rank: final rank at separation in long form when possible (e.g. "Staff Sergeant"). Use the form's wording.
- paygrade: Block 4b or similar — format "E-5", "E-6", "O-3", etc.
- years_of_service: Block 12 — total active service. Round to the nearest whole year. Use 0 if not derivable.
- military_education: Block 14 — formal courses/schools completed. One string per line item; preserve the form's wording.
- decorations: Block 13 — medals, badges, ribbons, commendations, citations. One string per line item. Include badges (e.g. "Combat Action Badge", "Expert Marksmanship Badge").
- branch: Army / Marine Corps / Navy / Air Force / Coast Guard / Space Force. Use exactly one of those values if determinable, otherwise "".
- separation_reason: Block 23 / 28 — the narrative reason if extractable (e.g. "Completion of Required Active Service"). Empty string if not present.
- separation_date: Block 12b or 12c — the date the veteran separated from active duty. Format strictly as ISO-8601 "YYYY-MM-DD". Convert any format on the form (e.g. "15 JUN 2023", "06/15/2023", "2023 JUN 15") to YYYY-MM-DD. Empty string if not present or illegible.

Rules:
- Never invent data. If a field is not present or is illegible, return its zero value ("" for strings, [] for arrays, 0 for numbers).
- Do not include sensitive PII (SSN, date of birth, home address) in any field. If you encounter such values, drop them silently.
- Output valid JSON only. No trailing commas. No comments. No markdown.`

// Extract sends the PDF to Claude and returns the parsed ExtractedProfile.
//
// The PDF is provided as its raw bytes; it is base64-encoded and sent as a
// native document block (Claude reads PDFs visually, so scanned forms work).
// The caller is responsible for size limits and file type validation.
//
// Errors returned:
//   - ErrEmptyPDF when pdfBytes is empty
//   - ErrNoTextResponse when the model returns no text content
//   - ErrInvalidJSON when the model response cannot be parsed as the profile schema
//   - plus any underlying network/API error from the Anthropic SDK
func (e *Extractor) Extract(ctx context.Context, pdfBytes []byte) (*ExtractedProfile, error) {
	if len(pdfBytes) == 0 {
		return nil, ErrEmptyPDF
	}

	b64 := base64.StdEncoding.EncodeToString(pdfBytes)

	msg, err := e.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     e.model,
		MaxTokens: 4096,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewDocumentBlock(anthropic.Base64PDFSourceParam{Data: b64}),
				anthropic.NewTextBlock(extractionPrompt),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("dd214: anthropic request failed: %w", err)
	}

	// Find the first text block in the response.
	var raw string
	for _, block := range msg.Content {
		if tb, ok := block.AsAny().(anthropic.TextBlock); ok {
			raw = tb.Text
			break
		}
	}
	if raw == "" {
		return nil, ErrNoTextResponse
	}

	profile, err := parseProfile(raw)
	if err != nil {
		return nil, err
	}
	return profile, nil
}

// parseProfile tolerates a small amount of conversational padding around the
// JSON (Claude sometimes wraps JSON in a code fence despite the instruction)
// and returns the validated struct. Exposed at package level so tests can
// exercise it without an API round-trip.
func parseProfile(raw string) (*ExtractedProfile, error) {
	text := strings.TrimSpace(raw)

	// Strip ```json ... ``` or ``` ... ``` fences if present.
	if strings.HasPrefix(text, "```") {
		// Drop the first line (opening fence with optional language tag).
		if nl := strings.IndexByte(text, '\n'); nl >= 0 {
			text = text[nl+1:]
		}
		// Drop the trailing fence.
		if idx := strings.LastIndex(text, "```"); idx >= 0 {
			text = text[:idx]
		}
		text = strings.TrimSpace(text)
	}

	// If there is leading/trailing prose, extract the outermost {...}.
	if !strings.HasPrefix(text, "{") {
		start := strings.Index(text, "{")
		end := strings.LastIndex(text, "}")
		if start < 0 || end <= start {
			return nil, fmt.Errorf("%w: no JSON object found in response", ErrInvalidJSON)
		}
		text = text[start : end+1]
	}

	var p ExtractedProfile
	if err := json.Unmarshal([]byte(text), &p); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}

	// Normalize codes to uppercase for consistent downstream matching.
	p.PrimaryMOS.Code = strings.ToUpper(strings.TrimSpace(p.PrimaryMOS.Code))
	for i := range p.SecondaryMOS {
		p.SecondaryMOS[i].Code = strings.ToUpper(strings.TrimSpace(p.SecondaryMOS[i].Code))
	}

	return &p, nil
}

// Sentinel errors callers can branch on.
var (
	ErrEmptyPDF       = errors.New("dd214: empty pdf input")
	ErrNoTextResponse = errors.New("dd214: claude returned no text content")
	ErrInvalidJSON    = errors.New("dd214: invalid extraction JSON")
)
