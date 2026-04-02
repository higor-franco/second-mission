-- 006_employer_auth_and_listings.sql
-- Employer authentication support and job listing management enhancements

-- Add password_hash column for employer self sign-in (prototyping only)
ALTER TABLE employers ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- Add is_active flag for employers
ALTER TABLE employers ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- Add task-level fields to job_listings for employer-created postings
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS tasks TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS benefits TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE job_listings ADD COLUMN IF NOT EXISTS mos_codes_preferred TEXT[] NOT NULL DEFAULT '{}';

-- Index for employer session lookups
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_type, user_id);
