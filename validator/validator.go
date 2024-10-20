package validator

import (
	"fmt"
	"regexp"
	"strings"
)

func ValidateUsers(variables map[string][]string) (bool, error) {
	users, ok := variables["users"]
	if !ok || len(users) == 0 {
		return false, fmt.Errorf("no users provided")
	}

	requiredKeys := []string{"env_code", "ris_name"}
	for _, key := range requiredKeys {
		if _, ok := variables[key]; !ok || len(variables[key]) == 0 {
			return false, fmt.Errorf("missing required key: %s", key)
		}
	}

	envCode := variables["env_code"][0]
	risName := variables["ris_name"][0]
	prefix := envCode + "_" + risName + "_"

	pattern := regexp.MustCompile("^[a-zA-Z0-9_-]+$")

	var errors []string

	for _, username := range users {
		username = strings.TrimSpace(strings.ToLower(username))
		if username == "" {
			continue
		}

		if !strings.HasPrefix(username, prefix) {
			errors = append(errors, fmt.Sprintf("username %s is missing expected prefix '%s'", username, prefix))
		}

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
	emails, ok := variables["email"]
	if !ok || len(emails) == 0 {
		return false, fmt.Errorf("no email provided")
	}

	var errors []string
	for _, email := range emails {
		if !strings.Contains(email, "@") {
			errors = append(errors, fmt.Sprintf("Owner should be listed as email, %s is missing @ symbol", email))
		}
	}

	return len(errors) == 0, joinErrors(errors)
}

func ValidateBuckets(variables map[string][]string) (bool, error) {
	bucketNames, okNames := variables["bucketnames"]
	bucketQuotas, okQuotas := variables["bucketquotas"]

	if !okNames || !okQuotas || len(bucketNames) == 0 || len(bucketQuotas) == 0 {
		return false, fmt.Errorf("no buckets provided")
	}

	if len(bucketNames) != len(bucketQuotas) {
		return false, fmt.Errorf("mismatch between number of bucket names (%d) and quotas (%d)", len(bucketNames), len(bucketQuotas))
	}

	requiredKeys := []string{"env_code", "ris_name"}
	if err := validateRequiredKeys(variables, requiredKeys); err != nil {
		return false, err
	}

	envCode := variables["env_code"][0]
	risName := variables["ris_name"][0]
	prefix := envCode + "-" + risName + "-"

	pattern := regexp.MustCompile("^[a-zA-Z0-9-]+$")
	quotaPattern := regexp.MustCompile(`^\d+[GMTPK]B?$`)

	var errors []string
	for i, bucket := range bucketNames {
		bucket = strings.TrimSpace(strings.ToLower(bucket))
		if bucket == "" {
			continue
		}

		if !strings.HasPrefix(bucket, prefix) {
			errors = append(errors, fmt.Sprintf("bucket name '%s' is missing expected prefix '%s'", bucket, prefix))
		}

		if !pattern.MatchString(bucket) {
			errors = append(errors, fmt.Sprintf("bucket name '%s' contains invalid characters", bucket))
		}

		if !quotaPattern.MatchString(bucketQuotas[i]) {
			errors = append(errors, fmt.Sprintf("invalid quota format for bucket '%s': '%s'", bucket, bucketQuotas[i]))
		}
	}

	return len(errors) == 0, joinErrors(errors)
}

func validateRequiredKeys(variables map[string][]string, requiredKeys []string) error {
	var missingKeys []string
	for _, key := range requiredKeys {
		if _, ok := variables[key]; !ok || len(variables[key]) == 0 {
			missingKeys = append(missingKeys, key)
		}
	}
	if len(missingKeys) > 0 {
		return fmt.Errorf("missing required keys: %s", strings.Join(missingKeys, ", "))
	}
	return nil
}

func joinErrors(errors []string) error {
	if len(errors) > 0 {
		return fmt.Errorf(strings.Join(errors, "; "))
	}
	return nil
}
