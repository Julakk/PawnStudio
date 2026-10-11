// Cari & Ganti di semua file (panel sidebar)
(function () {
  "use strict";
  const SKIP = new Set([".git", "node_modules", ".gradle", "build", ".idea"]);
  const BIN = /\.(png|jpe?g|gif|webp|ico|bmp|avif|zip|jar|apk|so|ttf|otf|woff2?|mp3|mp4|ogg|wav|pdf|amx|exe|dll|class)$/i;
  const MAX_FILES = 3000, MAX_MATCH = 1000, MAX_SIZE = 1000000;
  const opt = { case: false, word: false, regex: false };
  let results = [], busy = false;
  const $ = (id) => document.getElementById(id);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const kids = (r) => (Array.isArray(r) ? r : (r && r.children) || []);
  const isDir = (c) => c && (c.type === "directory" || c.type === "folder" || c.type === "dir" ||
    c.isDirectory === true || c.isDir === true || c.kind === "dir" || c.kind === "directory" || Array.isArray(c.children));

  function buildRe(q, global) {
    let src = q;
    if (!opt.regex) src = src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (opt.word) src = "\\b(?:" + src + ")\\b";
    return new RegExp(src, (global ? "g" : "") + (opt.case ? "" : "i") + (opt.regex ? "m" : ""));
  }
  async function readText(path) {
    const c = await FileManager.readFile(path);
    return typeof c === "string" ? c : c && typeof c.content === "string" ? c.content : null;
  }
  async function collect(exts) {
    const files = [];
    const stack = kids(await FileManager.listTree()).slice();
    let n = 0;
    while (stack.length && files.length < MAX_FILES) {
      const c = stack.shift();
      const name = c.name || String(c.path).split("/").pop();
      if (isDir(c)) {
        if (SKIP.has(name)) continue;
        try {
          const sub = Array.isArray(c.children) && c.children.length ? c.children : kids(await FileManager.listDir(c.path));
          stack.push(...sub);
        } catch (e) {}
      } else {
        if (BIN.test(name)) continue;
        if (exts.length && !exts.some((x) => name.toLowerCase().endsWith(x))) continue;
        files.push(c.path);
      }
      if (++n % 15 === 0) await tick();
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
  function syncModels(path, text) {
    try {
      const p0 = path.replace(/^\//, "");
      monaco.editor.getModels().forEach((m) => {
        const p = decodeURIComponent(m.uri.path || "").replace(/^\//, "");
        if (p === p0 || p.endsWith("/" + p0)) m.setValue(text);
      });
    } catch (e) {}
  }
  const status = (t) => { $("sp-status").textContent = t; };

  async function doSearch() {
    if (busy) return;
    const q = $("sp-find").value;
    if (!q) return status("Ketik kata yang dicari.");
    let re;
    try { re = buildRe(q, true); } catch (e) { return status("Regex tidak valid: " + e.message); }
    const exts = $("sp-ext").value.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
      .map((s) => (s[0] === "." ? s : "." + s));
    busy = true; results = []; $("sp-results").innerHTML = ""; status("Mencari...");
    try {
      const files = await collect(exts);
      let total = 0, i = 0;
      for (const path of files) {
        if (++i % 10 === 0) { status("Memeriksa " + i + "/" + files.length + " file..."); await tick(); }
        let content;
        try { content = await readText(path); } catch (e) { continue; }
        if (content == null || content.length > MAX_SIZE || content.indexOf("\u0000") >= 0) continue;
        const ms = scan(content, re, MAX_MATCH - total);
        if (ms.length) { results.push({ path, matches: ms }); total += ms.length; }
        if (total >= MAX_MATCH) break;
      }
      render(total, files.length);
    } catch (e) { status("Gagal mencari: " + e.message); }
    busy = false;
  }

  function render(total, nFiles) {
    const box = $("sp-results"); box.innerHTML = "";
    status(total ? total + " hasil di " + results.length + " file" + (total >= MAX_MATCH ? " (dibatasi, persempit pencarian)" : "")
      : "Tidak ada hasil (" + nFiles + " file diperiksa).");
    for (const r of results) {
      const head = document.createElement("div");
      head.className = "sp-file";
      head.textContent = r.path + "  (" + r.matches.length + ")";
      const list = document.createElement("div");
      head.onclick = () => { list.style.display = list.style.display === "none" ? "" : "none"; };
      box.append(head, list);
      for (const m of r.matches) {
        const row = document.createElement("div"); row.className = "sp-row";
        const txt = document.createElement("span"); txt.className = "sp-text";
        const t = m.text, from = Math.max(0, m.col - 20);
        const mk = document.createElement("mark"); mk.textContent = t.substr(m.col, m.len);
        txt.append(document.createTextNode(m.line + ": " + (from ? "…" : "") + t.slice(from, m.col)), mk,
          document.createTextNode(t.slice(m.col + m.len, m.col + m.len + 60)));
        txt.onclick = () => jump(r.path, m);
        const b = document.createElement("button"); b.className = "sp-one"; b.textContent = "Ganti"; b.title = "Ganti hasil ini saja";
        b.onclick = async () => { if (await replaceOne(r.path, m)) doSearch(); };
        row.append(txt, b); list.append(row);
      }
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
    await FileManager.writeFile(path, out); syncModels(path, out);
    return true;
  }

  async function replaceAll() {
    if (busy || !results.length) return status("Cari dulu sebelum Ganti Semua.");
    const repl = $("sp-repl").value;
    const total = results.reduce((a, r) => a + r.matches.length, 0);
    if (!confirm("Ganti " + total + " kecocokan di " + results.length + " file dengan:\n\n" + (repl || "(kosong)") + "\n\nTidak bisa di-undo.")) return;
    busy = true;
    let re; try { re = buildRe($("sp-find").value, true); } catch (e) { busy = false; return status(e.message); }
    let done = 0;
    for (const r of results) {
      try {
        const c = await readText(r.path);
        const out = c.replace(re, opt.regex ? repl : () => repl);
        if (out !== c) { await FileManager.writeFile(r.path, out); syncModels(r.path, out); done++; }
      } catch (e) {}
      await tick();
    }
    busy = false; status("Selesai: " + done + " file diubah."); doSearch();
  }

  function build() {
    const sb = $("sidebar"); if (!sb || $("search-panel")) return;
    const css = document.createElement("style");
    css.textContent = `
#sidebar.search-mode > :not(#search-panel){display:none !important}
#search-panel{display:none;flex-direction:column;height:100%;overflow:hidden;font-size:13px;color:#ccc}
#sidebar.search-mode #search-panel{display:flex}
#search-panel .sp-top{padding:8px;display:flex;flex-direction:column;gap:6px}
#search-panel .sp-title{font-size:11px;letter-spacing:.5px;opacity:.7}
#search-panel input{background:#3c3c3c;border:1px solid #555;color:#eee;padding:8px;font-size:14px;border-radius:4px;width:100%;box-sizing:border-box}
#search-panel .sp-line{display:flex;gap:4px}
#search-panel button{background:#0e639c;color:#fff;border:0;border-radius:4px;min-height:34px;padding:0 10px;font-size:13px}
#search-panel button.sp-opt{background:#3c3c3c;flex:0 0 auto;min-width:40px}
#search-panel button.sp-opt.on{background:#0e639c}
#search-panel #sp-status{padding:2px 8px;opacity:.75;font-size:12px}
#search-panel #sp-results{overflow:auto;flex:1;padding-bottom:40px}
.sp-file{padding:6px 8px;background:#2a2d2e;font-weight:600;word-break:break-all}
.sp-row{display:flex;align-items:center;gap:4px;padding:4px 8px}
.sp-text{flex:1;word-break:break-all;white-space:pre-wrap;font-family:monospace;font-size:12px}
.sp-text mark{background:#613214;color:#fff}
#search-panel button.sp-one{min-height:26px;font-size:11px;padding:0 6px;background:#444}`;
    document.head.appendChild(css);
    const p = document.createElement("div"); p.id = "search-panel";
    p.innerHTML = `<div class="sp-top"><div class="sp-title">CARI &amp; GANTI (SEMUA FILE)</div>
<div class="sp-line"><input id="sp-find" placeholder="Cari"><button class="sp-opt" data-o="case" title="Huruf besar/kecil">Aa</button><button class="sp-opt" data-o="word" title="Kata utuh">ab</button><button class="sp-opt" data-o="regex" title="Regex">.*</button></div>
<input id="sp-repl" placeholder="Ganti dengan"><input id="sp-ext" placeholder="Filter ekstensi, contoh: .pwn,.inc">
<div class="sp-line"><button id="sp-go" style="flex:1">Cari</button><button id="sp-all" style="flex:1;background:#a1260d">Ganti Semua</button></div></div>
<div id="sp-status"></div><div id="sp-results"></div>`;
    sb.appendChild(p);
    p.querySelectorAll(".sp-opt").forEach((b) => b.onclick = () => { opt[b.dataset.o] = !opt[b.dataset.o]; b.classList.toggle("on", opt[b.dataset.o]); });
    $("sp-go").onclick = doSearch; $("sp-all").onclick = replaceAll;
    $("sp-find").addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });

    const sBtn = $("activity-search"), eBtn = $("activity-explorer");
    sBtn.addEventListener("click", () => {
      if (sb.classList.contains("search-mode") && !sb.classList.contains("hidden")) { sb.classList.add("hidden"); sBtn.classList.remove("active"); return; }
      sb.classList.add("search-mode"); sb.classList.remove("hidden");
      sBtn.classList.add("active"); eBtn.classList.remove("active");
      setTimeout(() => $("sp-find").focus(), 50);
    });
    eBtn.addEventListener("click", () => {
      if (sb.classList.contains("search-mode")) { sb.classList.remove("search-mode"); sb.classList.remove("hidden"); sBtn.classList.remove("active"); eBtn.classList.add("active"); }
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
