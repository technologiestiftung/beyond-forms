# Authentik Authentication Setup

This directory contains the configuration for the [Authentik](https://goauthentik.io/) server used as the Identity Provider for BeyondForms.

## Services

The setup consists of several services defined in `compose.yml`:

- **authentik-server**: The main Authentik application server handling the UI and API.
- **authentik-worker**: Handles background tasks such as email sending and periodic synchronization.
- **authentik-postgresql**: The database used by Authentik to store configuration and user data.

## Configuration

To run the authentication services, you must provide several environment variables in a `.env` file (see `.env.template` for a starting point):

- `AUTHENTIK_SECRET_KEY`: A unique secret key for your Authentik instance.
- `PG_PASS`: The password for the PostgreSQL database.

## Integration

BeyondForms services use the `beyondforms-auth` library (located in `libs/auth`) to interact with this Authentik instance.

### Development Access

By default, the Authentik server is accessible at `http://localhost:9000`. You can log in using the administrative credentials set up during initial configuration, username: "akadmin" password: "abc123".

### Deployment

Authentik is included in the root `docker-compose.yaml` and is expected to be available for other services on the `app-network`.
