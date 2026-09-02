# Cross-Team Development Environment: Standardization & Setup Guide

This document defines the architectural standards and local workflow for our cross-team development environment. Our goal is to maintain high autonomy for individual teams while ensuring a seamless, "one-command" setup for local integration.

## 1. Repository Architecture

We employ a standard Monorepo structure. The root repository acts as a conductor, while individual services are managed in the `services/` folder. This allows teams to own their versioning while providing a centralized entry point for full-system testing.

### Directory layout

```
/root
├── .env.template # Global infrastructure variables
├── docker-compose.yml # Orchestration for shared resources
├── scripts/ # Bootstrap & helper scripts
├── prototypes/ # Misc experiments and prototypes
├── infrastructure/ # Deployment scripts for infra (terraform, skaffold, etc)
	└── services/
		├── service-a/ # Language: e.g., Python
		│ 	├── docker-compose.yml
		│ 	├── .env.template
		│ 	└── src/
		└── service-b/ # Language: e.g., TypeScript
			├── docker-compose.yml
			├── .env.template
			└── src/
```

## 2. Git & GitHub Standards

### Single Source of Truth

- The repository should be the single source of truth
- Deployments should be automated from the main branch
- Use CI/CD pipelines (GitHub Actions)
- Store secrets securely, never log them

### Git Workflow

1. **Never work directly on `main`**
2. Create feature branches: `git checkout -b feature/descriptive-name`
3. Our dev branch is called `staging` and all PRs should be merged into it.
4. Before we release, create a release PR from `staging` to `main`. After merging, also create a Github Release.
5. Make atomic commits (one commit = one change)
6. Always create Pull Requests
7. Do only ONE thing per branch
8. Push and track branches: `git push origin HEAD`

### Commit Messages

Follow this format:

```
<Summary in ~50 characters using imperative mood>

<Optional detailed explanation wrapped at ~72 characters>
```

