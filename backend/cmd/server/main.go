package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/higor-franco/second-mission/backend/internal/config"
	"github.com/higor-franco/second-mission/backend/internal/database"
	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
	"github.com/higor-franco/second-mission/backend/internal/dd214"
	"github.com/higor-franco/second-mission/backend/internal/handler"
)

func main() {
	cfg := config.Load()

	if cfg.DatabaseURL == "" {
		slog.Error("DATABASE_URL is required")
		os.Exit(1)
	}

	ctx := context.Background()

	// Connect to database with retry
	var pool *pgxpool.Pool
	var err error
	for i := range 6 {
		pool, err = pgxpool.New(ctx, cfg.DatabaseURL)
		if err == nil {
			if err = pool.Ping(ctx); err == nil {
				break
			}
			pool.Close()
		}
		delay := time.Second * (1 << i)
		slog.Warn("database not ready, retrying", "attempt", i+1, "delay", delay, "err", err)
		time.Sleep(delay)
	}
	if err != nil {
		slog.Error("failed to connect to database", "err", err)
		os.Exit(1)
	}
	defer pool.Close()
	slog.Info("connected to database")

	// Run migrations
	if err := database.RunMigrations(ctx, pool); err != nil {
		slog.Error("failed to run migrations", "err", err)
		os.Exit(1)
	}
	slog.Info("migrations complete")

	// Set up handlers
	queries := sqlc.New(pool)
	mosHandler := handler.NewMOSHandler(queries)
	authHandler := handler.NewAuthHandler(queries, cfg)
	veteranHandler := handler.NewVeteranHandler(queries)
	employerHandler := handler.NewEmployerHandler(queries, cfg)
	adminHandler := handler.NewAdminHandler(queries, cfg)

	// DD-214 extractor — only wired when the Anthropic API key is present.
	// Without the key the endpoint is registered but returns 503.
	var dd214Extractor handler.Extractor
	if cfg.AnthropicAPIKey != "" {
		ext, err := dd214.NewExtractor(cfg.AnthropicAPIKey)
		if err != nil {
			slog.Warn("dd214: extractor unavailable", "err", err)
		} else {
			dd214Extractor = ext
			slog.Info("dd214: extractor configured")
		}
	} else {
		slog.Warn("dd214: ANTHROPIC_API_KEY not set — upload endpoint will return 503")
	}
	dd214Handler := handler.NewDD214Handler(queries, dd214Extractor)

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /up", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Public API routes
	mux.HandleFunc("GET /api/translate", mosHandler.Translate)
	mux.HandleFunc("GET /api/mos-codes", mosHandler.ListMOSCodes)
	mux.HandleFunc("POST /api/dd214/translate", dd214Handler.Translate)

	// Auth routes
	mux.HandleFunc("POST /auth/magic-link", authHandler.SendMagicLink)
	mux.HandleFunc("GET /auth/verify", authHandler.VerifyToken)
	mux.HandleFunc("POST /api/auth/logout", authHandler.Logout)
	mux.Handle("GET /api/auth/me", handler.RequireAuth(queries, authHandler.Me))

	// Protected veteran routes
	mux.Handle("PUT /api/veteran/profile", handler.RequireAuth(queries, veteranHandler.UpdateProfile))
	mux.Handle("GET /api/veteran/matches", handler.RequireAuth(queries, veteranHandler.Matches))
	mux.Handle("GET /api/veteran/opportunities", handler.RequireAuth(queries, veteranHandler.Opportunities))
	mux.Handle("GET /api/veteran/applications", handler.RequireAuth(queries, veteranHandler.Applications))
	mux.Handle("POST /api/veteran/applications", handler.RequireAuth(queries, veteranHandler.ExpressInterest))
	mux.Handle("PUT /api/veteran/applications/{id}", handler.RequireAuth(queries, veteranHandler.UpdateApplicationStatus))
	mux.Handle("GET /api/veteran/journey", handler.RequireAuth(queries, veteranHandler.Journey))

	// Employer public routes
	mux.HandleFunc("POST /api/employer/register", employerHandler.Register)
	mux.HandleFunc("POST /api/employer/login", employerHandler.Login)
	mux.HandleFunc("POST /api/employer/forgot-password", employerHandler.ForgotPassword)
	mux.HandleFunc("POST /api/employer/reset-password", employerHandler.ResetPassword)
	mux.HandleFunc("GET /api/civilian-roles", employerHandler.ListCivilianRoles)

	// Protected employer routes
	mux.Handle("GET /api/employer/me", handler.RequireAuth(queries, employerHandler.Me))
	mux.Handle("PUT /api/employer/profile", handler.RequireAuth(queries, employerHandler.UpdateProfile))
	mux.Handle("GET /api/employer/dashboard", handler.RequireAuth(queries, employerHandler.Dashboard))
	mux.Handle("GET /api/employer/listings", handler.RequireAuth(queries, employerHandler.ListJobListings))
	mux.Handle("GET /api/employer/listings/{id}", handler.RequireAuth(queries, employerHandler.GetJobListing))
	mux.Handle("POST /api/employer/listings", handler.RequireAuth(queries, employerHandler.CreateJobListing))
	mux.Handle("PUT /api/employer/listings/{id}", handler.RequireAuth(queries, employerHandler.UpdateJobListing))
	mux.Handle("POST /api/employer/listings/{id}/toggle", handler.RequireAuth(queries, employerHandler.ToggleJobListing))
	mux.Handle("DELETE /api/employer/listings/{id}", handler.RequireAuth(queries, employerHandler.DeleteJobListing))
	mux.Handle("GET /api/employer/candidates", handler.RequireAuth(queries, employerHandler.ListCandidates))
	mux.Handle("PUT /api/employer/candidates/{id}/status", handler.RequireAuth(queries, employerHandler.UpdateCandidateStatus))

	// Admin public routes
	mux.HandleFunc("POST /api/admin/login", adminHandler.Login)

	// Protected admin routes
	mux.Handle("GET /api/admin/me", handler.RequireAuth(queries, adminHandler.Me))
	mux.Handle("GET /api/admin/stats", handler.RequireAuth(queries, adminHandler.Stats))
	mux.Handle("GET /api/admin/veterans", handler.RequireAuth(queries, adminHandler.ListVeterans))
	mux.Handle("GET /api/admin/employers", handler.RequireAuth(queries, adminHandler.ListEmployers))
	mux.Handle("GET /api/admin/listings", handler.RequireAuth(queries, adminHandler.ListJobListings))
	mux.Handle("GET /api/admin/applications", handler.RequireAuth(queries, adminHandler.ListApplications))
	mux.Handle("GET /api/admin/activity", handler.RequireAuth(queries, adminHandler.ActivityLogs))
	mux.Handle("GET /api/admin/sessions", handler.RequireAuth(queries, adminHandler.UserSessions))

	// Dev-only login endpoints (only registered when DEV_MODE=1)
	if cfg.DevMode {
		slog.Warn("DEV_MODE enabled — dev login endpoints are active")
		mux.HandleFunc("POST /api/dev/login", authHandler.DevLogin)
		mux.HandleFunc("POST /api/dev/employer-login", employerHandler.DevLogin)
		mux.HandleFunc("POST /api/dev/admin-login", adminHandler.DevLogin)
	}

	// Serve frontend (production only — in dev, Vite handles this)
	if !cfg.DevMode {
		frontendDist := "frontend/dist"
		// In Docker: WORKDIR /app, binary at /app/server, assets at /app/frontend/dist
		// In local dev (running from backend/): ../frontend/dist
		if _, err := os.Stat(frontendDist); os.IsNotExist(err) {
			frontendDist = filepath.Join("..", "frontend", "dist")
		}
		fs := http.FileServer(http.Dir(frontendDist))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
				http.NotFound(w, r)
				return
			}
			if r.URL.Path != "/" {
				if _, err := os.Stat(filepath.Join(frontendDist, filepath.Clean(r.URL.Path))); err == nil {
					fs.ServeHTTP(w, r)
					return
				}
			}
			http.ServeFile(w, r, filepath.Join(frontendDist, "index.html"))
		})
	}

	// Redirect www to apex domain
	var h http.Handler = wwwRedirect(mux, cfg.BaseURL)

	// Add CORS middleware for dev mode
	if cfg.DevMode {
		h = corsMiddleware(h)
	}

	slog.Info("starting server", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, h); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func wwwRedirect(next http.Handler, baseURL string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.Host, "www.") {
			target := baseURL + r.URL.RequestURI()
			http.Redirect(w, r, target, http.StatusMovedPermanently)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
