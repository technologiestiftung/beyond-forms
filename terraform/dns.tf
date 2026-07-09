# Public Managed DNS Zone
resource "google_dns_managed_zone" "dns_zone" {
  name        = var.dns_zone_name
  dns_name    = "${var.domain_name}."
  description = "Managed zone for BeyondForms subdomains"
  visibility  = "public"
}

# Reserve Static IP for Authentik GKE Ingress
resource "google_compute_global_address" "authentik_ingress_ip" {
  name = "k8s2-fr-wxce69fl-default-authentik-ingress"
}

# ==========================================
# A RECORDS FOR DOMAINS
# ==========================================

# 1. Frontend Web (Staging & Prod)
resource "google_dns_record_set" "staging_frontend" {
  name         = "staging.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.frontend_ip.address]
}

resource "google_dns_record_set" "prod_frontend" {
  name         = "prod.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.frontend_ip.address]
}

# 2. Auth Service Proxy (Staging & Prod)
resource "google_dns_record_set" "staging_auth" {
  name         = "auth.staging.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.auth_ip.address]
}

resource "google_dns_record_set" "prod_auth" {
  name         = "auth.prod.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.auth_ip.address]
}

# 3. Middleware Service (Staging & Prod)
resource "google_dns_record_set" "staging_middleware" {
  name         = "middleware.staging.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.middleware_ip.address]
}

resource "google_dns_record_set" "prod_middleware" {
  name         = "middleware.prod.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.middleware_ip.address]
}

# 4. GKE Authentik Ingress (Staging & Prod)
resource "google_dns_record_set" "staging_authentik" {
  name         = "authentik.staging.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.authentik_ingress_ip.address]
}

resource "google_dns_record_set" "prod_authentik" {
  name         = "authentik.prod.${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = google_dns_managed_zone.dns_zone.name
  rrdatas      = [google_compute_global_address.authentik_ingress_ip.address]
}
