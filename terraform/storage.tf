# Dev Storage Bucket
resource "google_storage_bucket" "dev_bucket" {
  name                        = var.dev_bucket_name
  location                    = "EUROPE-WEST10"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

# Prod Storage Bucket
resource "google_storage_bucket" "prod_bucket" {
  name                        = var.prod_bucket_name
  location                    = "EUROPE-WEST10"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}

# RAG Storage Bucket
resource "google_storage_bucket" "rag_bucket" {
  name                        = var.rag_bucket_name
  location                    = "EUROPE-WEST10"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  labels = {
    environment = "staging"
  }
}

# Loki Logs Bucket
resource "google_storage_bucket" "loki_logs" {
  name                        = var.loki_logs_bucket_name
  location                    = "EUROPE-WEST3"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Migrations Bucket
resource "google_storage_bucket" "migrations_bucket" {
  name                        = var.migrations_bucket_name
  location                    = "EUROPE-WEST10"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
}

# Prod Migrations Bucket (Hardened Security)
resource "google_storage_bucket" "migrations_bucket_prd" {
  name                        = var.migrations_bucket_prd_name
  location                    = "EUROPE-WEST10"
  storage_class               = "STANDARD"
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}

# Loki SA storage permissions
resource "google_storage_bucket_iam_binding" "loki_storage_admin" {
  bucket = google_storage_bucket.loki_logs.name
  role   = "roles/storage.objectAdmin"
  members = [
    "serviceAccount:${google_service_account.loki_gcs.email}"
  ]
}

# Cloud Run SA migration permissions
resource "google_storage_bucket_iam_binding" "migrations_storage_user" {
  bucket = google_storage_bucket.migrations_bucket.name
  role   = "roles/storage.objectUser"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

resource "google_storage_bucket_iam_binding" "migrations_storage_user_prd" {
  bucket = google_storage_bucket.migrations_bucket_prd.name
  role   = "roles/storage.objectViewer"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}
