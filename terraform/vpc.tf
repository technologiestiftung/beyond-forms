resource "google_compute_network" "vpc" {
  name                    = "${var.app_name}-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.app_name}-subnet-ber"
  ip_cidr_range = var.subnet_cidr
  region        = var.region
  network       = google_compute_network.vpc.id

  # GKE secondary range for pods
  secondary_ip_range {
    range_name    = "gke-authentik-pods"
    ip_cidr_range = var.gke_pods_cidr
  }
}

# Subnets in other regions (optional, matching existing setup)
resource "google_compute_subnetwork" "subnet_west1" {
  name          = "${var.app_name}-subnet"
  ip_cidr_range = var.subnet_west1_cidr
  region        = "europe-west1"
  network       = google_compute_network.vpc.id
}

resource "google_compute_subnetwork" "subnet_west3" {
  name          = "${var.app_name}-subnet-fra"
  ip_cidr_range = var.subnet_west3_cidr
  region        = "europe-west3"
  network       = google_compute_network.vpc.id
}

# Private Service Access IP Allocation (for AlloyDB)
resource "google_compute_global_address" "private_ip_alloc" {
  name          = "${var.app_name}-vpc-ip-range"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 20
  network       = google_compute_network.vpc.id
}

# VPC Peering Service Connection for Private Service Access
resource "google_service_networking_connection" "private_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_alloc.name]
}

# Optional but recommended Cloud Router & NAT for outbound traffic from GKE/Cloud Run
resource "google_compute_router" "router" {
  name    = "${var.app_name}-router"
  region  = var.region
  network = google_compute_network.vpc.id
}

resource "google_compute_router_nat" "nat" {
  name                               = "${var.app_name}-nat"
  router                             = google_compute_router.router.name
  region                             = var.region
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}
