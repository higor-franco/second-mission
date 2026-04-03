-- Admin users table
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs table — tracks what veterans and employers do
CREATE TABLE IF NOT EXISTS activity_logs (
    id BIGSERIAL PRIMARY KEY,
    user_type TEXT NOT NULL CHECK (user_type IN ('veteran', 'employer')),
    user_id INTEGER NOT NULL,
    session_id TEXT,
    action TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    ip_address TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs (user_type, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_session ON activity_logs (session_id) WHERE session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs (created_at DESC);

-- Extend sessions CHECK to allow 'admin' user_type
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_type_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_user_type_check CHECK (user_type IN ('veteran', 'employer', 'admin'));

-- Extend magic_tokens CHECK to allow 'admin' user_type
ALTER TABLE magic_tokens DROP CONSTRAINT IF EXISTS magic_tokens_user_type_check;
ALTER TABLE magic_tokens ADD CONSTRAINT magic_tokens_user_type_check CHECK (user_type IN ('veteran', 'employer', 'admin'));

-- Seed a default admin user (password: admin123 — must be changed on first login in production)
-- bcrypt hash of 'admin123' with cost 10
INSERT INTO admins (email, password_hash, name)
VALUES ('admin@secondmission.com', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'Admin')
ON CONFLICT (email) DO NOTHING;
