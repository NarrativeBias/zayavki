package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/NarrativeBias/zayavki/internal/config"
	"github.com/NarrativeBias/zayavki/internal/handlers"
	"github.com/NarrativeBias/zayavki/internal/repositories"
	"github.com/NarrativeBias/zayavki/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize database
	db, err := repositories.InitDB(cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// Initialize repositories
	tenantRepo := repositories.NewTenantRepository(db, cfg.Database.Schema, cfg.Database.Table)
	clusterRepo := repositories.NewClusterRepository()

	// Initialize services
	tenantService := services.NewTenantService(tenantRepo, clusterRepo)
	clusterService := services.NewClusterService(clusterRepo)

	// Initialize handlers
	tenantHandler := handlers.NewTenantHandler(tenantService)
	clusterHandler := handlers.NewClusterHandler(clusterService)

	// Initialize server
	server := handlers.NewServer(cfg.Server, tenantHandler, clusterHandler)

	// Start server in a goroutine
	go func() {
		log.Printf("Starting server on %s", cfg.Server.Address)
		if err := server.Start(); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")

	// Create a deadline for server shutdown
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited")
}
