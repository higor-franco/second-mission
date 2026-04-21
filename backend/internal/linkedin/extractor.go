// Package linkedin extracts structured company profile data from either a
// LinkedIn company page URL or a raw "About" section pasted by the user.
//
// The platform uses this on the employer registration and profile-edit
// screens so a new employer can paste their company page link and get the
// form pre-filled in one click, instead of typing every field by hand.
//
// Two input paths:
//
//  1. URL — the backend fetches the public company page HTML and sends it
//     to Claude for extraction. Works opportunistically; LinkedIn blocks
//     many non-logged-in requests, so the handler surfaces a clear error
//     and the frontend falls back to path 2.
//  2. Text — the employer pastes their own About section content, and we
//     run the same extractor on plain text. Always works.
//
// This package is deliberately small and has a single entry point:
// Extractor.Extract, which accepts raw text (either stripped HTML from a
// fetch, or user-pasted About content) and returns an ExtractedProfile.
// Nothing is persisted — the text lives only in the request/response.
package linkedin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// ExtractedProfile is the structured view of a company the frontend form
// expects. Fields are best-effort — anything Claude can't read confidently
// is returned as its zero value and the employer fills it in by hand.
type ExtractedProfile struct {
	// CompanyName is the company's display name as it appears on the
	// LinkedIn page (e.g. "NOV Inc.", "GE Vernova"). Empty if the source
	// text doesn't contain a clear name.
	CompanyName string `json:"company_name"`

	// Sector is the closest match from the platform's sector enum
	// (see SectorOptions below). Empty if no sector fits.
	Sector string `json:"sector"`

	// Location is the company's primary headquarters — typically formatted
	// "City, State" for U.S. companies and "City, Country" otherwise.
	Location string `json:"location"`

	// Description is a short paragraph (roughly 2-5 sentences) summarizing
	// what the company does, its industry context, and what kind of work
	// veterans would do there. Written in the company's own voice when
	// possible. Never longer than ~800 characters so it fits the form.
	Description string `json:"description"`

	// Tagline is an optional one-line pitch from the page (e.g. "Powering
	// the industrials that power the world"). Empty if not present.
	Tagline string `json:"tagline"`

	// IndustryRaw is the industry string as LinkedIn presents it
	// (e.g. "Oil and Gas", "Industrial Machinery Manufacturing"). Useful
	// for the UI to show the employer why we picked a given Sector; also
	// lets a future version map to additional sectors without re-querying.
	IndustryRaw string `json:"industry_raw"`
}

// SectorOptions is the closed set of sectors the platform supports on the
// employer profile form. Kept in sync with the frontend's SECTORS array in
// EmployerProfilePage.tsx / EmployerLoginPage.tsx. Exposed so the handler
// can include it verbatim in the prompt — if we ever add a sector, changing
// this one list fixes both the form and the extractor prompt.
var SectorOptions = []string{
	"Energy & Oil/Gas",
	"Construction",
	"Logistics & Supply Chain",
	"Manufacturing",
	"Field Operations",
	"Maintenance & Repair",
	"Other",
}

// Extractor wraps the Anthropic client and extraction policy. Cheap to
// construct; callers typically hold one for the process lifetime.
type Extractor struct {
	client anthropic.Client
	model  anthropic.Model
}

// NewExtractor constructs an Extractor using the provided API key. It
// returns an error if the key is empty so callers can fail fast at server
// startup rather than on the first import attempt.
func NewExtractor(apiKey string) (*Extractor, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("linkedin: ANTHROPIC_API_KEY is required")
	}
	client := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &Extractor{
		client: client,
		// Mirror the DD-214 extractor — Opus 4.7 keeps the two AI paths on
		// the same model for consistency, and the platform-wide default
		// per the claude-api skill. The cost delta vs a smaller model is
		// negligible for on-demand, user-triggered extraction.
		model: anthropic.ModelClaudeOpus4_7,
	}, nil
}

// Extract sends the source text to Claude and returns the parsed profile.
//
// `sourceText` may be:
//   - the raw HTML of a LinkedIn company page (the fetcher passes it through
//     as-is; Claude is robust to HTML boilerplate),
//   - plain text the user pasted from the About section.
//
// A max input length is enforced upstream by the handler; this function
// trusts its caller and only checks that the text is non-empty.
//
// Errors:
//   - ErrEmptyInput when the source text is empty after trimming.
//   - ErrNoTextResponse when the model returns no text content.
//   - ErrInvalidJSON when the response can't be parsed into the profile.
//   - ErrNoUsefulContent when the model parses but every field is empty —
//     typically means LinkedIn served us a login wall instead of page data.
//   - plus any underlying network/API error from the Anthropic SDK.
func (e *Extractor) Extract(ctx context.Context, sourceText string) (*ExtractedProfile, error) {
	trimmed := strings.TrimSpace(sourceText)
	if trimmed == "" {
		return nil, ErrEmptyInput
	}

	msg, err := e.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     e.model,
		MaxTokens: 1024,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(buildPrompt(trimmed)),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("linkedin: anthropic request failed: %w", err)
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

	// Normalize the sector value to exactly match one of our options —
	// Claude might drift to a close-but-not-quite label. Anything that
	// doesn't match is blanked out so the form asks the user to pick.
	profile.Sector = normalizeSector(profile.Sector)

	// If the extraction produced nothing useful, surface a dedicated error
	// so the handler can return a helpful message ("we couldn't read this
	// page — paste the About section instead") rather than a misleading
	// blank form.
	if isEmptyProfile(profile) {
		return nil, ErrNoUsefulContent
	}

	return profile, nil
}

