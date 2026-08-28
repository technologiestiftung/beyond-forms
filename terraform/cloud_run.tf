# Locals to manage environment-specific configurations
locals {
  envs = {
    stg = {
      name_prefix        = "stg"
      db_name            = "dev"
      db_user_secret     = google_secret_manager_secret.db_user.secret_id
      db_password_secret = google_secret_manager_secret.db_password.secret_id
      min_scale          = 0
      max_scale          = 10
      domain_suffix      = "staging"
      gemini_model       = "gemini-3.7-flash"
      internal_key       = var.internal_key_stg
      rag_corpus         = var.rag_corpus
      rag_region         = "europe-west3"
      bucket_name        = google_storage_bucket.dev_bucket.name
      pubsub_project_id  = var.pubsub_project_id
      pubsub_topic_id    = "document-processing"
      pubsub_sub_id      = "document-processing-sub"
      pubsub_dlq_id      = "document-processing-dlq"
    }
    prd = {
      name_prefix        = "prd"
      db_name            = "prod"
      db_user_secret     = google_secret_manager_secret.prod_db_user.secret_id
      db_password_secret = google_secret_manager_secret.prod_db_password.secret_id
      min_scale          = 0
      max_scale          = 20
      domain_suffix      = "prod"
      gemini_model       = "gemini-3.7-flash"
      internal_key       = var.internal_key_prd
      rag_corpus         = ""
      rag_region         = ""
      bucket_name        = google_storage_bucket.prod_bucket.name
      pubsub_project_id  = var.pubsub_project_id
      pubsub_topic_id    = "prd-document-processing"
      pubsub_sub_id      = "prd-document-processing-sub"
      pubsub_dlq_id      = "prd-document-processing-dlq"
    }
  }

  # Registry project and repository (can be overridden if needed)
  registry_project = var.registry_project
  registry_repo    = var.registry_repo
}

# Image tag variables for deployment flexibility
variable "auth_service_tag" {
  type    = string
  default = "latest"
}
variable "rules_engine_tag" {
  type    = string
  default = "latest"
}
variable "forms_filling_tag" {
  type    = string
  default = "latest"
}
variable "middleware_tag" {
  type    = string
  default = "latest"
}
variable "doc_intel_tag" {
  type    = string
  default = "latest"
}
variable "sidecar_tag" {
  type    = string
  default = "latest"
}
variable "frontend_tag" {
  type    = string
  default = "latest"
}
variable "migration_tag" {
  type    = string
  default = "latest"
}


# ==========================================
# 1. AUTH SERVICE
# ==========================================
resource "google_cloud_run_v2_service" "auth_service" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-auth-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = each.value.max_scale
      min_instance_count = each.value.min_scale
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/auth-service:${var.auth_service_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name  = "OIDC_REDIRECT_URI"
        value = "https://authentik.${each.value.domain_suffix}.${var.domain_name}/auth/callback"
      }
      env {
        name  = "AUTHENTIK_SERVER_URL"
        value = "https://authentik.${each.value.domain_suffix}.${var.domain_name}"
      }
      env {
        name  = "DB_HOST"
        value = google_alloydb_instance.alloydb_primary.ip_address
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_NAME"
        value = each.value.db_name
      }
      env {
        name  = "TEST_ACCOUNT_PASSWORD"
        value = "test-account-pw"
      }
      env {
        name  = "OIDC_CLIENT_ID"
        value = var.oidc_client_id
      }
      env {
        name  = "OIDC_CLIENT_SECRET"
        value = var.oidc_client_secret
      }
      env {
        name  = "AUTHENTIK_PUBLIC_KEY_PATH"
        value = "/app/auth/certs/pub/oidc_public.pem"
      }
      env {
        name  = "ENV"
        value = each.key == "prd" ? "production" : "staging"
      }
      env {
        name = "PROD_TEST_BYPASS_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.prod_test_bypass_key.secret_id
            version = "latest"
          }
        }
      }

      env {
        name = "DB_USER"
        value_source {
          secret_key_ref {
            secret  = each.value.db_user_secret
            version = "latest"
          }
        }
      }
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = each.value.db_password_secret
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "authentik-pub-key"
        mount_path = "/app/auth/certs/pub"
      }
    }

    volumes {
      name = "authentik-pub-key"
      secret {
        secret       = google_secret_manager_secret.authentik_pub.secret_id
        default_mode = 292 # decimal for 0444 octal read-only
        items {
          version = "latest"
          path    = "oidc_public.pem"
        }
      }
    }

    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc.name
        subnetwork = google_compute_subnetwork.subnet.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 2. RULES ENGINE
