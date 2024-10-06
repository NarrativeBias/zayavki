package main

import (
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/NarrativeBias/zayavki/cluster_endpoint_parser"
	"github.com/NarrativeBias/zayavki/email_template"
	"github.com/NarrativeBias/zayavki/postgresql_push"
	"github.com/NarrativeBias/zayavki/prep_db_table_data"
	"github.com/NarrativeBias/zayavki/rgw_commands"
	"github.com/NarrativeBias/zayavki/tenant_name_generation"
	"github.com/NarrativeBias/zayavki/validator"
	"github.com/NarrativeBias/zayavki/variables_parser"
)

func main() {
	err := postgresql_push.InitDB("db_config.json")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer postgresql_push.CloseDB()

	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/submit", handleSubmit)

	fmt.Println("Server is running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "templates/index.html")
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB max memory
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pushToDb := r.FormValue("push_to_db") == "true"

	result, err := processData(r.MultipartForm.Value, pushToDb)
	if err != nil {
		log.Printf("Error processing data: %v", err)
		http.Error(w, fmt.Sprintf("Error: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

func processData(rawVariables map[string][]string, pushToDb bool) (string, error) {
	var warnings []string
	var result strings.Builder

	// Parse and process variables
	processedVars, err := variables_parser.ParseAndProcessVariables(rawVariables)
	if err != nil {
		return "", fmt.Errorf("error processing variables: %v", err)
	}

	// Find matching clusters
	cluster_info := "clusters.xlsx"
	clusters, err := cluster_endpoint_parser.FindMatchingClusters(cluster_info, processedVars["segment"][0], processedVars["env"][0])
	if err != nil {
		return "", fmt.Errorf("error finding matching clusters: %v", err)
	}
	chosenCluster, err := cluster_endpoint_parser.ChooseCluster(clusters)
	if err != nil {
		return "", fmt.Errorf("error choosing cluster: %v", err)
	}

	// Generate tenant name
	if processedVars["tenant_override"][0] != "" {
		processedVars["tenant"] = []string{processedVars["tenant_override"][0]}
	} else {
		processedVars["tenant"] = []string{tenant_name_generation.GenerateTenantName(processedVars, chosenCluster)}
	}

	// Check if creating tenant is needed and add to users list if so
	if createTenant, ok := processedVars["create_tenant"]; ok && len(createTenant) > 0 && createTenant[0] == "true" {
		if len(processedVars["users"]) == 0 {
			processedVars["users"] = []string{processedVars["tenant"][0]}
		} else {
			processedVars["users"] = append([]string{processedVars["tenant"][0]}, processedVars["users"]...)
		}
	}

	// Validate users and buckets
	if valid, err := validator.ValidateUsers(processedVars); !valid {
		warnings = append(warnings, fmt.Sprintf("User validation warning: %v", err))
	}
	if valid, err := validator.ValidateBuckets(processedVars); !valid {
		warnings = append(warnings, fmt.Sprintf("Bucket validation warning: %v", err))
	}

	// Add warnings at the top if there are any
	if len(warnings) > 0 {
		result.WriteString("~~~~~~~Предупреждения~~~~~~~\n")
		for _, warning := range warnings {
			result.WriteString(warning + "\n")
		}
		result.WriteString("\n")
	}

	result.WriteString("~~~~~~~Таблица пользователей и бакетов для отправки в БД~~~~~~~\n")
	result.WriteString(prep_db_table_data.PopulateUsers(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(prep_db_table_data.PopulateBuckets(processedVars, chosenCluster))
	result.WriteString("\n\n")

	result.WriteString("~~~~~~~Список терминальных команд для создания пользователей и бакетов~~~~~~~\n")
	result.WriteString(rgw_commands.BucketCreation(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(rgw_commands.UserCreation(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(rgw_commands.ResultCheck(processedVars, chosenCluster))
	result.WriteString("\n\n")

	result.WriteString("~~~~~~~Шаблон для закрытия задания и письма с данными УЗ~~~~~~~\n")
	email, err := email_template.PopulateEmailTemplate(processedVars, chosenCluster)
	if err != nil {
		return "", fmt.Errorf("error generating email template: %v", err)
	}
	result.WriteString(email)
	result.WriteString("\n")

	// Push to database if requested
	if pushToDb {
		err := postgresql_push.PushToDB(processedVars, chosenCluster)
		if err != nil {
			return "", fmt.Errorf("failed to push to database: %v", err)
		}
		// Return only the success message for DB push
		return "Data successfully pushed to database.", nil
	}

	return result.String(), nil
}
