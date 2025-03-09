package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"log"
	"net/http"
	"strings"

	"github.com/NarrativeBias/zayavki/cluster_endpoint_parser"
	"github.com/NarrativeBias/zayavki/email_template"
	"github.com/NarrativeBias/zayavki/postgresql_operations"
	"github.com/NarrativeBias/zayavki/prep_db_table_data"
	"github.com/NarrativeBias/zayavki/rgw_commands"
	"github.com/NarrativeBias/zayavki/tenant_name_generation"
	"github.com/NarrativeBias/zayavki/validator"
	"github.com/NarrativeBias/zayavki/variables_parser"
)

var templates *template.Template

func init() {
	templates = template.Must(template.ParseFiles(
		"web/templates/layouts/base.html",
		"web/templates/partials/header.html",
		"web/templates/partials/footer.html",
		"web/templates/pages/index.html",
	))
}

func main() {
	err := postgresql_operations.InitDB("db_config.json")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer postgresql_operations.CloseDB()

	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("web/static"))
	mux.Handle("/zayavki/static/", http.StripPrefix("/zayavki/static/", fs))

	mux.HandleFunc("/zayavki/submit", stripPrefix(handleSubmit))
	mux.HandleFunc("/zayavki/", stripPrefix(handleIndex))
	mux.HandleFunc("/zayavki/cluster", stripPrefix(handleClusterSelection))
	mux.HandleFunc("/zayavki/check", stripPrefix(handleCheck))
	mux.HandleFunc("/zayavki/tenant-info", stripPrefix(handleTenantInfo))
	mux.HandleFunc("/zayavki/cluster-info", stripPrefix(handleClusterInfo))

	log.Fatal(http.ListenAndServe(":8080", mux))
}

func stripPrefix(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/zayavki")
		h(w, r)
	}
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	err := templates.ExecuteTemplate(w, "base.html", nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
}

func handleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	pushToDb := r.FormValue("push_to_db") == "true"

	processedVars, err := variables_parser.ParseAndProcessVariables(r.MultipartForm.Value)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error processing variables: %v", err), http.StatusInternalServerError)
		return
	}

	var cluster cluster_endpoint_parser.ClusterInfo
	cluster, err = cluster_endpoint_parser.GetCluster("clusters.xlsx", processedVars["segment"][0], processedVars["env"][0])
	if err != nil {
		if strings.HasPrefix(err.Error(), "no matching clusters found") {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		if err.Error() == "multiple clusters found" {
			clusters, _ := cluster_endpoint_parser.FindMatchingClusters("clusters.xlsx", processedVars["segment"][0], processedVars["env"][0])
			clusterJSON, _ := json.Marshal(clusters)
			w.Header().Set("Content-Type", "text/plain; charset=utf-8")
			fmt.Fprintf(w, "CLUSTER_SELECTION_REQUIRED:%s", clusterJSON)
			return
		}
		http.Error(w, fmt.Sprintf("Error finding cluster: %v", err), http.StatusInternalServerError)
		return
	}

	// Process data with the cluster
	result, err := processDataWithCluster(processedVars, cluster, pushToDb)
	if err != nil {
		handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

func handleClusterSelection(w http.ResponseWriter, r *http.Request) {
	var requestData struct {
		ProcessedVars   map[string][]string `json:"processedVars"`
		SelectedCluster map[string]string   `json:"selectedCluster"`
		PushToDb        bool                `json:"pushToDb"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing request: %v", err), http.StatusBadRequest)
		return
	}

	// Process the variables
	processedVars, err := variables_parser.ParseAndProcessVariables(requestData.ProcessedVars)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error processing variables: %v", err), http.StatusInternalServerError)
		return
	}

	// Convert map to ClusterInfo
	clusterInfo := cluster_endpoint_parser.ClusterInfo{
		Выдача:       requestData.SelectedCluster["Выдача"],
		ЦОД:          requestData.SelectedCluster["ЦОД"],
		Среда:        requestData.SelectedCluster["Среда"],
		ЗБ:           requestData.SelectedCluster["ЗБ"],
		TLSEndpoint:  requestData.SelectedCluster["tls_endpoint"],
		MTLSEndpoint: requestData.SelectedCluster["mtls_endpoint"],
		Кластер:      requestData.SelectedCluster["Кластер"],
		Реалм:        requestData.SelectedCluster["Реалм"],
	}

	// Process data with the selected cluster
	result, err := processDataWithCluster(processedVars, clusterInfo, requestData.PushToDb)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error processing data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

func checkTenantExists(processedVars map[string][]string, clusterMap map[string]string) error {
	if createTenant, ok := processedVars["create_tenant"]; !ok || len(createTenant) == 0 || createTenant[0] != "true" {
		return nil // Not creating a tenant, skip check
	}

	// Determine tenant name (override or generated)
	var tenantName string
	if len(processedVars["tenant_override"]) > 0 && processedVars["tenant_override"][0] != "" {
		tenantName = processedVars["tenant_override"][0]
	} else {
		var err error
		tenantName, err = tenant_name_generation.GenerateTenantName(processedVars, clusterMap)
		if err != nil {
			return fmt.Errorf("error generating tenant name: %v", err)
		}
	}

	// Check if tenant already exists
	results, err := postgresql_operations.CheckDBForExistingEntries(
		processedVars["segment"][0],
		processedVars["env"][0],
		"", // ris_number
		"", // ris_name
		tenantName,
		"",         // bucket
		tenantName, // user
		"",         // cluster
	)
	if err != nil {
		return fmt.Errorf("error checking database: %v", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("tenant '%s' already exists in the database", tenantName)
	}

	return nil
}

func processDataWithCluster(variables map[string][]string, cluster cluster_endpoint_parser.ClusterInfo, pushToDb bool) (string, error) {
	// Convert ClusterInfo to map for easier handling
	clusterMap := cluster.ConvertToMap()

	// Skip tenant name generation if we have tenant_override or existing tenant
	if _, hasExistingTenant := variables["tenant"]; !hasExistingTenant {
		if override, hasOverride := variables["tenant_override"]; hasOverride && len(override) > 0 && override[0] != "" {
			variables["tenant"] = []string{override[0]}
		} else {
			// Generate tenant name only for new tenant creation without override
			tenant, err := tenant_name_generation.GenerateTenantName(variables, clusterMap)
			if err != nil {
				return "", fmt.Errorf("error generating tenant name: %v", err)
			}
			variables["tenant"] = []string{tenant}
		}
	}

	// Validate the data
	if err := validator.ValidateData(variables); err != nil {
		return "", fmt.Errorf("validation error: %v", err)
	}

	// Check for existing tenant first
	if err := checkTenantExists(variables, clusterMap); err != nil {
		return "", err
	}

	// Set up tenant and users
	if err := setupTenantAndUsers(variables, clusterMap); err != nil {
		return "", err
	}

	if pushToDb {
		return pushToDatabase(variables, clusterMap)
	}

	return generateFullResult(variables, clusterMap)
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var checkData struct {
		Segment   string `json:"segment"`
		Env       string `json:"env"`
		RisNumber string `json:"ris_number"`
		RisName   string `json:"ris_name"`
		Cluster   string `json:"cluster,omitempty"`
		Tenant    string `json:"tenant,omitempty"`
		Bucket    string `json:"bucket,omitempty"`
		User      string `json:"user,omitempty"`
	}

	err := json.NewDecoder(r.Body).Decode(&checkData)
	if err != nil {
		jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	results, err := postgresql_operations.CheckDBForExistingEntries(
		checkData.Segment,
		checkData.Env,
		checkData.RisNumber,
		checkData.RisName,
		checkData.Tenant,
		checkData.Bucket,
		checkData.User,
		checkData.Cluster,
	)
	if err != nil {
		jsonError(w, fmt.Sprintf("Error checking database: %v", err), http.StatusInternalServerError)
		return
	}

	response := struct {
		Results []postgresql_operations.CheckResult `json:"results"`
	}{
		Results: results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func setupTenantAndUsers(processedVars map[string][]string, _ map[string]string) error {
	// Check if creating tenant is needed and add to users list if so
	if createTenant, ok := processedVars["create_tenant"]; ok && len(createTenant) > 0 && createTenant[0] == "true" {
		if len(processedVars["users"]) == 0 {
			processedVars["users"] = []string{processedVars["tenant"][0]}
		} else {
			processedVars["users"] = append([]string{processedVars["tenant"][0]}, processedVars["users"]...)
		}
	}
	return nil
}

func pushToDatabase(processedVars map[string][]string, clusterMap map[string]string) (string, error) {
	var result strings.Builder

	// Get database push result
	dbResult, err := postgresql_operations.PushToDB(processedVars, clusterMap)
	if err != nil {
		return "", fmt.Errorf("failed to push to database: %v", err)
	}

	// Add database result to output
	result.WriteString("~~~~~~~Результат отправки данных в БД~~~~~~~\n")
	result.WriteString(dbResult)
	result.WriteString("\n\n")

	// Generate and add email template
	emailTemplate, err := email_template.PopulateEmailTemplate(processedVars, clusterMap)
	if err != nil {
		return "", fmt.Errorf("failed to generate email template: %v", err)
	}
	result.WriteString("~~~~~~~Шаблон для закрытия задания и письма с данными УЗ~~~~~~~\n")
	result.WriteString(emailTemplate)

	return result.String(), nil
}

func generateFullResult(processedVars map[string][]string, clusterMap map[string]string) (string, error) {
	var result strings.Builder
	var warnings []string

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

	// Generate other parts of the result
	result.WriteString("~~~~~~~Таблица пользователей и бакетов для отправки в БД~~~~~~~\n")
	result.WriteString(prep_db_table_data.PopulateUsers(processedVars, clusterMap))
	result.WriteString("\n")
	result.WriteString(prep_db_table_data.PopulateBuckets(processedVars, clusterMap))
	result.WriteString("\n\n")

	result.WriteString("~~~~~~~Список терминальных команд для создания пользователей и бакетов~~~~~~~\n")
	result.WriteString(rgw_commands.BucketCreation(processedVars, clusterMap))
	result.WriteString("\n")
	result.WriteString(rgw_commands.UserCreation(processedVars, clusterMap))
	result.WriteString("\n")
	result.WriteString(rgw_commands.ResultCheck(processedVars, clusterMap))
	result.WriteString("\n\n")

	return result.String(), nil
}

func jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func handleError(w http.ResponseWriter, err error) {
	log.Printf("Error processing data: %v", err)
	http.Error(w, err.Error(), http.StatusInternalServerError)
}

func handleTenantInfo(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request struct {
		Tenant string `json:"tenant"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := postgresql_operations.GetTenantInfo(request.Tenant)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func handleClusterInfo(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Segment string `json:"segment"`
		Env     string `json:"env"`
		Cluster string `json:"cluster"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	clusters, err := cluster_endpoint_parser.FindMatchingClusters("clusters.xlsx", request.Segment, request.Env)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Find the specific cluster
	for _, cluster := range clusters {
		if cluster.Кластер == request.Cluster {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(cluster)
			return
		}
	}

	http.Error(w, "Cluster not found", http.StatusNotFound)
}
