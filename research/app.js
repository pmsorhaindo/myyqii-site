(() => {
  const API_BASE = "https://myyqii-research-api.myyqii.workers.dev";
  const KEY_STORAGE = "myyqii-research-publish-key";
  const MAX_EDGE = 720;
  const JPEG_QUALITY = 0.72;

  const form = document.getElementById("listen-form");
  const listEl = document.getElementById("listen-list");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("form-status");
  const photoInput = document.getElementById("photo");
  const previewWrap = document.getElementById("photo-preview-wrap");
  const previewImg = document.getElementById("photo-preview");
  const photoClear = document.getElementById("photo-clear");
  const publishKeyInput = document.getElementById("publish-key");

  const fields = {
    at: document.getElementById("at"),
    artist: document.getElementById("artist"),
    track: document.getElementById("track"),
    label: document.getElementById("label"),
    note: document.getElementById("note"),
  };

  let pendingPhoto = null;
  let data = { version: 1, listens: [] };

  function todayISO() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function clean(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function flash(msg, ok = true) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("ok", ok);
    clearTimeout(flash._t);
    flash._t = setTimeout(() => {
      statusEl.textContent = "";
      statusEl.classList.remove("ok");
    }, 2500);
  }

  function getPublishKey() {
    return (publishKeyInput.value || localStorage.getItem(KEY_STORAGE) || "").trim();
  }

  if (publishKeyInput) {
    publishKeyInput.value = localStorage.getItem(KEY_STORAGE) || "";
    publishKeyInput.addEventListener("change", () => {
      localStorage.setItem(KEY_STORAGE, publishKeyInput.value.trim());
      flash("Publish key saved on this device");
    });
  }

  function uniqueSorted(values) {
    const map = new Map();
    for (const v of values) {
      const c = clean(v);
      if (!c) continue;
      const key = c.toLowerCase();
      if (!map.has(key)) map.set(key, c);
    }
    return [...map.values()].sort((a, b) => a.localeCompare(b));
  }

  function fillDatalist(id, values) {
    const el = document.getElementById(id);
    el.innerHTML = "";
    for (const v of values) {
      const opt = document.createElement("option");
      opt.value = v;
      el.appendChild(opt);
    }
  }

  function refreshSuggest() {
    fillDatalist("artist-list", uniqueSorted(data.listens.map((l) => l.artist)));
    fillDatalist("label-list", uniqueSorted(data.listens.map((l) => l.label)));
  }

  function photoSrc(l) {
    if (l.photoUrl) {
      return l.photoUrl.startsWith("http") ? l.photoUrl : ;
    }
    if (l.photo && String(l.photo).startsWith("data:")) return l.photo;
    return null;
  }

  function clearPhoto() {
    pendingPhoto = null;
    photoInput.value = "";
    previewImg.removeAttribute("src");
    previewWrap.classList.add("hidden");
  }

  function setPhotoPreview(dataUrl) {
    previewImg.src = dataUrl;
    previewWrap.classList.remove("hidden");
  }

  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        let { width, height } = img;
        const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
        width = Math.max(1, Math.round(width * scale));
        height = Math.max(1, Math.round(height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve({ dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), mime: "image/jpeg" });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Could not read image"));
      };
      img.src = url;
    });
  }

  photoInput.addEventListener("change", async () => {
    const file = photoInput.files && photoInput.files[0];
    if (!file) {
      clearPhoto();
      return;
    }
    try {
      flash("Compressing…");
      pendingPhoto = await compressImage(file);
      setPhotoPreview(pendingPhoto.dataUrl);
      flash("Photo ready");
    } catch {
      clearPhoto();
      flash("Could not use that image", false);
    }
  });
  photoClear.addEventListener("click", clearPhoto);

  function render() {
    const listens = [...data.listens].sort(
      (a, b) =>
        (b.at || "").localeCompare(a.at || "") ||
        (b.createdAt || "").localeCompare(a.createdAt || "")
    );
    listEl.innerHTML = "";
    emptyEl.classList.toggle("show", listens.length === 0);
    for (const l of listens) {
      const li = document.createElement("li");
      const src = photoSrc(l);
      if (src) {
        const thumb = document.createElement("img");
        thumb.className = "listen-thumb";
        thumb.src = src;
        thumb.alt = "";
        li.append(thumb);
      } else {
        const ph = document.createElement("div");
        ph.className = "listen-thumb placeholder";
        ph.textContent = "—";
        ph.setAttribute("aria-hidden", "true");
        li.append(ph);
      }

      const main = document.createElement("div");
      main.className = "listen-main";
      const title = document.createElement("p");
      title.className = "listen-title";
      title.textContent = l.track ?  : l.artist;
      const meta = document.createElement("p");
      meta.className = "listen-meta";
      const bits = [l.at];
      if (l.label) bits.push(l.label);
      meta.textContent = bits.join(" · ");
      main.append(title, meta);
      if (l.note) {
        const note = document.createElement("p");
        note.className = "listen-note";
        note.textContent = l.note;
        main.append(note);
      }

      const del = document.createElement("button");
      del.type = "button";
      del.className = "del";
      del.textContent = "Delete";
      del.addEventListener("click", async () => {
        const key = getPublishKey();
        if (!key) {
          flash("Publish key required to delete", false);
          return;
        }
        const res = await fetch(, {
          method: "DELETE",
          headers: { Authorization:  },
        });
        if (!res.ok) {
          flash("Delete failed", false);
          return;
        }
        data.listens = data.listens.filter((x) => x.id !== l.id);
        refreshSuggest();
        render();
        flash("Deleted");
      });

      li.append(main, del);
      listEl.append(li);
    }
  }

  async function loadFromApi() {
    const res = await fetch(, { cache: "no-store" });
    if (!res.ok) throw new Error("load failed");
    const parsed = await res.json();
    data = { version: 1, listens: Array.isArray(parsed.listens) ? parsed.listens : [] };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const artist = clean(fields.artist.value);
    if (!artist) {
      fields.artist.focus();
      return;
    }
    const key = getPublishKey();
    if (!key) {
      flash("Add your publish key first", false);
      publishKeyInput?.focus();
      return;
    }
    const payload = {
      at: fields.at.value || todayISO(),
      artist,
      track: clean(fields.track.value) || undefined,
      label: clean(fields.label.value) || undefined,
      note: clean(fields.note.value) || undefined,
      photo: pendingPhoto ? pendingPhoto.dataUrl : undefined,
    };
    Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

    flash("Saving…");
    const res = await fetch(, {
      method: "POST",
      headers: {
        Authorization: ,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      flash(err.error === "unauthorized" ? "Bad publish key" : "Save failed", false);
      return;
    }
    const body = await res.json();
    if (body.listen) data.listens.push(body.listen);
    else await loadFromApi();
    refreshSuggest();
    render();
    fields.track.value = "";
    fields.note.value = "";
    clearPhoto();
    fields.track.focus();
    flash("Saved to R2");
  });

  form.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      form.requestSubmit();
    }
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = ;
    a.click();
    URL.revokeObjectURL(a.href);
    flash("Exported");
  });

  // Import becomes "bulk publish" only if key present — keep simple: disabled message
  document.getElementById("import-file").addEventListener("change", async (e) => {
    e.target.value = "";
    flash("Import to R2 coming later — use the form for now", false);
  });

  fields.at.value = todayISO();
  loadFromApi()
    .then(() => {
      refreshSuggest();
      render();
      fields.artist.focus();
    })
    .catch(() => {
      flash("Could not load shared listens", false);
      emptyEl.classList.add("show");
    });
})();
