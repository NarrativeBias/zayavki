package postgresql_push

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
}

var db *sql.DB

func InitDB(configPath string) error {
	// Read the config file
	file, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %v", err)
	}

	// Parse the JSON into our DBConfig struct
	var config DBConfig
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

func PushToDB(variables map[string][]string, clusters map[string]string) error {
	if db == nil {
		return fmt.Errorf("database connection not initialized")
	}

	// Prepare the SQL insert statement
	stmt, err := db.Prepare(`INSERT INTO sds.simple_cspp_clients
        (cls_name, net_seg, env, realm, tenant, s3_user, bucket, quota, sd_num, sr_num, done_date, ris_code, ris_id, owner_group, owner_person, applicant, email, cspp_comment) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`)
	if err != nil {
		return fmt.Errorf("failed to prepare SQL statement: %v", err)
	}
	defer stmt.Close()

	// Get current date
	done_date := time.Now().Format("02.01.2006") // Format: DD-MM-YYYY

	// Loop through the users and insert into the database
	for _, username := range variables["users"] {
		username = strings.ToLower(username)
		if username != "" {
			// Execute the prepared statement for each user
			_, err := stmt.Exec(
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], username, "-", "-",
				variables["request_id_sd"][0], variables["request_id_sr"][0],
				done_date, variables["ris_name"][0], variables["ris_code"][0],
				variables["resp_group"][0], variables["owner"][0], variables["requester"][0], variables["email"][0], "-",
			)
			if err != nil {
				return fmt.Errorf("failed to insert row for user %s: %v", username, err)
			}
		}
	}

	// Loop through the buckets and insert into the database
	for i, bucket := range variables["bucketnames"] {
		if bucket != "" {
			// Execute the prepared statement for each bucket
			_, err := stmt.Exec(
				clusters["Кластер"], variables["segment"][0], variables["env"][0],
				clusters["Реалм"], variables["tenant"][0], "-", bucket, variables["bucketquotas"][i],
				variables["request_id_sd"][0], variables["request_id_sr"][0],
				done_date, variables["ris_name"][0], variables["ris_code"][0],
				variables["resp_group"][0], variables["owner"][0], variables["requester"][0], "-", "-",
			)
			if err != nil {
				return fmt.Errorf("failed to insert row for bucket %s: %v", bucket, err)
			}
		}
	}

	return nil
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
