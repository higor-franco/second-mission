-- name: GetJobListing :one
SELECT
    jl.id, jl.title, jl.description, jl.requirements, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    jl.is_active, jl.posted_at,
    cr.onet_code, cr.title AS role_title, cr.sector,
    e.company_name, e.location AS company_location
FROM job_listings jl
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
LEFT JOIN employers e ON e.id = jl.employer_id
WHERE jl.id = $1;

-- name: ListMatchedJobListings :many
-- Returns active job listings that match a veteran's MOS code, with match scores
SELECT
    jl.id, jl.title, jl.description, jl.requirements, jl.location,
    jl.salary_min, jl.salary_max, jl.employment_type, jl.wotc_eligible,
    jl.posted_at,
    cr.onet_code, cr.title AS role_title, cr.sector,
    e.company_name, e.location AS company_location,
    mcm.match_score, mcm.transferable_skills
FROM job_listings jl
JOIN civilian_roles cr ON cr.id = jl.civilian_role_id
JOIN mos_civilian_mappings mcm ON mcm.civilian_role_id = jl.civilian_role_id AND mcm.mos_code = $1
LEFT JOIN employers e ON e.id = jl.employer_id
WHERE jl.is_active = true
ORDER BY mcm.match_score DESC, jl.posted_at DESC;

-- name: CountActiveJobListings :one
SELECT COUNT(*) FROM job_listings WHERE is_active = true;
