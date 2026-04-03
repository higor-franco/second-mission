package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgtype"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

// LogActivity records a user action in the activity_logs table.
// It's a fire-and-forget helper — errors are logged but don't block the request.
func LogActivity(queries *sqlc.Queries, r *http.Request, userType string, userID int32, action string, details map[string]any) {
	detailsJSON, _ := json.Marshal(details)

	sessionID := pgtype.Text{}
	if cookie, err := r.Cookie(sessionCookieName); err == nil && cookie.Value != "" {
		sessionID = pgtype.Text{String: cookie.Value, Valid: true}
	}

	ipAddress := pgtype.Text{}
	ip := clientIP(r)
	if ip != "" {
		ipAddress = pgtype.Text{String: ip, Valid: true}
	}

	_, err := queries.CreateActivityLog(r.Context(), sqlc.CreateActivityLogParams{
		UserType:  userType,
		UserID:    userID,
		SessionID: sessionID,
		Action:    action,
		Details:   detailsJSON,
		IpAddress: ipAddress,
	})
	if err != nil {
		slog.Warn("failed to log activity", "action", action, "user_type", userType, "user_id", userID, "err", err)
	}
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		return strings.TrimSpace(parts[0])
	}
	if xri := r.Header.Get("X-Real-Ip"); xri != "" {
		return strings.TrimSpace(xri)
	}
	// RemoteAddr is "ip:port"
	addr := r.RemoteAddr
	if idx := strings.LastIndex(addr, ":"); idx != -1 {
		return addr[:idx]
	}
	return addr
}
