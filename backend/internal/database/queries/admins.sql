-- name: GetAdminByEmail :one
SELECT id, email, password_hash, name, created_at, updated_at
FROM admins
WHERE email = $1;

-- name: GetAdminByID :one
SELECT id, email, password_hash, name, created_at, updated_at
FROM admins
WHERE id = $1;

-- name: CreateAdmin :one
INSERT INTO admins (email, password_hash, name)
VALUES ($1, $2, $3)
ON CONFLICT (email) DO NOTHING
RETURNING id, email, password_hash, name, created_at, updated_at;

-- name: UpdateAdminPassword :exec
UPDATE admins SET password_hash = $2, updated_at = NOW()
WHERE id = $1;

-- name: ListAllVeterans :many
SELECT id, email, name, mos_code, rank, years_of_service, separation_date, location, preferred_sectors, journey_step, created_at, updated_at
FROM veterans
ORDER BY created_at DESC;

-- name: ListAllEmployers :many
SELECT id, email, company_name, contact_name, sector, location, description, is_active, created_at, updated_at
FROM employers
ORDER BY created_at DESC;

-- name: ListAllJobListings :many
SELECT
    jl.id, jl.title, jl.description, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    jl.is_active, jl.posted_at,
    e.company_name,
    cr.title AS role_title, cr.sector
FROM job_listings jl
JOIN employers e ON e.id = jl.employer_id
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
ORDER BY jl.posted_at DESC;

-- name: CountPlatformStats :one
SELECT
    (SELECT COUNT(*) FROM veterans) AS total_veterans,
    (SELECT COUNT(*) FROM employers) AS total_employers,
    (SELECT COUNT(*) FROM job_listings WHERE is_active = true) AS active_listings,
    (SELECT COUNT(*) FROM veteran_applications WHERE status != 'matched') AS total_applications,
    (SELECT COUNT(*) FROM veteran_applications WHERE status = 'placed') AS total_placements;

-- name: ListAllApplications :many
SELECT
    va.id, va.status, va.match_score, va.created_at, va.updated_at,
    v.id AS veteran_id, v.name AS veteran_name, v.email AS veteran_email, v.mos_code,
    jl.id AS job_listing_id, jl.title AS job_title,
    e.company_name
FROM veteran_applications va
JOIN veterans v ON v.id = va.veteran_id
JOIN job_listings jl ON jl.id = va.job_listing_id
JOIN employers e ON e.id = jl.employer_id
WHERE va.status != 'matched'
ORDER BY va.updated_at DESC
LIMIT 100;
