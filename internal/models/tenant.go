package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

// Tenant represents a tenant in the system
type Tenant struct {
	ID          int64     `json:"id,omitempty"`
	Name        string    `json:"name" validate:"required,min=3,max=50"`
	Segment     string    `json:"segment" validate:"required"`
	Environment string    `json:"environment" validate:"required"`
	Cluster     string    `json:"cluster" validate:"required"`
	Realm       string    `json:"realm" validate:"required"`
	RisCode     string    `json:"ris_code,omitempty"`
	RisID       string    `json:"ris_id,omitempty"`
	OwnerGroup  string    `json:"owner_group,omitempty"`
	OwnerPerson string    `json:"owner_person,omitempty"`
	Active      bool      `json:"active"`
	CreatedAt   time.Time `json:"created_at,omitempty"`
	UpdatedAt   time.Time `json:"updated_at,omitempty"`
}

// TenantUser represents a user associated with a tenant
type TenantUser struct {
	ID       int64  `json:"id,omitempty"`
	TenantID int64  `json:"tenant_id"`
	Username string `json:"username" validate:"required"`
	Active   bool   `json:"active"`
}

// TenantBucket represents a bucket associated with a tenant
type TenantBucket struct {
	ID       int64  `json:"id,omitempty"`
	TenantID int64  `json:"tenant_id"`
	Name     string `json:"name" validate:"required"`
	Quota    string `json:"quota,omitempty"`
	Active   bool   `json:"active"`
}

// CreateTenantRequest represents the request to create a new tenant
type CreateTenantRequest struct {
	Tenant         string   `json:"tenant" validate:"required"`
	Segment        string   `json:"segment" validate:"required"`
	Environment    string   `json:"environment" validate:"required"`
	Cluster        string   `json:"cluster" validate:"required"`
	Users          []string `json:"users,omitempty"`
	Buckets        []string `json:"buckets,omitempty"`
	BucketQuotas   []string `json:"bucket_quotas,omitempty"`
	RisCode        string   `json:"ris_code,omitempty"`
	RisID          string   `json:"ris_id,omitempty"`
	OwnerGroup     string   `json:"owner_group,omitempty"`
	OwnerPerson    string   `json:"owner_person,omitempty"`
	CreateTenant   bool     `json:"create_tenant"`
	TenantOverride string   `json:"tenant_override,omitempty"`
	PushToDB       bool     `json:"push_to_db"`
}

// ClusterInfo represents cluster information
type ClusterInfo struct {
	Выдача       string `json:"Выдача"`
	ЦОД          string `json:"ЦОД"`
	Среда        string `json:"Среда"`
	ЗБ           string `json:"ЗБ"`
	TLSEndpoint  string `json:"tls_endpoint"`
	MTLSEndpoint string `json:"mtls_endpoint"`
	Кластер      string `json:"Кластер"`
	Реалм        string `json:"Реалм"`
}

// CheckResult represents the result of a database check
type CheckResult struct {
	ClsName     string         `json:"cluster"`
	NetSeg      string         `json:"segment"`
	Env         string         `json:"environment"`
	Realm       string         `json:"realm"`
	Tenant      string         `json:"tenant"`
	S3User      sql.NullString `json:"-"`
	Bucket      sql.NullString `json:"-"`
	Quota       sql.NullString `json:"-"`
	SdNum       string         `json:"sd_num"`
	SrtNum      string         `json:"srt_num"`
	DoneDate    string         `json:"done_date"`
	RisCode     string         `json:"ris_code"`
	RisId       string         `json:"ris_id"`
	OwnerGroup  string         `json:"owner_group"`
	OwnerPerson string         `json:"owner"`
	Applicant   string         `json:"applicant"`
	Email       sql.NullString `json:"-"`
	CsppComment sql.NullString `json:"-"`
	Active      bool           `json:"active"`
}

// MarshalJSON implements custom JSON marshaling for CheckResult
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

// getStringValue safely extracts string value from sql.NullString
func getStringValue(ns sql.NullString) string {
	if !ns.Valid {
		return "-"
	}
	return ns.String
}

// ConvertToMap converts ClusterInfo to a map for easier handling
func (c ClusterInfo) ConvertToMap() map[string]string {
	return map[string]string{
		"Выдача":        c.Выдача,
		"ЦОД":           c.ЦОД,
		"Среда":         c.Среда,
		"ЗБ":            c.ЗБ,
		"tls_endpoint":  c.TLSEndpoint,
		"mtls_endpoint": c.MTLSEndpoint,
		"Кластер":       c.Кластер,
		"Реалм":         c.Реалм,
	}
}
