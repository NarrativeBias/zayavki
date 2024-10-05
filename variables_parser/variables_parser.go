package variables_parser

import (
	"fmt"
	"strings"
)

// ParseAndProcessVariables processes the raw variables from the form submission
func ParseAndProcessVariables(rawVariables map[string][]string) (map[string][]string, error) {
	processedVars := make(map[string][]string)

	// Helper function to safely get the first element of a slice or return an empty string
	getFirst := func(slice []string) string {
		if len(slice) > 0 {
			return slice[0]
		}
		return ""
	}

	// Process other variables
	processedVars["request_id_sm"] = []string{strings.ToUpper(getFirst(rawVariables["request_id_sm"]))}
	processedVars["request_id_sf"] = []string{strings.ToUpper(getFirst(rawVariables["request_id_sf"]))}
	processedVars["segment"] = []string{strings.ToUpper(getFirst(rawVariables["segment"]))}
	processedVars["env"] = []string{strings.ToUpper(getFirst(rawVariables["env"]))}
	processedVars["ris_code"] = []string{getFirst(rawVariables["ris_code"])}
	processedVars["ris_name"] = []string{strings.ToLower(getFirst(rawVariables["ris_name"]))}
	processedVars["resp_group"] = []string{getFirst(rawVariables["resp_group"])}
	processedVars["owner"] = []string{getFirst(rawVariables["owner"])}
	processedVars["create_tenant"] = []string{strings.ToLower(getFirst(rawVariables["create_tenant"]))}
	processedVars["tenant_override"] = []string{strings.ToLower(getFirst(rawVariables["tenant_override"]))}
	processedVars["requester"] = []string{getFirst(rawVariables["requester"])}
	processedVars["email"] = []string{strings.ToLower(getFirst(rawVariables["email_for_credentials"]))}

	// Process buckets
	bucketInput := getFirst(rawVariables["buckets"])

	if bucketInput != "" {
		// Split the bucket input by newlines
		bucketList := strings.Split(bucketInput, "\n")
		for _, bucket := range bucketList {
			parts := strings.Fields(strings.TrimSpace(bucket))
			if len(parts) >= 2 {
				processedVars["bucketnames"] = append(processedVars["bucketnames"], strings.ToLower(parts[0]))
				processedVars["bucketquotas"] = append(processedVars["bucketquotas"], strings.ToUpper(parts[1]))
			}
		}
	}

	// Process users
	userInput := getFirst(rawVariables["users"])
	if userInput != "" {
		// Split the user input by newlines and/or commas
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

	// Convert env to env_code
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
	default:
		return nil, fmt.Errorf("Invalid environment: %s", env)
	}
	processedVars["env_code"] = []string{env_code}

	return processedVars, nil
}
