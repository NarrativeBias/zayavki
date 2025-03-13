package postgresql_operations

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/NarrativeBias/zayavki/cluster_endpoint_parser"
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
	SrtNum      string         `json:"srt_num"`
	DoneDate    string         `json:"done_date"`
	RisCode     string         `json:"ris_code"`
	RisId       string         `json:"ris_id"`
	OwnerGroup  string         `json:"owner_group"`
	OwnerPerson string         `json:"owner"`
	Applicant   string         `json:"applicant"`
	Email       sql.NullString `json:"-"` // Using custom JSON marshaling
	CsppComment sql.NullString `json:"-"` // Using custom JSON marshaling
	Active      bool           `json:"active"`
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

type TenantInfo struct {
	ClsName      string `json:"cls_name"`
	NetSeg       string `json:"net_seg"`
	Env          string `json:"env"`
	Realm        string `json:"realm"`
	RisCode      string `json:"ris_code"`
	RisId        string `json:"ris_id"`
	OwnerGroup   string `json:"owner_group"`
	OwnerPerson  string `json:"owner_person"`
	SrtNum       string `json:"srt_num"`
	TlsEndpoint  string `json:"tls_endpoint"`
	MtlsEndpoint string `json:"mtls_endpoint"`
	Tenant       string `json:"tenant"`
}

var (
	db     *sql.DB
	config DBConfig
	DB     *sql.DB
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

	DB = db // Assign to the public DB variable
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

func CheckDBForExistingEntries(segment, env, risNumber, risName, tenant, bucket, user, clusterName string) ([]CheckResult, error) {
	if db == nil {
		return nil, fmt.Errorf("database connection not initialized")
	}

	query := fmt.Sprintf(`
        SELECT DISTINCT 
            cls_name, net_seg, env, realm, tenant, 
            s3_user, bucket, quota, sd_num, srt_num, 
            done_date, ris_code, ris_id, owner_group, 
            owner_person, applicant, email, cspp_comment,
            active
        FROM %s.%s
        WHERE ($1 = '' OR net_seg = $1)
        AND ($2 = '' OR env = $2)
        AND ($3 = '' OR ris_id = $3)
        AND ($4 = '' OR ris_code = $4)
        AND ($5 = '' OR tenant = $5)
        AND ($6 = '' OR bucket = $6)
        AND ($7 = '' OR s3_user = $7)
        AND ($8 = '' OR cls_name = $8)
        ORDER BY done_date DESC`, config.Schema, config.Table)

	rows, err := db.Query(query, segment, env, risNumber, risName, tenant, bucket, user, clusterName)
	if err != nil {
		return nil, fmt.Errorf("error executing query: %v", err)
	}
	defer rows.Close()

	var results []CheckResult
	for rows.Next() {
		var result CheckResult
		err := rows.Scan(
			&result.ClsName, &result.NetSeg, &result.Env, &result.Realm,
			&result.Tenant, &result.S3User, &result.Bucket, &result.Quota,
			&result.SdNum, &result.SrtNum, &result.DoneDate, &result.RisCode,
			&result.RisId, &result.OwnerGroup, &result.OwnerPerson,
			&result.Applicant, &result.Email, &result.CsppComment, &result.Active,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning row: %v", err)
		}
		results = append(results, result)
	}

	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating rows: %v", err)
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
        (cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota, sd_num, srt_num, done_date, ris_code, ris_id, owner_group, owner_person, applicant, email, cspp_comment) 
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
				variables["resp_group"][0],
				fmt.Sprintf("%s; %s", variables["owner"][0], variables["zam_owner"][0]),
				variables["requester"][0], variables["email"][0], "-",
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
				variables["resp_group"][0],
				fmt.Sprintf("%s; %s", variables["owner"][0], variables["zam_owner"][0]),
				variables["requester"][0], "-", "-",
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

func GetTenantInfo(tenant string) (*TenantInfo, error) {
	query := fmt.Sprintf(`
        SELECT DISTINCT cls_name, net_seg, env, realm, ris_code, ris_id, owner_group, owner_person, srt_num
        FROM %s.%s
        WHERE tenant = $1 AND s3_user = $1
        LIMIT 1`, config.Schema, config.Table)

	var result TenantInfo
	err := db.QueryRow(query, tenant).Scan(
		&result.ClsName, &result.NetSeg, &result.Env, &result.Realm,
		&result.RisCode, &result.RisId, &result.OwnerGroup, &result.OwnerPerson,
		&result.SrtNum,
	)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("tenant not found")
	}
	if err != nil {
		return nil, fmt.Errorf("database error: %v", err)
	}

	// Get matching clusters
	clusters, err := cluster_endpoint_parser.FindMatchingClusters("clusters.xlsx", result.NetSeg, result.Env)
	if err != nil {
		return nil, fmt.Errorf("error finding clusters: %v", err)
	}

	// Find the cluster that matches our cls_name
	for _, cluster := range clusters {
		if cluster.Кластер == result.ClsName {
			result.TlsEndpoint = cluster.TLSEndpoint
			result.MtlsEndpoint = cluster.MTLSEndpoint
			break
		}
	}

	// Add tenant to the result
	result.Tenant = tenant

	return &result, nil
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
