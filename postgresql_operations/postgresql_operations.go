package postgresql_operations

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq" // PostgreSQL driver
)

type DBConfig struct {
	Host     string `json:"host"`
	Port     string `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbname"`
	Schema   string `json:"schema"`
	Table    string `json:"table"`
}

type CheckResult struct {
	ClsName     string         `json:"cluster"`
	NetSeg      string         `json:"segment"`
	Env         string         `json:"environment"`
	Realm       string         `json:"realm"`
	Tenant      string         `json:"tenant"`
	S3User      sql.NullString `json:"-"` // Using custom JSON marshaling
	Bucket      sql.NullString `json:"-"` // Using custom JSON marshaling
	Quota       sql.NullString `json:"-"` // Using custom JSON marshaling
	SdNum       string         `json:"sd_num"`
	SrNum       string         `json:"sr_num"`
	DoneDate    string         `json:"done_date"`
	RisCode     string         `json:"ris_code"`
	RisId       string         `json:"ris_id"`
	OwnerGroup  string         `json:"owner_group"`
	OwnerPerson string         `json:"owner"`
	Applicant   string         `json:"applicant"`
	Email       sql.NullString `json:"-"` // Using custom JSON marshaling
	CsppComment sql.NullString `json:"-"` // Using custom JSON marshaling
}

func (cr CheckResult) MarshalJSON() ([]byte, error) {
	type Alias CheckResult // prevent recursive marshaling

	return json.Marshal(&struct {
		Alias
		S3User      string `json:"user"`
		Bucket      string `json:"bucket"`
		Quota       string `json:"quota"`
		Email       string `json:"email"`
		CsppComment string `json:"cspp_comment"`
	}{
		Alias:       Alias(cr),
		S3User:      getStringValue(cr.S3User),
		Bucket:      getStringValue(cr.Bucket),
		Quota:       getStringValue(cr.Quota),
		Email:       getStringValue(cr.Email),
		CsppComment: getStringValue(cr.CsppComment),
	})
}

func getStringValue(ns sql.NullString) string {
	if !ns.Valid {
		return "-"
	}
	return ns.String
}

var (
	db     *sql.DB
	config DBConfig
)

func InitDB(configPath string) error {
	// Read the config file
	file, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// Parse the JSON into our DBConfig struct
	err = json.Unmarshal(file, &config)
	if err != nil {
		return fmt.Errorf("failed to parse config file: %v", err)
	}

	// Construct the connection string
	connStr := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
		config.Host, config.Port, config.User, config.Password, config.DBName)

	// Open the database connection
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		return fmt.Errorf("failed to open database connection: %v", err)
	}

	// Test the connection
	err = db.Ping()
	if err != nil {
		return fmt.Errorf("failed to ping database: %v", err)
	}

	return nil
}

func rowExists(tx *sql.Tx, schema, table string, params ...interface{}) (bool, error) {
	query := fmt.Sprintf(`
		SELECT EXISTS (
			SELECT 1 FROM %s.%s 
			WHERE cls_name = $1 AND net_seg = $2 AND env = $3 AND realm = $4 AND tenant = $5 
			AND s3_user = $6 AND bucket = $7
		)`, schema, table)

	var exists bool
	err := tx.QueryRow(query, params...).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("error checking row existence: %v", err)
	}
	return exists, nil
}

