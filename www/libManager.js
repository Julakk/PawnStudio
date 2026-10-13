// PawnStudio - Manajer Library (v1.14.3)
// Unduh include (.inc) dari GitHub ke <project>/pawno/include.
(function () {
  'use strict';

  var CATALOG = [
    { id: 'samp-stdlib', name: 'SA-MP stdlib', repo: 'pawn-lang/samp-stdlib', mode: 'release', desc: 'a_samp, a_players, dst. versi terbaru (0.3.DL).' },
    { id: 'sscanf', name: 'sscanf2', repo: 'Y-Less/sscanf', mode: 'release', desc: 'Parser input cepat: #include <sscanf2>.' },
    { id: 'ysi', name: 'YSI Includes', repo: 'Y-Less/YSI-Includes', mode: 'head', desc: 'y_hooks, y_timers, y_ini, dll. (besar, butuh waktu).' },
    { id: 'streamer', name: 'Streamer', repo: 'samp-incognito/samp-streamer-plugin', mode: 'release', desc: 'Object/pickup/checkpoint streamer: #include <streamer>.' },
    { id: 'mysql', name: 'MySQL (a_mysql)', repo: 'pBlueG/SA-MP-MySQL', mode: 'release', desc: 'Plugin MySQL: #include <a_mysql>.' },
    { id: 'zcmd', name: 'zcmd', repo: 'Zeex/zcmd', mode: 'head', desc: 'Command processor klasik: #include <zcmd>.' },
    { id: 'pawncmd', name: 'Pawn.CMD', repo: 'katursis/Pawn.CMD', mode: 'release', desc: 'Command processor modern (versi omp).' },
    { id: 'pawnraknet', name: 'Pawn.RakNet', repo: 'katursis/Pawn.RakNet', mode: 'release', desc: 'Akses RakNet dari Pawn (versi omp).' },
    { id: 'crashdetect', name: 'crashdetect', repo: 'Zeex/samp-plugin-crashdetect', mode: 'head', desc: 'Backtrace saat server crash.' },
    { id: 'amx_assembly', name: 'amx_assembly', repo: 'Zeex/amx_assembly', mode: 'head', desc: 'Library dasar untuk banyak include lain.' },
    { id: 'weapon-config', name: 'weapon-config', repo: 'oscar-broman/samp-weapon-config', mode: 'head', desc: 'Sistem damage/senjata kustom.' }
  ];

  var CUSTOM_KEY = 'ps-lib-custom';
  var state = { libs: {}, latest: {}, busy: {}, msg: '', checking: false };
  var root = null;

  function plugin() {
    var C = window.Capacitor || {};
    return (C.Plugins && C.Plugins.LibraryManager) ||
      (C.registerPlugin && C.registerPlugin('LibraryManager'));
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function getCustom() {
    try { return JSON.parse(localStorage.getItem(CUSTOM_KEY) || '[]'); } catch (e) { return []; }
  }
  function setCustom(a) {
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify(a)); } catch (e) { }
  }
  function entries() {
    var c = getCustom().map(function (r) {
      return { id: r, name: r, repo: r, mode: 'release', desc: 'Repo kustom.', custom: true };
    });
    return CATALOG.concat(c);
  }
  function find(id) {
    var l = entries();
    for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i];
    return null;
  }

  function injectCss() {
    if (document.getElementById('lib-css')) return;
    var s = document.createElement('style');
    s.id = 'lib-css';
    s.textContent =
      '#lib-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '#lib-modal .lib-box{background:var(--t-bg,#1e1e1e);color:var(--t-fg,#ddd);border:1px solid rgba(128,128,128,.35);border-radius:10px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden}' +
      '#lib-modal .lib-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.3);font-weight:600}' +
      '#lib-modal .lib-x{background:none;border:0;color:inherit;font-size:22px;line-height:1;padding:0 6px}' +
      '#lib-modal .lib-body{overflow:auto;padding:10px 14px;flex:1}' +
      '#lib-modal .lib-row{padding:10px 0;border-bottom:1px solid rgba(128,128,128,.2)}' +
      '#lib-modal .lib-name{font-weight:600}' +
      '#lib-modal .lib-sub{font-size:12px;opacity:.7;margin-top:2px;word-break:break-all}' +
      '#lib-modal .lib-st{font-size:12px;margin-top:4px}' +
      '#lib-modal .lib-ok{color:#4caf50}#lib-modal .lib-up{color:#ffb300}' +
      '#lib-modal .lib-act{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}' +
      '#lib-modal button.lib-b{background:rgba(128,128,128,.22);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:6px 12px;font-size:13px}' +
      '#lib-modal button.lib-b:disabled{opacity:.5}' +
      '#lib-modal button.lib-p{background:#0e639c;border-color:#0e639c;color:#fff}' +
      '#lib-modal .lib-foot{padding:10px 14px;border-top:1px solid rgba(128,128,128,.3);display:flex;gap:6px;flex-wrap:wrap}' +
      '#lib-modal input{flex:1;min-width:140px;background:rgba(128,128,128,.15);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:7px 9px;font-size:13px}' +
      '#lib-modal .lib-msg{font-size:12px;padding:6px 14px;border-top:1px solid rgba(128,128,128,.2);min-height:18px;word-break:break-word}';
    document.head.appendChild(s);
  }

  function render() {
    if (!root) return;
    var rows = entries().map(function (e) {
      var inst = state.libs[e.id];
      var busy = !!state.busy[e.id];
      var lat = state.latest[e.id];
      var st = '';
      if (inst) {
        st = '<div class="lib-st lib-ok">Terpasang: ' + esc(inst.tag) + ' (' + (inst.files ? inst.files.length : 0) + ' file)</div>';
        if (lat && lat !== inst.tag) st += '<div class="lib-st lib-up">Pembaruan tersedia: ' + esc(lat) + '</div>';
        else if (lat) st += '<div class="lib-st">Sudah terbaru.</div>';
      }
      var btns = '';
      if (!inst) btns += '<button class="lib-b lib-p" data-act="install" data-id="' + esc(e.id) + '"' + (busy ? ' disabled' : '') + '>Pasang</button>';
      else {
        var needUp = lat && lat !== inst.tag;
        btns += '<button class="lib-b' + (needUp ? ' lib-p' : '') + '" data-act="install" data-id="' + esc(e.id) + '"' + (busy ? ' disabled' : '') + '>' + (needUp ? 'Perbarui' : 'Pasang ulang') + '</button>';
        btns += '<button class="lib-b" data-act="remove" data-id="' + esc(e.id) + '"' + (busy ? ' disabled' : '') + '>Hapus</button>';
      }
      if (e.custom && !inst) btns += '<button class="lib-b" data-act="forget" data-id="' + esc(e.id) + '">Buang dari daftar</button>';
      return '<div class="lib-row"><div class="lib-name">' + esc(e.name) + (busy ? ' ...' : '') + '</div>' +
        '<div class="lib-sub">' + esc(e.desc) + ' &middot; ' + esc(e.repo) + '</div>' + st +
        '<div class="lib-act">' + btns + '</div></div>';
    }).join('');
    root.querySelector('.lib-body').innerHTML = rows;
    root.querySelector('.lib-msg').textContent = state.msg;
    var chk = root.querySelector('[data-act="check"]');
    if (chk) { chk.disabled = state.checking; chk.textContent = state.checking ? 'Memeriksa...' : 'Cek pembaruan'; }
  }

  function setMsg(m) { state.msg = m; if (root) root.querySelector('.lib-msg').textContent = m; }

  function reload() {
    return plugin().list().then(function (r) { state.libs = r.libs || {}; }).catch(function () { state.libs = {}; });
  }

  function doInstall(id) {
    var e = find(id); if (!e || state.busy[id]) return;
    state.busy[id] = true; setMsg('Mengunduh ' + e.name + ' ...'); render();
    plugin().install({ id: id, repo: e.repo, mode: e.mode }).then(function (r) {
      setMsg(e.name + ' terpasang: ' + r.count + ' file (' + r.tag + ') di pawno/include. Muat ulang Explorer bila belum terlihat.');
      document.dispatchEvent(new CustomEvent('pawnstudio:libs-changed'));
    }).catch(function (err) {
      setMsg('Gagal: ' + (err && err.message ? err.message : err));
    }).then(function () {
      delete state.busy[id];
      return reload();
    }).then(render);
  }

  function doRemove(id) {
    var e = find(id); if (!e || state.busy[id]) return;
    if (!window.confirm('Hapus file include ' + e.name + ' dari pawno/include?')) return;
    state.busy[id] = true; render();
    plugin().remove({ id: id }).then(function (r) {
      setMsg(e.name + ' dihapus (' + r.removed + ' file).');
      document.dispatchEvent(new CustomEvent('pawnstudio:libs-changed'));
    }).catch(function (err) {
      setMsg('Gagal: ' + (err && err.message ? err.message : err));
    }).then(function () {
      delete state.busy[id]; delete state.latest[id];
      return reload();
    }).then(render);
  }

  function doCheck() {
    if (state.checking) return;
    var ids = Object.keys(state.libs);
    if (!ids.length) { setMsg('Belum ada library terpasang.'); return; }
    state.checking = true; setMsg('Memeriksa pembaruan ...'); render();
    var chain = Promise.resolve();
    ids.forEach(function (id) {
      var e = find(id); var inst = state.libs[id];
      var repo = e ? e.repo : inst.repo; var mode = e ? e.mode : 'release';
      chain = chain.then(function () {
        return plugin().latest({ repo: repo, mode: mode }).then(function (r) { state.latest[id] = r.tag; });
      }).catch(function (err) {
        setMsg('Gagal cek ' + repo + ': ' + (err && err.message ? err.message : err));
      });
    });
    chain.then(function () {
      state.checking = false;
      var n = ids.filter(function (id) { return state.latest[id] && state.latest[id] !== state.libs[id].tag; }).length;
      if (state.msg.indexOf('Gagal') !== 0) setMsg(n ? n + ' library punya pembaruan.' : 'Semua sudah terbaru.');
      render();
    });
  }

  function addCustom() {
    var inp = root.querySelector('#lib-repo');
    var v = (inp.value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)) { setMsg('Format repo: owner/repo, mis. Y-Less/sscanf'); return; }
    if (!find(v)) { var c = getCustom(); c.push(v); setCustom(c); }
    inp.value = '';
    render();
    doInstall(v);
  }

  function open() {
    injectCss();
    if (root) root.remove();
    root = document.createElement('div');
    root.id = 'lib-modal';
    root.innerHTML =
      '<div class="lib-box"><div class="lib-head"><span>Library / Include</span><button class="lib-x" data-act="close">&times;</button></div>' +
      '<div class="lib-body"></div><div class="lib-msg"></div>' +
      '<div class="lib-foot"><input id="lib-repo" placeholder="Repo kustom: owner/repo" autocapitalize="off" autocomplete="off">' +
      '<button class="lib-b lib-p" data-act="add">Pasang</button>' +
      '<button class="lib-b" data-act="check">Cek pembaruan</button></div></div>';
    root.addEventListener('click', function (ev) {
      if (ev.target === root) { root.remove(); root = null; return; }
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
      if (act === 'close') { root.remove(); root = null; }
      else if (act === 'install') doInstall(id);
      else if (act === 'remove') doRemove(id);
      else if (act === 'check') doCheck();
      else if (act === 'add') addCustom();
      else if (act === 'forget') { setCustom(getCustom().filter(function (x) { return x !== id; })); render(); }
    });
    document.body.appendChild(root);
    render();
    reload().then(render);
  }

  function addButton() {
    if (document.getElementById('btn-libs')) return true;
    var ref = document.getElementById('btn-npm');
    if (!ref || !ref.parentNode) return false;
    var b = document.createElement('button');
    b.id = 'btn-libs';
    b.className = ref.className;
    b.title = 'Library / Include (pasang dari GitHub)';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>';
    b.addEventListener('click', open);
    ref.parentNode.insertBefore(b, ref.nextSibling);
    // Header Explorer sempit: biar tombol boleh turun ke baris ke-2 dan tidak terpotong.
    var p = ref.parentNode;
    p.style.flexWrap = 'wrap';
    p.style.minWidth = '0';
    p.style.flex = '1 1 0';
    p.style.justifyContent = 'flex-end';
    p.style.rowGap = '6px';
    return true;
  }

  function init() {
    if (addButton()) return;
    var tries = 0;
    var t = setInterval(function () {
      if (addButton() || ++tries > 40) clearInterval(t);
    }, 250);
  }

  window.LibManager = { open: open };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
