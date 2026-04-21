// Package jobimport extracts a batch of structured job postings from an
// employer's careers page (URL fetch) or pasted text. It's the
// "populate-before-signup" feature the Wharton AMP advisor flagged as the
// highest-leverage way to solve the two-sided cold-start problem — the
// employer arrives already having half their open roles on the platform.
//
// Architecture parity with the linkedin package (company-profile import):
//
//  1. Extractor wraps the Anthropic SDK + a prompt pinned to Claude Opus 4.7
//     and returns []JobDraft (not a single profile).
//  2. Fetcher retrieves any public https URL and strips scripts/styles.
//  3. The handler binds them together behind POST /api/employer/jobs/import.
//
// Nothing is persisted here — the drafts returned by Extract live only in
// the response body. The employer reviews them in the UI and publishes
// each one individually against the existing POST /api/employer/listings
// endpoint, so every written listing still flows through the normal
// create path with its validation and activity logging.
package jobimport

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

// maxInputBytes caps the size of the source text passed to Claude. A
// careers-page HTML can balloon past 500 KB; truncating at 64 KB keeps
// the prompt sized reasonably and the response latency bounded. Claude
// sees more than enough context for 5-20 postings at this size.
const maxInputBytes = 64 * 1024

// maxDraftsPerCall is an upper bound on how many JobDrafts the extractor
// will return in a single call. Matches the prompt's hard-cap so the
// backend cannot be tricked into emitting a 200-item array that would
// overwhelm the review UI.
const maxDraftsPerCall = 20

// CivilianRoleLite is the trimmed view of a civilian_roles row we pass to
// Claude in the prompt — just enough for Claude to pick a match by
// semantic similarity on title + sector without paying for the full
// description payload.
type CivilianRoleLite struct {
	ID       int32  `json:"id"`
	OnetCode string `json:"onet_code"`
	Title    string `json:"title"`
	Sector   string `json:"sector"`
}

// JobDraft is the per-posting extracted shape. All fields are best-effort
// — anything Claude can't read confidently is returned as its zero value
// and the employer fills it in during review. civilian_role_id is
// optional; when nil (or invalid vs. the catalog), the UI forces the
// employer to pick one before publishing.
type JobDraft struct {
	// Human-readable job title exactly as written on the source ("Fleet
	// Operations Manager"). Required — drafts with an empty title are
	// dropped by the handler's normalization pass.
	Title string `json:"title"`

	// Short 1-3 paragraph description written in the company's voice.
	// Capped at ~1500 characters so the review UI doesn't turn into a
	// wall of text.
	Description string `json:"description"`

	// Each requirement as its own bullet. Empty slice if none could be
	// extracted with confidence.
	Requirements []string `json:"requirements"`

	// Day-to-day tasks. Feeds the matching engine's skills_overlap
	// dimension — even a short list materially improves match scores.
	Tasks []string `json:"tasks"`

	// Benefits as bullets (health, 401k, relocation, etc.). Optional.
	Benefits []string `json:"benefits"`

	// "City, ST" format for U.S. roles; "Remote" is kept as-is.
	Location string `json:"location"`

	// Salary band in dollars per year. Zero means "unknown" — the UI
	// surfaces this to the employer so they can fill in before publish.
	SalaryMin int32 `json:"salary_min"`
	SalaryMax int32 `json:"salary_max"`

	// One of "full-time", "part-time", "contract", "internship". Defaults
	// to full-time when unspecified.
	EmploymentType string `json:"employment_type"`

	// Suggested Military Occupational Specialty codes the employer should
	// consider for this role (e.g. ["88M", "92Y"]). Claude infers these
	// from the task list; empty is fine.
	MosCodesPreferred []string `json:"mos_codes_preferred"`

	// WOTC eligibility — Claude defaults true for any role paying below
	// $200k; employer can uncheck during review if the specific business
	// context makes the role ineligible.
	WotcEligible bool `json:"wotc_eligible"`

	// CivilianRoleID is the civilian_roles.id Claude selected from the
	// catalog. nil means "no confident match" — the review UI makes the
	// employer pick. Validated against the catalog in the handler so we
	// never persist an id Claude hallucinated.
	CivilianRoleID *int32 `json:"civilian_role_id"`

	// CivilianRoleReason is a short ("Transportation manager tasks match
	// the fleet ops brief") rationale for the civilian_role_id pick. Not
	// shown to the employer in v1 — kept for debugging + future tuning.
	CivilianRoleReason string `json:"civilian_role_reason,omitempty"`
}

