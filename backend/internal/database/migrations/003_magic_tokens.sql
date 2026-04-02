-- 003_magic_tokens.sql
-- Magic link tokens for passwordless authentication

CREATE TABLE IF NOT EXISTS magic_tokens (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    user_type TEXT NOT NULL CHECK (user_type IN ('veteran', 'employer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_magic_tokens_token ON magic_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_tokens_expires ON magic_tokens(expires_at);
