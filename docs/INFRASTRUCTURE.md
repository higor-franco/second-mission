# Second Mission — Service Inventory

| Name | Image | Local Port | Env Var | Type |
|------|-------|-----------|---------|------|
| db | supabase/postgres:17.6.1.108 | 5432 | DATABASE_URL | backend |

## External APIs

| Service | Env Var | Used By | Notes |
|---------|---------|---------|-------|
| Anthropic Claude API | `ANTHROPIC_API_KEY` | Go backend (`internal/dd214`, `internal/linkedin`) | Powers DD-214 PDF extraction on `POST /api/dd214/translate` and LinkedIn company-profile extraction on `POST /api/employer/linkedin/extract`. Optional — when unset, both endpoints return 503 and the rest of the app runs normally. Model: `claude-opus-4-7`. |
| SMTP (Gmail, dev / Locaweb, prod) | `SMTP_*` | Go backend (auth + employer reset flows) | Used for veteran magic-link emails and employer password reset links. |
