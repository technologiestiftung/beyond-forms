# Auth Service

The `auth-service` manages user registration and authentication for BeyondForms using Authentik as the identity provider.

## Features

- **User Registration**: Create a new user account using a phone number as the username.
- **SMS Authentication**: Authenticate users by sending a one-time verification code via SMS.
- **Session Management**: Handle session cookies and authentication verification.

## Test Accounts

For testing and development, the service supports "test accounts" that bypass real SMS delivery. These accounts are identified by specific phone number prefixes reserved for media productions (Bundesnetzagentur "Drama Numbers").

### Test Phone Number Prefixes

| City      | Prefixes                       |
| --------- | ------------------------------ |
| Berlin    | `03023125...`, `+493023125...` |
| Frankfurt | `06990009...`, `+496990009...` |
| Hamburg   | `04066969...`, `+494066969...` |
| Köln      | `02214710...`, `+492214710...` |
| München   | `08999998...`, `+498999998...` |

### Authentication

Test accounts use the fixed password defined by `TEST_ACCOUNT_PASSWORD` (default: `J6$hR8@cV5`). When prompted for a verification code during the `/login/finish` step for a test account, any value can be provided as the service internally uses the configured test password to authenticate against Authentik.

## API Endpoints

### Public Endpoints

- `GET /health`: Simple health check. Returns `{"status": "healthy"}`.
- `POST /login/start`: Start the login flow and send a verification code to the given phone number.
  - Body: `{"phone_number": "+1234567890"}`
- `POST /login/finish`: Verify the code and set the authenticated session cookie.
  - Body: `{"phone_number": "+1234567890", "code": "123456"}`

### Authenticated Endpoints

These endpoints require or use the `authentik_session` cookie.

- `GET /verify_auth`: Check authentication status and get current user info.
  - Returns: `{"is_authenticated": bool, "user": str, "session_id": str}`
- `GET /require_auth`: Example endpoint that fails with `401 Unauthorized` if not logged in.
- `POST /logout`: Log out the current user and clear the session cookie.

## Dependencies

- **Authentik server**: The identity provider for user management and authentication. The `auth-service` acts as a proxy/client that orchestrates the SMS/OTP login flow against the Authentik instance.
- `**authentik-client`**: Python client for interacting with the Authentik API.
- `**beyondforms-auth**`: Local library for JWT/Session token verification and FastAPI dependencies.

## Development

### Run Locally

Ensure the `authentik-server` and `postgres` database are running via Docker Compose first.

```bash
cd services/auth-service
uv run fastapi dev --port 8003
```
