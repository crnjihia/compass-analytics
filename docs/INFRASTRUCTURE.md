# Infrastructure Documentation

This document provides guidance for working with the Terraform IaC used by Compass Analytics.

## Prerequisites
- **AWS CLI** configured with appropriate credentials.
- **Terraform** `>= 1.5` installed locally.
- Access to the AWS account where resources will be provisioned.

## Directory Structure
```
infra/terraform/
├── main.tf          # Root module – loads providers, backend config, and child modules.
├── variables.tf    # Input variables (environment, region, VPC CIDR, etc.).
├── outputs.tf      # Exported values such as VPC ID, RDS endpoint, EKS cluster name.
├── vpc.tf          # VPC, subnets, Internet/NAT gateways, route tables.
├── rds.tf          # PostgreSQL RDS instance with encryption, parameter groups.
├── redis.tf        # ElastiCache Redis cluster with in‑transit encryption.
├── eks.tf          # EKS cluster, node groups, IAM roles, security groups.
├── kms.tf          # KMS key for at‑rest encryption of RDS/Redis snapshots.
├── secrets.tf      # (optional) Creates Secrets Manager entries for DB credentials.
└── iam.tf          # IAM policies for the CI/CD pipeline and service accounts.
```

## Typical Workflow
1. **Initialize backend** (only once per workspace):
   ```bash
   cd infra/terraform
   terraform init -backend-config=backend.tfvars
   ```
2. **Plan** – preview changes before applying:
   ```bash
   terraform plan -var="environment=dev" -var="region=eu-west-1"
   ```
3. **Apply** – create or update resources:
   ```bash
   terraform apply -var="environment=dev" -auto-approve
   ```
4. **Destroy** – tear down the entire stack (use with caution):
   ```bash
   terraform destroy -var="environment=dev" -auto-approve
   ```

## Testing Locally
The repository includes a `make infra/plan` helper that runs the above commands with sensible defaults for a local `dev` environment. It also validates the configuration with `terraform validate` and `tflint`.

## CI Integration
The GitHub Actions workflow `validate-k8s.yml` already runs `terraform fmt` and `terraform validate` on PRs. For full apply on the `main` branch you can add a separate workflow that runs `terraform apply` on merge, using an OIDC‑based GitHub token for AWS access.

## Secrets Management
- Database credentials are stored in **AWS Secrets Manager** and referenced by the `secrets.tf` module.
- The `INGEST_SECRET` used by the Go ingest service is also stored in Secrets Manager and injected into the Kubernetes secret via the `deploy/k8s/base/secret.yaml` manifest.

## Next Steps
- Review the `variables.tf` file to customise CIDR blocks, instance sizes, and replica counts for your environment.
- If you need additional resources (e.g., S3 bucket for backups), create a new module under this directory and expose the relevant outputs.

---

*Generated on $(date)*
