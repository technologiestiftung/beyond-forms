output "vpc_network_name" {
  value       = google_compute_network.vpc.name
  description = "The name of the custom VPC network."
}

output "subnet_name" {
  value       = google_compute_subnetwork.subnet.name
  description = "The name of the primary subnetwork."
}

output "alloydb_primary_ip" {
  value       = google_alloydb_instance.alloydb_primary.ip_address
  description = "The private IP address of the AlloyDB primary instance."
}

output "alloydb_cluster_id" {
  value       = google_alloydb_cluster.alloydb_cluster.id
  description = "The ID of the AlloyDB cluster."
}

output "gke_cluster_name" {
  value       = google_container_cluster.gke_cluster.name
  description = "The name of the GKE Autopilot cluster."
}

output "gke_cluster_endpoint" {
  value       = google_container_cluster.gke_cluster.endpoint
  description = "The control plane endpoint of the GKE Autopilot cluster."
}

output "dns_nameservers" {
  value       = google_dns_managed_zone.dns_zone.name_servers
  description = "The nameservers for the public DNS zone. Update your domain registrar with these."
}

output "frontend_static_ip" {
  value       = google_compute_global_address.frontend_ip.address
  description = "The static IP for the wallet frontend LB."
}

output "auth_static_ip" {
  value       = google_compute_global_address.auth_ip.address
  description = "The static IP for the auth proxy LB."
}

output "middleware_static_ip" {
  value       = google_compute_global_address.middleware_ip.address
  description = "The static IP for the middleware LB."
}

output "authentik_ingress_ip" {
  value       = google_compute_global_address.authentik_ingress_ip.address
  description = "The static IP for GKE Ingress (Authentik). Make sure to configure this name 'k8s2-fr-wxce69fl-default-authentik-ingress' in GKE or reference the IP."
}
