// Cari & Ganti di semua file (panel sidebar) v2
(function () {
  "use strict";
  const SKIP = new Set([".git", "node_modules", ".gradle", "build", ".idea"]);
  const BIN = /\.(png|jpe?g|gif|webp|ico|bmp|avif|zip|jar|apk|so|ttf|otf|woff2?|mp3|mp4|ogg|wav|pdf|amx|exe|dll|class)$/i;
  const TEXT = [".pwn", ".inc", ".p", ".txt", ".json", ".cfg", ".ini", ".md", ".html", ".htm", ".css", ".js", ".xml", ".yml", ".yaml", ".sql", ".php", ".lua", ".sh"];
  const MAX_FILES = 6000, MAX_MATCH = 1000, MAX_SIZE = 1000000, CONC = 8, TTL = 300000, CACHE_MAX = 30000000;
  const opt = { case: false, word: false, regex: false };
  const cache = new Map();
  let cacheSize = 0, allFiles = null, stamp = 0;
  let results = [], total = 0, busy = false, cancel = false;
  const $ = (id) => document.getElementById(id);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const kids = (r) => (Array.isArray(r) ? r : (r && r.children) || []);
  const isDir = (c) => c && (c.type === "directory" || c.type === "folder" || c.type === "dir" ||
    c.isDirectory === true || c.isDir === true || c.kind === "dir" || c.kind === "directory" || Array.isArray(c.children));
  const status = (t) => { $("sp-status").textContent = t; };
  const bar = (p) => { $("sp-prog").style.width = p + "%"; $("sp-barwrap").style.opacity = p >= 100 || p <= 0 ? 0 : 1; };

  async function pool(items, n, fn) {
    let i = 0;
    await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const x = items[i++]; await fn(x); }
    }));
  }
  function buildRe(q, global) {
    let src = q;
    if (!opt.regex) src = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (opt.word) src = "\\b(?:" + src + ")\\b";
    return new RegExp(src, (global ? "g" : "") + (opt.case ? "" : "i"));
  }
  async function readText(path) {
    const c = await FileManager.readFile(path);
    return typeof c === "string" ? c : c && typeof c.content === "string" ? c.content : null;
  }
  async function collect() {
    const files = [];
    let level = kids(await FileManager.listTree());
    while (level.length && files.length < MAX_FILES) {
      const subdirs = [], next = [];
      for (const c of level) {
        const name = c.name || String(c.path).split("/").pop();
        if (isDir(c)) { if (!SKIP.has(name)) subdirs.push(c); }
        else if (!BIN.test(name)) files.push({ path: c.path, name, size: c.size });
      }
      status("Membaca struktur folder... " + files.length + " file");
      await pool(subdirs, CONC, async (d) => {
        try {
          const sub = Array.isArray(d.children) && d.children.length ? d.children : kids(await FileManager.listDir(d.path));
          next.push(...sub);
        } catch (e) {}
      });
      level = next;
    }
    return files;
  }
  function scan(text, re, cap) {
    const out = [], lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i].replace(/\r$/, "");
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(ln))) {
        if (m[0] === "") { re.lastIndex++; continue; }
        out.push({ line: i + 1, col: m.index, len: m[0].length, text: ln });
        if (out.length >= cap) return out;
      }
    }
    return out;
  }
  function setCache(path, text) {
    if (cache.has(path)) { const o = cache.get(path); cacheSize -= o ? o.length : 0; }
    if (text && cacheSize + text.length > CACHE_MAX) return;
    cache.set(path, text); cacheSize += text ? text.length : 0;
  }
  function syncModels(path, text) {
    try {
      const p0 = path.replace(/^\//, "");
      monaco.editor.getModels().forEach((m) => {
        const p = decodeURIComponent(m.uri.path || "").replace(/^\//, "");
        if (p === p0 || p.endsWith("/" + p0)) m.setValue(text);
      });
    } catch (e) {}
  }

  async function doSearch() {
    if (busy) { cancel = true; return; }
    const q = $("sp-find").value;
    if (!q) return status("Ketik kata yang dicari.");
    let reG, reT;
    try { reG = buildRe(q, true); reT = buildRe(q, false); } catch (e) { return status("Regex tidak valid: " + e.message); }
    const toks = $("sp-ext").value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    const all = toks.includes("*");
    const exts = all ? [] : toks.length ? toks.map((s) => (s[0] === "." ? s : "." + s)) : TEXT;
    busy = true; cancel = false; results = []; total = 0;
    $("sp-results").innerHTML = ""; $("sp-go").textContent = "Stop"; bar(1);
    try {
      if (!allFiles || Date.now() - stamp > TTL) {
        cache.clear(); cacheSize = 0; allFiles = await collect(); stamp = Date.now();
      }
      const files = allFiles.filter((f) => !(f.size > MAX_SIZE) && (all || exts.some((x) => f.name.toLowerCase().endsWith(x))));
      let done = 0;
      status("Mencari di " + files.length + " file...");
      await pool(files, CONC, async (f) => {
        if (cancel || total >= MAX_MATCH) return;
        let text;
        if (cache.has(f.path)) text = cache.get(f.path);
        else {
          try { text = await readText(f.path); } catch (e) { text = null; }
          if (text != null && (text.length > MAX_SIZE || text.indexOf("\u0000") >= 0)) text = null;
          setCache(f.path, text);
        }
        done++;
        if (done % 10 === 0) {
          bar(Math.round((done / files.length) * 100));
          status(total + " hasil · memeriksa " + done + "/" + files.length);
        }
        if (text && reT.test(text)) {
          const ms = scan(text, reG, MAX_MATCH - total);
          if (ms.length) { const r = { path: f.path, matches: ms }; results.push(r); total += ms.length; addResult(r); }
        }
      });
      status(cancel ? "Dihentikan · " + total + " hasil di " + results.length + " file"
        : total ? total + " hasil di " + results.length + " file" + (total >= MAX_MATCH ? " (dibatasi, persempit pencarian)" : "")
        : "Tidak ada hasil (" + files.length + " file diperiksa).");
    } catch (e) { status("Gagal mencari: " + e.message); }
    busy = false; cancel = false; bar(0); $("sp-go").textContent = "Cari";
  }

  function addResult(r) {
    const box = $("sp-results");
    const head = document.createElement("div"); head.className = "sp-file";
    const i = r.path.lastIndexOf("/");
    const fn = document.createElement("span"); fn.className = "sp-fn"; fn.textContent = r.path.slice(i + 1);
    const dr = document.createElement("span"); dr.className = "sp-dir"; dr.textContent = i > 0 ? r.path.slice(0, i) : "";
    const ct = document.createElement("span"); ct.className = "sp-cnt"; ct.textContent = r.matches.length;
    head.append(fn, dr, ct);
    const list = document.createElement("div");
    head.onclick = () => { list.style.display = list.style.display === "none" ? "" : "none"; };
    box.append(head, list);
    for (const m of r.matches) {
      const row = document.createElement("div"); row.className = "sp-row";
      const ln = document.createElement("span"); ln.className = "sp-ln"; ln.textContent = m.line;
      const txt = document.createElement("span"); txt.className = "sp-text";
      const t = m.text, from = Math.max(0, m.col - 24);
      const mk = document.createElement("mark"); mk.textContent = t.substr(m.col, m.len);
      txt.append(document.createTextNode((from ? "…" : "") + t.slice(from, m.col)), mk,
        document.createTextNode(t.slice(m.col + m.len, m.col + m.len + 70)));
      row.onclick = () => jump(r.path, m);
      const b = document.createElement("button"); b.className = "sp-one"; b.textContent = "Ganti";
      b.onclick = async (e) => { e.stopPropagation(); if (await replaceOne(r.path, m)) doSearch(); };
      row.append(ln, txt, b); list.append(row);
    }
  }

  async function jump(path, m) {
    try { await (window.openFile || openFile)(path); } catch (e) {}
    setTimeout(() => {
      try {
        const ed = (monaco.editor.getEditors ? monaco.editor.getEditors() : [])[0];
        if (ed) {
          ed.revealLineInCenter(m.line);
          ed.setSelection(new monaco.Selection(m.line, m.col + 1, m.line, m.col + 1 + m.len));
          ed.focus();
        }
      } catch (e) {}
      if (window.innerWidth < 700) $("sidebar").classList.add("hidden");
    }, 150);
  }

  async function replaceOne(path, m) {
    const repl = $("sp-repl").value;
    const content = await readText(path);
    const lines = content.split("\n"), raw = lines[m.line - 1];
    if (raw === undefined || raw.replace(/\r$/, "") !== m.text) { status("Baris sudah berubah, cari ulang."); return false; }
    const seg = raw.substr(m.col, m.len);
    const nw = opt.regex ? seg.replace(buildRe($("sp-find").value, false), repl) : repl;
    lines[m.line - 1] = raw.slice(0, m.col) + nw + raw.slice(m.col + m.len);
    const out = lines.join("\n");
    await FileManager.writeFile(path, out); setCache(path, out); syncModels(path, out);
    return true;
  }

  async function replaceAll() {
    if (busy || !results.length) return status("Cari dulu sebelum Ganti Semua.");
    const repl = $("sp-repl").value;
    const n = results.reduce((a, r) => a + r.matches.length, 0);
    if (!confirm("Ganti " + n + " kecocokan di " + results.length + " file dengan:\n\n" + (repl || "(kosong)") + "\n\nTidak bisa di-undo.")) return;
    let re; try { re = buildRe($("sp-find").value, true); } catch (e) { return status(e.message); }
    busy = true; let done = 0;
    for (const r of results) {
      try {
        const c = await readText(r.path);
        const out = c.replace(re, opt.regex ? repl : () => repl);
        if (out !== c) { await FileManager.writeFile(r.path, out); setCache(r.path, out); syncModels(r.path, out); done++; }
      } catch (e) {}
      await tick();
    }
    busy = false; status("Selesai: " + done + " file diubah."); doSearch();
  }

  function build() {
    const sb = $("sidebar"); if (!sb || $("search-panel")) return;
    const css = document.createElement("style");
    css.textContent = `
#sidebar.search-mode{width:calc(100vw - 46px) !important;max-width:none !important;min-width:0 !important}
@media(min-width:700px){#sidebar.search-mode{width:400px !important}}
#sidebar.search-mode > :not(#search-panel){display:none !important}
#search-panel{display:none;flex-direction:column;height:100%;overflow:hidden;font-size:14px;color:#ccc;background:#252526}
#sidebar.search-mode #search-panel{display:flex}
#search-panel .sp-head{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;font-size:12px;letter-spacing:.6px;opacity:.85;border-bottom:1px solid #333}
#search-panel .sp-head button{background:none;color:#ccc;font-size:18px;min-height:30px;padding:0 8px}
#search-panel .sp-top{padding:10px 12px;display:flex;flex-direction:column;gap:8px}
#search-panel input{background:#3c3c3c;border:1px solid #555;color:#eee;padding:0 10px;height:42px;font-size:15px;border-radius:6px;width:100%;box-sizing:border-box;outline:none}
#search-panel input:focus{border-color:#0e8ad9}
#search-panel .sp-line{display:flex;gap:6px}
#search-panel button{background:#0e639c;color:#fff;border:0;border-radius:6px;min-height:40px;padding:0 12px;font-size:14px}
#search-panel button.sp-opt{background:#3c3c3c;flex:0 0 auto;min-width:46px;font-weight:600}
#search-panel button.sp-opt.on{background:#0e639c}
#search-panel #sp-ext{flex:1;min-width:0;height:40px;font-size:13px}
#sp-barwrap{height:3px;background:transparent;transition:opacity .2s;opacity:0}
#sp-prog{height:3px;width:0;background:#0e8ad9;transition:width .15s}
#search-panel #sp-status{padding:6px 12px;opacity:.75;font-size:12px}
#search-panel #sp-results{overflow:auto;flex:1;padding-bottom:48px;-webkit-overflow-scrolling:touch}
.sp-file{display:flex;align-items:baseline;gap:8px;padding:8px 12px;background:#2d2d30;position:sticky;top:0;border-top:1px solid #1e1e1e}
.sp-fn{font-weight:600;color:#e8e8e8;white-space:nowrap}
.sp-dir{flex:1;min-width:0;opacity:.5;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;direction:rtl;text-align:left}
.sp-cnt{background:#0e639c;color:#fff;border-radius:10px;padding:0 8px;font-size:11px}
.sp-row{display:flex;align-items:center;gap:8px;padding:7px 12px;border-bottom:1px solid #2a2a2a}
.sp-row:active{background:#37373d}
.sp-ln{flex:0 0 auto;min-width:34px;text-align:right;opacity:.5;font-size:11px;font-family:monospace}
.sp-text{flex:1;min-width:0;word-break:break-all;white-space:pre-wrap;font-family:monospace;font-size:12px}
.sp-text mark{background:#7a4a14;color:#fff;border-radius:2px}
#search-panel button.sp-one{min-height:28px;font-size:11px;padding:0 8px;background:#444}`;
    document.head.appendChild(css);
    const p = document.createElement("div"); p.id = "search-panel";
    p.innerHTML = `<div class="sp-head"><span>CARI &amp; GANTI · SEMUA FILE</span><button id="sp-close" title="Tutup">✕</button></div>
<div class="sp-top">
<input id="sp-find" placeholder="Cari di semua file" autocomplete="off" autocapitalize="off" spellcheck="false">
<input id="sp-repl" placeholder="Ganti dengan" autocomplete="off" autocapitalize="off" spellcheck="false">
<div class="sp-line"><button class="sp-opt" data-o="case" title="Huruf besar/kecil">Aa</button><button class="sp-opt" data-o="word" title="Kata utuh">ab</button><button class="sp-opt" data-o="regex" title="Regex">.*</button><input id="sp-ext" placeholder=".pwn,.inc  (* = semua)" autocapitalize="off"></div>
<div class="sp-line"><button id="sp-go" style="flex:1">Cari</button><button id="sp-all" style="flex:1;background:#a1260d">Ganti Semua</button></div></div>
<div id="sp-barwrap"><div id="sp-prog"></div></div><div id="sp-status"></div><div id="sp-results"></div>`;
    sb.appendChild(p);
    p.querySelectorAll(".sp-opt").forEach((b) => b.onclick = () => { opt[b.dataset.o] = !opt[b.dataset.o]; b.classList.toggle("on", opt[b.dataset.o]); });
    $("sp-go").onclick = doSearch; $("sp-all").onclick = replaceAll;
    $("sp-find").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    const sBtn = $("activity-search"), eBtn = $("activity-explorer");
    $("sp-close").onclick = () => { sb.classList.add("hidden"); sBtn.classList.remove("active"); };
    sBtn.addEventListener("click", () => {
      if (sb.classList.contains("search-mode") && !sb.classList.contains("hidden")) { sb.classList.add("hidden"); sBtn.classList.remove("active"); return; }
      sb.classList.add("search-mode"); sb.classList.remove("hidden");
      sBtn.classList.add("active"); eBtn.classList.remove("active");
      setTimeout(() => $("sp-find").focus(), 50);
    });
    eBtn.addEventListener("click", () => setTimeout(() => {
      if (sb.classList.contains("search-mode")) { sb.classList.remove("search-mode"); sb.classList.remove("hidden"); sBtn.classList.remove("active"); eBtn.classList.add("active"); }
    }, 0));
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
