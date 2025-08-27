package repositories

import (
	"context"
	"fmt"

	"github.com/NarrativeBias/zayavki/internal/models"
	"github.com/xuri/excelize/v2"
)

// ClusterRepository handles cluster-related operations
type ClusterRepository struct {
	excelFile string
}

// NewClusterRepository creates a new cluster repository
func NewClusterRepository() *ClusterRepository {
	return &ClusterRepository{
		excelFile: "clusters.xlsx",
	}
}

// GetCluster retrieves cluster information based on segment and environment
func (r *ClusterRepository) GetCluster(ctx context.Context, segment, env string) (*models.ClusterInfo, error) {
	clusters, err := r.FindMatchingClusters(ctx, segment, env)
	if err != nil {
		return nil, err
	}

	if len(clusters) == 0 {
		return nil, fmt.Errorf("no matching clusters found for segment %s and environment %s", segment, env)
	}

	if len(clusters) > 1 {
		return nil, fmt.Errorf("multiple clusters found for segment %s and environment %s", segment, env)
	}

	return &clusters[0], nil
}

// FindMatchingClusters finds all clusters matching the given segment and environment
func (r *ClusterRepository) FindMatchingClusters(ctx context.Context, segment, env string) ([]models.ClusterInfo, error) {
	// Open the Excel file
	xlFile, err := excelize.OpenFile(r.excelFile)
	if err != nil {
		return nil, fmt.Errorf("failed to open Excel file: %v", err)
	}
	defer xlFile.Close()

	// Get the first sheet
	sheetName := xlFile.GetSheetName(0)
	rows, err := xlFile.GetRows(sheetName)
	if err != nil {
		return nil, fmt.Errorf("failed to get rows from sheet: %v", err)
	}

	if len(rows) < 2 {
		return nil, fmt.Errorf("Excel file is empty or has no data rows")
	}

	var clusters []models.ClusterInfo
	headers := rows[0]

	// Find column indices
	segmentIdx := -1
	envIdx := -1
	clusterIdx := -1
	realmIdx := -1
	выдачаIdx := -1
	цодIdx := -1
	средаIdx := -1
	збIdx := -1
	tlsEndpointIdx := -1
	mtlsEndpointIdx := -1

	for i, header := range headers {
		switch header {
		case "Сегмент":
			segmentIdx = i
		case "Среда":
			envIdx = i
		case "Кластер":
			clusterIdx = i
		case "Реалм":
			realmIdx = i
		case "Выдача":
			выдачаIdx = i
		case "ЦОД":
			цодIdx = i
		case "ЗБ":
			збIdx = i
		case "TLS Endpoint":
			tlsEndpointIdx = i
		case "MTLS Endpoint":
			mtlsEndpointIdx = i
		}
	}

	// Check if required columns were found
	if segmentIdx == -1 || envIdx == -1 || clusterIdx == -1 || realmIdx == -1 {
		return nil, fmt.Errorf("required columns not found in Excel file")
	}

	// Process data rows
	for i := 1; i < len(rows); i++ {
		row := rows[i]
		if len(row) <= max(segmentIdx, envIdx, clusterIdx, realmIdx) {
			continue // Skip rows with insufficient data
		}

		rowSegment := row[segmentIdx]
		rowEnv := row[envIdx]

		// Check if this row matches our criteria
		if rowSegment == segment && rowEnv == env {
			cluster := models.ClusterInfo{
				Кластер: row[clusterIdx],
				Реалм:   row[realmIdx],
			}

			// Add optional fields if available
			if выдачаIdx != -1 && выдачаIdx < len(row) {
				cluster.Выдача = row[выдачаIdx]
			}
			if цодIdx != -1 && цодIdx < len(row) {
				cluster.ЦОД = row[цодIdx]
			}
			if средаIdx != -1 && средаIdx < len(row) {
				cluster.Среда = row[средаIdx]
			}
			if збIdx != -1 && збIdx < len(row) {
				cluster.ЗБ = row[збIdx]
			}
			if tlsEndpointIdx != -1 && tlsEndpointIdx < len(row) {
				cluster.TLSEndpoint = row[tlsEndpointIdx]
			}
			if mtlsEndpointIdx != -1 && mtlsEndpointIdx < len(row) {
				cluster.MTLSEndpoint = row[mtlsEndpointIdx]
			}

			clusters = append(clusters, cluster)
		}
	}

	return clusters, nil
}

// max returns the maximum of the given integers
func max(nums ...int) int {
	if len(nums) == 0 {
		return 0
	}
	max := nums[0]
	for _, num := range nums[1:] {
		if num > max {
			max = num
		}
	}
	return max
}
