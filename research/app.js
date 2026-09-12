(() => {
  const STORAGE_KEY = "myyqii-research-v1";
  const form = document.getElementById("listen-form");
  const listEl = document.getElementById("listen-list");
  const emptyEl = document.getElementById("empty");
  const statusEl = document.getElementById("form-status");
  const fields = {
    at: document.getElementById("at"),
    artist: document.getElementById("artist"),
    track: document.getElementById("track"),
    label: document.getElementById("label"),
    note: document.getElementById("note"),
  };

  function todayISO() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { version: 1, listens: [] };
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.listens)) return { version: 1, listens: [] };
      return { version: 1, listens: data.listens };
    } catch {
      return { version: 1, listens: [] };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  function clean(s) {
    return (s || "").trim().replace(/\s+/g, " ");
  }

  function uid() {
    return crypto.randomUUID ? crypto.randomUUID() : `l_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  function refreshSuggest(data) {
    fillDatalist("artist-list", uniqueSorted(data.listens.map((l) => l.artist)));
    fillDatalist("label-list", uniqueSorted(data.listens.map((l) => l.label)));
  }

  function render(data) {
    const listens = [...data.listens].sort((a, b) => (b.at || "").localeCompare(a.at || "") || (b.createdAt || "").localeCompare(a.createdAt || ""));
    listEl.innerHTML = "";
    emptyEl.classList.toggle("show", listens.length === 0);
    for (const l of listens) {
      const li = document.createElement("li");
      const main = document.createElement("div");
      main.className = "listen-main";
      const title = document.createElement("p");
      title.className = "listen-title";
      title.textContent = l.track ? `${l.artist} — ${l.track}` : l.artist;
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
      del.setAttribute("aria-label", "Delete listen");
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        data.listens = data.listens.filter((x) => x.id !== l.id);
        save(data);
        refreshSuggest(data);
        render(data);
      });
      li.append(main, del);
      listEl.append(li);
    }
  }

  function flash(msg, ok = true) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("ok", ok);
    clearTimeout(flash._t);
    flash._t = setTimeout(() => {
      statusEl.textContent = "";
      statusEl.classList.remove("ok");
    }, 2200);
  }

  let data = load();
  fields.at.value = todayISO();
  refreshSuggest(data);
  render(data);
  fields.artist.focus();

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const artist = clean(fields.artist.value);
    if (!artist) {
      fields.artist.focus();
      return;
    }
    const entry = {
      id: uid(),
      at: fields.at.value || todayISO(),
      artist,
      track: clean(fields.track.value) || undefined,
      label: clean(fields.label.value) || undefined,
      note: clean(fields.note.value) || undefined,
      source: "manual",
      createdAt: new Date().toISOString(),
    };
    Object.keys(entry).forEach((k) => entry[k] === undefined && delete entry[k]);
    data.listens.push(entry);
    save(data);
    refreshSuggest(data);
    render(data);
    fields.track.value = "";
    fields.note.value = "";
    // Keep date/artist/label for rapid related entries; jump to track
    fields.track.focus();
    flash("Saved");
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
    a.download = `myyqii-listens-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    flash("Exported");
  });

  document.getElementById("import-file").addEventListener("change", async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const listens = Array.isArray(parsed) ? parsed : parsed.listens;
      if (!Array.isArray(listens)) throw new Error("bad shape");
      data = { version: 1, listens };
      save(data);
      refreshSuggest(data);
      render(data);
      flash("Imported");
    } catch {
      flash("Import failed — need { listens: [...] }", false);
    }
  });
})();
