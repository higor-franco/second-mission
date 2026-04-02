-- name: CreateMagicToken :one
INSERT INTO magic_tokens (email, token, user_type, expires_at)
VALUES ($1, $2, $3, $4)
RETURNING id, email, token, user_type, created_at, expires_at, used;

-- name: GetMagicToken :one
SELECT id, email, token, user_type, created_at, expires_at, used
FROM magic_tokens
WHERE token = $1 AND expires_at > NOW() AND used = FALSE;

-- name: MarkTokenUsed :exec
UPDATE magic_tokens SET used = TRUE WHERE id = $1;

-- name: DeleteExpiredTokens :exec
DELETE FROM magic_tokens WHERE expires_at < NOW() OR used = TRUE;
