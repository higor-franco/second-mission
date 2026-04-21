package linkedin

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// maxFetchBytes caps how much HTML we'll read from a LinkedIn response —
// 1 MB is plenty for any company About page and prevents a pathological
// body from wedging the process. Enforced via io.LimitReader.
const maxFetchBytes = 1 << 20

// fetchTimeout bounds the LinkedIn HTTP request. LinkedIn is aggressive
// about slow-roll-style bot detection on unknown clients, so a tight
// timeout also helps us fall back to the paste path quickly instead of
// making the employer stare at a spinner.
const fetchTimeout = 15 * time.Second

// DefaultFetcher is a package-level fetcher with sensible defaults. Safe
// to reuse across goroutines — net/http clients are concurrency-safe and
// keep their own connection pool.
var DefaultFetcher = NewFetcher()

// Fetcher pulls the HTML of a public LinkedIn company page and returns
// cleaned-up text suitable for the extractor. Implemented as a struct so
// tests can inject a stub http.Client via the exported field.
type Fetcher struct {
	Client *http.Client
}

// NewFetcher builds a Fetcher with a timeout-bounded http.Client and the
// default redirect policy. Use DefaultFetcher unless you need overrides.
func NewFetcher() *Fetcher {
	return &Fetcher{
		Client: &http.Client{
			Timeout: fetchTimeout,
		},
	}
}

// Fetch retrieves the given LinkedIn company URL and returns the response
// body as a plain string (HTML with scripts/styles stripped; see below).
// The caller is expected to pass the returned string straight to the
// extractor — Claude is resilient to boilerplate, so we only do cheap
// structural cleanup here.
//
// Returns:
//   - ErrInvalidURL if the URL doesn't parse, isn't https, or isn't on
//     linkedin.com. We refuse to fan out fetches to arbitrary hosts.
//   - ErrFetchBlocked if LinkedIn responds with a challenge/login page
//     (HTTP 400-ish, 403, 429, or a body that looks like a login wall).
//     Use this to surface a clear "paste it manually" message to the
//     user rather than a generic error.
//   - a wrapped network error for connect/DNS/TLS/timeout failures.
func (f *Fetcher) Fetch(ctx context.Context, linkedinURL string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(linkedinURL))
	if err != nil || u.Scheme != "https" {
		return "", ErrInvalidURL
	}
	host := strings.ToLower(u.Hostname())
	if host != "linkedin.com" && !strings.HasSuffix(host, ".linkedin.com") {
		return "", ErrInvalidURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("linkedin: build request: %w", err)
	}
	// A desktop-browser UA plus Accept/Accept-Language gives us the best
	// odds of getting HTML back rather than a tiny bot-detection stub.
	// It doesn't defeat real blocks (LinkedIn has many layers), but it's
	// the difference between "login wall" and "network error" for the
	// ~half of fetches where the public page is visible at all.
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := f.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("linkedin: fetch: %w", err)
	}
	defer resp.Body.Close()

	// LinkedIn returns 200 with a login wall, 403 with a challenge page,
	// 429 when rate-limiting, and the occasional 999 "unavailable" that
	// only it issues. Treat anything non-2xx as a block.
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%w: HTTP %d", ErrFetchBlocked, resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxFetchBytes))
	if err != nil {
		return "", fmt.Errorf("linkedin: read body: %w", err)
	}

	// Check for a login wall BEFORE stripping scripts — the JSON-LD that
	// marks a page as "has company data" lives inside a
	// <script type="application/ld+json"> block, and cleanHTML removes
	// every script tag. Running isLoginWall on the raw body preserves
	// that evidence.
	raw := string(bodyBytes)
	if isLoginWall(raw) {
		return "", ErrFetchBlocked
	}
	return cleanHTML(raw), nil
}

// cleanHTML strips <script> and <style> blocks from the body so Claude
// isn't fed hundreds of kilobytes of bundled JavaScript it can't use.
// Intentionally NOT a full HTML parser — a regex-based strip is fine for
// this one-way, extractor-feeding use case, and keeps the fetcher small.
var (
	scriptRE = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleRE  = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
)

func cleanHTML(body string) string {
	body = scriptRE.ReplaceAllString(body, "")
	body = styleRE.ReplaceAllString(body, "")
	return body
}

// isLoginWall is a cheap check for the common case where LinkedIn
// returned 200 but the body is the "join LinkedIn" interstitial with no
// company content. We look for the unmistakable signup form markers; if
// we find them and don't see the company-specific schema markup, treat
// it as blocked so the caller falls back to the paste path.
func isLoginWall(body string) bool {
	low := strings.ToLower(body)
	hasJoinWall := strings.Contains(low, "sign in to view") ||
		strings.Contains(low, "join linkedin") ||
		strings.Contains(low, `"challengev2"`)
	// Company pages embed schema.org "Organization" JSON-LD. If we have
	// that, there's extractable data even if the UI chrome looks like a
	// login nudge — let Claude try.
	hasCompanyData := strings.Contains(low, `"@type":"organization"`) ||
		strings.Contains(low, `"organization"`) ||
		strings.Contains(low, `<meta property="og:title"`)
	return hasJoinWall && !hasCompanyData
}

// Sentinel errors. Separated from extractor.go's errors so callers can
// tell "LinkedIn won't talk to us" apart from "we got data but Claude
// couldn't parse it" and react with the right UI message.
var (
	ErrInvalidURL    = errors.New("linkedin: only public LinkedIn URLs are supported")
	ErrFetchBlocked  = errors.New("linkedin: page is gated by LinkedIn — paste the About section instead")
)
