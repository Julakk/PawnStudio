// PawnStudio - Panel Git (tahap 2a: lihat, inisialisasi, commit lokal) (v1.11.0)
// Ikon Git di bar kiri membuka panel: cabang, remote, file yang berubah, commit, dan riwayat.
(function () {
  'use strict';
  var panel = null, body = null, branchEl = null, msgEl = null, busy = false;
  var state = { st: null, lg: null, id: null }, choice = {}, draft = '';
  var COLORS = { A: '#73c991', M: '#e2c08d', D: '#c74e39', '?': '#73c991', U: '#f14c4c' };
  var NAMES = { A: 'Baru (staged)', M: 'Berubah', D: 'Dihapus', '?': 'Belum dilacak', U: 'Konflik' };
  var IGNORABLE = /(^|\/)(compiled|node_modules)\/|\.(amx|exe|dll|so|log|bak|tmp)$/i;
  var GITIGNORE = 'compiled/\n*.amx\nnode_modules/\n*.log\n*.bak\n';
  var ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="6" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>';
  var BTN = 'background:#37373d;border:1px solid #4a4a50;border-radius:4px;color:#d4d4d4;font-size:12px;font-weight:600;padding:6px 12px;';
  var BTN_MAIN = 'background:#0e639c;border:1px solid #1177bb;border-radius:4px;color:#fff;font-size:13px;font-weight:600;padding:9px 16px;';
  var INPUT = 'width:100%;box-sizing:border-box;background:#2b2b2b;border:1px solid #4a4a50;border-radius:4px;color:#d4d4d4;font-size:14px;padding:9px 10px;margin:4px 0 12px;';

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
  function say(text, ok) {
    if (!msgEl) return;
    msgEl.textContent = text || '';
    msgEl.style.display = text ? 'block' : 'none';
    msgEl.style.color = ok ? '#73c991' : '#f48771';
  }
  function errText(e) { return (e && e.message) || String(e); }

  function build() {
    if (panel) return;
    panel = el('div', 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:60;display:none;flex-direction:column;background:#1e1e1e;color:#d4d4d4;font-family:sans-serif;');
    var head = el('div', 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:#252526;border-bottom:1px solid #3c3c3c;');
    head.appendChild(el('span', 'font-size:12px;font-weight:700;letter-spacing:.5px;color:#a3a3a3;', 'GIT'));
    branchEl = el('span', 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;color:#d4d4d4;', '');
    head.appendChild(branchEl);
    function btn(label, fn) { var b = el('button', BTN, label); b.addEventListener('click', fn); return b; }
    head.appendChild(btn('Akun', function () { if (!busy) showIdentity(); }));
    head.appendChild(btn('⟳', function () { load(); }));
    head.appendChild(btn('Tutup', close));
    msgEl = el('div', 'display:none;flex-shrink:0;padding:10px 14px;font-size:13px;line-height:1.4;background:#2a2a2a;border-bottom:1px solid #3c3c3c;word-break:break-word;');
    body = el('div', 'flex:1;overflow-y:auto;padding:12px;-webkit-user-select:text;user-select:text;');
    panel.appendChild(head);
    panel.appendChild(msgEl);
    panel.appendChild(body);
    document.body.appendChild(panel);
  }

  function section(title) { return el('div', 'margin:16px 0 6px;font-size:11px;font-weight:700;letter-spacing:.5px;color:#a3a3a3;', title); }
  function note(text, color) { return el('div', 'padding:8px 0;font-size:13px;line-height:1.5;color:' + (color || '#a3a3a3') + ';', text); }
  function setBusy(on) { busy = on; if (panel) panel.style.opacity = on ? '0.7' : '1'; }

  // ---- layar utama ----
  function render() {
    var st = state.st, lg = state.lg;
    body.innerHTML = '';
    if (!st || !st.isRepo) {
      branchEl.textContent = '';
      body.appendChild(note('Folder workspace ini belum menjadi repository Git.'));
      var b = el('button', BTN_MAIN, 'Inisialisasi repo di sini');
      b.addEventListener('click', doInit);
      body.appendChild(b);
      body.appendChild(note('Membuat folder .git (cabang main). Commit dan push ke GitHub ada di tahap berikutnya.'));
      return;
    }
    branchEl.textContent = '⎇ ' + (st.branch || '(tanpa cabang)');
    body.appendChild(note(st.remote ? 'Remote: ' + st.remote : 'Belum ada remote "origin".'));

    var files = st.files || [], total = st.total || 0;
    files.forEach(function (f) { if (!(f.path in choice)) choice[f.path] = !IGNORABLE.test(f.path); });
    var head = el('div', 'display:flex;align-items:center;margin:16px 0 6px;');
    head.appendChild(el('span', 'flex:1;font-size:11px;font-weight:700;letter-spacing:.5px;color:#a3a3a3;', total ? 'PERUBAHAN (' + total + ')' : 'PERUBAHAN'));
    if (files.length) {
      var all = el('button', BTN + 'padding:4px 10px;margin-left:6px;', 'Semua');
      all.addEventListener('click', function () { files.forEach(function (f) { choice[f.path] = true; }); render(); });
      var none = el('button', BTN + 'padding:4px 10px;margin-left:6px;', 'Kosong');
      none.addEventListener('click', function () { files.forEach(function (f) { choice[f.path] = false; }); render(); });
      head.appendChild(all); head.appendChild(none);
    }
    body.appendChild(head);
    if (st.clean || !total) body.appendChild(note('Tidak ada perubahan. Semua file sudah ter-commit.', '#73c991'));

    files.forEach(function (f) {
      var row = el('div', 'display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid #2d2d2d;font-size:13px;');
      var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!choice[f.path];
      cb.style.cssText = 'width:20px;height:20px;flex-shrink:0;';
      cb.addEventListener('change', function () { choice[f.path] = cb.checked; updateCommitBtn(); });
      var tag = el('span', 'flex-shrink:0;width:18px;text-align:center;font-weight:700;color:' + (COLORS[f.state] || '#d4d4d4') + ';', f.state);
      tag.title = NAMES[f.state] || f.state;
      var name = el('span', 'flex:1;min-width:0;word-break:break-all;', f.path);
      if (f.state !== 'D') {
        name.style.cursor = 'pointer';
        name.addEventListener('click', function () {
          try { if (typeof openFile === 'function') { openFile(f.path); close(); } } catch (e) {}
        });
      }
      row.appendChild(cb); row.appendChild(tag); row.appendChild(name);
      body.appendChild(row);
    });
    if (st.truncated) body.appendChild(note('Hanya 500 file pertama yang ditampilkan dari total ' + total + '.', '#e2c08d'));

    if (files.length) {
      body.appendChild(section('COMMIT'));
      var ta = el('textarea', INPUT + 'min-height:64px;resize:vertical;font-family:inherit;');
      ta.placeholder = 'Pesan commit'; ta.value = draft;
      ta.addEventListener('input', function () { draft = ta.value; });
      body.appendChild(ta);
      var cbtn = el('button', BTN_MAIN + 'width:100%;');
      cbtn.id = 'git-commit-btn';
      cbtn.addEventListener('click', doCommit);
      body.appendChild(cbtn);
      updateCommitBtn();
      if (state.id && (!state.id.name || !state.id.email)) body.appendChild(note('Nama dan email belum diisi. Ketuk Akun terlebih dulu.', '#e2c08d'));
    }

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

  function selectedPaths() {
    var files = (state.st && state.st.files) || [];
    return files.filter(function (f) { return choice[f.path]; }).map(function (f) { return f.path; });
  }
  function updateCommitBtn() {
    var b = document.getElementById('git-commit-btn');
    if (b) b.textContent = 'Commit (' + selectedPaths().length + ' file)';
  }

  // ---- layar akun ----
  function showIdentity(hint) {
    var id = state.id || {};
    body.innerHTML = '';
    if (hint) body.appendChild(note(hint, '#e2c08d'));
    function field(label, value, type, ph) {
      body.appendChild(el('div', 'font-size:12px;color:#a3a3a3;', label));
      var i = el('input', INPUT); i.type = type || 'text'; i.value = value || ''; if (ph) i.placeholder = ph;
      i.autocomplete = 'off'; i.setAttribute('autocapitalize', 'off');
      body.appendChild(i); return i;
    }
    var n = field('Nama (muncul di commit)', id.name);
    var e = field('Email (muncul di commit)', id.email, 'email');
    var u = field('Username GitHub (opsional)', id.username);
    var t = field('Token GitHub (untuk push, tahap berikutnya)', '', 'password', id.hasToken ? 'Tersimpan. Isi untuk mengganti.' : 'ghp_...');
    body.appendChild(note('Token disimpan di penyimpanan privat aplikasi dan tidak ikut backup Android, tetapi tidak dienkripsi tambahan. Jangan isi token berhak akses luas: buat token khusus repo yang dipakai.'));
    var save = el('button', BTN_MAIN + 'width:100%;margin-top:6px;', 'Simpan');
    save.addEventListener('click', async function () {
      if (busy) return;
      var p = plug(); if (!p) return;
      setBusy(true);
      try {
        var args = { name: n.value, email: e.value, username: u.value };
        if (t.value.trim()) args.token = t.value;
        state.id = await p.setIdentity(args);
        say('Akun disimpan.', true);
        render();
      } catch (x) { say('Gagal menyimpan: ' + errText(x)); }
      setBusy(false);
    });
    body.appendChild(save);
    if (id.hasToken) {
      var del = el('button', BTN + 'width:100%;margin-top:10px;', 'Hapus token tersimpan');
      del.addEventListener('click', async function () {
        if (busy || !confirm('Hapus token GitHub yang tersimpan?')) return;
        setBusy(true);
        try { state.id = await plug().setIdentity({ clearToken: true }); say('Token dihapus.', true); showIdentity(); }
        catch (x) { say('Gagal: ' + errText(x)); }
        setBusy(false);
      });
      body.appendChild(del);
    }
    var back = el('button', BTN + 'width:100%;margin-top:10px;', 'Kembali');
    back.addEventListener('click', render);
    body.appendChild(back);
  }

  // ---- aksi ----
  async function doInit() {
    if (busy) return;
    var p = plug(); if (!p) return;
    if (!confirm('Buat repository Git (folder .git) di workspace ini?')) return;
    var ign = confirm('Buat juga file .gitignore standar?\n\ncompiled/\n*.amx\nnode_modules/\n*.log\n*.bak');
    setBusy(true);
    try {
      await p.init({ path: '' });
      if (ign) {
        try { await FileManager.writeFile('.gitignore', GITIGNORE); }
        catch (e) { say('Repo dibuat, tapi .gitignore gagal ditulis: ' + errText(e)); setBusy(false); await load(true); return; }
      }
      say('Repository dibuat (cabang main).', true);
    } catch (e) { say('Gagal inisialisasi: ' + errText(e)); }
    setBusy(false);
    await load(true);
  }

  async function doCommit() {
    if (busy) return;
    var p = plug(); if (!p) return;
    var paths = selectedPaths(), msg = (draft || '').trim();
    if (!state.id || !state.id.name || !state.id.email) { showIdentity('Isi nama dan email dulu, lalu coba commit lagi.'); return; }
    if (!msg) { say('Tulis pesan commit dulu.'); return; }
    if (!paths.length) { say('Pilih minimal satu file.'); return; }
    setBusy(true);
    try {
      var r = await p.commit({ path: '', message: msg, paths: paths });
      draft = ''; choice = {};
      say('Commit ' + r.id + ' berhasil: ' + r.message, true);
    } catch (e) { say('Commit gagal: ' + errText(e)); }
    setBusy(false);
    await load(true);
  }

  async function load(keepMsg) {
    if (busy) return;
    var p = plug();
    if (!keepMsg) say('');
    body.innerHTML = '';
    if (!p) { body.appendChild(note('Plugin Git tidak ditemukan. Jalankan sebagai APK versi terbaru.', '#f48771')); return; }
    setBusy(true);
    body.appendChild(note('Membaca repository…'));
    try {
      state.id = await p.getIdentity();
      state.st = await p.status({ path: '' });
      state.lg = state.st && state.st.isRepo ? await p.log({ path: '', max: 30 }) : null;
      render();
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(note('Gagal membaca Git: ' + errText(e), '#f48771'));
    }
    setBusy(false);
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
