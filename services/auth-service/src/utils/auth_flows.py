from enum import Enum


class AuthFlow(str, Enum):
    ENROLLMENT = "enrollment"
    LOGIN = "login"
    TEST_ENROLLMENT = "test_enrollment"
    TEST_LOGIN = "test_login"


AUTH_FLOW_COOKIE_NAME = "beyondforms_auth_flow"
AUTH_FLOW_HEADER_NAME = "X-BeyondForms-Auth-Flow"
