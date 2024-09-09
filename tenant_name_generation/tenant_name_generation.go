package tenant_name_generation

import (
	"fmt"
	"strings"
)

func GenerateTenantName(variables map[string][]string, clusters map[string]string) string {

	segment_tenant := strings.Replace(strings.ToLower(variables["segment"][0]), "-", "_", -1)

	//Generate tenant name
	tenant := fmt.Sprintf("%s_%s_gen_01_%s_%s", variables["env_code"][0], variables["ris_name"][0], strings.ToLower(clusters["ЦОД"]), segment_tenant)

	return tenant
}
