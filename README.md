# fids-screen-editor-backend

Backend for the FIDS screen editor — a full templates + assets API. Mongoose-backed, NestJS 10.

## Quick start

```bash
npm install
cp .env.example .env   # already provided; edit if your Mongo URI differs
npm run start:dev
```

Server listens on `http://localhost:3001` by default. Verify:

```bash
curl http://localhost:3001/health
```

Expected response: `{ "status": "ok", "db": { "state": "connected", ... }, ... }`.

## Scripts

| Script | Description |
| --- | --- |
| `npm run start:dev` | Start in watch mode |
| `npm start` | Start without watch |
| `npm run start:debug` | Start in watch + debug mode |
| `npm run start:prod` | Run the compiled build (`node dist/main`) |
| `npm run build` | Compile with the Nest CLI |
| `npm run lint` | Run ESLint (with `--fix`) |
| `npm run format` | Format `src` with Prettier |

## Mongo

Connects to local Docker Mongo via `MONGO_URI` (see `.env.example`). Default DB name is `screen-editor` so we don't collide with dcmm-backend's collections on the same instance.

## Asset bytes

For the POC, asset blobs live on disk under `UPLOADS_DIR` (default `./uploads/`, gitignored). The asset service goes through an `IStorageService` seam so the swap to GCS is one file when this folds into dcmm-backend.

## Testing

This repo has no native test runner. The piece that matters most — the template schema that validates incoming template bodies — is covered by the **frontend's** Vitest harness instead. The editor's parity and round-trip suites import this repo's `templateSchema` and `backendSchemaShapes` (`src/template-schema/zod.ts`) and assert they stay key-for-key identical to the editor's schema. Zod strips unknown keys on `parse()`, so any drift between the two schemas would silently drop fields when a template is saved — these tests fail loudly instead.

To run them, check out `fids-screen-editor` alongside this repo and run `npm test` there. (`backendSchemaShapes` is exported solely for that suite — it isn't used by the runtime.)

## Configuration

Runtime config comes from environment variables. Locally they're read from `.env`; in the cluster they're split between a ConfigMap (non-secret) and a Secret.

| Variable | Source | Purpose |
| --- | --- | --- |
| `PORT` | ConfigMap | HTTP port (default `3001`) |
| `DEPLOYMENT_MODE` | ConfigMap | Storage backend seam — `cloud` (GCS) vs local (disk) |
| `MONGO_DB_NAME` | ConfigMap | Mongo database name |
| `MONGO_URI` | Secret | Mongo connection string |
| `GCS_BUCKET` | ConfigMap | Bucket for assets + template bodies |
| `GCS_IMAGE_PREFIX` / `GCS_TEMPLATE_PREFIX` | ConfigMap | Object-key prefixes |
| `SIGNED_URL_TTL_SECONDS` | ConfigMap | Signed-URL lifetime |
| `CORS_ORIGINS` | ConfigMap | Allowed origins (the frontend URL) |
| `AUTH_ENABLED` | ConfigMap | Toggle remote auth |
| `AUTH_SERVICE_URL` | ConfigMap | Remote-auth service URL |
| `JWT_SECRET` | Secret | Auth token secret |

Cluster secrets live in the `fids-studio-backend-secrets` Secret in the target namespace — create it before the first deploy.

## Deployment

Containerized and deployed to GKE via Google Cloud Build — the same pipeline shape as the frontend.

**Image** — multi-stage `Dockerfile`: Node 22 runs `npm ci` (authenticating to GitHub Packages for the private `@industronics/*` deps via a `GITHUB_PAT` build arg), `nest build`, then prunes dev deps into a slim runtime image that runs `node dist/main` on port 3001.

**Pipeline** (`cloudbuild.yaml`):

1. Read `GITHUB_PAT` from Secret Manager.
2. `docker build` (with the PAT) and push to Artifact Registry: `asia-southeast1-docker.pkg.dev/$PROJECT_ID/fids-studio-<env>/backend:<short-sha>`.
3. Render `pre-kubernetes.yaml` → `kubernetes.yaml` (`sed` swaps project ID, commit SHA, env name, and all runtime config — `_GCS_*`, `_MONGO_DB_NAME`, `_CORS_ORIGINS`, `_AUTH_*`, …).
4. `gke-deploy` to the `<env>-cluster` cluster, namespace `<env>`.

**Environments** — `_TARGET_ENV` defaults to `staging`; set it to `prod` on the Cloud Build trigger to promote.

**GKE resources** (`pre-kubernetes.yaml`): a ConfigMap, a 1-replica Deployment (Workload Identity via the `gke-sa` service account, a mounted GCS SA-key secret, `/health` readiness + liveness probes, port 3001), a NEG-enabled ClusterIP Service (80 → 3001), a GCE Ingress on the reserved global static IP `screen-editor-backend`, a Google-managed TLS cert for `fids-studio-api.iax.my`, and a FrontendConfig that redirects HTTP → HTTPS. The `fids-studio-backend-secrets` Secret (`MONGO_URI`, `JWT_SECRET`) must exist in the namespace before the first deploy.

**Manual restart caveat** — like the frontend, the image tag is the commit short SHA, so a config-only change (e.g. editing a substitution without a new commit) produces a tag the cluster already considers current, and the pod isn't replaced. Force the new image with:

```bash
kubectl rollout restart deployment/fids-studio-backend -n <env>
```