// buildPrompt composes the extraction instructions + the user-supplied
// source text. Kept as a function (rather than a template string + one-
// line concatenation at call sites) so the test suite can inspect it and
// so future versions can inline the sector list once it changes shape.
func buildPrompt(sourceText string) string {
	sectorList := strings.Join(SectorOptions, ", ")

	// The schema mirrors ExtractedProfile. The sector instruction pins
	// Claude to our enum; if nothing matches, pick "Other" so the form
	// has a valid default. Output is pure JSON — the parser is tolerant
	// but the prompt still forbids code fences for predictability.
	return `You are an extraction assistant for LinkedIn company pages.

Extract a clean structured profile from the company source below (the
source may be raw HTML from a public company page, or a short About
section the user pasted). Return ONLY a single valid JSON object — no
prose, no markdown, no code fences.

Schema:
{
  "company_name":  "string",
  "sector":        "string",
  "location":      "string",
  "description":   "string",
  "tagline":       "string",
  "industry_raw":  "string"
}

Field guide:
- company_name: the company's display name. Strip trailing status strings
  like "(Official)" or "- LinkedIn".
- sector: MUST be exactly one of these values (copy verbatim): ` + sectorList + `.
  Pick the closest fit for the company's primary activity — energy, oil &
  gas, utilities → "Energy & Oil/Gas"; heavy construction, infra, EPC →
  "Construction"; freight, 3PL, warehousing → "Logistics & Supply Chain";
  factories, heavy manufacturing → "Manufacturing"; oilfield services,
  survey crews, linemen → "Field Operations"; mechanics, MRO, repair shops
  → "Maintenance & Repair". If nothing fits, use "Other".
- location: the company headquarters, formatted "City, State" for U.S.
  companies and "City, Country" otherwise. Empty string if not stated.
- description: 2–5 sentences, written in a neutral third-person voice,
  summarizing what the company does and the kinds of roles it typically
  hires for. Prefer concrete details over buzzwords. Keep it under 800
  characters. Do not copy LinkedIn UI text ("See all employees", etc).
- tagline: a single pitch line from the page. Empty if not present.
- industry_raw: the LinkedIn "Industry" label as written on the page
  (e.g. "Oil and Gas", "Industrial Machinery Manufacturing"). Empty if
  not determinable.

Rules:
- Never invent data. If a field is not in the source, return its zero
  value ("" for strings).
- If the source looks like a login wall or has no company content
  (empty HTML, auth redirect, CAPTCHA), return all fields empty —
  DO NOT guess.
- Never include personal contact info, private emails, or employee
  names. Company leader names are OK if they appear on the public page.
- Output valid JSON only. No trailing commas. No comments.

Source:
` + sourceText
}

// parseProfile tolerates a small amount of conversational padding around
// the JSON — Claude sometimes wraps output in a code fence despite the
// instruction. Exposed at package level so tests can exercise it without
// an API round-trip.
func parseProfile(raw string) (*ExtractedProfile, error) {
	text := strings.TrimSpace(raw)

	// Strip ```json ... ``` or ``` ... ``` fences if present.
	if strings.HasPrefix(text, "```") {
		if nl := strings.IndexByte(text, '\n'); nl >= 0 {
			text = text[nl+1:]
		}
		if idx := strings.LastIndex(text, "```"); idx >= 0 {
			text = text[:idx]
		}
		text = strings.TrimSpace(text)
	}

	// If there's prose around the JSON, pull out the outermost {...}.
	if !strings.HasPrefix(text, "{") {
		start := strings.Index(text, "{")
		end := strings.LastIndex(text, "}")
		if start < 0 || end <= start {
			return nil, fmt.Errorf("%w: no JSON object found", ErrInvalidJSON)
		}
		text = text[start : end+1]
	}

	var p ExtractedProfile
	if err := json.Unmarshal([]byte(text), &p); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}

	// Trim stray whitespace; Claude occasionally pads fields.
	p.CompanyName = strings.TrimSpace(p.CompanyName)
	p.Sector = strings.TrimSpace(p.Sector)
	p.Location = strings.TrimSpace(p.Location)
	p.Description = strings.TrimSpace(p.Description)
	p.Tagline = strings.TrimSpace(p.Tagline)
	p.IndustryRaw = strings.TrimSpace(p.IndustryRaw)

	return &p, nil
}

// normalizeSector returns the input only if it's one of our supported
// sectors (case-insensitive match). Anything else becomes "" so the
// frontend dropdown shows the default "Select sector" and asks the user.
func normalizeSector(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	for _, opt := range SectorOptions {
		if strings.EqualFold(s, opt) {
			return opt
		}
	}
	return ""
}

// isEmptyProfile reports whether the extraction produced anything useful.
// We treat "company name + at least one other field" as the bar — name
// alone is often LinkedIn's page title and not a real signal.
func isEmptyProfile(p *ExtractedProfile) bool {
	other := p.Sector != "" || p.Location != "" || p.Description != "" ||
		p.Tagline != "" || p.IndustryRaw != ""
	return p.CompanyName == "" || !other
}

// Sentinel errors callers can branch on.
var (
	ErrEmptyInput      = errors.New("linkedin: empty source text")
	ErrNoTextResponse  = errors.New("linkedin: claude returned no text content")
	ErrInvalidJSON     = errors.New("linkedin: invalid extraction JSON")
	ErrNoUsefulContent = errors.New("linkedin: extraction produced no useful content (likely a login wall)")
)
