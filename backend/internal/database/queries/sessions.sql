-- name: CreateSession :one
INSERT INTO sessions (id, user_type, user_id, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, user_type, user_id, created_at, expires_at;

-- name: GetSession :one
SELECT id, user_type, user_id, created_at, expires_at
FROM sessions
WHERE id = $1 AND expires_at > NOW();

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = $1;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < NOW();
