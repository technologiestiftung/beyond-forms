# ==========================================
# 1. RESERVE STATIC EXTERNAL IP ADDRESSES
# ==========================================

resource "google_compute_global_address" "frontend_ip" {
  name = var.lb_ip_name
}

resource "google_compute_global_address" "auth_ip" {
  name = "auth-staging"
}

resource "google_compute_global_address" "middleware_ip" {
  name = "staging-auth-lb-forwarding-rule"
}

# ==========================================
# 2. SERVERLESS NETWORK ENDPOINT GROUPS (NEGs)
# ==========================================

# Staging NEGs
resource "google_compute_region_network_endpoint_group" "stg_auth_neg" {
  name                  = "staging-auth"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.auth_service["stg"].name
  }
}

resource "google_compute_region_network_endpoint_group" "stg_frontend_neg" {
  name                  = "staging-frontend"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.wallet_frontend["stg"].name
  }
}

resource "google_compute_region_network_endpoint_group" "stg_middleware_neg" {
  name                  = "staging-middleware"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.middleware_service["stg"].name
  }
}

# Production NEGs
resource "google_compute_region_network_endpoint_group" "prd_auth_neg" {
  name                  = "prod-auth"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.auth_service["prd"].name
  }
}

resource "google_compute_region_network_endpoint_group" "prd_frontend_neg" {
  name                  = "prod-frontend"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.wallet_frontend["prd"].name
  }
}

resource "google_compute_region_network_endpoint_group" "prd_middleware_neg" {
  name                  = "prod-middleware"
  network_endpoint_type = "SERVERLESS"
  region                = var.region

  cloud_run {
    service = google_cloud_run_v2_service.middleware_service["prd"].name
  }
}

# ==========================================
# 3. GLOBAL BACKEND SERVICES
# ==========================================

# Staging Backends
resource "google_compute_backend_service" "stg_auth_backend" {
  name                  = "staging-auth-backend-berlin"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.stg_auth_neg.id
  }
}

resource "google_compute_backend_service" "stg_frontend_backend" {
  name                  = "staging-frontend-berlin"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.stg_frontend_neg.id
  }
}

resource "google_compute_backend_service" "stg_middleware_backend" {
  name                  = "staging-middleware-backend-berlin"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.stg_middleware_neg.id
  }
}

# Production Backends
resource "google_compute_backend_service" "prd_auth_backend" {
  name                  = "prod-auth-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.prd_auth_neg.id
  }
}

resource "google_compute_backend_service" "prd_frontend_backend" {
  name                  = "prod-frontend-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.prd_frontend_neg.id
  }
}

resource "google_compute_backend_service" "prd_middleware_backend" {
  name                  = "prod-middleware-backend"
  protocol              = "HTTPS"
  load_balancing_scheme = "EXTERNAL_MANAGED"

  backend {
    group = google_compute_region_network_endpoint_group.prd_middleware_neg.id
  }
}

# ==========================================
# 4. GOOGLE-MANAGED SSL CERTIFICATES
# ==========================================

resource "google_compute_managed_ssl_certificate" "stg_auth_cert" {
  name = "auth-staging-domain"
  managed {
    domains = ["auth.staging.${var.domain_name}"]
  }
}

resource "google_compute_managed_ssl_certificate" "stg_frontend_cert" {
  name = "frontend-staging-domain"
  managed {
    domains = ["staging.${var.domain_name}"]
  }
}

resource "google_compute_managed_ssl_certificate" "stg_middleware_cert" {
  name = "middleware-staging-domain"
  managed {
    domains = ["middleware.staging.${var.domain_name}"]
  }
}

resource "google_compute_managed_ssl_certificate" "prd_auth_cert" {
  name = "prod-auth-cert"
  managed {
    domains = [
      "auth.prod.${var.domain_name}",
      "authentik.prod.${var.domain_name}"
    ]
  }
}

resource "google_compute_managed_ssl_certificate" "prd_frontend_cert" {
  name = "prod-frontend-cert"
  managed {
    domains = ["prod.${var.domain_name}"]
  }
}

resource "google_compute_managed_ssl_certificate" "prd_middleware_cert" {
  name = "prod-middleware-cert"
  managed {
    domains = ["middleware.prod.${var.domain_name}"]
  }
}

