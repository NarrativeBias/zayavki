package email_template

import (
	"bytes"
	"fmt"
	"text/template"
)

func PopulateEmailTemplate(variables map[string][]string, chosenCluster map[string]string) (string, error) {
	// Helper function to safely get the first element of a slice or return a default value
	getFirst := func(slice []string, defaultValue string) string {
		if len(slice) > 0 {
			return slice[0]
		}
		return defaultValue
	}

	data := map[string]interface{}{
		"email":         getFirst(variables["email"], "N/A"),
		"request_id_sd": getFirst(variables["request_id_sd"], "N/A"),
		"request_id_sr": getFirst(variables["request_id_sr"], "N/A"),
		"segment":       getFirst(variables["segment"], "N/A"),
		"env":           getFirst(variables["env"], "N/A"),
		"tenant":        getFirst(variables["tenant"], "N/A"),
		"users":         variables["users"],
		"bucketnames":   variables["bucketnames"],
		"tls_endpoint":  chosenCluster["tls_endpoint"],
		"mtls_endpoint": chosenCluster["mtls_endpoint"],
	}

	tmpl, err := template.New("email_template").Parse(emailTemplate)
	if err != nil {
		return "", fmt.Errorf("error parsing email template: %v", err)
	}

	var populatedTemplate bytes.Buffer
	err = tmpl.Execute(&populatedTemplate, data)
	if err != nil {
		return "", fmt.Errorf("error executing email template: %v", err)
	}

	return populatedTemplate.String(), nil
}

// Keep your existing emailTemplate const
const emailTemplate = `
{{.email}}
Добрый день.

Вы указаны получателем данных от УЗ созданных в рамках обращения {{.request_id_sd}} / {{.request_id_sr}}.

Сегмент: {{.segment}}
Окружение: {{.env}}
Тенант: {{.tenant}}
Endpoints для подключения:
{{.tls_endpoint}}
{{.mtls_endpoint}}

Пользователи созданы:
{{- range .users}}
{{- if .}}
- {{.}}
{{- end}}
{{- end}}

Бакеты созданы:
{{- range .bucketnames}}
{{- if .}}
- {{.}}
{{- end}}
{{- end}}
`
