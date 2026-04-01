-- 001_initial_schema.sql
-- Core tables for Second Mission veteran-employer matching platform

-- MOS codes and their descriptions
CREATE TABLE IF NOT EXISTS mos_codes (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    branch TEXT NOT NULL DEFAULT 'Army',
    description TEXT NOT NULL DEFAULT ''
);

-- Civilian occupations from O*NET
CREATE TABLE IF NOT EXISTS civilian_roles (
    id SERIAL PRIMARY KEY,
    onet_code TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL DEFAULT '',
    avg_salary_min INTEGER NOT NULL DEFAULT 0,
    avg_salary_max INTEGER NOT NULL DEFAULT 0
);

-- MOS to civilian role mappings with match confidence
CREATE TABLE IF NOT EXISTS mos_civilian_mappings (
    id SERIAL PRIMARY KEY,
    mos_code TEXT NOT NULL REFERENCES mos_codes(code),
    civilian_role_id INTEGER NOT NULL REFERENCES civilian_roles(id),
    match_score INTEGER NOT NULL DEFAULT 75, -- 0-100 confidence score
    transferable_skills TEXT[] NOT NULL DEFAULT '{}',
    UNIQUE(mos_code, civilian_role_id)
);

-- Veterans
CREATE TABLE IF NOT EXISTS veterans (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL DEFAULT '',
    mos_code TEXT REFERENCES mos_codes(code),
    rank TEXT NOT NULL DEFAULT '',
    years_of_service INTEGER NOT NULL DEFAULT 0,
    separation_date DATE,
    location TEXT NOT NULL DEFAULT '',
    preferred_sectors TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Employers
CREATE TABLE IF NOT EXISTS employers (
    id SERIAL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    company_name TEXT NOT NULL,
    contact_name TEXT NOT NULL DEFAULT '',
    sector TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sessions for auth
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_type TEXT NOT NULL CHECK (user_type IN ('veteran', 'employer')),
    user_id INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mos_mappings_mos ON mos_civilian_mappings(mos_code);
CREATE INDEX IF NOT EXISTS idx_veterans_mos ON veterans(mos_code);
CREATE INDEX IF NOT EXISTS idx_veterans_email ON veterans(email);
CREATE INDEX IF NOT EXISTS idx_employers_email ON employers(email);
