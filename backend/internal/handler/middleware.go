package handler

import (
	"context"
	"log/slog"
	"net/http"

	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

type contextKey string

const sessionContextKey contextKey = "session"

// AuthMiddleware checks for a valid session cookie and injects the session into context.
func AuthMiddleware(queries *sqlc.Queries) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie(sessionCookieName)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "not authenticated"})
				return
			}

			session, err := queries.GetSession(r.Context(), cookie.Value)
			if err != nil {
				slog.Warn("invalid session", "err", err)
				// Clear the invalid cookie
				http.SetCookie(w, &http.Cookie{
					Name:     sessionCookieName,
					Value:    "",
					Path:     "/",
					HttpOnly: true,
					MaxAge:   -1,
				})
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "session expired"})
				return
			}

			ctx := context.WithValue(r.Context(), sessionContextKey, session)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetSession retrieves the session from the request context.
func GetSession(r *http.Request) (sqlc.Session, bool) {
	session, ok := r.Context().Value(sessionContextKey).(sqlc.Session)
	return session, ok
}

// RequireAuth wraps a handler function with authentication.
func RequireAuth(queries *sqlc.Queries, handler http.HandlerFunc) http.Handler {
	return AuthMiddleware(queries)(http.HandlerFunc(handler))
}
