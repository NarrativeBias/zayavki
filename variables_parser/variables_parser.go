package variables_parser

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

// convertGBToBytes converts gigabytes to bytes (1 GB = 1,000,000,000 bytes)
func convertGBToBytes(gbStr string) (string, error) {
	// Parse the GB value
	gb, err := strconv.ParseFloat(gbStr, 64)
	if err != nil {
		return "", fmt.Errorf("invalid quota value: %s", gbStr)
	}

	// Convert to bytes (1 GB = 1,000,000,000 bytes, not 1,073,741,824 bytes)
	bytes := int64(gb * 1000000000)

	return strconv.FormatInt(bytes, 10), nil
}

func ParseAndProcessVariables(rawVariables map[string][]string) (map[string][]string, error) {
	processedVars := make(map[string][]string)

	getFirst := func(slice []string) string {
		if len(slice) > 0 {
			return slice[0]
		}
		return ""
	}

	variablesToProcess := []string{
		"request_id_sd", "request_id_srt", "segment", "env", "ris_number", "ris_name",
		"resp_group", "owner", "create_tenant", "tenant_override", "requester",
		"email_for_credentials", "zam_owner",
	}

	for _, varName := range variablesToProcess {
		rawValue := getFirst(rawVariables[varName])
		var processedValue string
		switch varName {
		case "request_id_sd", "request_id_srt", "segment", "env":
			processedValue = strings.ToUpper(rawValue)
		case "ris_name", "create_tenant", "tenant_override":
			processedValue = strings.ToLower(rawValue)
		case "email_for_credentials":
			processedValue = strings.ToLower(rawValue)
			varName = "email"
		default:
			processedValue = rawValue
		}
		processedVars[varName] = []string{processedValue}
	}

	// Process users
	userInput := getFirst(rawVariables["users"])
	if userInput != "" {
		userList := strings.Fields(strings.ReplaceAll(userInput, "\n", " "))
		processedVars["users"] = userList
	}

	// Process buckets
	bucketInput := getFirst(rawVariables["buckets"])
	if bucketInput != "" {
		bucketNames, bucketQuotas, bucketQuotasBytes, err := parseBuckets(bucketInput)
		if err != nil {
			return nil, fmt.Errorf("failed to parse buckets: %v", err)
		}
		processedVars["bucketnames"] = bucketNames
		processedVars["bucketquotas"] = bucketQuotas
		processedVars["bucketquotas_bytes"] = bucketQuotasBytes
	}

	// Process environment code
	env := processedVars["env"][0]
	var env_code string
	switch env {
	case "PROD":
		env_code = "p0"
	case "PREPROD":
		env_code = "rr"
	case "IFT":
		env_code = "if"
	case "HOTFIX":
		env_code = "hf"
	case "LT":
		env_code = "lt"
	case "":
		return nil, fmt.Errorf("environment is empty")
	default:
		return nil, fmt.Errorf("invalid environment: %s", env)
	}
	processedVars["env_code"] = []string{env_code}

	return processedVars, nil
}

type SRTData struct {
	RequestID string `json:"request_id"`
	Segment   string `json:"segment"`
	Env       string `json:"env"`
	RisNumber string `json:"ris_number"`
	RisName   string `json:"ris_name"`
	// Add other fields as needed
}

func LoadFromJSON(url string) (map[string]interface{}, error) {
	// Make HTTP GET request
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch JSON: %v", err)
	}
	defer resp.Body.Close()

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %v", err)
	}

	// Parse JSON into a generic map
	var data map[string]interface{}
	if err := json.Unmarshal(body, &data); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %v", err)
	}

	return data, nil
}

func parseBuckets(bucketStr string) ([]string, []string, []string, error) {
	var bucketNames []string
	var bucketQuotas []string
	var bucketQuotasBytes []string

	// Split into lines and process each line
	lines := strings.Split(bucketStr, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Split by pipe and trim spaces
		parts := strings.Split(line, "|")
		if len(parts) != 2 {
			return nil, nil, nil, fmt.Errorf("invalid bucket format: %s (expected: name | quota)", line)
		}

		bucketName := strings.TrimSpace(parts[0])
		quota := strings.TrimSpace(parts[1])

		// Validate bucket name and quota
		if bucketName == "" || quota == "" {
			return nil, nil, nil, fmt.Errorf("bucket name and quota cannot be empty")
		}

		// Convert quota from GB to bytes
		quotaBytes, err := convertGBToBytes(quota)
		if err != nil {
			return nil, nil, nil, fmt.Errorf("failed to convert quota to bytes: %v", err)
		}

		bucketNames = append(bucketNames, bucketName)
		bucketQuotas = append(bucketQuotas, quota)
		bucketQuotasBytes = append(bucketQuotasBytes, quotaBytes)
	}

	return bucketNames, bucketQuotas, bucketQuotasBytes, nil
}