# ==========================================
resource "google_cloud_run_v2_service" "rules_engine" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-rules-engine"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = each.value.max_scale
      min_instance_count = each.value.min_scale
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/rules-engine:${var.rules_engine_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name  = "DB_HOST"
        value = google_alloydb_instance.alloydb_primary.ip_address
      }
      env {
        name  = "DB_PORT"
        value = "5432"
      }
      env {
        name  = "DB_NAME"
        value = each.value.db_name
      }
      env {
        name = "DB_USER"
        value_source {
          secret_key_ref {
            secret  = each.value.db_user_secret
            version = "latest"
          }
        }
      }
      env {
        name = "DB_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = each.value.db_password_secret
            version = "latest"
          }
        }
      }
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 3. FORMS FILLING SERVICE
# ==========================================
resource "google_cloud_run_v2_service" "forms_filling_service" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-forms-filling-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = each.value.max_scale
      min_instance_count = each.value.min_scale
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/forms-filling-service:${var.forms_filling_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 4. ORCHESTRATION MIDDLEWARE SERVICE
# ==========================================
resource "google_cloud_run_v2_service" "middleware_service" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-orchestration-middleware-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = each.value.max_scale
      min_instance_count = each.value.min_scale
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/orchestration-middleware-service:${var.middleware_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "2Gi"
        }
      }

      env {
        name  = "ENDPOINT_RULES_ENGINE"
        value = "https://${var.app_name}-${each.key}-rules-engine-xk7qpppwga-oe.a.run.app"
      }
      env {
        name  = "ENDPOINT_FORMS_FILLER"
        value = "https://${var.app_name}-${each.key}-forms-filling-service-xk7qpppwga-oe.a.run.app"
      }
      env {
        name  = "GCS_BUCKET_NAME"
        value = each.value.bucket_name
      }
      # Demo persona seeding. Staging only historically; GitHub deploys now enable
      # it in every environment. When true, middleware startup inserts any persona
      # whose drama number does not already have a profile.
      env {
        name  = "DEMO_SEED_ENABLED"
        value = "true"
      }
      env {
        name  = "POSTGRES_HOST"
        value = google_alloydb_instance.alloydb_primary.ip_address
      }
      env {
        name  = "POSTGRES_PORT"
        value = "5432"
      }
      env {
        name  = "POSTGRES_DATABASE"
        value = each.value.db_name
      }
      env {
        name  = "OIDC_CLIENT_ID"
        value = var.oidc_client_id
      }
      env {
        name  = "OIDC_CLIENT_SECRET"
        value = var.oidc_client_secret
      }
      env {
        name  = "AUTHENTIK_PUBLIC_KEY_PATH"
        value = "/app/auth/certs/pub/oidc_public.pem"
      }
      env {
        name  = "GEMINI_MODEL_NAME"
        value = each.value.gemini_model
      }
      env {
        name  = "CHAT_CONTEXT_WINDOW_SIZE"
        value = "20"
      }
      env {
        name  = "GCLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "ENDPOINT_DOC_INTELLIGENCE"
        value = "https://${var.app_name}-${each.key}-document-intelligence-service-xk7qpppwga-oe.a.run.app"
      }
      env {
        name  = "PUBSUB_PROJECT_ID"
        value = each.value.pubsub_project_id
      }
      env {
        name  = "PUBSUB_TOPIC_ID"
        value = each.value.pubsub_topic_id
      }
      env {
        name  = "PUBSUB_SUBSCRIPTION_ID"
        value = each.value.pubsub_sub_id
      }
      env {
        name  = "PUBSUB_DLQ_TOPIC_ID"
        value = each.value.pubsub_dlq_id
      }
      env {
        name  = "INTERNAL_API_KEY"
        value = each.value.internal_key
      }
      env {
        name  = "MIDDLEWARE_SERVICE_URL"
        value = "https://${var.app_name}-${each.key}-orchestration-middleware-service-xk7qpppwga-oe.a.run.app"
      }
      env {
        name  = "RAG_ENGINE_CORPUS"
        value = each.value.rag_corpus
      }
      env {
        name  = "GCP_RAG_ENGINE_REGION"
        value = each.value.rag_region
      }
      env {
        name  = "AUTHENTIK_SERVER_URL"
        value = "https://authentik.${each.value.domain_suffix}.${var.domain_name}"
      }
      env {
        name  = "AUTHENTIK_ISSUER_URL"
        value = "https://authentik.${each.value.domain_suffix}.${var.domain_name}/application/o/beyondforms/"
      }
      env {
        name = "POSTGRES_USER"
        value_source {
          secret_key_ref {
            secret  = each.value.db_user_secret
            version = "latest"
          }
        }
      }
      env {
        name = "POSTGRES_PASSWORD"
        value_source {
          secret_key_ref {
            secret  = each.value.db_password_secret
            version = "latest"
          }
        }
      }

      volume_mounts {
        name       = "authentik-pub-key"
        mount_path = "/app/auth/certs/pub"
      }
    }

    volumes {
      name = "authentik-pub-key"
      secret {
        secret       = google_secret_manager_secret.authentik_pub.secret_id
        default_mode = 292
        items {
          version = "latest"
          path    = "oidc_public.pem"
        }
      }
    }

    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc.name
        subnetwork = google_compute_subnetwork.subnet.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 5. DOCUMENT INTELLIGENCE SERVICE
