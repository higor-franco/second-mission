package linkedin

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestFetch_Allowlist verifies we only call linkedin.com — passing some
// other host URL must be rejected without making a request.
func TestFetch_Allowlist(t *testing.T) {
	cases := []struct {
		name string
		url  string
	}{
		{"http scheme", "http://www.linkedin.com/company/nov"},
		{"non-linkedin", "https://example.com/company/nov"},
		{"empty", ""},
		{"random string", "not a url"},
	}
	f := NewFetcher()
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			_, err := f.Fetch(context.Background(), c.url)
			if !errors.Is(err, ErrInvalidURL) {
				t.Errorf("got err %v, want ErrInvalidURL", err)
			}
		})
	}
}

// TestFetch_StripsScriptsAndStyles verifies the HTML cleanup — script
// and style tags are stripped before we hand the body to the extractor.
// We point the fetcher at an httptest server that pretends to be linkedin
// by placing `linkedin.com` in the URL via the allowlist bypass — but
// since the fetcher validates the URL host, we test the cleanHTML helper
// directly, which is what actually matters.
func TestCleanHTML(t *testing.T) {
	body := `<html><head>
<style>body { color: red; }</style>
<script>var x = 1; console.log('bundled');</script>
</head><body>
<h1>NOV Inc.</h1>
<p>Energy services company.</p>
<script type="application/ld+json">{"@type":"Organization"}</script>
</body></html>`

	cleaned := cleanHTML(body)

	if strings.Contains(cleaned, "<script") {
		t.Error("cleaned HTML still contains a script tag")
	}
	if strings.Contains(cleaned, "<style") {
		t.Error("cleaned HTML still contains a style tag")
	}
	if !strings.Contains(cleaned, "NOV Inc.") {
		t.Error("cleaned HTML dropped the company name")
	}
}

// TestIsLoginWall distinguishes login-wall responses from real company
// pages. The real test is that if we see login-wall markers AND no
// company data at all, we flag it; if company data is present, we let
// the extractor try.
func TestIsLoginWall(t *testing.T) {
	cases := []struct {
		name string
		body string
		want bool
	}{
		{"login wall, no data", `<html>Sign in to view this page. Join LinkedIn.</html>`, true},
		{"login wall + og title", `<html>Sign in to view <meta property="og:title" content="NOV"></html>`, false},
		{"login wall + JSON-LD organization", `<html>Sign in to view <script>{"@type":"Organization"}</script></html>`, false},
		{"clean company page", `<html><meta property="og:title" content="NOV"><h1>NOV Inc.</h1></html>`, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			// Mirror the real pipeline: isLoginWall runs on the RAW body,
			// before cleanHTML strips scripts, so JSON-LD evidence of
			// company data survives long enough to be checked.
			if got := isLoginWall(c.body); got != c.want {
				t.Errorf("isLoginWall = %v, want %v for body %q", got, c.want, c.body)
			}
		})
	}
}

// TestFetch_Non2xxIsBlocked confirms that LinkedIn's usual "we don't
// want to talk to you" response codes (403, 429, 999) map to our
// ErrFetchBlocked sentinel so the handler can surface a paste fallback.
//
// We can't hit linkedin.com in tests — the URL allowlist would reject
// any other host. Instead we install a custom transport that routes
// all linkedin.com requests to a local test server. This keeps the
// allowlist check honest while still giving us a controlled response.
func TestFetch_Non2xxIsBlocked(t *testing.T) {
	codes := []int{403, 429, 999}
	for _, code := range codes {
		t.Run(http.StatusText(code), func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(code)
			}))
			defer srv.Close()

			// Redirect linkedin.com:443 → the test server. http.Transport
			// lets us rewrite the address at dial time; everything else
			// (hostname, TLS off) stays consistent with a real request.
			f := NewFetcher()
			f.Client = srv.Client()
			f.Client.Transport = rewriteTransport{target: srv.URL, inner: srv.Client().Transport}

			_, err := f.Fetch(context.Background(), "https://www.linkedin.com/company/nov/")
			if !errors.Is(err, ErrFetchBlocked) {
				t.Errorf("got err %v, want ErrFetchBlocked", err)
			}
		})
	}
}

// rewriteTransport redirects every request to `target` while preserving
// the original URL path. Used only by TestFetch_Non2xxIsBlocked so we
// can exercise the non-2xx branch without touching real LinkedIn.
type rewriteTransport struct {
	target string
	inner  http.RoundTripper
}

func (t rewriteTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Rebuild the URL to point at the test server but keep the path.
	u := req.URL
	u.Scheme = "http" // httptest serves HTTP; scheme check already passed upstream
	// srv.URL is like http://127.0.0.1:PORT — split it onto the request.
	// Quick hand-roll instead of pulling in net/url for one line.
	host := strings.TrimPrefix(t.target, "http://")
	host = strings.TrimPrefix(host, "https://")
	u.Host = host
	req.Host = host
	return t.inner.RoundTrip(req)
}
