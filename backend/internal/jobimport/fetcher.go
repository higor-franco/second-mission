package jobimport

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// maxFetchBytes caps how much HTML we'll read from a careers-page
// response. 2 MB is generous even for big-employer careers indexes;
// above that we abort because Claude won't read more than our 64 KB
// input cap anyway and we shouldn't spend the bandwidth.
const maxFetchBytes = 2 << 20

// fetchTimeout bounds a single HTTP request to a careers page. Employers
// (or their CDN) routinely put these behind bot-detection that slow-rolls
// unknown UAs; we'd rather fail fast and surface the paste fallback than
// make the employer watch a spinner for 30s.
const fetchTimeout = 15 * time.Second

// DefaultFetcher is a package-level fetcher with sensible defaults. Safe
// to share — net/http clients are concurrency-safe.
var DefaultFetcher = NewFetcher()

// Fetcher retrieves the HTML of an arbitrary public careers page. Unlike
// the LinkedIn variant which restricts hosts to linkedin.com, this one
// accepts any public https URL — hence the SSRF hardening below.
type Fetcher struct {
	Client *http.Client
}

// NewFetcher builds a Fetcher that rejects connections to private IPs
// via a custom DialContext. This is the load-bearing SSRF defense: even
// if an attacker submits a URL whose hostname resolves to 169.254.169.254
// or an internal 10.x address, the dialer refuses to open the socket.
func NewFetcher() *Fetcher {
	transport := &http.Transport{
		DialContext:         safeDialContext,
		TLSHandshakeTimeout: 10 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
	}
	return &Fetcher{
		Client: &http.Client{
			Timeout:   fetchTimeout,
			Transport: transport,
			// Follow redirects but cap the hop count and re-check each
			// destination — a 302 to http://10.0.0.1/admin would
			// otherwise bypass the URL allowlist.
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= 5 {
					return errors.New("jobimport: too many redirects")
				}
				if err := validateURL(req.URL); err != nil {
					return err
				}
				return nil
			},
		},
	}
}

// Fetch retrieves the given careers-page URL and returns the HTML body
// as a string (with <script>/<style> blocks stripped so the extractor
// prompt stays lean). Errors:
//
//   - ErrInvalidURL if the URL is malformed, non-https, or targets a
//     private / loopback / link-local host.
//   - ErrFetchBlocked if the server returns a non-2xx status that
//     suggests bot detection or a login wall.
//   - a wrapped network error for DNS/connect/TLS/timeout failures.
//
// The caller should pass the returned string straight to Extractor.Extract.
func (f *Fetcher) Fetch(ctx context.Context, pageURL string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(pageURL))
	if err != nil || u.Scheme != "https" {
		return "", ErrInvalidURL
	}
	if err := validateURL(u); err != nil {
		return "", ErrInvalidURL
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", fmt.Errorf("jobimport: build request: %w", err)
	}
	// Desktop-browser headers get us past the most casual UA blocks.
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := f.Client.Do(req)
	if err != nil {
		return "", fmt.Errorf("jobimport: fetch: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("%w: HTTP %d", ErrFetchBlocked, resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(io.LimitReader(resp.Body, maxFetchBytes))
	if err != nil {
		return "", fmt.Errorf("jobimport: read body: %w", err)
	}

	return cleanHTML(string(bodyBytes)), nil
}

// validateURL rejects URLs whose hostname resolves to a private,
// loopback, link-local, or multicast address — the core SSRF defense.
// Also rejects bare-IP targets and obvious localhost strings so a well-
// intentioned admin pasting "https://127.0.0.1" gets a clean error up
// front rather than a confusing network failure.
func validateURL(u *url.URL) error {
	if u.Scheme != "https" {
		return errors.New("jobimport: only https URLs are accepted")
	}
	host := u.Hostname()
	if host == "" {
		return errors.New("jobimport: URL has no host")
	}
	if strings.EqualFold(host, "localhost") {
		return errors.New("jobimport: localhost is not allowed")
	}

	// If the host is literally an IP, check it directly. Otherwise
	// resolve via the default resolver and check every returned address
	// — a sneaky DNS entry could point to a private IP.
	if ip := net.ParseIP(host); ip != nil {
		if !isPublicIP(ip) {
			return errors.New("jobimport: private or local IP not allowed")
		}
		return nil
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(context.Background(), host)
	if err != nil {
		// Don't fail the URL validation on a DNS miss — the HTTP client
		// will surface a clean network error. We only block confirmed
		// private IPs.
		return nil
	}
	for _, a := range addrs {
		if !isPublicIP(a.IP) {
			return errors.New("jobimport: host resolves to a private IP")
		}
	}
	return nil
}

// isPublicIP reports true for globally-routable addresses only.
func isPublicIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsMulticast() || ip.IsUnspecified() {
		return false
	}
	// Reject the AWS/GCP/Azure metadata service address explicitly
	// even though it's technically in the link-local range the checks
	// above already catch — being explicit helps reviewers.
	if ip.Equal(net.IPv4(169, 254, 169, 254)) {
		return false
	}
	return true
}

// safeDialContext is the DialContext used by the transport. It performs
// a second-layer check on the resolved address the dialer is actually
// about to connect to — catches the case where DNS rebinding returns a
// public IP during validateURL() but a private one when the socket
// opens milliseconds later.
func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, a := range ips {
		if !isPublicIP(a.IP) {
			return nil, fmt.Errorf("jobimport: blocked private IP %s", a.IP)
		}
	}
	// Dial the first resolved IP explicitly (rather than passing the
	// host string) so we don't re-resolve and get a different answer.
	d := net.Dialer{Timeout: 10 * time.Second}
	return d.DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

// cleanHTML strips <script> and <style> blocks so the 64 KB input cap
// on the extractor buys us more real content. Regex-level strip is
// adequate for feeding Claude; anything fancier would be over-engineered.
var (
	scriptRE = regexp.MustCompile(`(?is)<script[^>]*>.*?</script>`)
	styleRE  = regexp.MustCompile(`(?is)<style[^>]*>.*?</style>`)
)

func cleanHTML(body string) string {
	body = scriptRE.ReplaceAllString(body, "")
	body = styleRE.ReplaceAllString(body, "")
	return body
}

// Sentinel errors. Kept distinct from extractor.go's errors so the
// handler can tell "the URL itself was bogus" apart from "we got the
// page but couldn't extract jobs".
var (
	ErrInvalidURL   = errors.New("jobimport: only public https URLs are supported")
	ErrFetchBlocked = errors.New("jobimport: the page blocked us — paste the job listings instead")
)
