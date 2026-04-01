-- name: GetMOSCode :one
SELECT code, title, branch, description
FROM mos_codes
WHERE code = $1;

-- name: ListMOSCodes :many
SELECT code, title, branch, description
FROM mos_codes
ORDER BY code;

-- name: TranslateMOS :many
SELECT
    cr.onet_code,
    cr.title,
    cr.description,
    cr.sector,
    cr.avg_salary_min,
    cr.avg_salary_max,
    mcm.match_score,
    mcm.transferable_skills
FROM mos_civilian_mappings mcm
JOIN civilian_roles cr ON cr.id = mcm.civilian_role_id
WHERE mcm.mos_code = $1
ORDER BY mcm.match_score DESC;
