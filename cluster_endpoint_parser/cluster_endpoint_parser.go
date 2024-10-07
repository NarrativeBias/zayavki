package cluster_endpoint_parser

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/xuri/excelize/v2"
)

type ClusterInfo struct {
	Выдача       string `json:"Выдача"`
	ЦОД          string `json:"ЦОД"`
	Среда        string `json:"Среда"`
	ЗБ           string `json:"ЗБ"`
	TLSEndpoint  string `json:"tls_endpoint"`
	MTLSEndpoint string `json:"mtls_endpoint"`
	Кластер      string `json:"Кластер"`
	Реалм        string `json:"Реалм"`
}

func FindMatchingClusters(filename, segment, env string) ([]ClusterInfo, error) {
	f, err := excelize.OpenFile(filename)
	if err != nil {
		return nil, fmt.Errorf("error opening Excel file: %v", err)
	}
	defer f.Close()

	var matchedClusters []ClusterInfo
	rows, err := f.GetRows("Clusters")
	if err != nil {
		return nil, fmt.Errorf("error reading rows: %v", err)
	}

	for _, row := range rows[1:] { // Skip header row
		if len(row) >= 9 && row[3] == env && row[4] == segment {
			cluster := ClusterInfo{
				Выдача:       row[0],
				ЦОД:          row[1],
				Среда:        row[3],
				ЗБ:           row[4],
				TLSEndpoint:  row[5],
				MTLSEndpoint: row[6],
				Кластер:      row[7],
				Реалм:        row[8],
			}
			matchedClusters = append(matchedClusters, cluster)
		}
	}

	return matchedClusters, nil
}

func GetCluster(filename, segment, env string) (ClusterInfo, error) {
	clusters, err := FindMatchingClusters(filename, segment, env)
	if err != nil {
		return ClusterInfo{}, err
	}

	switch len(clusters) {
	case 0:
		return ClusterInfo{}, errors.New("no matching clusters found")
	case 1:
		return clusters[0], nil
	default:
		return ClusterInfo{}, errors.New("multiple clusters found")
	}
}

func HandleClusterSelection(w http.ResponseWriter, r *http.Request) (*ClusterInfo, error) {
	if r.Method != http.MethodPost {
		return nil, errors.New("method not allowed")
	}

	var data struct {
		SelectedCluster ClusterInfo `json:"selectedCluster"`
	}

	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("error decoding JSON: %v", err)
	}

	return &data.SelectedCluster, nil
}

// ConvertToMap converts a ClusterInfo struct to a map[string]string
func (c ClusterInfo) ConvertToMap() map[string]string {
	return map[string]string{
		"Выдача":        c.Выдача,
		"ЦОД":           c.ЦОД,
		"Среда":         c.Среда,
		"ЗБ":            c.ЗБ,
		"tls_endpoint":  c.TLSEndpoint,
		"mtls_endpoint": c.MTLSEndpoint,
		"Кластер":       c.Кластер,
		"Реалм":         c.Реалм,
	}
}
