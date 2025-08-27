package rgw_commands

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
)

// convertGBToBytes converts gigabytes to bytes (1 GB = 1,000,000,000 bytes)
// Only accepts plain integers, assumed to be in GB
func convertGBToBytes(gbStr string) string {
	// Remove any whitespace
	gbStr = strings.TrimSpace(gbStr)

	// Parse the GB value as integer
	gb, err := strconv.ParseInt(gbStr, 10, 64)
	if err != nil {
		return gbStr // Return original if conversion fails
	}

	// Convert to bytes (1 GB = 1,000,000,000 bytes)
	bytes := gb * 1000000000

	return strconv.FormatInt(bytes, 10)
}

func BucketCreation(variables map[string][]string, clusters map[string]string) string {
	var rows bytes.Buffer
	for i, bucket := range variables["bucketnames"] {
		if bucket != "" {
			createTenant, ok := variables["create_tenant"]
			if i == 0 && ok && len(createTenant) > 0 && createTenant[0] == "true" {
				displayName := fmt.Sprintf("%s;%s;%s",
					variables["resp_group"][0],
					variables["owner"][0],
					variables["request_id_srt"][0])
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %s --display-name \"%s\";",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					convertGBToBytes(variables["bucketquotas"][i]),
					displayName)
				rows.WriteString(bucketcreate)
			} else {
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %s;",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					convertGBToBytes(variables["bucketquotas"][i]))
				rows.WriteString(bucketcreate)
			}
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
			usercreate := fmt.Sprintf("sudo radosgw-admin user create --rgw-realm %s --tenant %s --uid %s --display-name %s --max-buckets -1 | grep -A2 '\"user\"';", clusters["Реалм"], variables["tenant"][0], user, variables["request_id_srt"][0])
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

func GenerateDeletionCommands(tenant string, users []string, buckets []string, realm string) string {
	var commands bytes.Buffer

	// Generate user deletion commands
	for _, user := range users {
		if user != "" && user != tenant { // Skip empty users and tenant user
			cmd := fmt.Sprintf("sudo radosgw-admin user rm --rgw-realm %s --tenant %s --uid %s\n",
				realm, tenant, user)
			commands.WriteString(cmd)
		}
	}

	// Generate bucket deletion commands
	for _, bucket := range buckets {
		if bucket != "" {
			cmd := fmt.Sprintf("sudo radosgw-admin bucket rm --rgw-realm %s --bucket \"%s/%s\"\n",
				realm, tenant, bucket)
			commands.WriteString(cmd)
		}
	}

	return commands.String()
}

func GenerateQuotaCommands(tenant string, buckets []string, realm string) string {
	var commands bytes.Buffer
	for _, bucket := range buckets {
		if bucket != "" {
			parts := strings.Split(bucket, "|")
			name := strings.TrimSpace(parts[0])
			size := "0"
			if len(parts) > 1 {
				size = strings.TrimSpace(parts[1])
			}

			cmd := fmt.Sprintf("sudo radosgw-admin quota set --rgw-realm %s --quota-scope bucket --bucket \"%s/%s\" --max-size %s\n",
				realm, tenant, name, convertGBToBytes(size))
			commands.WriteString(cmd)
		}
	}
	return commands.String()
}
