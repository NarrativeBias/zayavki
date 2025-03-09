package prep_db_table_data

import (
	"bytes"
	"fmt"
	"strings"
	"time"
)

func PopulateUsers(variables map[string][]string, clusters map[string]string) string {
	// Initialize a buffer to store the generated rows
	var rows bytes.Buffer

	// Get current date
	current_date := time.Now().Format("2006-01-02 15:04:05")

	// Combine owner and zam_owner
	ownerInfo := variables["owner"][0]
	if zamOwner, exists := variables["zam_owner"]; exists && len(zamOwner) > 0 {
		ownerInfo = fmt.Sprintf("%s; %s", ownerInfo, zamOwner[0])
	}

	// Create a row for each username
	for i, username := range variables["users"] {
		username = strings.ToLower(username)
		if username != "" {
			row := fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s",
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], username, "-", "-",
				variables["request_id_sd"][0], variables["request_id_srt"][0], current_date,
				variables["ris_name"][0], variables["ris_number"][0], variables["resp_group"][0],
				ownerInfo, variables["requester"][0])
			rows.WriteString(row)

			// Add newline character only if it's not the last row
			if i < len(variables["users"])-1 {
				rows.WriteString("\n")
			}
		}
	}
	return rows.String()
}

func PopulateBuckets(variables map[string][]string, clusters map[string]string) string {
	// Initialize a buffer to store the generated rows
	var rows bytes.Buffer

	// Get current date
	current_date := time.Now().Format("2006-01-02 15:04:05")

	// Combine owner and zam_owner
	ownerInfo := variables["owner"][0]
	if zamOwner, exists := variables["zam_owner"]; exists && len(zamOwner) > 0 {
		ownerInfo = fmt.Sprintf("%s; %s", ownerInfo, zamOwner[0])
	}

	// Create a row for each bucket
	for i, bucket := range variables["bucketnames"] {
		if bucket != "" {
			// Get quota and clean it up
			quota := variables["bucketquotas"][i]
			// Remove any pipe characters and trim spaces
			quota = strings.ReplaceAll(quota, "|", "")
			quota = strings.TrimSpace(quota)

			row := fmt.Sprintf("%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s",
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], "-", bucket, quota,
				variables["request_id_sd"][0], variables["request_id_srt"][0],
				current_date, variables["ris_name"][0], variables["ris_number"][0],
				variables["resp_group"][0], ownerInfo, variables["requester"][0])
			rows.WriteString(row)

			// Add newline character only if it's not the last row
			if i < len(variables["bucketnames"])-1 {
				rows.WriteString("\n")
			}
		}
	}
	return rows.String()
}
