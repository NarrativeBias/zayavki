package services

import (
	"context"
	"fmt"
	"strings"

	"github.com/NarrativeBias/zayavki/internal/models"
	"github.com/NarrativeBias/zayavki/internal/repositories"
	"github.com/NarrativeBias/zayavki/legacy/email_template"
	"github.com/NarrativeBias/zayavki/legacy/prep_db_table_data"
	"github.com/NarrativeBias/zayavki/legacy/rgw_commands"
	"github.com/NarrativeBias/zayavki/legacy/tenant_name_generation"
	"github.com/NarrativeBias/zayavki/legacy/variables_parser"
)

// TenantService handles business logic for tenant operations
type TenantService struct {
	tenantRepo  *repositories.TenantRepository
	clusterRepo *repositories.ClusterRepository
}

// NewTenantService creates a new tenant service
func NewTenantService(tenantRepo *repositories.TenantRepository, clusterRepo *repositories.ClusterRepository) *TenantService {
	return &TenantService{
		tenantRepo:  tenantRepo,
		clusterRepo: clusterRepo,
	}
}

// CreateTenant creates a new tenant with the given request
func (s *TenantService) CreateTenant(ctx context.Context, request *models.CreateTenantRequest) (string, error) {
	// Parse and process variables
	processedVars, err := variables_parser.ParseAndProcessVariables(convertRequestToMap(request))
	if err != nil {
		return "", fmt.Errorf("error processing variables: %v", err)
	}

	// Get cluster information
	cluster, err := s.clusterRepo.GetCluster(ctx, request.Segment, request.Environment)
	if err != nil {
		return "", fmt.Errorf("error finding cluster: %v", err)
	}

	// Convert cluster to map for easier handling
	clusterMap := cluster.ConvertToMap()

	// Process data with the cluster
	result, err := s.processDataWithCluster(ctx, processedVars, clusterMap, request.PushToDB)
	if err != nil {
		return "", err
	}

	return result, nil
}

// CheckTenantExists checks if a tenant already exists
func (s *TenantService) CheckTenantExists(ctx context.Context, segment, env, tenant string) error {
	results, err := s.tenantRepo.CheckForExistingEntries(ctx, segment, env, "", "", tenant, "", "", "")
	if err != nil {
		return fmt.Errorf("error checking database: %v", err)
	}

	if len(results) > 0 {
		return fmt.Errorf("tenant '%s' already exists in the database", tenant)
	}

	return nil
}

// CheckExistingEntries checks for existing entries in the database
func (s *TenantService) CheckExistingEntries(ctx context.Context, segment, env, risNumber, risName, cluster, tenant, bucket, user string) ([]models.CheckResult, error) {
	return s.tenantRepo.CheckForExistingEntries(ctx, segment, env, risNumber, risName, tenant, bucket, user, cluster)
}

// DeactivateResources deactivates tenant resources
func (s *TenantService) DeactivateResources(ctx context.Context, tenant string, users, buckets []string) (map[string]interface{}, error) {
	return s.tenantRepo.DeactivateResources(ctx, tenant, users, buckets)
}

// UpdateBucketQuotas updates bucket quotas
func (s *TenantService) UpdateBucketQuotas(ctx context.Context, tenant string, buckets []struct {
	Name string `json:"name"`
	Size string `json:"size"`
}) (map[string]interface{}, error) {
	return s.tenantRepo.UpdateBucketQuotas(ctx, tenant, buckets)
}

// processDataWithCluster processes tenant data with cluster information
func (s *TenantService) processDataWithCluster(ctx context.Context, variables map[string][]string, clusterMap map[string]string, pushToDb bool) (string, error) {
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

	// Check for existing tenant first
	if err := s.checkTenantExists(variables, clusterMap); err != nil {
		return "", err
	}

	// Set up tenant and users
	if err := s.setupTenantAndUsers(variables, clusterMap); err != nil {
		return "", err
	}

	if pushToDb {
		return s.pushToDatabase(ctx, variables, clusterMap)
	}

	return s.generateFullResult(variables, clusterMap)
}

// checkTenantExists checks if the tenant already exists
func (s *TenantService) checkTenantExists(processedVars map[string][]string, clusterMap map[string]string) error {
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
	results, err := s.tenantRepo.CheckForExistingEntries(
		context.Background(),
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

// setupTenantAndUsers sets up tenant and users
func (s *TenantService) setupTenantAndUsers(processedVars map[string][]string, _ map[string]string) error {
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

// pushToDatabase pushes data to the database
func (s *TenantService) pushToDatabase(ctx context.Context, processedVars map[string][]string, clusterMap map[string]string) (string, error) {
	var result strings.Builder

	// Get database push result
	dbResult, err := s.tenantRepo.PushToDB(ctx, processedVars, clusterMap)
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

// generateFullResult generates the full result without database operations
func (s *TenantService) generateFullResult(processedVars map[string][]string, clusterMap map[string]string) (string, error) {
	var result strings.Builder

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

// convertRequestToMap converts CreateTenantRequest to map[string][]string
func convertRequestToMap(request *models.CreateTenantRequest) map[string][]string {
	result := make(map[string][]string)

	if request.Tenant != "" {
		result["tenant"] = []string{request.Tenant}
	}
	if request.Segment != "" {
		result["segment"] = []string{request.Segment}
	}
	if request.Environment != "" {
		result["env"] = []string{request.Environment}
	}
	if request.Cluster != "" {
		result["cluster"] = []string{request.Cluster}
	}
	if len(request.Users) > 0 {
		result["users"] = request.Users
	}
	if len(request.Buckets) > 0 {
		result["bucketnames"] = request.Buckets
	}
	if len(request.BucketQuotas) > 0 {
		result["bucketquotas"] = request.BucketQuotas
	}
	if request.RisCode != "" {
		result["ris_code"] = []string{request.RisCode}
	}
	if request.RisID != "" {
		result["ris_id"] = []string{request.RisID}
	}
	if request.OwnerGroup != "" {
		result["resp_group"] = []string{request.OwnerGroup}
	}
	if request.OwnerPerson != "" {
		result["owner"] = []string{request.OwnerPerson}
	}

	if request.CreateTenant {
		result["create_tenant"] = []string{"true"}
	}
	if request.TenantOverride != "" {
		result["tenant_override"] = []string{request.TenantOverride}
	}
	if request.PushToDB {
		result["push_to_db"] = []string{"true"}
	}

	return result
}
