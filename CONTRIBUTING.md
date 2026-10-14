# Contributing to Compass Analytics

Thank you for considering contributing! This project follows a clear workflow to keep history clean and ensure high quality.

## Getting Started

```bash
make setup   # installs dependencies, sets up DB, creates .env.example
```

## Branching & Commits

- Branch off `main` using the `feat/…`, `fix/…`, `docs/…`, `chore/…` prefixes.
- Commit using **Conventional Commits**:
  ```
  type(scope): short imperative summary
  
  Body describing what and why (optional for trivial changes).
  ```
- Pull request titles should match the commit message.

## Running Tests

```bash
make test   # runs unit, integration, and e2e tests
```

## Pull Request Checklist

- [ ] Branch is up‑to‑date with `main`.
- [ ] Commits are atomic and pass `make lint && make test`.
- [ ] Documentation updated where needed.
- [ ] ADRs added for any architectural decisions.
- [ ] All CI checks pass.

## Good First Issues

Look for the `good first issue` label in the issue tracker. These are small, self‑contained tasks that are a great way to get familiar with the codebase.

## Code of Conduct

By participating, you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
