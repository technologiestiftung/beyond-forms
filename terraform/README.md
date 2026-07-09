# BeyondForms GCP Infrastructure Walkthrough

This directory contains the Terraform configuration to replicate the Google Cloud Platform infrastructure for the BeyondForms application.

---

## 1. Directory Structure

The configuration is divided into the following files:

- [providers.tf](providers.tf): Sets up the standard `google` and `google-beta` providers.
- [variables.tf](variables.tf): Declares configuration variables like GCP Project ID, region, zone, and domains.
- [vpc.tf](vpc.tf): Custom VPC network, subnets, private service connection (for AlloyDB), and Cloud NAT.
- [iam.tf](iam.tf): Defines dedicated service accounts (`loki-gcs`, `generic-cloud-run`, `vertex-express`) to enforce least privilege.
- [registry.tf](registry.tf): Standard Artifact Registry Docker repository for container images.
- [storage.tf](storage.tf): GCS buckets (dev/prod buckets, loki logs with 30-day lifecycle, migrations bucket, RAG engine bucket).
- [secrets.tf](secrets.tf): Secret Manager containers (database users, passwords, Gemini API keys, Authentik keys).
- [alloydb.tf](alloydb.tf): AlloyDB cluster (Postgres 16) and zonal primary instance.
- [gke.tf](gke.tf): GKE Autopilot cluster configured in the VPC.
- [cloud_run.tf](cloud_run.tf): Configures Cloud Run services and jobs for both `stg` and `prd` environments using loops, referencing secrets and dynamic AlloyDB IPs.
- [load_balancer.tf](load_balancer.tf): Global HTTPS Load Balancer with 3 frontend IPs, Google-managed SSL certs, and URL Map routing rules.
- [dns.tf](dns.tf): Public Cloud DNS zone and record sets pointing to load balancer IPs and GKE.
- [outputs.tf](outputs.tf): Exposes critical values (endpoints, IPs, nameservers) after deployment.

---

## 2. Key Architecture & Setup Features

### Environment Parity

The configuration defines both `stg` (staging) and `prd` (production) resources for Cloud Run services/jobs in the same project using dry loops (`for_each`). If you want to separate them into different projects, you can configure different project IDs or split the workspaces.

### AlloyDB Dynamic Peering

We use standard Terraform resource outputs to automatically feed the private IP address of your AlloyDB instance (`google_alloydb_instance.alloydb_primary.ip_address`) straight into the `DB_HOST` and `POSTGRES_HOST` env variables of your Cloud Run services.

### Global Load Balancer & Routing Improvements

In your manual configuration:

- The URL Map routed `middleware.staging/prod` and `staging/prod` correctly, but had no host rule for `auth.staging` or `auth.prod`.
- Both auth domains fell back blindly to the URL Map's default backend `staging-auth-backend-berlin`.
- **Fixed in Terraform**: We added explicit host rules for `auth.staging` (routes to `staging-auth-backend-berlin`) and `auth.prod` (routes to `prod-auth-backend`), resolving the fallback routing bug.

### Secret Manager Preparation

Secrets are declared without payloads in [secrets.tf](secrets.tf). When you deploy this to a new project, Terraform will create empty secret containers. You must populate the latest version of these secrets manually (or via a script) with:

- `AUTH_SERVICE_DB_USER`
- `AUTH_SERVICE_DB_PASSWORD`
- `GEMINI_API_KEY`
- `GOAUTHENTIK_KEY_PRIV` (Authentik signing private key)
- `GOAUTHENTIK_KEY_PUB` (Authentik signing public certificate)

---

## 3. How to Deploy to a New Project

1. **Log in to GCP CLI**:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. **Configure Variables**:
   Update `project_id` and `domain_name` in [variables.tf](variables.tf) or use a `terraform.tfvars` file:
   ```hcl
   project_id  = "your-new-gcp-project-id"
   domain_name = "your-domain.org"
   ```
3. **Initialize & Validate**:
   ```bash
   cd terraform
   terraform init
   terraform validate
   ```
4. **Deploy**:
   ```bash
   terraform plan -out=tfplan
   terraform apply tfplan
   ```
5. **Populate Secrets**:
   Go to the Secret Manager Console or use `gcloud` to add versions for the database credentials and the Authentik certs.
6. **Set up DNS nameservers**:
   Retrieve the nameservers from the output `dns_nameservers` and update your domain registrar.

---

## 4. GKE & Authentik Deployment

After Terraform provisions the GKE Autopilot cluster:

1. Configure `kubectl` to target the new cluster:
   ```bash
   gcloud container clusters get-credentials authentik --region=europe-west10
   ```
2. Apply your existing manifests from `auth/infrastructure/`:
   ```bash
   kubectl apply -f ../auth/infrastructure/
   ```
3. Verify that the GKE Ingress controller matches the reserved static IP name: `k8s2-fr-wxce69fl-default-authentik-ingress`.
