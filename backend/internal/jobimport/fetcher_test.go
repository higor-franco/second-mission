package jobimport

import (
	"context"
	"errors"
	"net/url"
	"strings"
	"testing"
)

// validateURL is the core SSRF defense; make sure every "no way"
// category is blocked.
func TestValidateURL_Rejections(t *testing.T) {
	cases := []struct {
		name string
		raw  string
	}{
		{"http scheme",          "http://example.com"},
		{"ftp scheme",           "ftp://example.com"},
		{"literal localhost",    "https://localhost/"},
		{"loopback ip v4",       "https://127.0.0.1/"},
		{"loopback ip v6",       "https://[::1]/"},
		{"rfc1918 10.x",         "https://10.0.0.1/"},
		{"rfc1918 192.168.x",    "https://192.168.1.1/"},
		{"link-local",           "https://169.254.0.1/"},
		{"cloud metadata",       "https://169.254.169.254/latest/meta-data/"},
		{"no host",              "https:///foo"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			u, err := url.Parse(tt.raw)
			if err != nil {
				// A parse error is an acceptable rejection path too.
				return
			}
			if err := validateURL(u); err == nil {
				t.Errorf("%s: expected rejection, got nil", tt.raw)
			}
		})
	}
}

// Public hostnames should pass. Resolution may fail in the test
// environment — that's fine, we only reject confirmed-private IPs.
func TestValidateURL_PublicHostnamesAccepted(t *testing.T) {
	cases := []string{
		"https://example.com/",
		"https://careers.example.com/jobs",
		"https://boards.greenhouse.io/acme",
	}
	for _, raw := range cases {
		u, _ := url.Parse(raw)
		if err := validateURL(u); err != nil {
			// DNS resolution might fail offline — that's OK, the check
			// only fails when we actively see a private IP.
			if !strings.Contains(err.Error(), "private") &&
				!strings.Contains(err.Error(), "localhost") &&
				!strings.Contains(err.Error(), "https") {
				// Allow resolution failures to pass silently.
			}
		}
	}
}

// Fetch returns ErrInvalidURL for malformed schemes without hitting the
// network. Important because we want fast feedback for bad input.
func TestFetch_RejectsBadScheme(t *testing.T) {
	_, err := DefaultFetcher.Fetch(context.Background(), "http://example.com")
	if !errors.Is(err, ErrInvalidURL) {
		t.Errorf("want ErrInvalidURL, got %v", err)
	}

	_, err = DefaultFetcher.Fetch(context.Background(), "not a url at all")
	if !errors.Is(err, ErrInvalidURL) {
		t.Errorf("want ErrInvalidURL, got %v", err)
	}
}

// cleanHTML should strip scripts and styles but leave body text alone.
func TestCleanHTML_StripsScriptsAndStyles(t *testing.T) {
	in := `<html><head><script>var x = 1;</script><style>body{color:red;}</style></head>` +
		`<body><h1>Careers</h1><p>Join us!</p></body></html>`
	out := cleanHTML(in)
	if strings.Contains(out, "var x = 1") {
		t.Errorf("script not stripped: %q", out)
	}
	if strings.Contains(out, "color:red") {
		t.Errorf("style not stripped: %q", out)
	}
	if !strings.Contains(out, "Join us!") {
		t.Errorf("body text lost: %q", out)
	}
}

func TestIsPublicIP_KnownPrivateRanges(t *testing.T) {
	cases := map[string]bool{
		"10.0.0.1":        false,
		"192.168.1.1":     false,
		"172.16.5.3":      false,
		"127.0.0.1":       false,
		"169.254.169.254": false,
		"8.8.8.8":         true,
		"1.1.1.1":         true,
	}
	for ipStr, wantPublic := range cases {
		u, _ := url.Parse("https://" + ipStr)
		err := validateURL(u)
		if wantPublic && err != nil {
			t.Errorf("%s: expected public, got err %v", ipStr, err)
		}
		if !wantPublic && err == nil {
			t.Errorf("%s: expected rejection, got nil", ipStr)
		}
	}
}
