-- name: GetVeteranByEmail :one
SELECT id, email, name, mos_code, rank, years_of_service, separation_date, location, preferred_sectors, created_at, updated_at
FROM veterans
WHERE email = $1;

-- name: GetVeteranByID :one
SELECT id, email, name, mos_code, rank, years_of_service, separation_date, location, preferred_sectors, created_at, updated_at
FROM veterans
WHERE id = $1;

-- name: UpsertVeteran :one
INSERT INTO veterans (email, name, mos_code, rank, years_of_service, separation_date, location, preferred_sectors)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
ON CONFLICT (email) DO UPDATE SET
    name = EXCLUDED.name,
    mos_code = EXCLUDED.mos_code,
    rank = EXCLUDED.rank,
    years_of_service = EXCLUDED.years_of_service,
    separation_date = EXCLUDED.separation_date,
    location = EXCLUDED.location,
    preferred_sectors = EXCLUDED.preferred_sectors,
    updated_at = NOW()
RETURNING id, email, name, mos_code, rank, years_of_service, separation_date, location, preferred_sectors, created_at, updated_at;
