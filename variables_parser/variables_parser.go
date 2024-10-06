package variables_parser

import (
	"fmt"
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
		"request_id_sd", "request_id_sr", "segment", "env", "ris_code", "ris_name",
		"resp_group", "owner", "create_tenant", "tenant_override", "requester",
		"email_for_credentials",
	}

	for _, varName := range variablesToProcess {
		rawValue := getFirst(rawVariables[varName])
		var processedValue string
		switch varName {
		case "request_id_sd", "request_id_sr", "segment", "env":
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

	userInput := getFirst(rawVariables["users"])
	if userInput != "" {
		userList := strings.FieldsFunc(userInput, func(r rune) bool {
			return r == '\n' || r == ',' || r == ' '
		})
		for _, user := range userList {
			trimmedUser := strings.TrimSpace(user)
			if trimmedUser != "" {
				processedVars["users"] = append(processedVars["users"], strings.ToLower(trimmedUser))
			}
		}
	}

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
	case "":
		return nil, fmt.Errorf("environment is empty")
	default:
		return nil, fmt.Errorf("invalid environment: %s", env)
	}
	processedVars["env_code"] = []string{env_code}

	return processedVars, nil
}