func CheckDBForExistingEntries(segment, env, risNumber, risName, clusterName string) ([]CheckResult, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection not initialized")
	}

	query := fmt.Sprintf(`
        SELECT 
            cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota,
            sd_num, sr_num, done_date, ris_code, ris_id, owner_group,
            owner_person, applicant, email, cspp_comment
        FROM %s.%s
        WHERE 1=1
    `, config.Schema, config.Table)

	args := make([]interface{}, 0)
	paramCount := 1

	// Build dynamic query based on provided parameters
	if segment != "" {
		query += fmt.Sprintf(" AND net_seg = $%d", paramCount)
		args = append(args, segment)
		paramCount++
	}
	if env != "" {
		query += fmt.Sprintf(" AND env = $%d", paramCount)
		args = append(args, env)
		paramCount++
	}
	if risNumber != "" {
		query += fmt.Sprintf(" AND ris_id = $%d", paramCount)
		args = append(args, risNumber)
		paramCount++
	}
	if risName != "" {
		query += fmt.Sprintf(" AND ris_code = $%d", paramCount)
		args = append(args, risName)
		paramCount++
	}
	if clusterName != "" {
		query += fmt.Sprintf(" AND cls_name = $%d", paramCount)
		args = append(args, clusterName)
	}

	// Add ordering for consistent results
	query += " ORDER BY done_date DESC, cls_name, tenant"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("error querying database: %v", err)
	}
	defer rows.Close()

	var results []CheckResult
	for rows.Next() {
		var result CheckResult
		err := rows.Scan(
			&result.ClsName,
			&result.NetSeg,
			&result.Env,
			&result.Realm,
			&result.Tenant,
			&result.S3User,
			&result.Bucket,
			&result.Quota,
			&result.SdNum,
			&result.SrNum,
			&result.DoneDate,
			&result.RisCode,
			&result.RisId,
			&result.OwnerGroup,
			&result.OwnerPerson,
			&result.Applicant,
			&result.Email,
			&result.CsppComment,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning row: %v", err)
		}

		results = append(results, result)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating over rows: %v", err)
	}

	return results, nil
}

func PushToDB(variables map[string][]string, clusters map[string]string) (string, error) {
	if db == nil {
		return "", fmt.Errorf("database connection not initialized")
	}

	// Start a transaction
	tx, err := db.Begin()
	if err != nil {
		return "", fmt.Errorf("failed to start transaction: %v", err)
	}
	defer tx.Rollback() // Rollback the transaction if it hasn't been committed

	// Prepare the SQL insert statement
	stmt, err := tx.Prepare(fmt.Sprintf(`INSERT INTO %s.%s
        (cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota, sd_num, sr_num, done_date, ris_code, ris_id, owner_group, owner_person, applicant, email, cspp_comment) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`, config.Schema, config.Table))
	if err != nil {
		return "", fmt.Errorf("failed to prepare SQL statement: %v", err)
	}
	defer stmt.Close()

	// Get current date
	done_date := time.Now().Format("2006-01-02 15:04:05")

	var duplicates []string

	// Check and collect duplicates for users
	for _, username := range variables["users"] {
		username = strings.ToLower(username)
		if username != "" {
			exists, err := rowExists(tx, config.Schema, config.Table,
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], username, "-")
			if err != nil {
				return "", fmt.Errorf("error checking row existence: %v", err)
			}
			if exists {
				duplicates = append(duplicates, fmt.Sprintf("user: %s", username))
			}
		}
	}

	// Check and collect duplicates for buckets
	for _, bucket := range variables["bucketnames"] {
		if bucket != "" {
			exists, err := rowExists(tx, config.Schema, config.Table,
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], "-", bucket)
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
	for _, username := range variables["users"] {
		username = strings.ToLower(username)
		if username != "" {
			_, err = stmt.Exec(
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], username, "-", "-",
				variables["request_id_sd"][0], variables["request_id_srt"][0],
				done_date, variables["ris_name"][0], variables["ris_number"][0],
				variables["resp_group"][0], variables["owner"][0], variables["requester"][0], variables["email"][0], "-",
			)
			if err != nil {
				return "", fmt.Errorf("failed to insert row for user %s: %v", username, err)
			}
			insertedUsers = append(insertedUsers, username)
		}
	}

	for i, bucket := range variables["bucketnames"] {
		if bucket != "" {
			_, err = stmt.Exec(
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], "-", bucket, variables["bucketquotas"][i],
				variables["request_id_sd"][0], variables["request_id_srt"][0],
				done_date, variables["ris_name"][0], variables["ris_number"][0],
				variables["resp_group"][0], variables["owner"][0], variables["requester"][0], "-", "-",
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
		variables["tenant"][0],
		strings.Join(insertedUsers, ", "),
		strings.Join(insertedBuckets, ", "))

	return result, nil
}

// CloseDB closes the database connection
func CloseDB() error {
	if db != nil {
		err := db.Close()
		db = nil
		return err
	}
	return nil
}
