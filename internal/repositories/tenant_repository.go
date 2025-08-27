package repositories

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/NarrativeBias/zayavki/internal/models"
)

// TenantRepository handles database operations for tenants
type TenantRepository struct {
	db     *sql.DB
	schema string
	table  string
}

// NewTenantRepository creates a new tenant repository
func NewTenantRepository(db *sql.DB, schema, table string) *TenantRepository {
	return &TenantRepository{
		db:     db,
		schema: schema,
		table:  table,
	}
}

// CheckForExistingEntries checks the database for existing entries
func (r *TenantRepository) CheckForExistingEntries(ctx context.Context, segment, env, risNumber, risName, tenant, bucket, user, cluster string) ([]models.CheckResult, error) {
	query := fmt.Sprintf(`
		SELECT 
			cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota,
			sd_num, srt_num, done_date, ris_code, ris_id, owner_group, owner_person,
			applicant, email, cspp_comment, active
		FROM %s.%s 
		WHERE 1=1
	`, r.schema, r.table)

	var args []interface{}
	var conditions []string
	argCount := 1

	if segment != "" {
		conditions = append(conditions, fmt.Sprintf("net_seg = $%d", argCount))
		args = append(args, segment)
		argCount++
	}
	if env != "" {
		conditions = append(conditions, fmt.Sprintf("env = $%d", argCount))
		args = append(args, env)
		argCount++
	}
	if risNumber != "" {
		conditions = append(conditions, fmt.Sprintf("ris_code = $%d", argCount))
		args = append(args, risNumber)
		argCount++
	}
	if risName != "" {
		conditions = append(conditions, fmt.Sprintf("ris_id = $%d", argCount))
		args = append(args, risName)
		argCount++
		log.Printf("DEBUG: Adding risName condition: ris_id = $%d with value: %s", argCount-1, risName)
	}
	if tenant != "" {
		conditions = append(conditions, fmt.Sprintf("tenant = $%d", argCount))
		args = append(args, tenant)
		argCount++
	}
	if bucket != "" {
		conditions = append(conditions, fmt.Sprintf("bucket = $%d", argCount))
		args = append(args, bucket)
		argCount++
	}
	if user != "" {
		conditions = append(conditions, fmt.Sprintf("s3_user = $%d", argCount))
		args = append(args, user)
		argCount++
	}
	if cluster != "" {
		conditions = append(conditions, fmt.Sprintf("cls_name = $%d", argCount))
		args = append(args, cluster)
		argCount++
	}

	if len(conditions) > 0 {
		query += " AND " + strings.Join(conditions, " AND ")
	}

	log.Printf("DEBUG: Final query: %s", query)
	log.Printf("DEBUG: Query args: %v", args)

	// First, let's check what data exists in the table for debugging
	if len(args) == 0 {
		debugQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s.%s", r.schema, r.table)
		var count int
		err := r.db.QueryRowContext(ctx, debugQuery).Scan(&count)
		if err != nil {
			log.Printf("DEBUG: Error checking table count: %v", err)
		} else {
			log.Printf("DEBUG: Table %s.%s contains %d rows", r.schema, r.table, count)
		}

		// Also check a few sample rows
		sampleQuery := fmt.Sprintf("SELECT * FROM %s.%s LIMIT 3", r.schema, r.table)
		sampleRows, err := r.db.QueryContext(ctx, sampleQuery)
		if err != nil {
			log.Printf("DEBUG: Error getting sample rows: %v", err)
		} else {
			defer sampleRows.Close()
			log.Printf("DEBUG: Sample rows structure:")
			columns, _ := sampleRows.Columns()
			log.Printf("DEBUG: Columns: %v", columns)
		}
	}

	// Check if the specific search column exists and has data
	if risName != "" {
		checkQuery := fmt.Sprintf("SELECT COUNT(*) FROM %s.%s WHERE ris_id = $1", r.schema, r.table)
		var count int
		err := r.db.QueryRowContext(ctx, checkQuery, risName).Scan(&count)
		if err != nil {
			log.Printf("DEBUG: Error checking ris_id column: %v", err)
		} else {
			log.Printf("DEBUG: Found %d rows with ris_id = '%s'", count, risName)
		}
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query database: %v", err)
	}
	defer rows.Close()

	var results []models.CheckResult
	for rows.Next() {
		var result models.CheckResult
		err := rows.Scan(
			&result.ClsName, &result.NetSeg, &result.Env, &result.Realm, &result.Tenant,
			&result.S3User, &result.Bucket, &result.Quota, &result.SdNum, &result.SrtNum,
			&result.DoneDate, &result.RisCode, &result.RisId, &result.OwnerGroup,
			&result.OwnerPerson, &result.Applicant, &result.Email, &result.CsppComment, &result.Active,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan row: %v", err)
		}
		results = append(results, result)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %v", err)
	}

	return results, nil
}

