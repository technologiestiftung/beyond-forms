variable "project_id" {
  type        = string
  description = "The GCP Project ID to deploy the infrastructure in."
}

variable "pubsub_project_id" {
  type        = string
  description = "The GCP Project ID where Pub/Sub resources are hosted."
}

variable "region" {
  type        = string
  description = "The primary GCP region for resources."
  default     = "europe-west10"
}

variable "zone" {
  type        = string
  description = "The GCP zone for single-zone resources."
  default     = "europe-west10-c"
}

variable "domain_name" {
  type        = string
  description = "The domain name managed by Cloud DNS."
}

variable "app_name" {
  type        = string
  description = "Prefix for resources."
}

variable "dev_bucket_name" {
  type        = string
  description = "Name of the dev GCS bucket."
}
variable "prod_bucket_name" {
  type        = string
  description = "Name of the prod GCS bucket."
}
variable "rag_bucket_name" {
  type        = string
  description = "Name of the RAG storage bucket."
}
variable "loki_logs_bucket_name" {
  type        = string
  description = "Name of the Loki logs bucket."
}
variable "migrations_bucket_name" {
  type        = string
  description = "Name of the migrations bucket (staging)."
}
variable "migrations_bucket_prd_name" {
  type        = string
  description = "Name of the migrations bucket (prod)."
}
variable "subnet_cidr" {
  type        = string
  description = "Primary subnet CIDR range."
}
variable "subnet_west1_cidr" {
  type        = string
  description = "europe-west1 subnet CIDR range."
}
variable "subnet_west3_cidr" {
  type        = string
  description = "europe-west3 subnet CIDR range."
}
variable "gke_pods_cidr" {
  type        = string
  description = "Secondary CIDR range for GKE pods."
}
variable "rag_corpus" {
  type        = string
  description = "Vertex AI RAG corpus id (staging)."
}
variable "registry_project" {
  type        = string
  description = "GCP project hosting the container image registry."
}
variable "registry_repo" {
  type        = string
  description = "Artifact Registry repository used in image paths."
}
variable "artifact_repo_id" {
  type        = string
  description = "Artifact Registry repository id created by terraform."
}
variable "dns_zone_name" {
  type        = string
  description = "Cloud DNS managed zone name."
}
variable "cloud_run_sa_account_id" {
  type        = string
  description = "Account id of the shared Cloud Run service account."
}
variable "lb_ip_name" {
  type        = string
  description = "Name of the global load balancer IP address resource."
}
variable "oidc_client_id" {
  type        = string
  description = "OIDC client id."
}
variable "oidc_client_secret" {
  type        = string
  description = "OIDC client secret (placeholder; real value injected from Secret Manager at deploy)."
  sensitive   = true
}
variable "internal_key_stg" {
  type        = string
  description = "Staging internal service-to-service API key (placeholder; real value injected from Secret Manager at deploy)."
  sensitive   = true
}
variable "internal_key_prd" {
  type        = string
  description = "Production internal service-to-service API key (placeholder; real value injected from Secret Manager at deploy)."
  sensitive   = true
}
