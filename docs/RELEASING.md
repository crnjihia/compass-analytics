# Compass Analytics - Release Guide

This document describes the release engineering process, version tagging guidelines, and GitHub Release procedures.

---

## 1. Versioning Standard

Compass Analytics strictly adheres to [Semantic Versioning (SemVer 2.0.0)](https://semver.org/):
- **MAJOR (`x.0.0`)**: Incompatible API changes, database schema breaking migrations without backwards compatibility, or multi-tenant boundary modifications.
- **MINOR (`1.x.0`)**: Backwards-compatible features, new analytics metrics, or additional Daraja webhook handlers.
- **PATCH (`1.0.x`)**: Backwards-compatible bug fixes, UI styling refinements, or security patches.

---

## 2. Pre-Release Quality Gates

Before creating a release tag, verify that all quality gates pass:

```bash
# 1. Monorepo linting and strict type checking
pnpm lint

# 2. Complete test suite across shared, db, and web packages
pnpm test

# 3. Go ingest test suite with race detector
cd services/ingest && go test -v -race ./... && cd ../..

# 4. Kubernetes Kustomize validation
kubectl kustomize deploy/k8s/overlays/production > /dev/null
```

---

## 3. Creating a Release

1. Update `CHANGELOG.md` by moving items from `[Unreleased]` to `[v1.0.0] - YYYY-MM-DD`.
2. Commit the changes:
   ```bash
   git add CHANGELOG.md
   git commit -m "chore(release): prepare v1.0.0 release"
   ```
3. Tag the commit with an annotated tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0: Production-grade multi-tenant analytics for Kenyan SMEs"
   ```
4. Push the branch and tag to GitHub:
   ```bash
   git push origin main --tags
   ```
5. Create the GitHub Release using the GitHub CLI:
   ```bash
   gh release create v1.0.0 \
     --title "Compass Analytics v1.0.0 - Multi-Tenant Business Analytics for Kenyan SMEs" \
     --notes-file RELEASE_NOTES.md
   ```

Pushed tags automatically trigger the `.github/workflows/release.yml` pipeline to build and publish multi-arch Docker images to GitHub Container Registry (`ghcr.io/crnjihia/compass-web` and `ghcr.io/crnjihia/compass-ingest`).
