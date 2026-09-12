# myyqii-research-api

Cloudflare Worker + R2 backend for the MyyQii research listen log.

## Setup

1. Create a Cloudflare API token with **Workers Scripts: Edit** and **Workers R2 Storage: Edit**
2. `npx wrangler r2 bucket create myyqii-research`
3. `npx wrangler secret put PUBLISH_SECRET` (long random string — used as Bearer token from the research form)
4. `npx wrangler deploy`

## API

- `GET /listens` — public
- `GET /photos/:id` — public
- `POST /listens` — Bearer `PUBLISH_SECRET`; JSON body with artist + optional track/label/note/photo (data URL)
- `DELETE /listens/:id` — Bearer `PUBLISH_SECRET`
