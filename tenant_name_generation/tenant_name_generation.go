package tenant_name_generation

import (
	"fmt"
	"strings"
)

func GenerateTenantName(variables map[string][]string, clusters map[string]string) (string, error) {
	getFirst := func(key string) (string, error) {
		if values, ok := variables[key]; ok && len(values) > 0 {
			return values[0], nil
		}
		return "", fmt.Errorf("%s is missing or empty", key)
	}

	envCode, err := getFirst("env_code")
	if err != nil {
		return "", err
	}

	risName, err := getFirst("ris_name")
	if err != nil {
		return "", err
	}

	segment, err := getFirst("segment")
	if err != nil {
		return "", err
	}

	datacenter, ok := clusters["ЦОД"]
	if !ok {
		return "", fmt.Errorf("ЦОД (datacenter) information is missing")
	}

	segmentTenant := strings.Replace(strings.ToLower(segment), "-", "_", -1)

	tenant := fmt.Sprintf("%s_%s_gen_01_%s_%s",
		strings.ToLower(envCode),
		strings.ToLower(risName),
		strings.ToLower(datacenter),
		segmentTenant)

	return tenant, nil
}
