package validator

import (
	"fmt"
	"regexp"
	"strings"
)

func ValidateTenant(tenant string, env string) {
	// Check if the tenant only contains lowercase English characters, digits, and underscore
	allowedCharsPattern := "^[a-z0-9_]+$"
	matched, err := regexp.MatchString(allowedCharsPattern, tenant)
	if err != nil {
		fmt.Println("Error in regex pattern for Tenant name validation:", err)
		return
	}
	if !matched {
		fmt.Println("Warning: Tenant contains invalid characters(not an English character/digit/underscore)")
	}

	//Validate if tenant contains 'gen'
	if !strings.Contains(tenant, "gen") {
		fmt.Println("Warning: Tenant must contain 'gen'")
	}

	// Validate if the tenant contains special symbols or characters other then "_"
	if strings.ContainsAny(tenant, "!@#$%^&*()+`-=[]{}|;':\",./<>?—") {
		fmt.Println("Warning: Tenant contains invalid special characters")
	}

	// Define a list of environments to check against
	envsToCheck := []string{"IFT", "PREPROD", "HOTFIX"}
	// Check if the environment is one of the specified ones and tenant contains 'prod'
	for _, envToCheck := range envsToCheck {
		if env == envToCheck && strings.Contains(tenant, "prod") {
			fmt.Printf("Warning: Environment is %s, but tenant contains 'prod'\n", env)
			break // No need to check other environments if warning is already printed
		}
	}

	// Check if the environment is PROD and tenant contains 'test'
	if env == "PROD" && strings.Contains(tenant, "test") {
		fmt.Println("Warning: Environment is PROD, but tenant contains 'test'")
	}
}
func ValidateUsers(variables map[string][]string) {
	//Validate if usernames contain Russian characters
	for _, username := range variables["users"] {
		username = strings.ToLower(username)
		if strings.ContainsAny(username, "абвгдеёжзийклмнопрстуфхцчшщъыьэюя") {
			fmt.Println("Warning: Username contains Russian characters")
		}
	}
}
func ValidateBuckets(variables map[string][]string) {
	//Validate if bucket names contain Russian characters
	for _, bucket := range variables["buckets"] {
		bucket = strings.ToLower(bucket)
		if strings.ContainsAny(bucket, "абвгдеёжзийклмнопрстуфхцчшщъыьэюя") {
			fmt.Println("Warning: Bucket name contains Russian characters")
		}
	}
}
