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

	mux := http.NewServeMux()

	// Health check
	mux.HandleFunc("GET /up", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// API routes
	mux.HandleFunc("GET /api/translate", mosHandler.Translate)
	mux.HandleFunc("GET /api/mos-codes", mosHandler.ListMOSCodes)

	// Serve frontend (production only — in dev, Vite handles this)
	if !cfg.DevMode {
		frontendDist := filepath.Join("..", "frontend", "dist")
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

	// Add CORS middleware for dev mode
	var h http.Handler = mux
	if cfg.DevMode {
		h = corsMiddleware(mux)
	}

	slog.Info("starting server", "port", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, h); err != nil {
		slog.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
