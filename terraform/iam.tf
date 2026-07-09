# Service Account: Loki GCS
resource "google_service_account" "loki_gcs" {
  account_id   = "loki-gcs"
  display_name = "Loki GCS Access"
}

# Service Account: Generic Cloud Run
resource "google_service_account" "generic_cloud_run" {
  account_id   = var.cloud_run_sa_account_id
  display_name = var.cloud_run_sa_account_id
}

# Service Account: Vertex Express
resource "google_service_account" "vertex_express" {
  account_id   = "vertex-express"
  display_name = "Vertex Express SA"
}

# Project-Level IAM Bindings

# Secret Manager Accessor for Cloud Run (so it can access DB credentials and public keys)
resource "google_project_iam_binding" "secret_accessor_cloudrun" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

# Logging writer for Cloud Run SA
resource "google_project_iam_binding" "log_writer_cloudrun" {
  project = var.project_id
  role    = "roles/logging.logWriter"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

# Storage Object Creator / Viewer for Cloud Run SA
resource "google_project_iam_binding" "storage_creator_cloudrun" {
  project = var.project_id
  role    = "roles/storage.objectCreator"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

resource "google_project_iam_binding" "storage_viewer_cloudrun" {
  project = var.project_id
  role    = "roles/storage.objectViewer"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

# Pub/Sub Publisher and Subscriber for Cloud Run SA (if needed for middleware)
resource "google_project_iam_binding" "pubsub_publisher_cloudrun" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

resource "google_project_iam_binding" "pubsub_subscriber_cloudrun" {
  project = var.project_id
  role    = "roles/pubsub.subscriber"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}

# Vertex AI User for Cloud Run SA (to access Gemini)
resource "google_project_iam_binding" "aiplatform_user_cloudrun" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  members = [
    "serviceAccount:${google_service_account.generic_cloud_run.email}"
  ]
}
