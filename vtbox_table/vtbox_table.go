package vtbox_table

import (
	"bytes"
	"fmt"
	"strings"
	"time"
)

func PopulateUsers(variables map[string][]string) string {
	// Initialize a buffer to store the generated rows
	var rows bytes.Buffer

	// Get current date
	current_date := time.Now().Format("02.01.2006") // Format: DD-MM-YYYY

	// Create a row for each username
	for i, username := range variables["users"] {
		username = strings.ToLower(username)
		if username != "" {
			row := fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s", variables["cluster"][0], variables["segment"][0], variables["env"][0], variables["rgw_realm"][0], variables["tenant"][0], username, "-", "-", variables["request_id_sm"][0], variables["request_id_sf"][0], current_date, variables["ris_name"][0], variables["ris_code"][0], variables["resp_group"][0], variables["owner"][0], variables["requester"][0])
			rows.WriteString(row)

			// Add newline character only if it's not the last row
			if i < len(variables["users"])-1 {
				rows.WriteString("\n")
			}
		}
	}
	return rows.String()
}

func PopulateBuckets(variables map[string][]string) string {
	// Initialize a buffer to store the generated rows
	var rows bytes.Buffer

	// Get current date
	current_date := time.Now().Format("02.01.2006") // Format: DD-MM-YYYY

	// Create a row for each bucket
	for i, bucket := range variables["bucketnames"] {
		if bucket != "" {
			row := fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s", variables["cluster"][0], variables["segment"][0], variables["env"][0], variables["rgw_realm"][0], variables["tenant"][0], "-", variables["bucketnames"][i], variables["bucketquotas"][i], variables["request_id_sm"][0], variables["request_id_sf"][0], current_date, variables["ris_name"][0], variables["ris_code"][0], variables["resp_group"][0], variables["owner"][0], variables["requester"][0])
			rows.WriteString(row)

			// Add newline character only if it's not the last row
			if i < len(variables["bucketnames"])-1 {
				rows.WriteString("\n")
			}
		}
	}
	return rows.String()
}
