package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/NarrativeBias/zayavki/internal/services"
)

// ClusterHandler handles HTTP requests for cluster operations
type ClusterHandler struct {
	clusterService *services.ClusterService
}

// NewClusterHandler creates a new cluster handler
func NewClusterHandler(clusterService *services.ClusterService) *ClusterHandler {
	return &ClusterHandler{
		clusterService: clusterService,
	}
}

// HandleClusterInfo handles requests for cluster information
func (h *ClusterHandler) HandleClusterInfo(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Segment string `json:"segment"`
		Env     string `json:"env"`
		Cluster string `json:"cluster"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	cluster, err := h.clusterService.GetClusterByClusterName(r.Context(), request.Segment, request.Env, request.Cluster)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(cluster)
}
