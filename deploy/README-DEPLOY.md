# Deployment (Ubuntu 24.04 + Apache)

Target layout:

```
/var/www/source
|-- dist/              # Vite build output
|-- server/            # Node backend (from this repo)
|-- shared/            # Shared theme definitions
|-- public/            # Static assets (logo)
|-- package.json
`-- package-lock.json  # if you use npm ci
```

## 1) Install Node.js 20 LTS

```
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2) Build locally (recommended)

On your PC:

```
npm install
npm run build
```

Upload to the server:
- `dist/` -> `/var/www/source/dist`
- `server/` -> `/var/www/source/server`
- `shared/` -> `/var/www/source/shared`
- `public/` -> `/var/www/source/public` (optional when building locally; `dist/` already contains copied public assets)
- `package.json` and `package-lock.json` -> `/var/www/source/`

## 3) Install runtime dependencies + Playwright deps (server)

```
cd /var/www/source
npm ci --omit=dev
sudo mkdir -p /var/www/source/.cache/ms-playwright
sudo chown -R www-data:www-data /var/www/source/.cache
sudo -u www-data -H env PLAYWRIGHT_BROWSERS_PATH=/var/www/source/.cache/ms-playwright npx playwright install chromium
sudo npx playwright install-deps chromium
```

## 4) Backend env file

Copy `deploy/env/sourceprinter.env` to `/var/www/source/server/.env` and adjust limits if needed. `RENDER_CONCURRENCY` controls how many files are rendered in parallel.

`MAX_ACTIVE_JOBS` limits how many render requests run at the same time (shared across `/api/render/start` jobs and direct `/api/render` requests). `MAX_QUEUED_JOBS` limits how many background jobs may wait in the queue when all active slots are busy. When both limits are reached, the API returns HTTP `429`.

`MAX_UMZ_BYTES` limits the maximum uncompressed size of a single embedded `.umz` file inside the uploaded zip. `MAX_FILE_BYTES` still applies to each individual source file.

`CHROMIUM_NO_SANDBOX=0` keeps the Chromium sandbox enabled (recommended). Set it to `1` only if your server cannot use the sandbox and Playwright fails with a "No usable sandbox" error.

## 5) systemd service

```
sudo cp deploy/systemd/sourceprinter.service /etc/systemd/system/sourceprinter.service
sudo systemctl daemon-reload
sudo systemctl enable --now sourceprinter
sudo systemctl status sourceprinter
```

Health check:

```
curl http://127.0.0.1:3001/api/health
```

## 6) Apache vhost

```
sudo a2enmod proxy proxy_http headers ssl
sudo cp deploy/apache/sourceprinter.conf /etc/apache2/sites-available/sourceprinter.conf
sudo a2ensite sourceprinter.conf
sudo systemctl reload apache2
```

If you use certbot:

```
sudo certbot --apache -d source.haan.lu
```

## Updating an existing deployment

1) Build locally
```
npm ci
npm run build
```

2) Upload changed files to the server (overwrite existing)
- Frontend changes: `dist/` -> `/var/www/source/dist`
- Backend changes: `server/` -> `/var/www/source/server` and `shared/` -> `/var/www/source/shared`
- Dependency changes: `package.json` and `package-lock.json` -> `/var/www/source/`
- `public/` is optional when you build locally; files from `public/` are copied into `dist/` during `vite build`.

3) On the server, update runtime deps only if `package.json` or `package-lock.json` changed
```
cd /var/www/source
npm ci --omit=dev
```

4) If the Playwright version changed, update browsers
```
sudo -u www-data -H env PLAYWRIGHT_BROWSERS_PATH=/var/www/source/.cache/ms-playwright npx playwright install chromium
```

5) Restart backend service only if backend code, deps, or `/var/www/source/server/.env` changed
```
sudo systemctl restart sourceprinter
```

6) Reload Apache only if vhost config changed
```
sudo systemctl reload apache2
```

Optional health check (after backend changes):
```
curl http://127.0.0.1:3001/api/health
```
