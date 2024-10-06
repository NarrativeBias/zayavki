package rgw_commands

import (
	"bytes"
	"fmt"
)

func BucketCreation(variables map[string][]string, clusters map[string]string) string {
	// Iterate over the buckets to generate terminal commands for bucket creation
	var rows bytes.Buffer
	for i, bucket := range variables["bucketnames"] {
		// Check if UID is empty
		if bucket != "" {
			bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %s --req %s", clusters["Реалм"], variables["tenant"][0], variables["bucketnames"][i], variables["bucketquotas"][i], variables["request_id_sd"][0])
			rows.WriteString(bucketcreate)
			// Add newline character only if it's not the last row
			if i < len(variables["bucketnames"])-1 {
				rows.WriteString(" &&\\\n")
			}
		}

	}
	return rows.String()
}

func UserCreation(variables map[string][]string, clusters map[string]string) string {
	// Iterate over the usernames to generate terminal commands for "radogw-admin user create"
	var rows bytes.Buffer
	for i, user := range variables["users"] {
		// Skip the generation of main tenant user
		if user == variables["tenant"][0] {
			continue
		}
		// Check if UID is empty
		if user != "" {
			usercreate := fmt.Sprintf("sudo radosgw-admin user create --rgw-realm %s --tenant %s --uid %s --display-name %s --max-buckets -1 | grep -A2 '\"user\"';", clusters["Реалм"], variables["tenant"][0], user, variables["request_id_sd"][0])
			rows.WriteString(usercreate)
			// Add newline character only if it's not the last row
			if i < len(variables["users"])-1 {
				rows.WriteString("\n")
			}
		}

	}
	return rows.String()
}

func ResultCheck(variables map[string][]string, clusters map[string]string) string {
	// Commands to check users and buckets in tenant
	userListCommand := fmt.Sprintf("sudo radosgw-admin user list --rgw-realm %s | grep %s; sudo radosgw-admin bucket list --rgw-realm %s | grep %s;\n", clusters["Реалм"], variables["tenant"][0], clusters["Реалм"], variables["tenant"][0])
	return userListCommand
}
