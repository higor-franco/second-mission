-- name: CreateActivityLog :one
INSERT INTO activity_logs (user_type, user_id, session_id, action, details, ip_address)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, user_type, user_id, session_id, action, details, ip_address, created_at;

-- name: GetActivityLogsForUser :many
SELECT id, user_type, user_id, session_id, action, details, ip_address, created_at
FROM activity_logs
WHERE user_type = $1 AND user_id = $2
ORDER BY created_at DESC
LIMIT $3;

-- name: GetActivityLogsForUserSessions :many
-- Get activity logs for the last N distinct sessions of a user
SELECT al.id, al.user_type, al.user_id, al.session_id, al.action, al.details, al.ip_address, al.created_at
FROM activity_logs al
WHERE al.user_type = $1 AND al.user_id = $2
  AND al.session_id IN (
      SELECT DISTINCT session_id
      FROM activity_logs
      WHERE user_type = $1 AND user_id = $2 AND session_id IS NOT NULL AND session_id != ''
      ORDER BY session_id DESC
      LIMIT $3
  )
ORDER BY al.created_at DESC;

-- name: GetDistinctSessionsForUser :many
-- Get distinct sessions for a user with first and last activity timestamps
SELECT
    session_id,
    MIN(created_at) AS session_start,
    MAX(created_at) AS session_end,
    COUNT(*) AS action_count
FROM activity_logs
WHERE user_type = $1 AND user_id = $2 AND session_id IS NOT NULL AND session_id != ''
GROUP BY session_id
ORDER BY MIN(created_at) DESC
LIMIT $3;

-- name: GetRecentActivityLogs :many
-- Get recent activity across all users
SELECT al.id, al.user_type, al.user_id, al.session_id, al.action, al.details, al.ip_address, al.created_at
FROM activity_logs al
ORDER BY al.created_at DESC
LIMIT $1;