# ==========================================
# 5. URL MAP & ROUTING
# ==========================================

resource "google_compute_url_map" "url_map" {
  name            = "staging-auth-lb"
  default_service = google_compute_backend_service.stg_auth_backend.id

  # Host rule: Staging Middleware
  host_rule {
    hosts        = ["middleware.staging.${var.domain_name}"]
    path_matcher = "staging-middleware"
  }

  # Host rule: Staging Frontend
  host_rule {
    hosts        = ["staging.${var.domain_name}"]
    path_matcher = "staging-frontend"
  }

  # Host rule: Staging Auth
  host_rule {
    hosts        = ["auth.staging.${var.domain_name}"]
    path_matcher = "staging-auth"
  }

  # Host rule: Production Middleware
  host_rule {
    hosts        = ["middleware.prod.${var.domain_name}"]
    path_matcher = "prod-middleware"
  }

  # Host rule: Production Frontend
  host_rule {
    hosts        = ["prod.${var.domain_name}"]
    path_matcher = "prod-frontend"
  }

  # Host rule: Production Auth
  host_rule {
    hosts        = ["auth.prod.${var.domain_name}"]
    path_matcher = "prod-auth"
  }

  # Path Matchers
  path_matcher {
    name            = "staging-middleware"
    default_service = google_compute_backend_service.stg_middleware_backend.id
  }

  path_matcher {
    name            = "staging-frontend"
    default_service = google_compute_backend_service.stg_frontend_backend.id
  }

  path_matcher {
    name            = "staging-auth"
    default_service = google_compute_backend_service.stg_auth_backend.id
  }

  path_matcher {
    name            = "prod-middleware"
    default_service = google_compute_backend_service.prd_middleware_backend.id
  }

  path_matcher {
    name            = "prod-frontend"
    default_service = google_compute_backend_service.prd_frontend_backend.id
  }

  path_matcher {
    name            = "prod-auth"
    default_service = google_compute_backend_service.prd_auth_backend.id
  }
}

# ==========================================
# 6. TARGET HTTPS PROXIES
# ==========================================

# 1st Target Proxy: Auth domains (points to URL Map, mounts auth staging/prod certs)
resource "google_compute_target_https_proxy" "auth_proxy" {
  name    = "staging-auth-lb-target-proxy"
  url_map = google_compute_url_map.url_map.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.stg_auth_cert.id,
    google_compute_managed_ssl_certificate.prd_auth_cert.id
  ]
}

# 2nd Target Proxy: Middleware domains (points to URL Map, mounts middleware certs)
resource "google_compute_target_https_proxy" "middleware_proxy" {
  name    = "staging-auth-lb-target-proxy-2"
  url_map = google_compute_url_map.url_map.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.stg_middleware_cert.id,
    google_compute_managed_ssl_certificate.prd_middleware_cert.id
  ]
}

# 3rd Target Proxy: Frontend/Web domains (points to URL Map, mounts frontend certs)
resource "google_compute_target_https_proxy" "frontend_proxy" {
  name    = "staging-auth-lb-target-proxy-3"
  url_map = google_compute_url_map.url_map.id
  ssl_certificates = [
    google_compute_managed_ssl_certificate.stg_frontend_cert.id,
    google_compute_managed_ssl_certificate.prd_frontend_cert.id
  ]
}

# ==========================================
# 7. GLOBAL FORWARDING RULES (LINK IP TO PROXY)
# ==========================================

# Auth IP routing
resource "google_compute_global_forwarding_rule" "auth_forwarding" {
  name                  = "auth-staging"
  ip_address            = google_compute_global_address.auth_ip.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.auth_proxy.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# Middleware IP routing
resource "google_compute_global_forwarding_rule" "middleware_forwarding" {
  name                  = "staging-auth-lb-forwarding-rule"
  ip_address            = google_compute_global_address.middleware_ip.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.middleware_proxy.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}

# Frontend IP routing
resource "google_compute_global_forwarding_rule" "frontend_forwarding" {
  name                  = "main-frontend"
  ip_address            = google_compute_global_address.frontend_ip.address
  ip_protocol           = "TCP"
  port_range            = "443"
  target                = google_compute_target_https_proxy.frontend_proxy.id
  load_balancing_scheme = "EXTERNAL_MANAGED"
}
