package handler_test

import (
	"context"
	"os"
	"testing"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/higor-franco/second-mission/backend/internal/database"
	"github.com/higor-franco/second-mission/backend/internal/database/sqlc"
)

var testPool *pgxpool.Pool
var testQueries *sqlc.Queries

func TestMain(m *testing.M) {
	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgres://postgres:postgres@localhost:5432/postgres?sslmode=disable"
	}

	ctx := context.Background()
	var err error
	testPool, err = pgxpool.New(ctx, dbURL)
	if err != nil {
		panic("failed to connect to test database: " + err.Error())
	}
	defer testPool.Close()

	if err := database.RunMigrations(ctx, testPool); err != nil {
		panic("failed to run migrations: " + err.Error())
	}

	testQueries = sqlc.New(testPool)

	os.Exit(m.Run())
}
