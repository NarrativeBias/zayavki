package validator

import (
	"fmt"
	"strings"
)

func ValidateTenant(tenant string, env string) {
	// Perform validation
	// Validate if the tenant contains Russian characters
	if strings.ContainsAny(tenant, "абвгдеёжзийклмнопрстуфхцчшщъыьэюя") {
		fmt.Println("Warning: Tenant contains Russian characters")
	}
	//Validate if tenant contains 'gen'
	if !strings.Contains(tenant, "gen") {
		fmt.Println("Warning: Tenant must contain 'gen'")
	}
	// Validate if the tenant contains special symbols or characters other then "_"
	if strings.ContainsAny(tenant, "!@#$%^&*()+`-=[]{}|;':\",./<>?—") {
		fmt.Println("Warning: Tenant contains invalid special characters")
	}
	if env == "TEST" && strings.Contains(tenant, "prod") {
		fmt.Println("Warning: Environment is TEST, but tenant contains 'prod'")
	}
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
