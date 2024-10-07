package variables_parser

import (
	"fmt"
	"strings"
)

func ParseAndProcessVariables(rawVariables map[string][]string) (map[string][]string, error) {
	processedVars := make(map[string][]string)

	getFirst := func(key string) string {
		if values, ok := rawVariables[key]; ok && len(values) > 0 {
			return values[0]
		}
		return ""
	}

	variablesToProcess := map[string]func(string) string{
		"request_id_sd":         strings.ToUpper,
		"request_id_sr":         strings.ToUpper,
		"segment":               strings.ToUpper,
		"env":                   strings.ToUpper,
		"ris_name":              strings.ToLower,
		"create_tenant":         strings.ToLower,
		"tenant_override":       strings.ToLower,
		"email_for_credentials": strings.ToLower,
		"ris_number":            func(s string) string { return s },
		"resp_group":            func(s string) string { return s },
		"owner":                 func(s string) string { return s },
		"requester":             func(s string) string { return s },
	}

	for varName, processFunc := range variablesToProcess {
		rawValue := getFirst(varName)
		processedValue := processFunc(rawValue)
		if varName == "email_for_credentials" {
			varName = "email"
		}
		processedVars[varName] = []string{processedValue}
	}

	processList := func(input, separator string) []string {
		var result []string
		for _, item := range strings.Split(input, separator) {
			if trimmed := strings.TrimSpace(item); trimmed != "" {
				result = append(result, strings.ToLower(trimmed))
			}
		}
		return result
	}

	if bucketInput := getFirst("buckets"); bucketInput != "" {
		for _, bucket := range strings.Split(bucketInput, "\n") {
			parts := strings.Fields(strings.TrimSpace(bucket))
			if len(parts) >= 2 {
				processedVars["bucketnames"] = append(processedVars["bucketnames"], strings.ToLower(parts[0]))
				processedVars["bucketquotas"] = append(processedVars["bucketquotas"], strings.ToUpper(parts[1]))
			}
		}
	}

	if userInput := getFirst("users"); userInput != "" {
		processedVars["users"] = processList(userInput, "\n,")
	}

	envCodes := map[string]string{
		"PROD":    "p0",
		"PREPROD": "rr",
		"IFT":     "if",
		"HOTFIX":  "hf",
	}

	env := processedVars["env"][0]
	if envCode, ok := envCodes[env]; ok {
		processedVars["env_code"] = []string{envCode}
	} else {
		return nil, fmt.Errorf("invalid environment: %s", env)
	}

	return processedVars, nil
}
