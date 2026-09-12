# MyyQii research — listen log

Manual-first log for intentional electronic listening (DJ / produce).

## Use

1. Open `/research/`
2. Paste your **publish key** (needed to save/delete; not stored in the browser)
3. Log artist (+ optional track, label, note, photo)
4. Entries + photos live in **Cloudflare R2** and are visible to anyone on the page

`Cmd/Ctrl+Enter` saves. Photos are compressed in-browser before upload.

## Backend

- Worker: `https://myyqii-research-api.myyqii.workers.dev`
- Public: `GET /listens`, `GET /photos/:id`
- Auth: `POST` / `DELETE` with `Authorization: Bearer <PUBLISH_SECRET>`

Clubs/festivals are not on this form — separate outing entries later.
