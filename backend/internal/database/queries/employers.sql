-- name: GetEmployerByEmail :one
SELECT id, email, company_name, contact_name, sector, location, description, password_hash, is_active, created_at, updated_at
FROM employers
WHERE email = $1;

-- name: GetEmployerByID :one
SELECT id, email, company_name, contact_name, sector, location, description, password_hash, is_active, created_at, updated_at
FROM employers
WHERE id = $1;

-- name: CreateEmployer :one
INSERT INTO employers (email, company_name, contact_name, sector, location, description, password_hash)
VALUES ($1, $2, $3, $4, $5, $6, $7)
ON CONFLICT (email) DO NOTHING
RETURNING id, email, company_name, contact_name, sector, location, description, password_hash, is_active, created_at, updated_at;

-- name: UpdateEmployerProfile :one
UPDATE employers SET
    company_name = $2,
    contact_name = $3,
    sector = $4,
    location = $5,
    description = $6,
    updated_at = NOW()
WHERE id = $1
RETURNING id, email, company_name, contact_name, sector, location, description, password_hash, is_active, created_at, updated_at;

-- name: ListEmployerJobListings :many
SELECT
    jl.id, jl.title, jl.description, jl.requirements, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    jl.is_active, jl.posted_at, jl.expires_at, jl.tasks, jl.benefits,
    jl.mos_codes_preferred,
    cr.onet_code, cr.title AS role_title, cr.sector
FROM job_listings jl
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
WHERE jl.employer_id = $1
ORDER BY jl.posted_at DESC;

-- name: CreateJobListing :one
INSERT INTO job_listings (employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible, tasks, benefits, mos_codes_preferred)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING id, employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible, is_active, posted_at, expires_at, tasks, benefits, mos_codes_preferred;

-- name: UpdateJobListing :one
UPDATE job_listings SET
    title = $3,
    description = $4,
    requirements = $5,
    location = $6,
    salary_min = $7,
    salary_max = $8,
    employment_type = $9,
    wotc_eligible = $10,
    tasks = $11,
    benefits = $12,
    mos_codes_preferred = $13,
    is_active = $14
WHERE id = $1 AND employer_id = $2
RETURNING id, employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible, is_active, posted_at, expires_at, tasks, benefits, mos_codes_preferred;

-- name: ToggleJobListingActive :one
UPDATE job_listings SET is_active = NOT is_active
WHERE id = $1 AND employer_id = $2
RETURNING id, employer_id, civilian_role_id, title, description, requirements, location, salary_min, salary_max, employment_type, wotc_eligible, is_active, posted_at, expires_at, tasks, benefits, mos_codes_preferred;

-- name: DeleteJobListing :exec
DELETE FROM job_listings WHERE id = $1 AND employer_id = $2;

-- name: GetEmployerJobListing :one
SELECT
    jl.id, jl.title, jl.description, jl.requirements, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    jl.is_active, jl.posted_at, jl.expires_at, jl.tasks, jl.benefits,
    jl.mos_codes_preferred, jl.civilian_role_id,
    cr.onet_code, cr.title AS role_title, cr.sector
FROM job_listings jl
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
WHERE jl.id = $1 AND jl.employer_id = $2;

-- name: ListCivilianRoles :many
SELECT id, onet_code, title, description, sector, avg_salary_min, avg_salary_max
FROM civilian_roles
ORDER BY sector, title;

-- name: GetEmployerDashboardStats :one
SELECT
    COUNT(*) FILTER (WHERE is_active = true) AS active_listings,
    COUNT(*) FILTER (WHERE is_active = false) AS inactive_listings,
    COUNT(*) AS total_listings
FROM job_listings
WHERE employer_id = $1;

-- name: CountCandidatesForEmployer :one
SELECT COUNT(DISTINCT va.veteran_id) AS total_candidates
FROM veteran_applications va
JOIN job_listings jl ON jl.id = va.job_listing_id
WHERE jl.employer_id = $1 AND va.status != 'matched';

-- name: ListCandidatesForEmployer :many
SELECT
    va.id AS application_id, va.status, va.match_score, va.created_at AS applied_at,
    v.id AS veteran_id, v.name, v.mos_code, v.rank, v.years_of_service,
    v.separation_date, v.location AS veteran_location, v.journey_step,
    jl.id AS job_listing_id, jl.title AS job_title,
    cr.sector
FROM veteran_applications va
JOIN veterans v ON v.id = va.veteran_id
JOIN job_listings jl ON jl.id = va.job_listing_id
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
WHERE jl.employer_id = $1 AND va.status != 'matched'
ORDER BY
    CASE va.status
        WHEN 'placed' THEN 1
        WHEN 'interviewing' THEN 2
        WHEN 'introduced' THEN 3
        WHEN 'interested' THEN 4
    END,
    va.match_score DESC;

-- name: UpdateEmployerPassword :exec
UPDATE employers SET password_hash = $2, updated_at = NOW()
WHERE id = $1;

-- name: UpdateCandidateStatus :one
UPDATE veteran_applications SET
    status = $3,
    updated_at = NOW()
WHERE veteran_applications.id = $1 AND veteran_applications.job_listing_id IN (SELECT jl.id FROM job_listings jl WHERE jl.employer_id = $2)
RETURNING id, veteran_id, job_listing_id, status, match_score, notes, created_at, updated_at;
