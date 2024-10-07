package main

import (
	"encoding/json"
	"fmt"
	"io"
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

	mux := http.NewServeMux()

	fs := http.FileServer(http.Dir("static"))
	mux.Handle("/zayavki/static/", http.StripPrefix("/zayavki/static/", fs))

	mux.HandleFunc("/zayavki/submit", stripPrefix(handleSubmit))
	mux.HandleFunc("/zayavki/", stripPrefix(handleIndex))
	mux.HandleFunc("/zayavki/cluster", stripPrefix(handleClusterSelection))

	log.Fatal(http.ListenAndServe(":8080", mux))
}

func stripPrefix(h http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		r.URL.Path = strings.TrimPrefix(r.URL.Path, "/zayavki")
		h(w, r)
	}
}

func handleIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "templates/index.html")
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
	log.Println("Handling cluster selection")

	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading request body: %v", err)
		http.Error(w, fmt.Sprintf("Error reading request: %v", err), http.StatusBadRequest)
		return
	}
	log.Printf("Received data: %s", string(body))

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

	log.Printf("Processed variables: %+v", data.ProcessedVars)
	log.Printf("Selected cluster: %+v", data.SelectedCluster)
	log.Printf("Push to DB: %v", data.PushToDb)

	// Ensure email is properly set
	if email, ok := data.ProcessedVars["email_for_credentials"]; ok && len(email) > 0 {
		data.ProcessedVars["email"] = email
	}

	// Process buckets
	if buckets, ok := data.ProcessedVars["buckets"]; ok && len(buckets) > 0 && buckets[0] != "" {
		data.ProcessedVars["bucketnames"] = strings.Split(buckets[0], "\n")
		data.ProcessedVars["bucketquotas"] = make([]string, len(data.ProcessedVars["bucketnames"]))
		for i, bucket := range data.ProcessedVars["bucketnames"] {
			parts := strings.Fields(bucket)
			if len(parts) >= 2 {
				data.ProcessedVars["bucketnames"][i] = parts[0]
				data.ProcessedVars["bucketquotas"][i] = parts[1]
			}
		}
	}

	result, err := processDataWithCluster(data.ProcessedVars, data.SelectedCluster, data.PushToDb)
	if err != nil {
		log.Printf("Error processing data: %v", err)
		http.Error(w, fmt.Sprintf("Error processing data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

func processDataWithCluster(processedVars map[string][]string, chosenCluster cluster_endpoint_parser.ClusterInfo, pushToDb bool) (string, error) {
	var warnings []string
	var result strings.Builder

	clusterMap := chosenCluster.ConvertToMap()

	// Generate tenant name
	if len(processedVars["tenant_override"]) > 0 && processedVars["tenant_override"][0] != "" {
		processedVars["tenant"] = []string{processedVars["tenant_override"][0]}
	} else {
		tenantName, err := tenant_name_generation.GenerateTenantName(processedVars, clusterMap)
		if err != nil {
			return "", fmt.Errorf("error generating tenant name: %v", err)
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

	// Push to database if requested
	if pushToDb {
		err := postgresql_push.PushToDB(processedVars, clusterMap)
		if err != nil {
			return "", fmt.Errorf("failed to push to database: %v", err)
		}
		result.WriteString("\nData successfully pushed to database.")
	}

	return result.String(), nil
}
