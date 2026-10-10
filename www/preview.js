// PawnStudio - Preview HTML/CSS/JS (v1.10.0)
// Menggabungkan <link href> dan <script src> lokal ke satu dokumen, ditampilkan di iframe sandbox.
(function () {
  'use strict';
  var overlay = null, frame = null, titleEl = null, currentPath = null, btn = null, refreshT = null;

  function isHtml(p) { return /\.html?$/i.test(p || ''); }
  function norm(p) { return String(p || '').replace(/^\/+/, ''); }
  function dirOf(p) { var i = p.lastIndexOf('/'); return i < 0 ? '' : p.slice(0, i); }
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
    var lastErr;
    var tries = [p, '/' + p];
    for (var i = 0; i < tries.length; i++) {
      try { return await FileManager.readFile(tries[i]); } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('tidak ditemukan');
  }

  function logLine(type, text) {
    try { if (typeof showOutputPanel === 'function') showOutputPanel(); } catch (e) {}
    var b = document.getElementById('output-panel-body');
    if (!b) return;
    var cls = type === 'error' ? 'error' : type === 'warn' ? 'warning' : type === 'info' ? 'info' : 'plain';
    var el = document.createElement('div');
    el.className = 'output-line ' + cls;
    el.textContent = text;
    b.appendChild(el);
    while (b.children.length > 500) b.removeChild(b.firstChild);
    b.scrollTop = b.scrollHeight;
  }

  // Dijalankan DI DALAM iframe: teruskan console dan error ke panel Output.
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
  }
  var BRIDGE = '<script>(' + bridge.toString() + ')();<\/script>';

  async function buildDoc(path) {
    var html = await readAny(path);
    var base = dirOf(norm(path));
    var doc = new DOMParser().parseFromString(html, 'text/html');
    var warns = [];
    var i, el, ref, txt;

    var links = Array.prototype.slice.call(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
    for (i = 0; i < links.length; i++) {
      el = links[i]; ref = el.getAttribute('href');
      if (isRemote(ref)) continue;
      try {
        txt = await readAny(resolve(base, ref));
        var st = doc.createElement('style');
        st.textContent = txt.replace(/<\/style/gi, "<\\/style");
        el.replaceWith(st);
      } catch (e) { warns.push('CSS tidak ditemukan: ' + ref); }
    }

    var scripts = Array.prototype.slice.call(doc.querySelectorAll('script[src]'));
    for (i = 0; i < scripts.length; i++) {
      el = scripts[i]; ref = el.getAttribute('src');
      if (isRemote(ref)) continue;
      try {
        txt = await readAny(resolve(base, ref));
        var sc = doc.createElement('script');
        var ty = el.getAttribute('type');
        if (ty) sc.setAttribute('type', ty);
        sc.textContent = txt.replace(/<\/script/gi, '<\\/script');
        if (el.hasAttribute('defer') && doc.body) { el.remove(); doc.body.appendChild(sc); }
        else el.replaceWith(sc);
      } catch (e) { warns.push('JS tidak ditemukan: ' + ref); }
    }

    var imgs = doc.querySelectorAll('img[src]');
    for (i = 0; i < imgs.length; i++) {
      if (!isRemote(imgs[i].getAttribute('src'))) { warns.push('Gambar lokal belum didukung di preview.'); break; }
    }

    doc.head.insertAdjacentHTML('afterbegin', BRIDGE);
    return { html: '<!DOCTYPE html>\n' + doc.documentElement.outerHTML, warns: warns };
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'preview-overlay';
    overlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;z-index:15;display:none;flex-direction:column;background:#1e1e1e;';
    var bar = document.createElement('div');
    bar.style.cssText = 'height:34px;flex-shrink:0;display:flex;align-items:center;gap:8px;padding:0 10px;background:#252526;border-bottom:1px solid #3c3c3c;color:#a3a3a3;font-size:11px;font-weight:700;letter-spacing:.5px;';
    titleEl = document.createElement('span');
    titleEl.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    function mk(label, fn) {
      var b = document.createElement('button');
      b.textContent = label;
      b.style.cssText = 'background:#37373d;border:1px solid #4a4a50;border-radius:4px;color:#d4d4d4;font-size:11px;font-weight:600;padding:3px 10px;height:24px;';
      b.addEventListener('click', fn);
      return b;
    }
    bar.appendChild(titleEl);
    bar.appendChild(mk('Muat ulang', function () { refresh(); }));
    bar.appendChild(mk('Tutup', function () { closePreview(); }));
    frame = document.createElement('iframe');
    // Tanpa allow-same-origin: JS di preview tidak bisa menyentuh plugin Capacitor, file, atau NodeRunner.
    frame.setAttribute('sandbox', 'allow-scripts allow-forms allow-modals allow-popups');
    frame.style.cssText = 'flex:1;width:100%;border:0;background:#fff;';
    overlay.appendChild(bar);
    overlay.appendChild(frame);
    (document.getElementById('main-area') || document.body).appendChild(overlay);
  }

  async function render() {
    if (!currentPath) return;
    titleEl.textContent = 'PREVIEW · ' + currentPath.split('/').pop();
    try {
      var r = await buildDoc(currentPath);
      frame.srcdoc = r.html;
      r.warns.forEach(function (w) { logLine('warn', w); });
    } catch (e) {
      logLine('error', 'Preview gagal: ' + (e && e.message ? e.message : e));
    }
  }

  async function openPreview() {
    var p = activePath();
    if (!isHtml(p)) return;
    ensureOverlay();
    currentPath = p;
    overlay.style.display = 'flex';
    await render();
  }
  function refresh() { return render(); }
  function closePreview() {
    if (!overlay) return;
    overlay.style.display = 'none';
    if (frame) frame.srcdoc = '';
  }
  function isOpen() { return overlay && overlay.style.display !== 'none'; }

  window.addEventListener('message', function (e) {
    if (!frame || e.source !== frame.contentWindow) return;
    var d = e.data;
    if (!d || d.__ps !== 'console') return;
    logLine(d.type, String(d.text));
  });

  function init() {
    var bar = document.getElementById('topbar-actions');
    var run = document.getElementById('btn-run');
    if (!bar) return;
    btn = document.createElement('button');
    btn.id = 'btn-preview';
    btn.title = 'Preview HTML';
    btn.style.display = 'none';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    btn.addEventListener('click', function () { if (isOpen()) refresh(); else openPreview(); });
    bar.insertBefore(btn, run || bar.firstChild);

    // ▶ pada file .html membuka preview. File lain (.js, .pwn) tetap jalan seperti biasa.
    if (run) {
      run.addEventListener('click', function (e) {
        if (isHtml(activePath())) { e.stopImmediatePropagation(); e.preventDefault(); openPreview(); }
      }, true);
    }

    setInterval(function () { btn.style.display = isHtml(activePath()) ? '' : 'none'; }, 500);

    // Muat ulang otomatis setelah file disimpan (kalau preview sedang terbuka).
    try {
      var ow = FileManager.writeFile;
      FileManager.writeFile = async function () {
        var r = await ow.apply(FileManager, arguments);
        if (isOpen()) { clearTimeout(refreshT); refreshT = setTimeout(refresh, 300); }
        return r;
      };
    } catch (e) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
