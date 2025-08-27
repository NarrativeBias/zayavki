package services

import (
	"context"
	"fmt"

	"github.com/NarrativeBias/zayavki/internal/models"
	"github.com/NarrativeBias/zayavki/internal/repositories"
)

// ClusterService handles business logic for cluster operations
type ClusterService struct {
	clusterRepo *repositories.ClusterRepository
}

// NewClusterService creates a new cluster service
func NewClusterService(clusterRepo *repositories.ClusterRepository) *ClusterService {
	return &ClusterService{
		clusterRepo: clusterRepo,
	}
}

// GetCluster retrieves cluster information based on segment and environment
func (s *ClusterService) GetCluster(ctx context.Context, segment, env string) (*models.ClusterInfo, error) {
	return s.clusterRepo.GetCluster(ctx, segment, env)
}

// FindMatchingClusters finds all clusters matching the given segment and environment
func (s *ClusterService) FindMatchingClusters(ctx context.Context, segment, env string) ([]models.ClusterInfo, error) {
	return s.clusterRepo.FindMatchingClusters(ctx, segment, env)
}

// GetClusterByClusterName retrieves a specific cluster by its name
func (s *ClusterService) GetClusterByClusterName(ctx context.Context, segment, env, clusterName string) (*models.ClusterInfo, error) {
	clusters, err := s.clusterRepo.FindMatchingClusters(ctx, segment, env)
	if err != nil {
		return nil, err
	}

	// Find the specific cluster
	for _, cluster := range clusters {
		if cluster.Кластер == clusterName {
			return &cluster, nil
		}
	}

	return nil, fmt.Errorf("cluster '%s' not found for segment %s and environment %s", clusterName, segment, env)
}
