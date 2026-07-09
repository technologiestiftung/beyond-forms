import os
import urllib.parse
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

ENV = os.getenv("ENV", "development").lower()
IS_PRODUCTION = ENV == "production"

AUTHENTIK_SERVER_URL = os.getenv("AUTHENTIK_SERVER_URL", "http://authentik-server:9000")
LOGIN_FLOW_URL = f"{AUTHENTIK_SERVER_URL}/api/v3/flows/executor/passwordless-sms-login/"
ENROLLMENT_FLOW_URL = f"{AUTHENTIK_SERVER_URL}/api/v3/flows/executor/passwordless-sms-enrollment/"

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_USER = os.getenv("DB_USER", "postgres")
DB_PASSWORD = os.getenv("DB_PASSWORD", "postgres")
DB_NAME = os.getenv("DB_NAME", "postgres")


def construct_db_url(user: str, password: str, host: str, port: str, name: str) -> str:
    # URL-encode the credentials to handle special characters (e.g. '@') in user/password
    quoted_user = urllib.parse.quote(user, safe="")
    quoted_password = urllib.parse.quote(password, safe="")
    return f"postgresql://{quoted_user}:{quoted_password}@{host}:{port}/{name}"


DATABASE_URL = construct_db_url(DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)

# Test accounts are authenticated using a password flow.
TEST_PASSWORD_AUTH_FLOW_URL = f"{AUTHENTIK_SERVER_URL}/api/v3/flows/executor/default-authentication-flow/"
TEST_ENROLLMENT_FLOW_URL = f"{AUTHENTIK_SERVER_URL}/api/v3/flows/executor/username-password-enrollment/"
TEST_ACCOUNT_PASSWORD = os.getenv("TEST_ACCOUNT_PASSWORD", "test_account_password")

# OIDC Configuration
# These must match the 'client_id' and 'client_secret' attributes in the
# OIDC Provider defined in auth/blueprints/oidc-provider.yaml.
OIDC_CLIENT_ID = os.getenv("OIDC_CLIENT_ID")
OIDC_CLIENT_SECRET = os.getenv("OIDC_CLIENT_SECRET")

# Bypass key for running E2E tests in production
PROD_TEST_BYPASS_KEY = os.getenv("PROD_TEST_BYPASS_KEY")
