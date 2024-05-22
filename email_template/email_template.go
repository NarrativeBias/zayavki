package email_template

import (
	"bytes"
	"text/template"
)

// Email template with placeholders for variables.
const emailTemplate = `
{{.email}}
Добрый день.

Ваш запрос {{.request_id_sm}} был выполнен.

Сегмент: {{.segment}}
Окружение: {{.env}}
Тенант: {{.tenant}}

Пользователи созданы:
{{- range .users}}
- {{.}}
{{- end}}

Бакеты созданы:
{{- range .bucketnames}}
- {{.}}
{{- end}}

`

// Function to populate the email template with variables.
func PopulateEmailTemplate(variables map[string][]string) (string, error) {
	tmpl, err := template.New("email").Parse(emailTemplate)
	if err != nil {
		return "", err
	}
	var populatedTemplate bytes.Buffer
	err = tmpl.Execute(&populatedTemplate, variables)
	if err != nil {
		return "", err
	}
	return populatedTemplate.String(), nil
}