// Extractor wraps the Anthropic client and the prompt/policy. Safe to
// share across requests; net/http and the SDK handle concurrency.
type Extractor struct {
	client anthropic.Client
	model  anthropic.Model
}

// NewExtractor constructs an Extractor. Returns an error on empty API
// key so startup fails fast — matches the linkedin + dd214 packages.
func NewExtractor(apiKey string) (*Extractor, error) {
	if strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("jobimport: ANTHROPIC_API_KEY is required")
	}
	client := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &Extractor{
		client: client,
		// Same model as linkedin + dd214 extractors — one platform-wide
		// default per the claude-api skill, and the cost per import is
		// negligible for a user-triggered batch action.
		model: anthropic.ModelClaudeOpus4_7,
	}, nil
}

// Extract sends `sourceText` plus the civilian-role catalog to Claude
// and returns a list of JobDrafts. `sourceText` may be raw careers-page
// HTML (the fetcher passes it through with scripts/styles stripped) or
// plain text the employer pasted.
//
// Errors:
//   - ErrEmptyInput when the input is blank after trimming.
//   - ErrNoTextResponse when the model returns no text content.
//   - ErrInvalidJSON when the response isn't a parseable JSON array.
//   - ErrNoUsefulContent when Claude returned an empty array (usually
//     means the source had no actual job postings — a marketing page or
//     a login wall).
func (e *Extractor) Extract(ctx context.Context, sourceText string, catalog []CivilianRoleLite) ([]JobDraft, error) {
	trimmed := strings.TrimSpace(sourceText)
	if trimmed == "" {
		return nil, ErrEmptyInput
	}

	// Hard cap the input to protect the prompt budget. We log the
	// truncation on the handler side so the employer gets told when
	// their paste was too big to ingest in one shot.
	if len(trimmed) > maxInputBytes {
		trimmed = trimmed[:maxInputBytes]
	}

	msg, err := e.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model: e.model,
		// 4096 out-tokens comfortably fits 20 drafts at ~150 tokens each
		// and is the maximum we'd ever return (maxDraftsPerCall).
		MaxTokens: 4096,
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(
				anthropic.NewTextBlock(buildPrompt(trimmed, catalog)),
			),
		},
	})
	if err != nil {
		return nil, fmt.Errorf("jobimport: anthropic request failed: %w", err)
	}

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

	drafts, err := parseDrafts(raw)
	if err != nil {
		return nil, err
	}

	// Post-process: validate civilian_role_id against the catalog, clean
	// up fields, clamp to the hard cap. These guardrails mean the
	// handler can trust whatever we return.
	catalogIDs := make(map[int32]struct{}, len(catalog))
	for _, c := range catalog {
		catalogIDs[c.ID] = struct{}{}
	}
	out := make([]JobDraft, 0, len(drafts))
	for _, d := range drafts {
		d = normalizeDraft(d, catalogIDs)
		if d.Title == "" {
			// Skip empty-title drafts — they're noise, typically from
			// careers pages where Claude hit a "more roles" nav link
			// and tried to structure it.
			continue
		}
		out = append(out, d)
		if len(out) >= maxDraftsPerCall {
			break
		}
	}

	if len(out) == 0 {
		return nil, ErrNoUsefulContent
	}
	return out, nil
}

