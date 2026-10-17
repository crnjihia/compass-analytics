## Description
Provide a concise summary of the change, the motivation behind it, and any architectural trade-offs made.

## Type of Change
- [ ] `feat`: New feature or capability
- [ ] `fix`: Bug fix
- [ ] `perf`: Performance enhancement
- [ ] `refactor`: Code refactoring without behavior changes
- [ ] `test`: Added or updated unit/integration tests
- [ ] `docs`: Documentation updates or ADR additions
- [ ] `infra` / `ci`: Infrastructure, Terraform, Docker, or CI/CD adjustments

## Multi-Tenancy & Security Verification
- [ ] Row-Level Security (RLS) is preserved and `set_config('app.org_id', ...)` isolation is verified
- [ ] Monetary amounts are strictly represented as integer KES cents (`BigInt`)
- [ ] Sensitive M-Pesa secrets are encrypted with AES-256-GCM
- [ ] Customer MSISDNs are masked and hashed with HMAC-SHA256

## Checklist
- [ ] `pnpm lint` passed with 0 errors
- [ ] `pnpm test` passed across all workspaces
- [ ] Go tests passed (`go test -v ./...`)
- [ ] Kubernetes manifests validate with `kubectl kustomize`
- [ ] Relevant documentation or ADR updated
