-- 004_job_listings_and_applications.sql
-- Job listings from employers and veteran application tracking

-- Job listings posted by employers (or seeded for MVP)
CREATE TABLE IF NOT EXISTS job_listings (
    id SERIAL PRIMARY KEY,
    employer_id INTEGER REFERENCES employers(id),
    civilian_role_id INTEGER NOT NULL REFERENCES civilian_roles(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    requirements TEXT[] NOT NULL DEFAULT '{}',
    location TEXT NOT NULL DEFAULT '',
    salary_min INTEGER NOT NULL DEFAULT 0,
    salary_max INTEGER NOT NULL DEFAULT 0,
    employment_type TEXT NOT NULL DEFAULT 'full-time' CHECK (employment_type IN ('full-time', 'part-time', 'contract', 'internship')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    wotc_eligible BOOLEAN NOT NULL DEFAULT true,
    posted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_listings_civilian_role ON job_listings(civilian_role_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_employer ON job_listings(employer_id);
CREATE INDEX IF NOT EXISTS idx_job_listings_active ON job_listings(is_active) WHERE is_active = true;

-- Veteran applications / interest tracking
-- Status flow: matched -> interested -> introduced -> interviewing -> placed
CREATE TABLE IF NOT EXISTS veteran_applications (
    id SERIAL PRIMARY KEY,
    veteran_id INTEGER NOT NULL REFERENCES veterans(id),
    job_listing_id INTEGER NOT NULL REFERENCES job_listings(id),
    status TEXT NOT NULL DEFAULT 'matched' CHECK (status IN ('matched', 'interested', 'introduced', 'interviewing', 'placed')),
    match_score INTEGER NOT NULL DEFAULT 0,
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(veteran_id, job_listing_id)
);

CREATE INDEX IF NOT EXISTS idx_veteran_applications_veteran ON veteran_applications(veteran_id);
CREATE INDEX IF NOT EXISTS idx_veteran_applications_status ON veteran_applications(status);

-- Track veteran journey step (discover, translate, match, place)
-- This is derived from veteran activity but tracked explicitly for dashboard
ALTER TABLE veterans ADD COLUMN IF NOT EXISTS journey_step TEXT NOT NULL DEFAULT 'discover'
    CHECK (journey_step IN ('discover', 'translate', 'match', 'place'));