// PushToDB pushes tenant data to the database
func (r *TenantRepository) PushToDB(ctx context.Context, processedVars map[string][]string, clusterMap map[string]string) (string, error) {
	// Start a transaction
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return "", fmt.Errorf("failed to start transaction: %v", err)
	}
	defer tx.Rollback() // Rollback the transaction if it hasn't been committed

	// Prepare the SQL insert statement
	stmt, err := tx.PrepareContext(ctx, fmt.Sprintf(`INSERT INTO %s.%s
        (cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota, sd_num, srt_num, done_date, ris_code, ris_id, owner_group, owner_person, applicant, email, cspp_comment, active) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`, r.schema, r.table))
	if err != nil {
		return "", fmt.Errorf("failed to prepare SQL statement: %v", err)
	}
	defer stmt.Close()

	// Get current date
	done_date := time.Now().Format("2006-01-02 15:04:05")

	var duplicates []string

	// Check and collect duplicates for users
	for _, username := range processedVars["users"] {
		username = strings.ToLower(username)
		if username != "" {
			exists, err := r.rowExists(ctx, tx, r.schema, r.table,
				clusterMap["Кластер"], processedVars["segment"][0], processedVars["env"][0],
				clusterMap["Реалм"], processedVars["tenant"][0], username, "-")
			if err != nil {
				return "", fmt.Errorf("error checking row existence: %v", err)
			}
			if exists {
				duplicates = append(duplicates, fmt.Sprintf("user: %s", username))
			}
		}
	}

	// Check and collect duplicates for buckets
	for _, bucket := range processedVars["bucketnames"] {
		if bucket != "" {
			exists, err := r.rowExists(ctx, tx, r.schema, r.table,
				clusterMap["Кластер"], processedVars["segment"][0], processedVars["env"][0],
				clusterMap["Реалм"], processedVars["tenant"][0], "-", bucket)
			if err != nil {
				return "", fmt.Errorf("error checking row existence: %v", err)
			}
			if exists {
				duplicates = append(duplicates, fmt.Sprintf("bucket: %s", bucket))
			}
		}
	}

	// If duplicates were found, return an error with the list
	if len(duplicates) > 0 {
		return "", fmt.Errorf("the following entries already exist: %s", strings.Join(duplicates, ", "))
	}

	insertedUsers := []string{}
	insertedBuckets := []string{}

	// If no duplicates, proceed with insertion
	for _, username := range processedVars["users"] {
		username = strings.ToLower(username)
		if username != "" {
			// Get default values for missing fields
			risName := getValueOrDefault(processedVars, "ris_name", "")
			risNumber := getValueOrDefault(processedVars, "ris_number", "")
			respGroup := getValueOrDefault(processedVars, "resp_group", "")
			owner := getValueOrDefault(processedVars, "owner", "")
			requester := getValueOrDefault(processedVars, "requester", "")
			email := getValueOrDefault(processedVars, "email", "")
			requestIdSd := getValueOrDefault(processedVars, "request_id_sd", "")
			requestIdSrt := getValueOrDefault(processedVars, "request_id_srt", "")

			_, err = stmt.ExecContext(ctx,
				clusterMap["Кластер"], processedVars["segment"][0], processedVars["env"][0],
				clusterMap["Реалм"], processedVars["tenant"][0], username, "-", "-",
				requestIdSd, requestIdSrt, done_date, risName, risNumber,
				respGroup, owner, requester, email, "-", true,
			)
			if err != nil {
				return "", fmt.Errorf("failed to insert row for user %s: %v", username, err)
			}
			insertedUsers = append(insertedUsers, username)
		}
	}

	for i, bucket := range processedVars["bucketnames"] {
		if bucket != "" {
			// Get default values for missing fields
			risName := getValueOrDefault(processedVars, "ris_name", "")
			risNumber := getValueOrDefault(processedVars, "ris_number", "")
			respGroup := getValueOrDefault(processedVars, "resp_group", "")
			owner := getValueOrDefault(processedVars, "owner", "")
			requester := getValueOrDefault(processedVars, "requester", "")
			requestIdSd := getValueOrDefault(processedVars, "request_id_sd", "")
			requestIdSrt := getValueOrDefault(processedVars, "request_id_srt", "")

			quota := "-"
			if i < len(processedVars["bucketquotas"]) {
				quota = processedVars["bucketquotas"][i]
			}

			_, err = stmt.ExecContext(ctx,
				clusterMap["Кластер"], processedVars["segment"][0], processedVars["env"][0],
				clusterMap["Реалм"], processedVars["tenant"][0], "-", bucket, quota,
				requestIdSd, requestIdSrt, done_date, risName, risNumber,
				respGroup, owner, requester, "-", "-", true,
			)
			if err != nil {
				return "", fmt.Errorf("failed to insert row for bucket %s: %v", bucket, err)
			}
			insertedBuckets = append(insertedBuckets, bucket)
		}
	}

	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return "", fmt.Errorf("failed to commit transaction: %v", err)
	}

	result := fmt.Sprintf("Successfully pushed to database:\nTenant: %s\nInserted users: %s\nInserted buckets: %s",
		processedVars["tenant"][0],
		strings.Join(insertedUsers, ", "),
		strings.Join(insertedBuckets, ", "))

	return result, nil
}

