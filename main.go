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
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	formattedResult := formatResult(result)

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(formattedResult))
}

func formatResult(result string) string {
	sections := strings.Split(result, "\n\n")
	var formatted strings.Builder

	for _, section := range sections {
		lines := strings.SplitN(section, "\n", 2)
		if len(lines) < 2 {
			continue
		}
		title := strings.TrimSpace(lines[0])
		content := strings.TrimSpace(lines[1])

		formatted.WriteString(title + "\n")
		formatted.WriteString(content + "\n\n")
	}

	return formatted.String()
}

func processData(rawVariables map[string][]string, pushToDb bool) (string, error) {
	var warnings []string

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

	// Validate users and buckets
	if valid, err := validator.ValidateUsers(processedVars); !valid {
		warnings = append(warnings, fmt.Sprintf("User validation warning: %v", err))
	}
	if valid, err := validator.ValidateBuckets(processedVars); !valid {
		warnings = append(warnings, fmt.Sprintf("Bucket validation warning: %v", err))
	}

	// Generate results
	var result strings.Builder

	result.WriteString("~~~~~~~Table of users and buckets to be pushed into database~~~~~~~\n")
	result.WriteString(prep_db_table_data.PopulateUsers(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(prep_db_table_data.PopulateBuckets(processedVars, chosenCluster))
	result.WriteString("\n\n")

	result.WriteString("~~~~~~~List of terminal commands for bucket and user creation~~~~~~~\n")
	result.WriteString(rgw_commands.BucketCreation(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(rgw_commands.UserCreation(processedVars, chosenCluster))
	result.WriteString("\n")
	result.WriteString(rgw_commands.ResultCheck(processedVars, chosenCluster))
	result.WriteString("\n\n")

	result.WriteString("~~~~~~~Request closure + Email template~~~~~~~\n")
	email, err := email_template.PopulateEmailTemplate(processedVars, chosenCluster)
	if err != nil {
		return "", fmt.Errorf("error generating email template: %v", err)
	}
	result.WriteString(email)
	result.WriteString("\n")

	// Add warnings to the result
	if len(warnings) > 0 {
		result.WriteString("\n~~~~~~~Warnings~~~~~~~\n")
		for _, warning := range warnings {
			result.WriteString(warning + "\n")
		}
	}

	// Push to database if requested
	if pushToDb {
		err := postgresql_push.PushToDB(processedVars, chosenCluster)
		if err != nil {
			result.WriteString(fmt.Sprintf("\nError pushing to database: %v\n", err))
		} else {
			result.WriteString("\nData successfully pushed to database.\n")
		}
	}

	return result.String(), nil
}
