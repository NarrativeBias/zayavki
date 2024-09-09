package variables_parser

import (
	"bufio"
	"fmt"
	"os"
	"strings"
)

func ReadVariablesFromFile(filename string) (map[string][]string, error) {
	// Open the file
	file, err := os.Open(filename)
	if err != nil {
		return nil, fmt.Errorf("error opening file: %v", err)
	}
	defer file.Close()

	// Create a map to store the variables
	variables := make(map[string][]string)

	// Read the file line by line
	scanner := bufio.NewScanner(file)
	var key string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			continue // Skip empty lines
		}
		if strings.Contains(line, ":") {
			// Split the line into key-value pair
			parts := strings.SplitN(line, ":", 2)
			key = strings.TrimSpace(parts[0])
			value := strings.TrimSpace(parts[1])
			variables[key] = append(variables[key], value)
		} else {
			// Append value to the existing key
			variables[key] = append(variables[key], strings.TrimSpace(line))
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading file: %v", err)
	}
	// fixing lower,upper case
	request_id_sm := strings.ToUpper(variables["request_id_sm"][0])
	request_id_sf := strings.ToUpper(variables["request_id_sf"][0])
	segment := strings.ToUpper(variables["segment"][0])
	env := strings.ToUpper(variables["env"][0])
	ris_code := variables["ris_code"][0]
	ris_name := strings.ToLower(variables["ris_name"][0])
	resp_group := variables["resp_group"][0]
	owner := variables["owner"][0]
	create_tenant := strings.ToLower(variables["create_tenant"][0])
	override_tenant_name := strings.ToLower(variables["override_tenant"][0])
	requester := variables["requester"][0]
	email := strings.ToLower(variables["email_for_credentials"][0])
	bucketNames := make([]string, len(variables["buckets"]))
	bucketQuotas := make([]string, len(variables["buckets"]))
	for i, bucket := range variables["buckets"] {
		if bucket != "" {
			parts := strings.Fields(bucket)
			bucketNames[i] = strings.ToLower(parts[0])
			bucketQuotas[i] = strings.ToUpper(parts[1])
		}
	}
	users := make([]string, len(variables["users"]))
	for i, user := range variables["users"] {
		users[i] = strings.ToLower(user)
	}

	//convert existing variables into format for tenant_name
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
	}

	return map[string][]string{
		"request_id_sm":   {request_id_sm},
		"request_id_sf":   {request_id_sf},
		"segment":         {segment},
		"env":             {env},
		"env_code":        {env_code},
		"ris_code":        {ris_code},
		"ris_name":        {ris_name},
		"resp_group":      {resp_group},
		"owner":           {owner},
		"create_tenant":   {create_tenant},
		"tenant_override": {override_tenant_name},
		"requester":       {requester},
		"email":           {email},
		"bucketnames":     bucketNames,
		"bucketquotas":    bucketQuotas,
		"users":           users,
	}, nil
}