// DeactivateResources deactivates tenant resources in the database
func (r *TenantRepository) DeactivateResources(ctx context.Context, tenant string, users, buckets []string) (map[string]interface{}, error) {
	result := map[string]interface{}{
		"tenant":  tenant,
		"users":   make([]map[string]interface{}, 0),
		"buckets": make([]map[string]interface{}, 0),
	}

	// Deactivate users
	for _, user := range users {
		query := fmt.Sprintf(`UPDATE %s.%s SET active = false WHERE s3_user = $1`, r.schema, r.table)
		_, err := r.db.ExecContext(ctx, query, user)
		if err != nil {
			return nil, fmt.Errorf("failed to deactivate user %s: %v", user, err)
		}

		result["users"] = append(result["users"].([]map[string]interface{}), map[string]interface{}{
			"name":   user,
			"status": "deactivated",
		})
	}

	// Deactivate buckets
	for _, bucket := range buckets {
		bucketName := strings.Split(bucket, "|")[0]
		bucketName = strings.TrimSpace(bucketName)

		query := fmt.Sprintf(`UPDATE %s.%s SET active = false WHERE bucket = $1`, r.schema, r.table)
		_, err := r.db.ExecContext(ctx, query, bucketName)
		if err != nil {
			return nil, fmt.Errorf("failed to deactivate bucket %s: %v", bucketName, err)
		}

		result["buckets"] = append(result["buckets"].([]map[string]interface{}), map[string]interface{}{
			"name":   bucketName,
			"status": "deactivated",
		})
	}

	return result, nil
}

// UpdateBucketQuotas updates bucket quotas in the database
func (r *TenantRepository) UpdateBucketQuotas(ctx context.Context, tenant string, buckets []struct {
	Name string `json:"name"`
	Size string `json:"size"`
}) (map[string]interface{}, error) {
	result := map[string]interface{}{
		"tenant":  tenant,
		"buckets": make([]map[string]interface{}, 0),
	}

	for _, bucket := range buckets {
		query := fmt.Sprintf(`UPDATE %s.%s SET quota = $1 WHERE bucket = $2 AND tenant = $3`, r.schema, r.table)
		_, err := r.db.ExecContext(ctx, query, bucket.Size, bucket.Name, tenant)
		if err != nil {
			return nil, fmt.Errorf("failed to update bucket %s quota: %v", bucket.Name, err)
		}

		result["buckets"] = append(result["buckets"].([]map[string]interface{}), map[string]interface{}{
			"name":   bucket.Name,
			"quota":  bucket.Size,
			"status": "updated",
		})
	}

	return result, nil
}

// rowExists checks if a row exists in the database
func (r *TenantRepository) rowExists(ctx context.Context, tx *sql.Tx, schema, table string, params ...interface{}) (bool, error) {
	query := fmt.Sprintf(`
		SELECT EXISTS (
			SELECT 1 FROM %s.%s 
			WHERE cls_name = $1 AND net_seg = $2 AND env = $3 AND realm = $4 AND tenant = $5 
			AND s3_user = $6 AND bucket = $7
		)`, schema, table)

	var exists bool
	err := tx.QueryRowContext(ctx, query, params...).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("error checking row existence: %v", err)
	}
	return exists, nil
}

// getValueOrDefault gets a value from the map or returns a default
func getValueOrDefault(m map[string][]string, key, defaultValue string) string {
	if vals, ok := m[key]; ok && len(vals) > 0 {
		return vals[0]
	}
	return defaultValue
}
