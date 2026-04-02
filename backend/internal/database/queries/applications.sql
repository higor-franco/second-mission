-- name: GetVeteranApplications :many
-- Returns all applications for a veteran with job listing and employer details
SELECT
    va.id, va.status, va.match_score, va.notes, va.created_at, va.updated_at,
    jl.id AS job_listing_id, jl.title, jl.description, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    cr.sector, cr.title AS role_title,
    e.company_name
FROM veteran_applications va
JOIN job_listings jl ON jl.id = va.job_listing_id
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
LEFT JOIN employers e ON e.id = jl.employer_id
WHERE va.veteran_id = $1
ORDER BY
    CASE va.status
        WHEN 'placed' THEN 1
        WHEN 'interviewing' THEN 2
        WHEN 'introduced' THEN 3
        WHEN 'interested' THEN 4
        WHEN 'matched' THEN 5
    END,
    va.match_score DESC;

-- name: GetVeteranApplication :one
SELECT
    va.id, va.veteran_id, va.job_listing_id, va.status, va.match_score,
    va.notes, va.created_at, va.updated_at
FROM veteran_applications va
WHERE va.id = $1 AND va.veteran_id = $2;

-- name: CreateOrGetApplication :one
-- Creates an application if it doesn't exist, or returns the existing one
INSERT INTO veteran_applications (veteran_id, job_listing_id, status, match_score)
VALUES ($1, $2, $3, $4)
ON CONFLICT (veteran_id, job_listing_id) DO UPDATE SET
    status = CASE
        WHEN veteran_applications.status = 'matched' THEN EXCLUDED.status
        ELSE veteran_applications.status
    END,
    updated_at = NOW()
RETURNING id, veteran_id, job_listing_id, status, match_score, notes, created_at, updated_at;

-- name: UpdateApplicationStatus :one
UPDATE veteran_applications SET
    status = $3,
    updated_at = NOW()
WHERE id = $1 AND veteran_id = $2
RETURNING id, veteran_id, job_listing_id, status, match_score, notes, created_at, updated_at;

-- name: CountVeteranApplicationsByStatus :many
SELECT status, COUNT(*) AS count
FROM veteran_applications
WHERE veteran_id = $1
GROUP BY status;

-- name: EnsureMatchedApplications :exec
-- Auto-create matched applications for a veteran based on their MOS
INSERT INTO veteran_applications (veteran_id, job_listing_id, status, match_score)
SELECT $1, jl.id, 'matched', mcm.match_score
FROM mos_civilian_mappings mcm
JOIN job_listings jl ON jl.civilian_role_id = mcm.civilian_role_id AND jl.is_active = true
WHERE mcm.mos_code = $2
ON CONFLICT (veteran_id, job_listing_id) DO NOTHING;
