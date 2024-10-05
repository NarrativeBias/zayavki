package main

import (
	"fmt"
	"html/template"
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
	// Initialize database connection
	err := postgresql_push.InitDB("db_config.json")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Serve static files
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))

	http.HandleFunc("/", handleIndex)
	http.HandleFunc("/submit", handleSubmit)

	fmt.Println("Server is running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	tmpl, err := template.ParseFiles("templates/index.html")
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	tmpl.Execute(w, nil)
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse form data
	err := r.ParseForm()
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Check if push to database is requested
	pushToDb := r.Form.Get("push_to_db") == "true"

	// Process data
	result, err := processData(r.Form, pushToDb)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Set the content type to text/plain with UTF-8 encoding
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")

	// Write the result as UTF-8 encoded bytes
	_, err = w.Write([]byte(result))
	if err != nil {
		http.Error(w, "Error writing response", http.StatusInternalServerError)
		return
	}
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

	result.WriteString("~~~~~~~Table of users and buckets to copy-paste into VTBox~~~~~~~\n")
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
