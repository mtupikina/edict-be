# CI/CD deployment (edict-be)

Same flow as **edict-admin-be**: secrets are stored in the **GitHub repository** (Settings → Secrets and variables → Actions). The workflow syncs them to Render and triggers deploy. You do **not** set env vars in the Render dashboard.

## Overview

- **Trigger:** Push to the `main` branch.
- **Pipeline:** Checkout → Node 20 + npm cache → `npm ci` → lint → test → build → **sync env vars from GitHub Secrets to Render** → trigger Render deploy.
- **Env vars:** Stored only in GitHub repository secrets; the workflow pushes them to Render on each deploy.

---

## 1. Render: create the backend service

1. Go to [Render Dashboard](https://dashboard.render.com/) and sign in.
2. **New → Web Service**.
3. Connect the **edict-be** GitHub repo.
4. Configure:
   - **Name:** e.g. `edict-be`
   - **Region:** choose closest to your users.
   - **Branch:** `main`
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start:prod`
   - **Instance type:** Free or paid as needed.
5. You do **not** need to add env vars in Render; the workflow syncs them from GitHub Secrets.
6. Create the service, then go to **Settings** and note:
   - **Service ID:** in the URL, e.g. `https://dashboard.render.com/web/srv-xxxxxxxxxxxx` → the ID is `srv-xxxxxxxxxxxx`.
   - **Deploy hook:** Settings → **Deploy Hook** → copy the deploy hook URL.

---

## 2. Render: get API key

1. [Render Account Settings](https://dashboard.render.com/u/settings#api-keys) → **API Keys**.
2. **Create API Key**, name it (e.g. `edict-be-deploy`), copy the key.
3. You will add this as `RENDER_API_KEY` in the GitHub repo secrets.

---

## 3. GitHub: repository secrets

All env vars are stored in the **edict-be** repo on GitHub.

1. **Settings → Secrets and variables → Actions**.
2. **New repository secret** for each of the following.

| Secret name | Description | Example / note |
|-------------|-------------|----------------|
| `RENDER_API_KEY` | Render API key from step 2 | From Render API Keys |
| `RENDER_SERVICE_ID` | Render Web Service ID | e.g. `srv-xxxxxxxxxxxx` |
| `RENDER_DEPLOY_HOOK_URL` | Deploy hook URL | From service → Settings → Deploy Hook |
| `MONGODB_URI` | Production MongoDB connection string | e.g. `mongodb+srv://...` |
| `MONGODB_URI_TEST` | MongoDB used in CI tests | Can be same as prod or a separate test DB |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL on Render | e.g. `https://edict-be.onrender.com/auth/google/callback` |
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | Strong random string |
| `JWT_EXPIRATION_SECONDS` | JWT expiry in seconds | e.g. `21600` (6 hours) |
| `PORT` | Port Render uses | `10000` (Render default) or omit |
| `FRONTEND_URL` | Allowed CORS / redirect origin | e.g. `https://your-edict-app.example.com` |

The workflow syncs these to Render (except `MONGODB_URI_TEST`, which is only for CI tests). Ensure **Google OAuth** redirect URI in Google Cloud Console includes your Render callback URL.

---

## 4. Workflow file

The workflow is in:

```text
edict-be/.github/workflows/deploy.yml
```

On **push to `main`** it:

1. Checks out the repo.
2. Sets up Node 20 with npm cache.
3. Runs `npm ci`, `npm run lint`, `npm run test` (using `MONGODB_URI_TEST` and a test JWT from secrets/env), then `npm run build`.
4. **Syncs env vars to Render** from the GitHub secrets (MONGODB_URI, Google OAuth, JWT, PORT, FRONTEND_URL).
5. **Triggers Render deploy** via the deploy hook.

No env vars are set manually on Render; they come from the repository secrets.

---

## 5. Deploy and test

1. Push to `main`:
   ```bash
   cd edict-be
   git add .github/workflows/deploy.yml docs/DEPLOY.md
   git commit -m "CI/CD: same flow as edict-admin-be, secrets in GitHub"
   git push origin main
   ```
2. In GitHub: **Actions** tab → “Deploy backend” workflow runs.
3. When it passes, the workflow syncs secrets to Render and triggers the deploy. Check Render **Logs** to confirm the app starts.

---

## 6. Difference from edict-admin-be

- **JWT expiry:** edict-be uses `JWT_EXPIRATION_SECONDS` (number); edict-admin-be uses `JWT_EXPIRATION` (string, e.g. `6h`). So in GitHub Secrets you set `JWT_EXPIRATION_SECONDS` (e.g. `21600`) for this repo.

Everything else (secrets in GitHub, sync to Render, deploy hook) is the same as edict-admin-be.

---

## Troubleshooting

- **Workflow fails on “Sync env vars to Render”:** Check `RENDER_API_KEY` and `RENDER_SERVICE_ID`; ensure the API key has access to that service.
- **Workflow fails on “Trigger Render deploy”:** Check `RENDER_DEPLOY_HOOK_URL` (no trailing slash, correct service).
- **Tests fail in CI:** Ensure `MONGODB_URI_TEST` is set and reachable from GitHub’s runners (e.g. MongoDB Atlas with allowed IPs or 0.0.0.0/0).
- **App fails on Render:** After a run, env vars should be on Render; check Render **Logs** and **Environment** to confirm the sync step ran and vars are present.
