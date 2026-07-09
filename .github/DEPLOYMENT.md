# Deployment Configuration

Deploys inject all environment-specific values from GitHub-managed
configuration. Nothing sensitive lives in the repo. Set these before the first
deploy. Values below are **placeholders** — substitute your own.

## Repo-level (Settings → Secrets and variables → Actions)

Identical across environments.

### Variables
| Name | Example |
|---|---|
| `GCP_REGION` | `europe-west10` |
| `GCP_CIS_PROJECT_ID` | `<artifact-registry project>` |
| `GCP_DEPLOY_PROJECT_ID` | `<cloud build project>` |
| `GCLOUD_PROJECT` | `<gcp-project-id>` |
| `AUTHENTIK_URL` | `https://authentik.example.org` |
| `PUBSUB_PROJECT_ID` | `<gcp-project-id>` |

### Secrets (masked in logs)
| Name | Notes |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | existing |
| `GCP_SERVICE_ACCOUNT` | existing |
| `INTERNAL_API_KEY` | existing |
| `NETWORK` | `<vpc-name>` |
| `SUBNET` | `<subnet-name>` |
| `RAG_ENGINE_CORPUS` | Vertex RAG corpus id |

## Environment-level (Settings → Environments → `staging` / `production`)

Values differ per environment. Set both environments.

### Variables
| Name | staging | production |
|---|---|---|
| `API_PROXY_URL` | `https://middleware.staging.example.org` | `https://middleware.prod.example.org` |
| `AUTH_PROXY_URL` | `https://auth.staging.example.org` | `https://auth.prod.example.org` |
| `DB_NAME` | `dev` | `prod` |
| `GCS_BUCKET` | `<dev-bucket>` | `<prod-bucket>` |
| `ENDPOINT_RULES_ENGINE` | `<rules-engine staging run.app URL>` | `<rules-engine prod run.app URL>` |
| `ENDPOINT_FORMS_FILLER` | `<forms-filler staging URL>` | `<forms-filler prod URL>` |
| `ENDPOINT_DOC_INTELLIGENCE` | `<doc-intelligence staging URL>` | `<doc-intelligence prod URL>` |
| `MIDDLEWARE_SERVICE_URL` | `<middleware staging URL>` | `<middleware prod URL>` |
| `PUBSUB_TOPIC_ID` | `<topic>` | `<topic>` |
| `PUBSUB_SUBSCRIPTION_ID` | `<subscription>` | `<subscription>` |
| `PUBSUB_DLQ_TOPIC_ID` | `<dlq-topic>` | `<dlq-topic>` |
| `DB_USER_SECRET` | `<db-user secret name>` | `<db-user secret name>` |
| `DB_PASSWORD_SECRET` | `<db-password secret name>` | `<db-password secret name>` |

### Secrets (masked in logs)
| Name | Notes |
|---|---|
| `ALLOYDB_HOST` | AlloyDB private IP (existing) |

## Setting values with the gh CLI

```bash
# Repo-level variable / secret
gh variable set GCLOUD_PROJECT --body "<gcp-project-id>"
gh secret   set NETWORK        --body "<vpc-name>"

# Environment-level variable / secret
gh variable set DB_NAME     --env staging    --body "dev"
gh variable set DB_NAME     --env production --body "prod"
gh secret   set ALLOYDB_HOST --env staging   --body "<ip>"
```
