resource "google_alloydb_cluster" "alloydb_cluster" {
  cluster_id       = "postgres-alloy-staging"
  location         = var.region
  database_version = "POSTGRES_16"
  network_config {
    network = google_compute_network.vpc.id
  }

  continuous_backup_config {
    enabled              = true
    recovery_window_days = 14
  }

  automated_backup_policy {
    enabled = false # As per existing configuration
  }

  # Ensure the VPC Peering connection is ready before creating the cluster
  depends_on = [google_service_networking_connection.private_connection]
}

resource "google_alloydb_instance" "alloydb_primary" {
  cluster       = google_alloydb_cluster.alloydb_cluster.name
  instance_id   = "postgres-alloy-staging-primary"
  instance_type = "PRIMARY"

  # Single zone (zonal) for staging/development
  availability_type = "ZONAL"
  gce_zone          = var.zone

  machine_config {
    cpu_count = 2
  }

  database_flags = {
    "alloydb.iam_authentication" = "on"
  }
}
