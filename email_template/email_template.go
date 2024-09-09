package email_template

import (
	"bytes"
	"errors"
	"text/template"
)

// Email template with placeholders for variables.
const emailTemplate = `
{{.email}}
Добрый день.

Вы указаны получателем данных от УЗ созданных в рамках обращения {{.request_id_sm}}.

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

// Function to populate the email template with variables.
func PopulateEmailTemplate(variables map[string][]string, chosenCluster map[string]string) (string, error) {
	if chosenCluster == nil {
		return "", errors.New("clusters map is nil")
	}

	tmpl, err := template.New("email_template").Parse(emailTemplate)
	if err != nil {
		return "", err
	}

	var populatedTemplate bytes.Buffer
	err = tmpl.Execute(&populatedTemplate, map[string]interface{}{
		"email":         variables["email"][0],
		"request_id_sm": variables["request_id_sm"][0],
		"segment":       variables["segment"][0],
		"env":           variables["env"][0],
		"tenant":        variables["tenant"][0],
		"users":         variables["users"],
		"bucketnames":   variables["bucketnames"],
		"tls_endpoint":  chosenCluster["mtls_endpoint"],
		"mtls_endpoint": chosenCluster["tls_endpoint"],
	})
	if err != nil {
		return "", err
	}

	return populatedTemplate.String(), nil
}
