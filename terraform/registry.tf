resource "google_artifact_registry_repository" "registry" {
  location      = var.region
  repository_id = var.artifact_repo_id
  description   = "Docker repository for BeyondForms application images"
  format        = "DOCKER"
}
