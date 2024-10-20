package main

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
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

	cluster, err := cluster_endpoint_parser.GetCluster("clusters.xlsx", processedVars["segment"][0], processedVars["env"][0])
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

	// Process data with the single cluster found
	result, err := processDataWithCluster(processedVars, cluster, pushToDb)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error processing data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}
func handleClusterSelection(w http.ResponseWriter, r *http.Request) {

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		http.Error(w, fmt.Sprintf("Error reading request: %v", err), http.StatusBadRequest)
		return
	}

	var data struct {
		ProcessedVars   map[string][]string                 `json:"processedVars"`
		SelectedCluster cluster_endpoint_parser.ClusterInfo `json:"selectedCluster"`
		PushToDb        bool                                `json:"pushToDb"`
	}

	if err := json.Unmarshal(body, &data); err != nil {
		log.Printf("Error unmarshaling JSON: %v", err)
		http.Error(w, fmt.Sprintf("Error parsing request: %v", err), http.StatusBadRequest)
		return
	}

	// Process the variables
	processedVars, err := variables_parser.ParseAndProcessVariables(data.ProcessedVars)
	if err != nil {
		log.Printf("Error processing variables: %v", err)
		http.Error(w, fmt.Sprintf("Error processing variables: %v", err), http.StatusInternalServerError)
		return
	}

	// Process data with the selected cluster
	result, err := processDataWithCluster(processedVars, data.SelectedCluster, data.PushToDb)
	if err != nil {
		log.Printf("Error processing data: %v", err)
		http.Error(w, fmt.Sprintf("Error processing data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

func processDataWithCluster(processedVars map[string][]string, chosenCluster cluster_endpoint_parser.ClusterInfo, pushToDb bool) (string, error) {
	clusterMap := chosenCluster.ConvertToMap()

	// Set up tenant and users
	if err := setupTenantAndUsers(processedVars, clusterMap); err != nil {
		return "", err
	}

	if pushToDb {
		return pushToDatabase(processedVars, clusterMap)
	}

	return generateFullResult(processedVars, clusterMap)
}

func handleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var checkData struct {
		Segment   string `json:"segment"`
		Env       string `json:"env"`
		RisNumber string `json:"ris_number"`
		RisName   string `json:"ris_name"`
		Cluster   string `json:"cluster,omitempty"`
	}

	err := json.NewDecoder(r.Body).Decode(&checkData)
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if checkData.Cluster == "" {
		// If no cluster is provided, find matching clusters
		clusters, err := cluster_endpoint_parser.FindMatchingClusters("clusters.xlsx", checkData.Segment, checkData.Env)
		if err != nil {
			http.Error(w, fmt.Sprintf("Error finding clusters: %v", err), http.StatusInternalServerError)
			return
		}

		response := struct {
			Clusters []cluster_endpoint_parser.ClusterInfo `json:"clusters"`
		}{
			Clusters: clusters,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	} else {
		// If a cluster is provided, perform the database check
		results, err := postgresql_operations.CheckDBForExistingEntries(checkData.Segment, checkData.Env, checkData.RisNumber, checkData.RisName, checkData.Cluster)
		if err != nil {
			http.Error(w, fmt.Sprintf("Error checking database: %v", err), http.StatusInternalServerError)
			return
		}

		if len(results) == 0 {
			fmt.Fprint(w, "No results found")
		} else {
			fmt.Fprint(w, strings.Join(results, "\n"))
		}
	}
}

func setupTenantAndUsers(processedVars map[string][]string, clusterMap map[string]string) error {
	// Generate tenant name
	if len(processedVars["tenant_override"]) > 0 && processedVars["tenant_override"][0] != "" {
		processedVars["tenant"] = []string{processedVars["tenant_override"][0]}
	} else {
		tenantName, err := tenant_name_generation.GenerateTenantName(processedVars, clusterMap)
		if err != nil {
			return fmt.Errorf("error generating tenant name: %v", err)
		}
		processedVars["tenant"] = []string{tenantName}
	}

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
	dbResult, err := postgresql_operations.PushToDB(processedVars, clusterMap)
	if err != nil {
		return "", fmt.Errorf("failed to push to database: %v", err)
	}
	return fmt.Sprintf("~~~~~~~Результат отправки данных в БД~~~~~~~\n%s", dbResult), nil
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

	result.WriteString("~~~~~~~Шаблон для закрытия задания и письма с данными УЗ~~~~~~~\n")
	email, err := email_template.PopulateEmailTemplate(processedVars, clusterMap)
	if err != nil {
		return "", fmt.Errorf("error generating email template: %v", err)
	}
	result.WriteString(email)
	result.WriteString("\n")

	return result.String(), nil
}
