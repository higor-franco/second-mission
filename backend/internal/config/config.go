package config

import (
	"os"
)

type Config struct {
	Port        string
	DatabaseURL string
	BaseURL     string
	DevMode     bool

	// SMTP settings for magic link emails
	SMTPHost     string
	SMTPPort     string
	SMTPUser     string
	SMTPPassword string
	SMTPFrom     string

	// Session secret for signing session IDs
	SessionSecret string
}

func Load() Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	smtpPort := os.Getenv("SMTP_PORT")
	if smtpPort == "" {
		smtpPort = "587"
	}

	return Config{
		Port:        port,
		DatabaseURL: os.Getenv("DATABASE_URL"),
		BaseURL:     os.Getenv("BASE_URL"),
		DevMode:     os.Getenv("DEV_MODE") == "1",

		SMTPHost:     os.Getenv("SMTP_HOST"),
		SMTPPort:     smtpPort,
		SMTPUser:     os.Getenv("SMTP_USER"),
		SMTPPassword: os.Getenv("SMTP_PASSWORD"),
		SMTPFrom:     os.Getenv("SMTP_FROM"),

		SessionSecret: os.Getenv("SESSION_SECRET"),
	}
}
