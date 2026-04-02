# 005 - Employer Authentication via Password

**Status:** Accepted

## Context
Employers need a separate authentication flow from veterans. Veterans use magic link (passwordless) auth, which works well for individuals browsing on mobile. Employers, however, are typically at a desk, managing a dashboard repeatedly, and need quick access without waiting for an email each time.

## Decision
Employers authenticate via email + password (bcrypt-hashed). A separate session is created with `user_type = "employer"` in the shared sessions table. The same session cookie name is reused — the backend distinguishes veteran vs. employer sessions by the `user_type` field.

A dev-only login endpoint (`POST /api/dev/employer-login`) bypasses password validation for automated testing, gated by `DEV_MODE=1`.

## Rationale
- Password auth is simpler to implement for the prototype phase and provides instant access for repeat users
- The shared sessions table with a `user_type` discriminator avoids duplicating session infrastructure
- Employer and veteran auth are intentionally separate — they have different UX flows, different profile data, and different permissions

## Trade-offs
**Pros:**
- Fast to implement for prototype/demo
- Familiar UX for enterprise users
- No SMTP dependency for employer auth

**Cons:**
- Password-based auth is less secure than magic link or OAuth
- Must be replaced with a stronger auth method before production launch (e.g., SSO, OAuth)

## Alternatives Considered
- **Magic link for employers too**: Rejected — adds friction for repeat dashboard access, and employers expect password-based portals
- **OAuth/SSO**: Ideal for production but over-engineered for the Wharton demo
