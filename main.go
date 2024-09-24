package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/NarrativeBias/zayavki/cluster_endpoint_parser"
	"github.com/NarrativeBias/zayavki/email_template"
	"github.com/NarrativeBias/zayavki/postgresql_push"
	"github.com/NarrativeBias/zayavki/rgw_commands"
	"github.com/NarrativeBias/zayavki/tenant_name_generation"
	"github.com/NarrativeBias/zayavki/validator"
	"github.com/NarrativeBias/zayavki/variables_parser"
	"github.com/NarrativeBias/zayavki/vtbox_table"
)

func main() {
	// Define flags
	helpFlag := flag.Bool("help", false, "Display all available options and help")
	dbPushFlag := flag.Bool("db_push", false, "Push result to DB")

	// Parse the flags
	flag.Parse()

	// Handle the --help flag
	if *helpFlag {
		fmt.Println("Usage: zayavki [OPTIONS]")
		fmt.Println("Options:")
		fmt.Println("  --help      Show this help message")
		fmt.Println("  --db_push   Push result to DB")
		os.Exit(0)
	}

	// Open the result.txt file in write mode
	resultFile, err := os.OpenFile("result.txt", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0644)
	if err != nil {
		fmt.Println("Error opening result.txt:", err)
		return
	}
	defer resultFile.Close()
	//Reading variables
	variables, err := variables_parser.ReadVariablesFromFile("request.txt")
	if err != nil {
		fmt.Println(err)
		return
	}

	cluster_info := "clusters.xlsx" // Filename with cluster information
	clusters, err := cluster_endpoint_parser.FindMatchingClusters(cluster_info, variables["segment"][0], variables["env"][0])
	if err != nil {
		fmt.Println("Error finding matching clusters:", err)
		return
	}
	chosenCluster, err := cluster_endpoint_parser.ChooseCluster(clusters)
	if err != nil {
		fmt.Println("Error choosing cluster:", err)
		return
	}
	fmt.Println(variables["tenant_override"][0])
	//generating tenant name
	if variables["tenant_override"][0] != "" {
		variables["tenant"] = []string{variables["tenant_override"][0]}
	} else {
		variables["tenant"] = []string{tenant_name_generation.GenerateTenantName(variables, chosenCluster)}
	}
	// checking if creating tenant is needed
	if variables["create_tenant"][0] == "true" {
		if len(variables["users"]) == 1 {
			variables["users"] = []string{variables["tenant"][0]}
		} else {
			variables["users"] = append([]string{variables["tenant"][0]}, variables["users"]...)
		}
	}
	//Sending variables through validator
	validationResult, validationError := validator.ValidateUsers(variables)
	if !validationResult {
		fmt.Fprintln(resultFile, "ValidateUsers:", validationError)
	}
	validationResult, validationError = validator.ValidateBuckets(variables)
	if !validationResult {
		fmt.Fprintln(resultFile, "ValidateBuckets:", validationError)
	}

	// Handle the --db_push flag
	if *dbPushFlag {
		fmt.Println("Database push mode enabled.")
		postgresql_push.PushToDB(variables, chosenCluster)

	} else {
		fmt.Println("Running in normal mode.")
		//Generating table rows for VTBox
		fmt.Fprintln(resultFile, "\n~~~~~~~Table of users and buckets to copy-paste into VTBox~~~~~~~")
		fmt.Fprintln(resultFile, vtbox_table.PopulateUsers(variables, chosenCluster))
		fmt.Fprintln(resultFile, vtbox_table.PopulateBuckets(variables, chosenCluster))
	}

	//Generating terminal commands
	fmt.Fprintln(resultFile, "\n~~~~~~~List of terminal commands for bucket and user creation~~~~~~~")
	fmt.Fprintln(resultFile, rgw_commands.BucketCreation(variables, chosenCluster))
	fmt.Fprintln(resultFile, rgw_commands.UserCreation(variables, chosenCluster))
	fmt.Fprintln(resultFile, rgw_commands.ResultCheck(variables, chosenCluster))

	//Generation of email template
	fmt.Fprintln(resultFile, "\n~~~~~~~Request closure + Email template~~~~~~~")
	email, err := email_template.PopulateEmailTemplate(variables, chosenCluster)
	if err != nil {
		fmt.Println("Error generating email template:", err)
		return
	}
	fmt.Fprintln(resultFile, email)
}
