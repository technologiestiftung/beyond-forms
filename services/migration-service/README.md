# Migration Service

The Migration Service is responsible for applying database migrations for the BeyondForms platform. It ensures that the PostgreSQL database schema is kept up-to-date across all environments.

## Core Responsibilities

- **Schema Initialization**: Creates the necessary database tables on first launch.
- **Schema Updates**: Applies incremental schema changes (migrations) securely as new features are added.

## Tech Stack

- **ORM / Migrations**: SQLAlchemy & Alembic
- **Database**: PostgreSQL
- **Language**: Python 3.13

## How it works

The migration service does not stay running. It runs as a one-off task (init container) every time `docker compose up` is executed.

1. It waits for the `postgres` service to be ready.
2. It mounts the root `migrations/` directory.
3. It executes `alembic upgrade head`.
4. It exits successfully once the database is up-to-date.

## Development

If you change the database models in the codebase (usually defined in the Orchestration Middleware Service or Auth Service), you will need to generate a new migration script.

To generate a new migration locally:

```bash
# Ensure your database is running
docker compose up -d postgres

# From the root of the project (where alembic.ini is located)
uv run alembic revision --autogenerate -m "description of your changes"

# Review the generated file in the `migrations/versions/` directory!

# Apply the migration
uv run alembic upgrade head
```

## Deployment

In the cloud infrastructure, the migration service is triggered automatically during the CI/CD pipeline or when the environment boots up, ensuring the schema matches the deployed application code.
