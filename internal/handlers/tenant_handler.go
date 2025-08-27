package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/NarrativeBias/zayavki/internal/models"
	"github.com/NarrativeBias/zayavki/internal/services"
)

// TenantHandler handles HTTP requests for tenant operations
type TenantHandler struct {
	tenantService *services.TenantService
}

// NewTenantHandler creates a new tenant handler
func NewTenantHandler(tenantService *services.TenantService) *TenantHandler {
	return &TenantHandler{
		tenantService: tenantService,
	}
}

// HandleSubmit handles the main tenant submission endpoint
func (h *TenantHandler) HandleSubmit(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	err := r.ParseMultipartForm(10 << 20)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Convert form data to CreateTenantRequest
	request := h.convertFormToRequest(r.MultipartForm.Value)

	// Create tenant
	result, err := h.tenantService.CreateTenant(r.Context(), request)
	if err != nil {
		h.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

// HandleClusterSelection handles cluster selection after multiple clusters are found
func (h *TenantHandler) HandleClusterSelection(w http.ResponseWriter, r *http.Request) {
	var requestData struct {
		ProcessedVars   map[string][]string `json:"processedVars"`
		SelectedCluster map[string]string   `json:"selectedCluster"`
		PushToDb        bool                `json:"pushToDb"`
	}

	if err := json.NewDecoder(r.Body).Decode(&requestData); err != nil {
		http.Error(w, fmt.Sprintf("Error parsing request: %v", err), http.StatusBadRequest)
		return
	}

	// Convert to CreateTenantRequest
	request := h.convertMapToRequest(requestData.ProcessedVars)
	request.PushToDB = requestData.PushToDb

	// Create a temporary request to process the data
	tempRequest := h.convertMapToRequest(requestData.ProcessedVars)
	tempRequest.PushToDB = requestData.PushToDb

	// Process the data
	result, err := h.tenantService.CreateTenant(r.Context(), tempRequest)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error processing data: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.Write([]byte(result))
}

// HandleCheck handles checking for existing entries
func (h *TenantHandler) HandleCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.jsonError(w, "Method not allowed", http.StatusMethodNotAllowed)
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
		h.jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	results, err := h.tenantService.CheckExistingEntries(
		r.Context(),
		checkData.Segment,
		checkData.Env,
		checkData.RisNumber,
		checkData.RisName,
		checkData.Cluster,
		checkData.Tenant,
		checkData.Bucket,
		checkData.User,
	)
	if err != nil {
		h.jsonError(w, fmt.Sprintf("Error checking database: %v", err), http.StatusInternalServerError)
		return
	}

	response := struct {
		Results []models.CheckResult `json:"results"`
	}{
		Results: results,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// HandleCheckTenantResources handles checking tenant resources
func (h *TenantHandler) HandleCheckTenantResources(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Tenant  string   `json:"tenant"`
		Users   []string `json:"users"`
		Buckets []string `json:"buckets"`
		Mode    string   `json:"mode"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get all entries for this tenant
	results, err := h.tenantService.CheckExistingEntries(
		r.Context(),
		"", "", "", "", "", request.Tenant, "", "",
	)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error checking database: %v", err), http.StatusInternalServerError)
		return
	}

	if len(results) == 0 {
		http.Error(w, "Tenant not found", http.StatusNotFound)
		return
	}

	// Find the row where s3_user equals tenant
	var tenantInfo *models.CheckResult
	for _, result := range results {
		if result.S3User.Valid && result.S3User.String == request.Tenant {
			tenantInfo = &result
			break
		}
	}

	if tenantInfo == nil {
		http.Error(w, "Tenant info not found", http.StatusNotFound)
		return
	}

	result := map[string]interface{}{
		"tenant": map[string]string{
			"name":        request.Tenant,
			"cluster":     tenantInfo.ClsName,
			"env":         tenantInfo.Env,
			"segment":     tenantInfo.NetSeg,
			"realm":       tenantInfo.Realm,
			"ris_code":    tenantInfo.RisCode,
			"ris_id":      tenantInfo.RisId,
			"owner_group": tenantInfo.OwnerGroup,
			"owner":       tenantInfo.OwnerPerson,
		},
		"users":   make([]map[string]interface{}, 0),
		"buckets": make([]map[string]interface{}, 0),
	}

	// Check users if any provided
	for _, user := range request.Users {
		var userInfo *models.CheckResult
		for _, entry := range results {
			if entry.S3User.Valid && entry.S3User.String == user {
				userInfo = &entry
				break
			}
		}
		result["users"] = append(result["users"].([]map[string]interface{}), map[string]interface{}{
			"name":   user,
			"exists": userInfo != nil,
			"status": h.getUserStatusFromResult(userInfo),
		})
	}

	// Check buckets if any provided
	for _, bucket := range request.Buckets {
		bucketName := strings.Split(bucket, "|")[0]
		bucketName = strings.TrimSpace(bucketName)
		var bucketInfo *models.CheckResult
		for _, entry := range results {
			if entry.Bucket.Valid && entry.Bucket.String == bucketName {
				bucketInfo = &entry
				break
			}
		}
		result["buckets"] = append(result["buckets"].([]map[string]interface{}), map[string]interface{}{
			"name":   bucketName,
			"exists": bucketInfo != nil,
			"size":   h.getBucketSizeFromResult(bucketInfo),
			"status": h.getBucketStatusFromResult(bucketInfo),
		})
	}

	// Add appropriate commands based on mode
	if request.Mode == "create" {
		// Generate creation commands
		vars := map[string][]string{
			"tenant":         {request.Tenant},
			"users":          request.Users,
			"request_id_srt": {tenantInfo.SrtNum},
			"resp_group":     {tenantInfo.OwnerGroup},
			"owner":          {tenantInfo.OwnerPerson},
		}

		// Split buckets and their quotas
		var bucketNames, bucketQuotas []string
		for _, bucket := range request.Buckets {
			parts := strings.Split(bucket, "|")
			name := strings.TrimSpace(parts[0])
			quota := "0"
			if len(parts) > 1 {
				quota = strings.TrimSpace(parts[1])
			}
			bucketNames = append(bucketNames, name)
			bucketQuotas = append(bucketQuotas, quota)
		}
		vars["bucketnames"] = bucketNames
		vars["bucketquotas"] = bucketQuotas

		// Import the rgw_commands package to generate commands
		// This is a placeholder - you'll need to implement the actual command generation
		result["creation_commands"] = "Commands would be generated here"
	} else if request.Mode == "quota" {
		result["commands"] = "Quota commands would be generated here"
	} else {
		result["deletion_commands"] = "Deletion commands would be generated here"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleDeactivateResources handles deactivating tenant resources
func (h *TenantHandler) HandleDeactivateResources(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Tenant  string   `json:"tenant"`
		Users   []string `json:"users"`
		Buckets []string `json:"buckets"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Check if tenant is provided
	if request.Tenant == "" {
		http.Error(w, "Tenant name is required", http.StatusBadRequest)
		return
	}

	// Deactivate resources in database
	result, err := h.tenantService.DeactivateResources(r.Context(), request.Tenant, request.Users, request.Buckets)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error deactivating resources: %v", err), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// HandleUpdateBucketQuotas handles updating bucket quotas
func (h *TenantHandler) HandleUpdateBucketQuotas(w http.ResponseWriter, r *http.Request) {
	var request struct {
		Tenant  string `json:"tenant"`
		Buckets []struct {
			Name string `json:"name"`
			Size string `json:"size"`
		} `json:"buckets"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		h.jsonError(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Update bucket quotas in the database
	result, err := h.tenantService.UpdateBucketQuotas(r.Context(), request.Tenant, request.Buckets)
	if err != nil {
		h.jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// Helper methods
func (h *TenantHandler) convertFormToRequest(form map[string][]string) *models.CreateTenantRequest {
	request := &models.CreateTenantRequest{}

	if vals, ok := form["tenant"]; ok && len(vals) > 0 {
		request.Tenant = vals[0]
	}
	if vals, ok := form["segment"]; ok && len(vals) > 0 {
		request.Segment = vals[0]
	}
	if vals, ok := form["env"]; ok && len(vals) > 0 {
		request.Environment = vals[0]
	}
	if vals, ok := form["cluster"]; ok && len(vals) > 0 {
		request.Cluster = vals[0]
	}
	if vals, ok := form["users"]; ok {
		request.Users = vals
	}
	if vals, ok := form["bucketnames"]; ok {
		request.Buckets = vals
	}
	if vals, ok := form["bucketquotas"]; ok {
		request.BucketQuotas = vals
	}
	if vals, ok := form["ris_code"]; ok && len(vals) > 0 {
		request.RisCode = vals[0]
	}
	if vals, ok := form["ris_id"]; ok && len(vals) > 0 {
		request.RisID = vals[0]
	}
	if vals, ok := form["resp_group"]; ok && len(vals) > 0 {
		request.OwnerGroup = vals[0]
	}
	if vals, ok := form["owner"]; ok && len(vals) > 0 {
		request.OwnerPerson = vals[0]
	}
	if vals, ok := form["create_tenant"]; ok && len(vals) > 0 {
		request.CreateTenant = vals[0] == "true"
	}
	if vals, ok := form["tenant_override"]; ok && len(vals) > 0 {
		request.TenantOverride = vals[0]
	}
	if vals, ok := form["push_to_db"]; ok && len(vals) > 0 {
		request.PushToDB = vals[0] == "true"
	}

	return request
}

func (h *TenantHandler) convertMapToRequest(data map[string][]string) *models.CreateTenantRequest {
	request := &models.CreateTenantRequest{}

	if vals, ok := data["tenant"]; ok && len(vals) > 0 {
		request.Tenant = vals[0]
	}
	if vals, ok := data["segment"]; ok && len(vals) > 0 {
		request.Segment = vals[0]
	}
	if vals, ok := data["env"]; ok && len(vals) > 0 {
		request.Environment = vals[0]
	}
	if vals, ok := data["cluster"]; ok && len(vals) > 0 {
		request.Cluster = vals[0]
	}
	if vals, ok := data["users"]; ok {
		request.Users = vals
	}
	if vals, ok := data["bucketnames"]; ok {
		request.Buckets = vals
	}
	if vals, ok := data["bucketquotas"]; ok {
		request.BucketQuotas = vals
	}
	if vals, ok := data["ris_code"]; ok && len(vals) > 0 {
		request.RisCode = vals[0]
	}
	if vals, ok := data["ris_id"]; ok && len(vals) > 0 {
		request.RisID = vals[0]
	}
	if vals, ok := data["resp_group"]; ok && len(vals) > 0 {
		request.OwnerGroup = vals[0]
	}
	if vals, ok := data["owner"]; ok && len(vals) > 0 {
		request.OwnerPerson = vals[0]
	}
	if vals, ok := data["create_tenant"]; ok && len(vals) > 0 {
		request.CreateTenant = vals[0] == "true"
	}
	if vals, ok := data["tenant_override"]; ok && len(vals) > 0 {
		request.TenantOverride = vals[0]
	}
	if vals, ok := data["push_to_db"]; ok && len(vals) > 0 {
		request.PushToDB = vals[0] == "true"
	}

	return request
}

func (h *TenantHandler) handleError(w http.ResponseWriter, err error) {
	// Check for specific error types and handle accordingly
	if strings.HasPrefix(err.Error(), "no matching clusters found") {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	if err.Error() == "multiple clusters found" {
		// This should be handled differently in the new architecture
		http.Error(w, "Multiple clusters found - use cluster selection endpoint", http.StatusConflict)
		return
	}

	http.Error(w, err.Error(), http.StatusInternalServerError)
}

func (h *TenantHandler) jsonError(w http.ResponseWriter, message string, code int) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func (h *TenantHandler) getBucketSizeFromResult(info *models.CheckResult) string {
	if info == nil || !info.Quota.Valid {
		return "-"
	}
	return info.Quota.String
}

func (h *TenantHandler) getBucketStatusFromResult(info *models.CheckResult) string {
	if info == nil {
		return "Не найден"
	}
	if info.Active {
		return "Активен"
	}
	return "Не активен"
}

func (h *TenantHandler) getUserStatusFromResult(info *models.CheckResult) string {
	if info == nil {
		return "Не найден"
	}
	if info.Active {
		return "Активен"
	}
	return "Не активен"
}
