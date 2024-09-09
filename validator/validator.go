package validator

import (
	"fmt"
	"regexp"
	"strings"
)

func ValidateUsers(variables map[string][]string) (bool, error) {
	//Validate if usernames contain invalid characters / env code is wrong / no ris name
	var errors []string
	for _, username := range variables["users"] {
		username = strings.ToLower(username)
		if len(username) >= 2 {
			prefix := variables["env_code"][0] + "_" + variables["ris_name"][0] + "_"
			if !strings.HasPrefix(username, prefix) {
				errors = append(errors, fmt.Sprintf("username %s is missing expected prefix '%s'", username, prefix))
			}
			pattern := regexp.MustCompile("^[a-zA-Z0-9_-]+$")
			if !pattern.MatchString(username[len(prefix):]) {
				errors = append(errors, fmt.Sprintf("username %s contains invalid characters", username))
			}
		}
	}
	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "\n"))
	}
	return true, nil
}

func ValidateBuckets(variables map[string][]string) (bool, error) {
	//Validate if bucket names contain invalid characters / env code is wrong / no ris name
	var errors []string
	for _, bucket := range variables["bucketnames"] {
		bucket = strings.ToLower(bucket)
		if len(bucket) >= 2 {
			prefix := variables["env_code"][0] + "-" + variables["ris_name"][0] + "-"
			if !strings.HasPrefix(bucket, prefix) {
				errors = append(errors, fmt.Sprintf("bucket name %s is missing expected prefix '%s'", bucket, prefix))
			}
			pattern := regexp.MustCompile("^[a-zA-Z0-9-]+$")
			if !pattern.MatchString(bucket[len(prefix):]) {
				errors = append(errors, fmt.Sprintf("bucket name %s contains invalid characters", bucket))
			}
		}
	}
	if len(errors) > 0 {
		return false, fmt.Errorf(strings.Join(errors, "\n"))
	}
	return true, nil
}
