resource "google_secret_manager_secret" "db_user" {
  secret_id = "AUTH_SERVICE_DB_USER"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "db_password" {
  secret_id = "AUTH_SERVICE_DB_PASSWORD"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "prod_db_user" {
  secret_id = "PROD_AUTH_SERVICE_DB_USER"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "prod_db_password" {
  secret_id = "PROD_AUTH_SERVICE_DB_PASSWORD"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "gemini_key" {
  secret_id = "GEMINI_API_KEY"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "authentik_priv" {
  secret_id = "GOAUTHENTIK_KEY_PRIV"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "authentik_pub" {
  secret_id = "GOAUTHENTIK_KEY_PUB"
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "prod_test_bypass_key" {
  secret_id = "PROD_TEST_BYPASS_KEY"
  replication {
    auto {}
  }
}
