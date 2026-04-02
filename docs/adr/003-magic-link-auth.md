# 003 - Magic Link Authentication for Veterans

**Status:** Accepted

## Context
Veterans need a way to sign in to access their dashboard, profile, and personalized career matches. The platform needs authentication that is simple, secure, and doesn't require veterans to remember passwords.

## Decision
Implement passwordless authentication using magic links (one-time tokens sent via email). Veterans enter their email, receive a link, click it, and are logged in with a session cookie.

## Rationale
- **No passwords to remember** — reduces friction for first-time users who may not be tech-savvy
- **Email verification built-in** — the act of clicking the link proves email ownership
- **Simpler to implement securely** — no password hashing, reset flows, or credential storage
- **PRD specifies magic link** — aligns with the product requirements document

## Trade-offs
**Pros:**
- Zero-friction signup (enter email → click link → done)
- No password security concerns (no credentials to leak)
- Auto-creates veteran account on first login
- Dev login endpoint for local testing without SMTP

**Cons:**
- Requires SMTP configuration for production
- Login speed depends on email delivery time
- Users without email access can't log in (acceptable for target audience)

## Alternatives Considered
- **Username + password:** Discarded — adds friction and security burden for no benefit given the target audience
- **Google OAuth:** Viable as a future addition, but not all veterans have Google accounts; magic link is more universal
- **SMS OTP:** Higher cost per authentication, requires phone number collection
