package handlers

import (
	"context"
	"fmt"
	"html/template"
	"net/http"
	"strings"
	"time"

	"github.com/NarrativeBias/zayavki/internal/config"
)

// Server handles the HTTP server setup and routing
type Server struct {
	config         *config.ServerConfig
	tenantHandler  *TenantHandler
	clusterHandler *ClusterHandler
	server         *http.Server
	templates      *template.Template
}

// NewServer creates a new server instance
func NewServer(cfg config.ServerConfig, tenantHandler *TenantHandler, clusterHandler *ClusterHandler) *Server {
	// Parse templates
	templates := template.Must(template.ParseFiles(
		"web/templates/layouts/base.html",
		"web/templates/partials/header.html",
		"web/templates/partials/footer.html",
		"web/templates/pages/index.html",
	))

	return &Server{
		config:         &cfg,
		tenantHandler:  tenantHandler,
		clusterHandler: clusterHandler,
		templates:      templates,
	}
}

// Start starts the HTTP server
func (s *Server) Start() error {
	mux := http.NewServeMux()

	// Serve static files
	fs := http.FileServer(http.Dir("web/static"))
	mux.Handle("/zayavki/static/", http.StripPrefix("/zayavki/static/", fs))

	// Tenant routes
	mux.HandleFunc("/zayavki/submit", s.stripPrefix(s.tenantHandler.HandleSubmit))
	mux.HandleFunc("/zayavki/cluster", s.stripPrefix(s.tenantHandler.HandleClusterSelection))
	mux.HandleFunc("/zayavki/check", s.stripPrefix(s.tenantHandler.HandleCheck))
	mux.HandleFunc("/zayavki/check-tenant-resources", s.stripPrefix(s.tenantHandler.HandleCheckTenantResources))
	mux.HandleFunc("/zayavki/deactivate-resources", s.stripPrefix(s.tenantHandler.HandleDeactivateResources))
	mux.HandleFunc("/zayavki/update-bucket-quotas", s.stripPrefix(s.tenantHandler.HandleUpdateBucketQuotas))

	// Cluster routes
	mux.HandleFunc("/zayavki/cluster-info", s.stripPrefix(s.clusterHandler.HandleClusterInfo))

	// Index route
	mux.HandleFunc("/zayavki/", s.stripPrefix(s.handleIndex))

	// Create server with timeouts
	serverAddr := fmt.Sprintf("%s:%d", s.config.Address, s.config.Port)
	s.server = &http.Server{
		Addr:           serverAddr,
		Handler:        mux,
		ReadTimeout:    time.Duration(s.config.ReadTimeout) * time.Second,
		WriteTimeout:   time.Duration(s.config.WriteTimeout) * time.Second,
		MaxHeaderBytes: s.config.MaxHeaderBytes,
	}

	return s.server.ListenAndServe()
}

// Shutdown gracefully shuts down the server
func (s *Server) Shutdown(ctx context.Context) error {
	return s.server.Shutdown(ctx)
}

// stripPrefix removes the /zayavki prefix from requests
func (s *Server) stripPrefix(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/zayavki")
		h(w, r)
	}
}

// handleIndex handles the main index page
func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	err := s.templates.ExecuteTemplate(w, "base.html", nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}
