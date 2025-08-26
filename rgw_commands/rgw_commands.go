package rgw_commands

import (
	"bytes"
	"fmt"
	"strconv"
	"strings"
)

// convertSizeToBytes converts various size units to bytes
// Supports: T (TB), G (GB), M (MB), K (KB) and plain numbers (assumed to be GB)
func convertSizeToBytes(sizeStr string) string {
	// Remove any whitespace
	sizeStr = strings.TrimSpace(sizeStr)

	// Check if it ends with a unit
	var multiplier float64 = 1000000000 // Default: GB (1 GB = 1,000,000,000 bytes)
	var numericPart string = sizeStr

	if strings.HasSuffix(strings.ToUpper(sizeStr), "T") {
		multiplier = 1000000000000 // 1 TB = 1,000,000,000,000 bytes
		numericPart = strings.TrimSuffix(strings.ToUpper(sizeStr), "T")
	} else if strings.HasSuffix(strings.ToUpper(sizeStr), "G") {
		multiplier = 1000000000 // 1 GB = 1,000,000,000 bytes
		numericPart = strings.TrimSuffix(strings.ToUpper(sizeStr), "G")
	} else if strings.HasSuffix(strings.ToUpper(sizeStr), "M") {
		multiplier = 1000000 // 1 MB = 1,000,000 bytes
		numericPart = strings.TrimSuffix(strings.ToUpper(sizeStr), "M")
	} else if strings.HasSuffix(strings.ToUpper(sizeStr), "K") {
		multiplier = 1000 // 1 KB = 1,000 bytes
		numericPart = strings.TrimSuffix(strings.ToUpper(sizeStr), "K")
	}

	// Parse the numeric value
	size, err := strconv.ParseFloat(numericPart, 64)
	if err != nil {
		return sizeStr // Return original if conversion fails
	}

	// Convert to bytes
	bytes := int64(size * multiplier)

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
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %s --display-name \"%s\"",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					convertSizeToBytes(variables["bucketquotas"][i]),
					displayName)
				rows.WriteString(bucketcreate)
			} else {
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %s",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					convertSizeToBytes(variables["bucketquotas"][i]))
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
				realm, tenant, name, convertSizeToBytes(size))
			commands.WriteString(cmd)
		}
	}
	return commands.String()
}