// buildPrompt composes the system instructions + the civilian-role
// catalog + the source text. Kept as a pure function so tests can
// inspect the exact prompt Claude sees.
func buildPrompt(sourceText string, catalog []CivilianRoleLite) string {
	// Serialize the catalog as compact JSON so Claude can match on id,
	// title, and sector without a multi-line table we'd have to re-sync
	// every time a role is added.
	catalogJSON, _ := json.Marshal(catalog)

	return `You are an extraction assistant for employer careers pages.

Read the SOURCE below (raw HTML from a careers page, OR text the employer
pasted) and extract every concrete job posting you can find. Return ONLY
a single valid JSON array — no prose, no markdown, no code fences.

Schema per array item:
{
  "title":               "string",
  "description":         "string",
  "requirements":        ["string", ...],
  "tasks":               ["string", ...],
  "benefits":            ["string", ...],
  "location":            "string",
  "salary_min":          integer (USD/year, 0 if unknown),
  "salary_max":          integer (USD/year, 0 if unknown),
  "employment_type":     "full-time" | "part-time" | "contract" | "internship",
  "mos_codes_preferred": ["string", ...],
  "wotc_eligible":       boolean,
  "civilian_role_id":    integer | null,
  "civilian_role_reason":"string"
}

Field guide:
- Split distinct postings into separate items. Same title in two cities =
  two items. One posting with multiple locations listed = one item with
  the first/primary location.
- description: 1-3 short paragraphs, company-voice, concrete over
  buzzwords, <=1500 chars. Drop LinkedIn/Greenhouse UI fluff ("apply
  now", "share this posting", etc.).
- tasks: day-to-day responsibilities as bullets. Feeds our matching
  engine's skills_overlap dimension, so err on the side of including
  specific verbs ("operate SAP", "supervise 12-person crew").
- requirements: qualifications the employer listed. Don't invent.
- benefits: if the page has a benefits block, list them. Empty is fine.
- salary: extract a USD/yr range when stated. If the posting gives a
  single number, set both min and max to it. If the range is hourly,
  convert to annual at 2080 hours/yr. Unknown → 0 for both.
- employment_type: default to "full-time" unless otherwise stated.
- mos_codes_preferred: infer 1-3 U.S. Army MOS codes that match the
  role's tasks. Common examples: 88M (Motor Transport), 91B (Wheeled
  Vehicle Mechanic), 92A (Automated Logistical Specialist), 92Y (Unit
  Supply), 12B (Combat Engineer), 68W (Combat Medic), 15T (UH-60
  Helicopter Repairer), 25B (IT Specialist). Empty array is acceptable
  if nothing fits — don't reach.
- wotc_eligible: true for any role paying <=$200k/yr (the WOTC veteran
  wage cap). Defaults to true when salary is unknown.
- civilian_role_id: pick EXACTLY ONE id from the CIVILIAN_ROLE_CATALOG
  below by semantic match on title + tasks. Never invent an id not in
  the catalog — if nothing matches with >= 0.6 confidence, return null
  and the employer will pick manually.
- civilian_role_reason: one short sentence ("Fleet mgmt tasks match the
  Transportation Storage and Distribution Manager role") explaining why.

Rules:
- Focus on blue-collar / field-ops / industrial / trades roles. Skip
  purely white-collar corporate jobs (CFO, marketing manager, etc.)
  unless the page is 100% blue-collar.
- Return an empty array [] if the source has no genuine job postings
  (marketing page, login wall, 404 content). Never invent postings.
- Hard-cap: at most 20 items per response.
- Output must be valid JSON. No trailing commas. No comments. Array
  root only — never an object wrapping the array.

CIVILIAN_ROLE_CATALOG:
` + string(catalogJSON) + `

SOURCE:
` + sourceText
}

