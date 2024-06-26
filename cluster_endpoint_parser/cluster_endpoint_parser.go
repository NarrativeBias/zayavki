package cluster_endpoint_parser

import (
	"fmt"

	"github.com/xuri/excelize/v2"
)

func ReadVariablesFromExcel(filename string) (map[string][]string, error) {
	f, err := excelize.OpenFile(filename)
	if err != nil {
		return nil, fmt.Errorf("error opening Excel file: %v", err)
	}
	defer f.Close()

	variables := make(map[string][]string)
	rows, err := f.GetRows("Clusters")
	if err != nil {
		return nil, fmt.Errorf("error reading rows: %v", err)
	}

	rowNumber := 0 // Start the row numbering at 0
	for _, row := range rows[2:] {
		key := fmt.Sprintf("%d", rowNumber) // Create a key like "row0", "row1", etc.
		variables[key] = append(variables[key], row...)
		rowNumber++
	}

	return variables, nil
}

// FindMatchingClusters searches for clusters in the Excel file that match the given segment and env.
func FindMatchingClusters(filename, segment, env string) ([]map[string]string, error) {
	f, err := excelize.OpenFile(filename)
	if err != nil {
		return nil, fmt.Errorf("error opening Excel file: %v", err)
	}
	defer f.Close()

	var matchedClusters []map[string]string
	rows, err := f.GetRows("Clusters")
	if err != nil {
		return nil, fmt.Errorf("error reading rows: %v", err)
	}
	for _, row := range rows {
		if len(row) >= 5 && row[3] == env && row[4] == segment { // Assuming columns are 0-indexed
			clusterData := map[string]string{
				"Выдача":        row[0],
				"ЦОД":           row[1],
				"Среда":         row[3],
				"ЗБ":            row[4],
				"tls_endpoint":  row[5],
				"mtls_endpoint": row[6],
				"Кластер":       row[7],
				"Реалм":         row[8],
			}
			matchedClusters = append(matchedClusters, clusterData)
		}
	}
	return matchedClusters, nil
}

// Ask user to choose cluster out of the list
func ChooseCluster(clusters []map[string]string) (map[string]string, error) {
	if len(clusters) == 1 {
		// Use the single matching cluster
		return clusters[0], nil
	} else if len(clusters) > 1 {
		// Multiple matching clusters, let the user choose
		fmt.Println("Multiple matching clusters found. Please choose one:")
		for i, cluster := range clusters {
			fmt.Printf("%d. %v\n", i+1, cluster)
		}
		var choice int
		fmt.Scanln(&choice)
		if choice >= 1 && choice <= len(clusters) {
			return clusters[choice-1], nil
		} else {
			return nil, fmt.Errorf("invalid choice. Exiting")
		}
	} else {
		return nil, fmt.Errorf("no matching clusters found")
	}
}
