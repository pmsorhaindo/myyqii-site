/**
 * MyyQii research API
 * GET  /listens          -> public JSON
 * GET  /photos/:id       -> public image bytes
 * POST /listens          -> create listen (+ optional photo) — requires Authorization: Bearer <PUBLISH_SECRET>
 * DELETE /listens/:id    -> delete listen (+ photo) — requires Bearer
 * OPTIONS *              -> CORS
 */

const LISTENS_KEY = "listens.json";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors, ...extra },
  });
}

function unauthorized() {
  return json({ error: "unauthorized" }, 401);
}

function requirePublish(request, env) {
  const secret = env.PUBLISH_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  return token && token === secret;
}

async function loadListens(bucket) {
  const obj = await bucket.get(LISTENS_KEY);
  if (!obj) return { version: 1, listens: [] };
  try {
    const data = await obj.json();
    if (!data || !Array.isArray(data.listens)) return { version: 1, listens: [] };
    return { version: 1, listens: data.listens };
  } catch {
    return { version: 1, listens: [] };
  }
}

async function saveListens(bucket, data) {
  await bucket.put(LISTENS_KEY, JSON.stringify(data, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
  });
}

function uid() {
  return crypto.randomUUID();
}

function clean(s) {
  return String(s || "").trim().replace(/\s+/g, " ");
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      if (request.method === "GET" && (path === "/listens" || path === "/")) {
        const data = await loadListens(env.BUCKET);
        return json(data, 200, { "Cache-Control": "public, max-age=30" });
      }

      if (request.method === "GET" && path.startsWith("/photos/")) {
        const id = decodeURIComponent(path.slice("/photos/".length));
        if (!id || id.includes("..") || id.includes("/")) {
          return json({ error: "bad id" }, 400);
        }
        // try common keys
        const keys = [`photos/${id}.jpg`, `photos/${id}.jpeg`, `photos/${id}.png`, `photos/${id}.webp`];
        let obj = null;
        let key = null;
        for (const k of keys) {
          obj = await env.BUCKET.get(k);
          if (obj) {
            key = k;
            break;
          }
        }
        if (!obj) return json({ error: "not found" }, 404);
        const headers = new Headers(cors);
        headers.set("Content-Type", obj.httpMetadata?.contentType || "image/jpeg");
        headers.set("Cache-Control", "public, max-age=86400");
        return new Response(obj.body, { status: 200, headers });
      }

      if (request.method === "POST" && path === "/listens") {
        if (!requirePublish(request, env)) return unauthorized();
        const body = await request.json();
        const artist = clean(body.artist);
        if (!artist) return json({ error: "artist required" }, 400);

        const id = body.id || uid();
        const entry = {
          id,
          at: clean(body.at) || new Date().toISOString().slice(0, 10),
          artist,
          source: "manual",
          createdAt: new Date().toISOString(),
        };
        const track = clean(body.track);
        const label = clean(body.label);
        const note = clean(body.note);
        if (track) entry.track = track;
        if (label) entry.label = label;
        if (note) entry.note = note;

        // optional photo as base64 data URL
        if (body.photo && typeof body.photo === "string" && body.photo.startsWith("data:image/")) {
          const m = body.photo.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
          if (!m) return json({ error: "bad photo" }, 400);
          const mime = m[1];
          const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
          const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
          const photoKey = `photos/${id}.${ext}`;
          await env.BUCKET.put(photoKey, bin, {
            httpMetadata: { contentType: mime },
          });
          entry.photoPath = photoKey;
          // public URL path relative to this worker
          entry.photoUrl = `/photos/${id}`;
        }

        const data = await loadListens(env.BUCKET);
        data.listens.push(entry);
        await saveListens(env.BUCKET, data);
        return json({ ok: true, listen: entry }, 201);
      }

      if (request.method === "DELETE" && path.startsWith("/listens/")) {
        if (!requirePublish(request, env)) return unauthorized();
        const id = decodeURIComponent(path.slice("/listens/".length));
        const data = await loadListens(env.BUCKET);
        const existing = data.listens.find((l) => l.id === id);
        if (!existing) return json({ error: "not found" }, 404);
        data.listens = data.listens.filter((l) => l.id !== id);
        await saveListens(env.BUCKET, data);
        if (existing.photoPath) {
          try {
            await env.BUCKET.delete(existing.photoPath);
          } catch (_) {}
        } else {
          for (const ext of ["jpg", "jpeg", "png", "webp"]) {
            try {
              await env.BUCKET.delete(`photos/${id}.${ext}`);
            } catch (_) {}
          }
        }
        return json({ ok: true });
      }

      return json({ error: "not found" }, 404);
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500);
    }
  },
};