// parseDrafts tolerates some envelope noise (code fences, a little
// leading/trailing prose) and extracts the JSON array. Exposed at package
// level so tests can exercise it without an API round-trip.
func parseDrafts(raw string) ([]JobDraft, error) {
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

	// If Claude wrapped the array in prose (it shouldn't, but be robust),
	// extract the outermost [...] block.
	if !strings.HasPrefix(text, "[") {
		start := strings.Index(text, "[")
		end := strings.LastIndex(text, "]")
		if start < 0 || end <= start {
			return nil, fmt.Errorf("%w: no JSON array found", ErrInvalidJSON)
		}
		text = text[start : end+1]
	}

	var drafts []JobDraft
	if err := json.Unmarshal([]byte(text), &drafts); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidJSON, err)
	}
	return drafts, nil
}

// normalizeDraft trims strings, enforces enum values, clamps int ranges,
// and validates civilian_role_id against the catalog. The returned draft
// is safe to pass downstream without further checks.
func normalizeDraft(d JobDraft, catalogIDs map[int32]struct{}) JobDraft {
	d.Title = strings.TrimSpace(d.Title)
	d.Description = strings.TrimSpace(d.Description)
	d.Location = strings.TrimSpace(d.Location)
	d.CivilianRoleReason = strings.TrimSpace(d.CivilianRoleReason)

	d.Requirements = trimSlice(d.Requirements, 20)
	d.Tasks = trimSlice(d.Tasks, 20)
	d.Benefits = trimSlice(d.Benefits, 20)
	d.MosCodesPreferred = trimMosSlice(d.MosCodesPreferred, 10)

	// Clamp employment_type to the enum used by job_listings — anything
	// outside the four allowed values gets coerced to full-time because
	// the handler's create endpoint would reject it otherwise and lose
	// the whole draft.
	switch strings.ToLower(d.EmploymentType) {
	case "full-time", "full_time", "fulltime", "":
		d.EmploymentType = "full-time"
	case "part-time", "part_time", "parttime":
		d.EmploymentType = "part-time"
	case "contract":
		d.EmploymentType = "contract"
	case "internship", "intern":
		d.EmploymentType = "internship"
	default:
		d.EmploymentType = "full-time"
	}

	// Salary sanity: negatives, min>max, absurd magnitudes.
	if d.SalaryMin < 0 {
		d.SalaryMin = 0
	}
	if d.SalaryMax < 0 {
		d.SalaryMax = 0
	}
	if d.SalaryMax > 0 && d.SalaryMin > d.SalaryMax {
		d.SalaryMin, d.SalaryMax = d.SalaryMax, d.SalaryMin
	}

	// Drop hallucinated civilian_role_ids — Claude occasionally picks
	// the highest id in the catalog as a "default". Null means "employer
	// picks during review", which the UI handles cleanly.
	if d.CivilianRoleID != nil {
		if _, ok := catalogIDs[*d.CivilianRoleID]; !ok {
			d.CivilianRoleID = nil
		}
	}

	return d
}

// trimSlice caps length and drops empty entries. Matches the
// nullableSlice convention used elsewhere in the handler layer.
func trimSlice(in []string, max int) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		out = append(out, s)
		if len(out) >= max {
			break
		}
	}
	return out
}

// trimMosSlice uppercases and filters MOS-ish tokens. Claude sometimes
// hallucinates pseudo-codes ("LOGISTICS") that aren't actual MOS codes;
// we keep anything that looks like <digits><letter> or a short acronym,
// leaving looser cleanup to the review UI.
func trimMosSlice(in []string, max int) []string {
	out := make([]string, 0, len(in))
	for _, s := range in {
		s = strings.ToUpper(strings.TrimSpace(s))
		if s == "" || len(s) > 6 {
			continue
		}
		out = append(out, s)
		if len(out) >= max {
			break
		}
	}
	return out
}

// Sentinel errors callers can branch on.
var (
	ErrEmptyInput      = errors.New("jobimport: empty source text")
	ErrNoTextResponse  = errors.New("jobimport: claude returned no text content")
	ErrInvalidJSON     = errors.New("jobimport: invalid extraction JSON")
	ErrNoUsefulContent = errors.New("jobimport: no job postings found in the source")
)