# ==========================================
resource "google_cloud_run_v2_service" "document_intelligence" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-document-intelligence-service"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = 10
      min_instance_count = each.key == "stg" ? 2 : 0
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/document-intelligence-service:${var.doc_intel_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "2Gi"
        }
      }

      env {
        name  = "LLM_RETRIES"
        value = "3"
      }
      env {
        name  = "GEMINI_MODEL_NAME"
        value = each.value.gemini_model
      }
      env {
        name  = "GCLOUD_PROJECT"
        value = var.project_id
      }
    }

    vpc_access {
      network_interfaces {
        network    = google_compute_network.vpc.name
        subnetwork = google_compute_subnetwork.subnet.name
      }
      egress = "PRIVATE_RANGES_ONLY"
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 6. WALLET FRONTEND
# ==========================================
resource "google_cloud_run_v2_service" "wallet_frontend" {
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-wallet-frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    scaling {
      max_instance_count = each.value.max_scale
      min_instance_count = 0
    }
    service_account = google_service_account.generic_cloud_run.email

    containers {
      image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/wallet-frontend:${var.frontend_tag}"
      ports { container_port = 8080 }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }

      env {
        name  = "API_PROXY_URL"
        value = "https://middleware.${each.value.domain_suffix}.${var.domain_name}"
      }
      env {
        name  = "AUTH_PROXY_URL"
        value = "https://auth.${each.value.domain_suffix}.${var.domain_name}"
      }
    }

    annotations = {
      "run.googleapis.com/startup-cpu-boost" = "true"
    }
  }
}


# ==========================================
# 7. MIGRATION SERVICE (CLOUD RUN JOB)
# ==========================================
resource "google_cloud_run_v2_job" "migration_job" {
  provider = google-beta
  for_each = local.envs
  name     = "${var.app_name}-${each.key}-migration-service"
  location = var.region

  template {
    task_count = 1

    template {
      max_retries     = 3
      service_account = google_service_account.generic_cloud_run.email
      timeout         = "600s"

      containers {
        image = "europe-west10-docker.pkg.dev/${local.registry_project}/${local.registry_repo}/migration-service:${var.migration_tag}"

        resources {
          limits = {
            cpu    = "1000m"
            memory = "512Mi"
          }
        }

        env {
          name  = "DB_HOST"
          value = google_alloydb_instance.alloydb_primary.ip_address
        }
        env {
          name  = "DB_PORT"
          value = "5432"
        }
        env {
          name  = "DB_USER"
          value = "dev"
        }
        env {
          name  = "DB_PASSWORD"
          value = "rQfUMTgZgt4FFZV"
        }
        env {
          name  = "DB_NAME"
          value = each.value.db_name
        }
        env {
          name  = "DB_SSLMODE"
          value = "require"
        }

        volume_mounts {
          name       = "migrations-vol"
          mount_path = "/app/migrations"
        }
      }

      volumes {
        name = "migrations-vol"
        gcs {
          bucket    = each.key == "prd" ? google_storage_bucket.migrations_bucket_prd.name : google_storage_bucket.migrations_bucket.name
          read_only = false
        }
      }

      vpc_access {
        network_interfaces {
          network    = google_compute_network.vpc.name
          subnetwork = google_compute_subnetwork.subnet.name
        }
        egress = "ALL_TRAFFIC"
      }
    }
  }
}
