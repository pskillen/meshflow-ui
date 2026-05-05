# Release Process

This document describes how Docker images are built and pushed to GitHub Container Registry (ghcr.io) for Meshflow UI.

## Release Triggers

### 1. Manual Release

**Workflow:** [manual-release.yaml](../.github/workflows/manual-release.yaml)

**Trigger:** Run manually via GitHub Actions → "Manual release" → "Run workflow"

**Tags pushed:**

- `latest-dev`
- `{short-sha}` (e.g. `abc1234`)

Use this to build and push from the current `main` branch without merging new commits.

---

### 2. Push to `main`

**Workflow:** [main.yaml](../.github/workflows/main.yaml)

**Trigger:** Push to `origin/main`

**Tags pushed:**

- `latest-dev`
- `dev-{short-sha}` (e.g. `dev-abc1234`)

---

### 3. Pre-release (Release Candidate)

**Workflow:** [pre-release.yaml](../.github/workflows/pre-release.yaml)

**Trigger:** Create a GitHub Release marked as "Pre-release" with a semver tag (e.g. `1.2.3-rc.4`)

**Tags pushed:**

- `latest-rc`
- `{semver}` (e.g. `1.2.3-rc.4`)

---

### 4. Production Release

**Workflow:** [release.yaml](../.github/workflows/release.yaml)

**Trigger:** Publish a GitHub Release (not a pre-release) with a semver tag (e.g. `1.2.3`)

**Tags pushed:**

- `latest`
- `{semver}` (e.g. `1.2.3`)

---

## Summary Table

| Trigger        | Rolling tag  | Version tag  |
| -------------- | ------------ | ------------ |
| Manual release | `latest-dev` | `{sha}`      |
| Push to `main` | `latest-dev` | `dev-{sha}`  |
| Pre-release    | `latest-rc`  | `1.2.3-rc.4` |
| Release        | `latest`     | `1.2.3`      |

## Pulling Images

```bash
# Latest production
docker pull ghcr.io/pskillen/meshflow-ui:latest

# Specific version
docker pull ghcr.io/pskillen/meshflow-ui:1.2.3

# Latest dev build
docker pull ghcr.io/pskillen/meshflow-ui:latest-dev

# Latest release candidate
docker pull ghcr.io/pskillen/meshflow-ui:latest-rc
```