Use [Conventional Commits](https://www.conventionalcommits.org/) where possible:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `chore:` for maintenance tasks
- `refactor:` for code restructuring
- `test:` for tests

### GitHub Repository Standards

- Use **signed commits** for the technologiestiftung organization
- Repository naming:
  - Use hyphens instead of underscores
  - Lowercase only
  - No special characters
  - Prefix related projects (e.g., `citylab-`)
  - Use domain as prefix for web projects (e.g., `giessdenkiez-de-api`)
- Configure repository:
  - Add topics and description
  - Add project URL if applicable
  - Disable unused features (wiki, discussions, etc.)
  - Use CODEOWNERS: `echo "* @username" >> .github/CODEOWNERS`

## 3. Environment Variables & Secret Protocol

Let's treat .env files as the source of truth for local configuration. To keep secrets safe and environments reproducible, follow these rules:

- No Secrets in Git: .env files are strictly git-ignored.
- The .env.template Standard: Every service must maintain a .env.template with placeholders (e.g., API_KEY=your_key_here).
- Global vs. Local: Use the root .env for shared infrastructure (Message Brokers, LLM Endpoints) and service-specific .env files for internal logic.

### LLM Injection Pattern

Since our services utilize both remote (ex. Gemini) and local (ex. Gemma/Network-hosted) models, all LLM-enabled services must use the following injection keys:

| Variable       | Description                   | Example(local)            | Example(remote)               |
| -------------- | ----------------------------- | ------------------------- | ----------------------------- |
| LLM_ENDPOINT   | The API base URL              | http://192.168.1.50:11434 | https://generativelanguage... |
| LLM_MODEL_NAME | The specific model identifier | gemma-3-1b-it             | gemini-3.7-flash              |
| LLM_API_KEY    | Authentication token          | not-needed-for-local      | AIzaSy...                     |

## 4. Containerization (Docker Compose)

Each service must be "container-first." A developer should be able to spin up a single service and its dependencies without needing to understand the entire ecosystem.

### Networking Strategy

We use a shared External Docker Network named app-network. This allows containers managed by different docker-compose.yml files to communicate via service names.

### Example: services/auth-service/docker-compose.yml

```
services:
	auth-db:
	image: postgres:16-alpine
	environment:
		POSTGRES_DB: ${DB_NAME}
	networks:
		- app-network

auth-service:
	build:  .
	networks:
		- app-network

networks:
	app-network:
		external:  true
```

## 5. Database & Infrastructure Standards

To ensure portability and avoid licensing hurdles, all teams must use Open Source Compatible databases:

- PostgreSQL (v16+): Recommended for relational data and robust JSONB support.

**Strict Isolation**: No service may connect to another service's database. If you need data from Service A, call Service A's API.

**Cloud Portability**: All infrastructure must be reproducible across cloud providers (not limited to GCP). Use cloud-agnostic tooling (e.g., Terraform with provider abstractions, Kubernetes) and avoid proprietary managed services unless a clear exit path exists.

## 6. Testing Criteria & Best Practices

Testing is not an afterthought. Let’s utilize a Contract-First testing methodology (whenever possible) to prevent cross-team breakages.

### The Testing Stack

- Unit Tests: Focus on business logic; zero external dependencies.
- Integration Tests: Use Testcontainers to spin up ephemeral Postgres instances.
- Contract Tests (Pact): Ensure that changes to Service A's API don't break Service B's consumer code

## 7. Quick Start Workflow

1.  Clone: `git clone <root-repo-url>`
2.  Bootstrap: Run `./scripts/bootstrap.sh` (This creates the docker network, copies all `.env.template` files to `.env`, and generates local dev certs).
3.  Launch Infrastructure & Services: `docker compose up -d` in the root.
4.  Launch specific Service (if developing locally without docker): e.g., `cd services/<your-service> && uv run fastapi dev` (or `npm run dev` for frontend).

### Service Ports

When running the project locally, the services are mapped to the following ports:

| Service                           | Port   |
| :-------------------------------- | :----- |
| **Authentication Service**        | `8002` |
| **Wallet Frontend**               | `3000` |
| **Forms Filling Service**         | `8005` |
| **Document Intelligence Service** | `8001` |
| **Pub/Sub Emulator**              | `8085` |

### Hot Reload

The Python backend services have hot reload baked into them. This means you can develop with `docker compose up -d` running and see your changes in real time without needing to rebuild or restart the containers.
For the frontend (`wallet-frontend`), hot reload is currently not supported inside Docker. To see your frontend changes, you must rebuild and restart the container: `docker compose up -d --build wallet-frontend`.

### Pub/Sub Emulator Setup (Optional / Manual)

The Pub/Sub emulator is included in the root `compose.yaml` and starts automatically. If you ever need to run it standalone:

1. `gcloud components install pubsub-emulator`
2. `gcloud beta emulators pubsub start --host-port=0.0.0.0:8085`

## 8. Code Style & Formatting

For JavaScript/TypeScript projects, use the shared @technologiestiftung configs:

- [eslint-config](https://github.com/technologiestiftung/eslint-config)
- [prettier-config](https://github.com/technologiestiftung/prettier-config)

For Python projects we use a custom [Ruff](https://docs.astral.sh/ruff/) configuration for formatting and linting. The settings can be found in the [`ruff.toml`](./ruff.toml) file at the root of the repository.

## 9. Dependency Management & Versioning

To ensure reproducible builds, we strictly pin versions for both code dependencies and container images:

- **Pin exact versions in package.json**: Avoid `^` or `~` prefixes (e.g., use `"lodash": "4.17.21"` not `"lodash": "^4.17.21"`).
- **Commit lockfiles**: Always commit `package-lock.json`, `pnpm-lock.yaml`, `yarn.lock` or `uv.lock`.
- **Use .npmrc**: Consider adding an `.npmrc` with `save-exact=true` to enforce exact versions by default.
- **Docker Pinning**: Pin images to at least minor versions (e.g., `"postgres:16.3-alpine"` not `"postgres:latest"`).

## 10. Data Handling Principles

**Data Minimization**: Only use external data processing services when absolutely necessary. Prefer local/self-hosted processing to minimize data exposure. When external services are unavoidable, document the justification and ensure compliance with data protection requirements.

---
