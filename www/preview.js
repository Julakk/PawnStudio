// PawnStudio - Preview HTML/CSS/JS (v1.10.0)
// Gabungkan <link href>, <script src>, gambar lokal ke satu dokumen, tampil di iframe sandbox.
(function () {
  'use strict';
  var overlay = null, frame = null, titleEl = null, backBtn = null, modeBtn = null, btn = null;
  var currentPath = null, history = [], deps = {}, warned = {};
  var seq = 0, liveT = null, refreshT = null, scrollY = 0, scrollFor = null;
  var mode = 'split';
  try { var sm = localStorage.getItem('psPreviewMode'); if (sm === 'full' || sm === 'split') mode = sm; } catch (e) {}

  var MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
    svg: 'image/svg+xml', ico: 'image/x-icon', bmp: 'image/bmp', avif: 'image/avif' };

  function isHtml(p) { return /\.html?$/i.test(p || ''); }
  function norm(p) { return String(p || '').replace(/^\/+/, ''); }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
  function extOf(p) { var m = /\.([a-z0-9]+)$/i.exec(p || ''); return m ? m[1].toLowerCase() : ''; }
  function isRemote(u) { return /^([a-z][a-z0-9+.\-]*:|\/\/|#)/i.test(u); }
  function resolve(base, rel) {
    rel = rel.split('#')[0].split('?')[0];
    var parts = (rel.charAt(0) === '/' ? '' : base).split('/').filter(Boolean);
    rel.split('/').forEach(function (s) {
      if (!s || s === '.') return;
      if (s === '..') parts.pop(); else parts.push(s);
    });
    return parts.join('/');
  }
  function activePath() { try { return activeTabPath; } catch (e) { return null; } }
  function openTabFor(p) {
    try { return openTabs.find(function (t) { return norm(t.path) === norm(p); }); } catch (e) { return null; }
  }

  // Pakai isi editor kalau file terbuka (termasuk yang belum disimpan), kalau tidak baca dari disk.
  async function readAny(p) {
    var t = openTabFor(p);
    if (t && t.model) return t.model.getValue();
    var lastErr, tries = [p, '/' + p];
    for (var i = 0; i < tries.length; i++) {
      try { return await FileManager.readFile(tries[i]); } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('tidak ditemukan');
  }

  // ---- gambar lokal ----
  function toB64(x) {
    if (typeof x === 'string') { var k = x.indexOf('base64,'); return k >= 0 ? x.slice(k + 7) : x; }
    var u8 = Object.prototype.toString.call(x) === '[object ArrayBuffer]' ? new Uint8Array(x)
      : (x && x.buffer ? new Uint8Array(x.buffer, x.byteOffset || 0, x.byteLength) : null);
    if (!u8) throw new Error('format biner tidak dikenal');
    var s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return btoa(s);
  }
  async function readBase64(p) {
    var names = ['readFileBase64', 'readBase64', 'readFileBinary', 'readBinary', 'readFileAsBase64', 'readFileRaw'];
    var tries = [p, '/' + p], lastErr = null;
    for (var n = 0; n < names.length; n++) {
      var fn = FileManager[names[n]];
      if (typeof fn !== 'function') continue;
      for (var t = 0; t < tries.length; t++) {
        try { return toB64(await fn.call(FileManager, tries[t])); } catch (e) { lastErr = e; }
      }
    }
    throw lastErr || new Error('FileManager belum punya pembaca biner');
  }
  async function dataUri(path, cache) {
    if (cache[path]) return cache[path];
    var ext = extOf(path), mime = MIME[ext], uri;
    if (!mime) throw new Error('tipe .' + ext + ' tidak didukung');
    if (ext === 'svg') {
      uri = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(await readAny(path));
    } else {
      var b = await readBase64(path);
      if (b.length > 6000000) throw new Error('lebih dari 4 MB');
      uri = 'data:' + mime + ';base64,' + b;
    }
    cache[path] = uri;
    return uri;
  }
  async function inlineCssUrls(css, cssDir, cache, warns) {
    var re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g, m, map = {}, jobs = [];
    while ((m = re.exec(css))) {
      var ref = m[2].trim();
      if (!isRemote(ref) && jobs.indexOf(ref) < 0) jobs.push(ref);
    }
    for (var i = 0; i < jobs.length; i++) {
      try { map[jobs[i]] = await dataUri(resolve(cssDir, jobs[i]), cache); }
      catch (e) { warns.push('Gambar CSS tidak terbaca: ' + jobs[i] + ' (' + ((e && e.message) || e) + ')'); }
    }
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (full, q, r) {
      var u = map[r.trim()];
      return u ? 'url("' + u + '")' : full;
    });
  }

  // ---- panel Output ----
  function logLine(type, text) {
    var b = document.getElementById('output-panel-body');
    var pn = document.getElementById('output-panel');
    var created = false;
    if (!b) {
      try { if (typeof showOutputPanel === 'function') showOutputPanel(); } catch (e) {}
      b = document.getElementById('output-panel-body');
      pn = document.getElementById('output-panel');
      created = true;
    }
    if (!b) return;
    if (type === 'error' && pn && pn.classList.contains('hidden')) pn.classList.remove('hidden');
    else if (created && type !== 'error' && pn) pn.classList.add('hidden');
    var cls = type === 'error' ? 'error' : type === 'warn' ? 'warning' : type === 'info' ? 'info' : 'plain';
    var el = document.createElement('div');
    el.className = 'output-line ' + cls;
    el.textContent = text;
    b.appendChild(el);
    while (b.children.length > 500) b.removeChild(b.firstChild);
    b.scrollTop = b.scrollHeight;
  }

  // Dijalankan DI DALAM iframe: console, error, klik link, dan posisi scroll dikirim ke aplikasi.
  function bridge() {
    function send(type, args) {
      try {
        var text = Array.prototype.map.call(args, function (x) {
          if (typeof x === 'string') return x;
          if (x instanceof Error) return x.stack || x.message;
          try { return JSON.stringify(x); } catch (e) { return String(x); }
        }).join(' ');
        parent.postMessage({ __ps: 'console', type: type, text: text }, '*');
      } catch (e) {}
    }
    ['log', 'info', 'warn', 'error'].forEach(function (k) {
      var orig = console[k];
      console[k] = function () { send(k, arguments); try { orig.apply(console, arguments); } catch (e) {} };
    });
    window.addEventListener('error', function (e) { send('error', [e.message + ' (baris ' + e.lineno + ')']); });
    window.addEventListener('unhandledrejection', function (e) {
      send('error', ['Promise ditolak: ' + ((e.reason && e.reason.message) || e.reason)]);
    });
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a) return;
      var h = a.getAttribute('href') || '';
      if (!h || h.charAt(0) === '#' || /^(mailto:|tel:|sms:|javascript:)/i.test(h)) return;
      e.preventDefault();
      try { parent.postMessage({ __ps: 'nav', href: h }, '*'); } catch (x) {}
    }, true);
    var tk = 0;
    window.addEventListener('scroll', function () {
      if (tk) return;
      tk = setTimeout(function () {
        tk = 0;
        try { parent.postMessage({ __ps: 'scroll', y: window.pageYOffset || 0 }, '*'); } catch (e) {}
      }, 150);
    }, true);
  }
  var BRIDGE = '<script>(' + bridge.toString() + ')();<\/script>';

  async function buildDoc(path) {
    var cur = {};
    var html = await readAny(path);
    cur[norm(path)] = 1;
    var base = dirOf(norm(path));
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var warns = [], cache = {};
    var i, el, ref, txt;

    // <style> bawaan halaman: url() lokal di dalamnya
    var ownStyles = Array.prototype.slice.call(doc.querySelectorAll('style'));
    for (i = 0; i < ownStyles.length; i++) {
      ownStyles[i].textContent = (await inlineCssUrls(ownStyles[i].textContent, base, cache, warns))
        .replace(/<\/style/gi, '<\\/style');
    }

    var links = Array.prototype.slice.call(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (i = 0; i < links.length; i++) {
      el = links[i]; ref = el.getAttribute('href');
      if (isRemote(ref)) continue;
      try {
        var cssPath = resolve(base, ref);
        txt = await readAny(cssPath);
        cur[norm(cssPath)] = 1;
        txt = await inlineCssUrls(txt, dirOf(cssPath), cache, warns);
        var st = doc.createElement('style');
        st.textContent = txt.replace(/<\/style/gi, '<\\/style');
        el.replaceWith(st);
      } catch (e) { warns.push('CSS tidak ditemukan: ' + ref); }
    }

    var scripts = Array.prototype.slice.call(doc.querySelectorAll('script[src]'));
    for (i = 0; i < scripts.length; i++) {
      el = scripts[i]; ref = el.getAttribute('src');
      if (isRemote(ref)) continue;
      try {
        var jsPath = resolve(base, ref);
        txt = await readAny(jsPath);
        cur[norm(jsPath)] = 1;
        var sc = doc.createElement('script');
        var ty = el.getAttribute('type');
        if (ty) sc.setAttribute('type', ty);
        sc.textContent = txt.replace(/<\/script/gi, '<\\/script');
        if (el.hasAttribute('defer') && doc.body) { el.remove(); doc.body.appendChild(sc); }
        else el.replaceWith(sc);
      } catch (e) { warns.push('JS tidak ditemukan: ' + ref); }
    }

    var imgs = Array.prototype.slice.call(doc.querySelectorAll('img[src]'));
    for (i = 0; i < imgs.length; i++) {
      ref = imgs[i].getAttribute('src');
      if (isRemote(ref)) continue;
      try { imgs[i].setAttribute('src', await dataUri(resolve(base, ref), cache)); }
      catch (e) { warns.push('Gambar tidak terbaca: ' + ref + ' (' + ((e && e.message) || e) + ')'); }
    }

    var restore = (scrollFor === currentPath && scrollY > 0)
      ? '<script>addEventListener("load",function(){scrollTo(0,' + (scrollY | 0) + ')})<\/script>' : '';
    doc.head.insertAdjacentHTML('afterbegin', BRIDGE + restore);
    return { html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, warns: warns, deps: cur };
  }

  // ---- tata letak: split / penuh, tidak tertutup panel Output ----
  function calcLayout(mainH, editorTop, P, m) {
    if (m !== 'split') return { top: 0, edH: -1 };
    var et = Math.max(0, editorTop);
    var avail = mainH - P - et;
    if (avail < 160) return { top: 0, edH: -1 };
    var half = Math.round(avail / 2);
    return { top: et + half, edH: half };
  }
  function editorNode() { try { return monacoEditor.getContainerDomNode(); } catch (e) { return null; } }
  function setEditorHeight(h) {
    try {
      var en = editorNode();
      if (!en) return;
      if (h < 0) monacoEditor.layout();
      else monacoEditor.layout({ width: en.getBoundingClientRect().width, height: h });
    } catch (e) {}
  }
  function isOpen() { return !!overlay && overlay.style.display !== 'none'; }
  function layout() {
    if (!isOpen()) return;
    var main = overlay.parentNode;
    var mr = main.getBoundingClientRect();
    var pn = document.getElementById('output-panel');
    var P = (pn && !pn.classList.contains('hidden')) ? pn.offsetHeight : 0;
    var en = editorNode();
    var et = en ? en.getBoundingClientRect().top - mr.top : 0;
    var L = calcLayout(mr.height, et, P, mode);
    overlay.style.top = L.top + 'px';
    overlay.style.bottom = P + 'px';
    setEditorHeight(L.edH);
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'preview-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:15;display:none;flex-direction:column;background:#1e1e1e;';
    var bar = document.createElement('div');
    bar.style.cssText = 'height:34px;flex-shrink:0;display:flex;align-items:center;gap:6px;padding:0 8px;background:#252526;border-bottom:1px solid #3c3c3c;color:#a3a3a3;font-size:11px;font-weight:700;';
    function mk(label, fn) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'background:#37373d;border:1px solid #4a4a50;border-radius:4px;color:#d4d4d4;font-size:11px;font-weight:600;padding:3px 8px;height:24px;flex-shrink:0;';
      b.addEventListener('click', fn);
      return b;
    }
    backBtn = mk('‹', function () { goBack(); });
    backBtn.style.display = 'none';
    titleEl = document.createElement('span');
    titleEl.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    modeBtn = mk(mode === 'split' ? 'Penuh' : 'Split', function () { setMode(mode === 'split' ? 'full' : 'split'); });
    bar.appendChild(backBtn);
    bar.appendChild(titleEl);
    bar.appendChild(modeBtn);
    bar.appendChild(mk('Output', function () { toggleOutput(); }));
    bar.appendChild(mk('⟳', function () { render(); }));
    bar.appendChild(mk('Tutup', function () { closePreview(); }));
    frame = document.createElement('iframe');
    // Tanpa allow-same-origin: JS di preview tidak bisa menyentuh plugin Capacitor, file, atau NodeRunner.
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
    frame.style.cssText = 'flex:1;width:100%;border:0;background:#fff;';
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    (document.getElementById('main-area') || document.body).appendChild(overlay);
  }

  function setMode(m) {
    mode = m;
    try { localStorage.setItem('psPreviewMode', m); } catch (e) {}
    if (modeBtn) modeBtn.textContent = m === 'split' ? 'Penuh' : 'Split';
    layout();
  }
  function toggleOutput() {
    var pn = document.getElementById('output-panel');
    if (pn && !pn.classList.contains('hidden')) pn.classList.add('hidden');
    else { try { showOutputPanel(); } catch (e) {} }
    layout();
  }
  function updateBack() { if (backBtn) backBtn.style.display = history.length ? '' : 'none'; }

  async function render() {
    if (!currentPath) return false;
    var my = ++seq;
    try {
      var r = await buildDoc(currentPath);
      if (my !== seq) return false;
      deps = r.deps;
      titleEl.textContent = currentPath.split('/').pop();
      frame.srcdoc = r.html;
      r.warns.forEach(function (w) {
        if (!warned[w]) { warned[w] = 1; logLine('warn', w); }
      });
      return true;
    } catch (e) {
      if (my === seq) logLine('error', 'Preview gagal: ' + (e && e.message ? e.message : e));
      return false;
    }
  }

  async function openPreview() {
    var p = activePath();
    if (!isHtml(p)) return;
    ensureOverlay();
    currentPath = p; history = []; warned = {}; scrollY = 0; scrollFor = null;
    updateBack();
    overlay.style.display = 'flex';
    hookMonaco();
    try { if (typeof setOutputLines === 'function') setOutputLines([{ text: '$ preview ' + p.split('/').pop(), type: 'info' }]); } catch (e) {}
    layout();
    await render();
  }
  function closePreview() {
    if (!overlay) return;
    seq++;
    clearTimeout(liveT);
    overlay.style.display = 'none';
    if (frame) frame.srcdoc = '';
    setEditorHeight(-1);
  }

  async function goBack() {
    if (!history.length) return;
    currentPath = history.pop();
    updateBack();
    scrollY = 0; scrollFor = null;
    await render();
  }
  async function handleNav(href) {
    if (/^[a-z][a-z0-9+.\-]*:/i.test(href) || href.indexOf('//') === 0) {
      logLine('info', 'Link luar tidak dibuka di preview: ' + href);
      return;
    }
    var target = resolve(dirOf(norm(currentPath)), href);
    if (!isHtml(target)) { logLine('warn', 'Link bukan HTML tidak dibuka: ' + href); return; }
    var prev = currentPath;
    currentPath = target; scrollY = 0; scrollFor = null;
    var ok = await render();
    if (ok) { history.push(prev); updateBack(); }
    else currentPath = prev;
  }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || !d.__ps) return;
    if (d.__ps === 'console') logLine(d.type, String(d.text));
    else if (d.__ps === 'nav') handleNav(String(d.href));
    else if (d.__ps === 'scroll') { scrollY = d.y | 0; scrollFor = currentPath; }
  });

  // ---- live saat ngetik ----
  var attached = typeof WeakSet === 'function' ? new WeakSet() : null, hooked = false;
  function attachModel(m) {
    if (!m || (attached && attached.has(m))) return;
    if (attached) attached.add(m);
    m.onDidChangeContent(function () {
      if (!isOpen()) return;
      var t = null;
      try { t = openTabs.find(function (x) { return x.model === m; }); } catch (e) {}
      if (t && !deps[norm(t.path)]) return;   // file lain yang tidak dipakai halaman ini
      clearTimeout(liveT);
      liveT = setTimeout(function () { render(); }, 700);
    });
  }
  function hookMonaco() {
    if (hooked) return;
    try {
      if (typeof monaco === 'undefined' || !monaco.editor) return;
      monaco.editor.getModels().forEach(attachModel);
      monaco.editor.onDidCreateModel(attachModel);
      hooked = true;
    } catch (e) {}
  }

  function init() {
    var bar = document.getElementById('topbar-actions');
    var run = document.getElementById('btn-run');
    if (!bar) return;
    btn = document.createElement('button');
    btn.id = 'btn-preview';
    btn.title = 'Preview HTML';
    btn.style.display = 'none';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.addEventListener('click', function () { if (isOpen()) render(); else openPreview(); });
    bar.insertBefore(btn, run || bar.firstChild);

    // ▶ pada file .html membuka preview. File lain (.js, .pwn) tetap jalan seperti biasa.
    if (run) {
      run.addEventListener('click', function (e) {
        if (isHtml(activePath())) { e.stopImmediatePropagation(); e.preventDefault(); openPreview(); }
      }, true);
    }

    setInterval(function () {
      btn.style.display = isHtml(activePath()) ? '' : 'none';
      hookMonaco();
      layout();
    }, 500);
    window.addEventListener('resize', function () { setTimeout(layout, 120); });

    // Muat ulang juga setelah file disimpan (kalau preview sedang terbuka).
    try {
      var ow = FileManager.writeFile;
      FileManager.writeFile = async function () {
        var r = await ow.apply(FileManager, arguments);
        if (isOpen()) { clearTimeout(refreshT); refreshT = setTimeout(render, 300); }
        return r;
      };
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
