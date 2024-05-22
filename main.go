package main

import (
	"fmt"
	"os"
	"zayavki/email_template"
	"zayavki/rgw_commands"
	"zayavki/validator"
	"zayavki/variables_parser"
	"zayavki/vtbox_table"
)

func main() {
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
	//Sending variables through validator
	validator.ValidateTenant(variables["tenant"][0], variables["env"][0])
	validator.ValidateUsers(variables)
	validator.ValidateBuckets(variables)

	//Generating table rows for VTBox
	fmt.Fprintln(resultFile, "\n~~~~~~~Table of users and buckets to copy-paste into VTBox~~~~~~~")
	fmt.Fprintln(resultFile, vtbox_table.PopulateUsers(variables))
	fmt.Fprintln(resultFile, vtbox_table.PopulateBuckets(variables))

	//Generating terminal commands
	fmt.Fprintln(resultFile, "\n~~~~~~~List of terminal commands for bucket and user creation~~~~~~~")
	fmt.Fprintln(resultFile, rgw_commands.BucketCreation(variables))
	fmt.Fprintln(resultFile, rgw_commands.UserCreation(variables))
	fmt.Fprintln(resultFile, rgw_commands.ResultCheck(variables))

	//Generation of email template
	fmt.Fprintln(resultFile, "\n~~~~~~~Request closure + Email template~~~~~~~")
	email, err := email_template.PopulateEmailTemplate(variables)
	if err != nil {
		fmt.Println("Error generating email template:", err)
		return
	}
	fmt.Fprintln(resultFile, email)
}
