# Decap CMS

The CMS lives at `/admin/` in the built Astro site.

## Local editing

Run the Decap local backend and Astro dev server in separate terminals:

```bash
npm run cms
npm run dev
```

The local Decap backend is configured to use port `8082` because `8081` is commonly already occupied.

Then open:

```text
http://localhost:4321/admin/
```

If `8082` is also busy, pick another port and update both places:

```json
"cms": "PORT=8090 npx decap-server"
```

```yaml
local_backend:
  url: http://localhost:8090/api/v1
```

Article content is stored in:

```text
src/content/articles/*.md
```

Uploaded CMS media is stored in:

```text
public/media/
```

and is published at:

```text
/media/...
```

## Production editing

`public/admin/config.yml` is configured for the GitHub backend:

```yaml
backend:
  name: github
  repo: justinkinney/justinkinney-web
  branch: main
  base_url: https://decap-oauth.justinkinney.com
  auth_endpoint: auth
  site_domain: justinkinney.com
```

GitHub OAuth requires a small server-side OAuth provider because GitHub cannot safely exchange the client secret from a static S3-hosted admin page. Configure the GitHub OAuth app with:

```text
Homepage URL: https://justinkinney.com
Authorization callback URL: https://decap-oauth.justinkinney.com/callback
```

Then deploy an OAuth proxy at `https://decap-oauth.justinkinney.com` that implements:

- `/auth` to redirect Decap CMS to GitHub's authorization flow.
- `/callback` to exchange the GitHub authorization code and `postMessage` the token back to Decap CMS.

Only GitHub users with push access to `justinkinney/justinkinney-web` can publish content through the CMS.

## Build and deploy

```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name/ --delete
```
