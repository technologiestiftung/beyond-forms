resource "google_container_cluster" "gke_cluster" {
  name     = "authentik"
  location = var.region

  # Enable Autopilot
  enable_autopilot = true

  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name = "gke-authentik-pods"
  }

  release_channel {
    channel = "REGULAR"
  }

  # Allow public access to control plane (endpoint) but keep nodes private
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
  }
}
