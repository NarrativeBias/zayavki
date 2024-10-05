package validator

import (
	"fmt"
	"regexp"
	"strings"
)

func ValidateUsers(variables map[string][]string) (bool, error) {
	var errors []string

	// Check if 'users' key exists and has values
	users, ok := variables["users"]
	if !ok || len(users) == 0 {
		return false, fmt.Errorf("no users provided")
	}

	// Check if required keys exist
	requiredKeys := []string{"env_code", "ris_name"}
	for _, key := range requiredKeys {
		if _, ok := variables[key]; !ok || len(variables[key]) == 0 {
			errors = append(errors, fmt.Sprintf("missing required key: %s", key))
		}
	}

	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "; "))
	}

	envCode := variables["env_code"][0]
	risName := variables["ris_name"][0]

	for _, username := range users {
		username = strings.TrimSpace(strings.ToLower(username))
		if username == "" {
			continue // Skip empty usernames
		}

		prefix := envCode + "_" + risName + "_"
		if !strings.HasPrefix(username, prefix) {
			errors = append(errors, fmt.Sprintf("username %s is missing expected prefix '%s'", username, prefix))
		}

		pattern := regexp.MustCompile("^[a-zA-Z0-9_-]+$")
		if !pattern.MatchString(username[len(prefix):]) {
			errors = append(errors, fmt.Sprintf("username %s contains invalid characters", username))
		}
	}

	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "; "))
	}
	return true, nil
}

func ValidateOwnerEmail(variables map[string][]string) (bool, error) {
	var errors []string
	emails, ok := variables["email"]
	if !ok || len(emails) == 0 {
		return false, fmt.Errorf("no email provided")
	}

	for _, email := range emails {
		if !strings.Contains(email, "@") {
			errors = append(errors, fmt.Sprintf("Owner should be listed as email, %s is missing @ symbol", email))
		}
	}

	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "; "))
	}
	return true, nil
}

func ValidateBuckets(variables map[string][]string) (bool, error) {
	var errors []string

	bucketNames, okNames := variables["bucketnames"]
	bucketQuotas, okQuotas := variables["bucketquotas"]

	if !okNames || !okQuotas || len(bucketNames) == 0 || len(bucketQuotas) == 0 {
		return false, fmt.Errorf("no buckets provided")
	}

	if len(bucketNames) != len(bucketQuotas) {
		return false, fmt.Errorf("mismatch between number of bucket names (%d) and quotas (%d)", len(bucketNames), len(bucketQuotas))
	}

	// Check if required keys exist
	requiredKeys := []string{"env_code", "ris_name"}
	for _, key := range requiredKeys {
		if _, ok := variables[key]; !ok || len(variables[key]) == 0 {
			errors = append(errors, fmt.Errorf("missing required key: %s", key).Error())
		}
	}

	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "; "))
	}

	envCode := variables["env_code"][0]
	risName := variables["ris_name"][0]

	for i, bucket := range bucketNames {
		bucket = strings.TrimSpace(strings.ToLower(bucket))
		if bucket == "" {
			continue // Skip empty bucket names
		}

		prefix := envCode + "-" + risName + "-"
		if !strings.HasPrefix(bucket, prefix) {
			errors = append(errors, fmt.Errorf("bucket name '%s' is missing expected prefix '%s'", bucket, prefix).Error())
		}

		pattern := regexp.MustCompile("^[a-zA-Z0-9-]+$")
		if !pattern.MatchString(bucket) {
			errors = append(errors, fmt.Errorf("bucket name '%s' contains invalid characters", bucket).Error())
		}

		// Validate quota format (you might want to adjust this based on your specific requirements)
		quotaPattern := regexp.MustCompile(`^\d+[GMTPK]B?$`)
		if !quotaPattern.MatchString(bucketQuotas[i]) {
			errors = append(errors, fmt.Errorf("invalid quota format for bucket '%s': '%s'", bucket, bucketQuotas[i]).Error())
		}
	}

	if len(errors) > 0 {
		return false, fmt.Errorf("ValidateBuckets errors: %s", strings.Join(errors, "; "))
	}

	return true, nil
}
