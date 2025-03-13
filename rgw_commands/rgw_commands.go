package rgw_commands

import (
	"bytes"
	"fmt"
)

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
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %sG --display-name \"%s\"",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					variables["bucketquotas"][i],
					displayName)
				rows.WriteString(bucketcreate)
			} else {
				bucketcreate := fmt.Sprintf("~/scripts/rgw-create-bucket.sh --config %s --tenant %s --bucket %s --size %sG",
					clusters["Реалм"],
					variables["tenant"][0],
					variables["bucketnames"][i],
					variables["bucketquotas"][i])
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
