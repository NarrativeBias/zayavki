package variables_parser

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

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
		bucketList := strings.Split(bucketInput, "\n")
		for _, bucket := range bucketList {
			parts := strings.Fields(strings.TrimSpace(bucket))
			if len(parts) >= 2 {
				processedVars["bucketnames"] = append(processedVars["bucketnames"], strings.ToLower(parts[0]))
				processedVars["bucketquotas"] = append(processedVars["bucketquotas"], strings.ToUpper(parts[1]))
			}
		}
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
