// PawnStudio - Panel Git (tahap 1: baca saja) (v1.11.0)
// Ikon Git di bar kiri membuka panel: cabang, remote, file yang berubah, dan riwayat commit.
(function () {
  'use strict';
  var panel = null, body = null, branchEl = null, busy = false;
  var COLORS = { A: '#73c991', M: '#e2c08d', D: '#c74e39', '?': '#73c991', U: '#f14c4c' };
  var NAMES = { A: 'Baru (staged)', M: 'Berubah', D: 'Dihapus', '?': 'Belum dilacak', U: 'Konflik' };
  var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>';

  function plug() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GitNative; }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function ago(sec) {
    var d = Math.max(0, Math.floor(Date.now() / 1000) - sec);
    if (d < 60) return 'baru saja';
    if (d < 3600) return Math.floor(d / 60) + ' mnt lalu';
    if (d < 86400) return Math.floor(d / 3600) + ' jam lalu';
    if (d < 2592000) return Math.floor(d / 86400) + ' hari lalu';
    return Math.floor(d / 2592000) + ' bln lalu';
  }

  function build() {
    if (panel) return;
    panel = el('div', 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:60;display:none;flex-direction:column;background:#1e1e1e;color:#d4d4d4;font-family:sans-serif;');
    var head = el('div', 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:#252526;border-bottom:1px solid #3c3c3c;');
    head.appendChild(el('span', 'font-size:12px;font-weight:700;letter-spacing:.5px;color:#a3a3a3;', 'GIT'));
    branchEl = el('span', 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#d4d4d4;', '');
    head.appendChild(branchEl);
    function btn(label, fn) {
      var b = el('button', 'background:#37373d;border:1px solid #4a4a50;border-radius:4px;color:#d4d4d4;font-size:12px;font-weight:600;padding:5px 12px;', label);
      b.addEventListener('click', fn);
      return b;
    }
    head.appendChild(btn('⟳', load));
    head.appendChild(btn('Tutup', close));
    body = el('div', 'flex:1;overflow-y:auto;padding:12px;-webkit-user-select:text;user-select:text;');
    panel.appendChild(head);
    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  function section(title) { return el('div', 'margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.5px;color:#a3a3a3;', title); }
  function note(text, color) { return el('div', 'padding:8px 0;font-size:13px;line-height:1.5;color:' + (color || '#a3a3a3') + ';', text); }

  function render(st, lg) {
    body.innerHTML = '';
    if (!st || !st.isRepo) {
      branchEl.textContent = '';
      body.appendChild(note('Folder workspace ini belum menjadi repository Git.'));
      body.appendChild(note('Membuat repo, commit, dan push dari aplikasi menyusul di tahap berikutnya. Untuk sekarang, gunakan Termux.'));
      return;
    }
    branchEl.textContent = '⎇ ' + (st.branch || '(tanpa cabang)');
    if (st.remote) body.appendChild(note('Remote: ' + st.remote));
    else body.appendChild(note('Belum ada remote "origin".'));

    var total = st.total || 0;
    body.appendChild(section(total ? 'PERUBAHAN (' + total + ')' : 'PERUBAHAN'));
    if (st.clean || !total) body.appendChild(note('Tidak ada perubahan. Semua file sudah ter-commit.', '#73c991'));
    (st.files || []).forEach(function (f) {
      var row = el('div', 'display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid #2d2d2d;font-size:13px;');
      var tag = el('span', 'flex-shrink:0;width:18px;text-align:center;font-weight:700;color:' + (COLORS[f.state] || '#d4d4d4') + ';', f.state);
      tag.title = NAMES[f.state] || f.state;
      row.appendChild(tag);
      row.appendChild(el('span', 'flex:1;min-width:0;word-break:break-all;', f.path));
      if (f.state !== 'D') {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () {
          try { if (typeof openFile === 'function') { openFile(f.path); close(); } } catch (e) {}
        });
      }
      body.appendChild(row);
    });
    if (st.truncated) body.appendChild(note('Hanya 500 file pertama yang ditampilkan dari total ' + total + '.', '#e2c08d'));

    body.appendChild(section('RIWAYAT'));
    var cs = (lg && lg.commits) || [];
    if (!cs.length) body.appendChild(note('Belum ada commit.'));
    cs.forEach(function (c) {
      var row = el('div', 'padding:9px 4px;border-bottom:1px solid #2d2d2d;');
      row.appendChild(el('div', 'font-size:13px;word-break:break-word;', c.message || '(tanpa pesan)'));
      row.appendChild(el('div', 'margin-top:3px;font-size:11px;color:#8a8a8a;', c.id + '  ·  ' + (c.author || '') + '  ·  ' + ago(c.time)));
      body.appendChild(row);
    });
  }

  async function load() {
    if (busy) return;
    var p = plug();
    body.innerHTML = '';
    if (!p) { body.appendChild(note('Plugin Git tidak ditemukan. Jalankan sebagai APK versi terbaru.', '#f48771')); return; }
    busy = true;
    body.appendChild(note('Membaca repository…'));
    try {
      var st = await p.status({ path: '' });
      var lg = st && st.isRepo ? await p.log({ path: '', max: 30 }) : null;
      render(st, lg);
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(note('Gagal membaca Git: ' + ((e && e.message) || e), '#f48771'));
    }
    busy = false;
  }

  function open() { build(); panel.style.display = 'flex'; load(); }
  function close() { if (panel) panel.style.display = 'none'; }

  function init() {
    var anchor = document.getElementById('activity-search');
    var b;
    if (anchor) {
      b = anchor.cloneNode(false);               // ikut gaya tombol di bar kiri
      Array.prototype.slice.call(b.attributes).forEach(function (a) {
        if (/^data-/.test(a.name) || a.name === 'id') b.removeAttribute(a.name);
      });
      b.classList.remove('active');
    } else {
      b = document.createElement('button');
    }
    b.id = 'activity-git';
    b.title = 'Git';
    b.innerHTML = ICON;
    b.addEventListener('click', function (e) { e.stopPropagation(); e.preventDefault(); open(); });
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(b, anchor.nextSibling);
    else (document.getElementById('topbar-actions') || document.body).appendChild(b);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
