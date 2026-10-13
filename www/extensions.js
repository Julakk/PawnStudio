// PawnStudio - Ekstensi (v1.15.0)
// Ekstensi = paket JSON (snippet, tema editor, daftar include). Tidak ada kode yang dijalankan.
(function () {
  'use strict';
  var K_INST = 'ps-ext-installed', K_OFF = 'ps-ext-disabled', K_THEME = 'ps-ext-theme';

  function T(a) { return a.join('\n'); }
  function mkTheme(id, name, base, c) {
    return {
      id: id, name: name, base: base,
      colors: {
        'editor.background': c.bg, 'editor.foreground': c.fg,
        'editorLineNumber.foreground': c.ln, 'editor.selectionBackground': c.sel,
        'editor.lineHighlightBackground': c.line, 'editorCursor.foreground': c.cur
      },
      rules: [
        { token: 'comment', foreground: c.cm, fontStyle: 'italic' },
        { token: 'keyword', foreground: c.kw },
        { token: 'string', foreground: c.st },
        { token: 'number', foreground: c.nu },
        { token: 'type', foreground: c.ty }
      ]
    };
  }

  var BUILTIN = [
    {
      id: 'psx-samp-snippets', name: 'SA-MP Snippets', version: '1.0.0', author: 'PawnStudio',
      description: 'Snippet siap pakai untuk gamemode SA-MP: command, dialog, timer, hook YSI, MySQL.',
      themes: [], includes: [],
      snippets: [
        { prefix: 'cmd', body: T(['CMD:${1:nama}(playerid, params[])', '{', '\t$0', '\treturn 1;', '}']), description: 'Command (zcmd / Pawn.CMD)' },
        { prefix: 'pubf', body: T(['forward ${1:Nama}(${2:playerid});', 'public $1($2)', '{', '\t$0', '\treturn 1;', '}']), description: 'forward + public' },
        { prefix: 'dialog', body: 'ShowPlayerDialog(playerid, ${1:DIALOG_ID}, ${2:DIALOG_STYLE_MSGBOX}, "${3:Judul}", "${4:Isi}", "${5:OK}", "${6:Batal}");', description: 'ShowPlayerDialog' },
        { prefix: 'ondr', body: T(['public OnDialogResponse(playerid, dialogid, response, listitem, inputtext[])', '{', '\tif(dialogid == ${1:DIALOG_ID})', '\t{', '\t\tif(!response) return 1;', '\t\t$0', '\t\treturn 1;', '\t}', '\treturn 0;', '}']), description: 'OnDialogResponse' },
        { prefix: 'timer', body: 'SetTimerEx("${1:Fungsi}", ${2:1000}, ${3:false}, "${4:i}", ${5:playerid});', description: 'SetTimerEx' },
        { prefix: 'hook', body: T(['hook ${1:OnPlayerConnect}(playerid)', '{', '\t$0', '\treturn 1;', '}']), description: 'YSI y_hooks' },
        { prefix: 'ocon', body: T(['public OnPlayerConnect(playerid)', '{', '\t$0', '\treturn 1;', '}']), description: 'OnPlayerConnect' },
        { prefix: 'odis', body: T(['public OnPlayerDisconnect(playerid, reason)', '{', '\t$0', '\treturn 1;', '}']), description: 'OnPlayerDisconnect' },
        { prefix: 'mysqlq', body: 'mysql_tquery(${1:g_SQL}, "${2:SELECT * FROM tabel}", "${3:OnQuery}", "${4:i}", ${5:playerid});', description: 'mysql_tquery' },
        { prefix: 'scm', body: 'SendClientMessage(${1:playerid}, ${2:-1}, "${3:Pesan}");', description: 'SendClientMessage' },
        { prefix: 'fmt', body: T(['new ${1:str}[${2:128}];', 'format($1, sizeof($1), "${3:%s}", ${4:arg});']), description: 'format string' },
        { prefix: 'foreachp', body: T(['foreach(new ${1:i} : Player)', '{', '\t$0', '}']), description: 'foreach pemain' },
        { prefix: 'enum', body: T(['enum e_${1:NAMA}', '{', '\t${2:e_FIELD}', '}']), description: 'enum' },
        { prefix: 'sscanf', body: 'if(sscanf(params, "${1:ui}", ${2:target}, ${3:nilai})) return SendClientMessage(playerid, -1, "Gunakan: /${4:cmd} [${5:id}] [${6:nilai}]");', description: 'sscanf parameter command' }
      ]
    },
    {
      id: 'psx-themes', name: 'Tema Tambahan', version: '1.0.0', author: 'PawnStudio',
      description: 'Nord, Tokyo Night, Solarized Dark, GitHub Dark untuk editor.',
      snippets: [], includes: [],
      themes: [
        mkTheme('nord', 'Nord', 'vs-dark', { bg: '#2e3440', fg: '#d8dee9', ln: '#4c566a', sel: '#434c5e', line: '#3b4252', cur: '#d8dee9', cm: '#616e88', kw: '#81a1c1', st: '#a3be8c', nu: '#b48ead', ty: '#8fbcbb' }),
        mkTheme('tokyo-night', 'Tokyo Night', 'vs-dark', { bg: '#1a1b26', fg: '#c0caf5', ln: '#3b4261', sel: '#283457', line: '#1f2335', cur: '#c0caf5', cm: '#565f89', kw: '#bb9af7', st: '#9ece6a', nu: '#ff9e64', ty: '#2ac3de' }),
        mkTheme('solarized-dark', 'Solarized Dark', 'vs-dark', { bg: '#002b36', fg: '#93a1a1', ln: '#586e75', sel: '#073642', line: '#073642', cur: '#93a1a1', cm: '#586e75', kw: '#859900', st: '#2aa198', nu: '#d33682', ty: '#b58900' }),
        mkTheme('github-dark', 'GitHub Dark', 'vs-dark', { bg: '#0d1117', fg: '#c9d1d9', ln: '#6e7681', sel: '#264f78', line: '#161b22', cur: '#c9d1d9', cm: '#8b949e', kw: '#ff7b72', st: '#a5d6ff', nu: '#79c0ff', ty: '#ffa657' })
      ]
    }
  ];

  var state = { inst: [], off: {}, msg: '' };
  var root = null, provReg = false, initDone = false;

  // ---------- util ----------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function lsGet(k, def) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch (e) { return def; } }
  function lsSet(k, v) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  function plugin() {
    var C = window.Capacitor || {};
    return (C.Plugins && C.Plugins.LibraryManager) || (C.registerPlugin && C.registerPlugin('LibraryManager'));
  }
  function waitMonaco(cb) {
    var n = 0;
    (function tick() {
      var m = window.monaco;
      if (m && m.languages && m.editor) return cb(m);
      if (++n < 200) setTimeout(tick, 300);
    })();
  }

  // ---------- validasi manifest ----------
  var HEX6 = /^#[0-9a-fA-F]{6}$/, HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
  function str(v, max, def) {
    if (v === undefined || v === null) return def || '';
    if (typeof v !== 'string') throw new Error('Ada nilai yang seharusnya teks');
    return v.slice(0, max);
  }
  function sanitize(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Format bukan objek JSON');
    var id = str(raw.id, 40);
    if (!/^[a-z0-9][a-z0-9._-]{0,39}$/.test(id)) throw new Error('"id" wajib huruf kecil/angka/-._ (maks 40 karakter)');
    var out = { id: id, name: str(raw.name, 60) || id, version: str(raw.version, 20, '0.0.0'), author: str(raw.author, 60), description: str(raw.description, 300), snippets: [], themes: [], includes: [] };

    if (raw.snippets !== undefined) {
      if (!Array.isArray(raw.snippets) || raw.snippets.length > 300) throw new Error('"snippets" harus array (maks 300)');
      raw.snippets.forEach(function (s) {
        if (!s || typeof s !== 'object') throw new Error('Snippet tidak valid');
        var p = str(s.prefix, 40);
        var b = Array.isArray(s.body) ? s.body.slice(0, 80).map(function (x) { return str(x, 500); }).join('\n') : str(s.body, 4000);
        if (!p || !b) throw new Error('Snippet butuh "prefix" dan "body"');
        out.snippets.push({ prefix: p, body: b, description: str(s.description, 200) });
      });
    }
    if (raw.themes !== undefined) {
      if (!Array.isArray(raw.themes) || raw.themes.length > 20) throw new Error('"themes" harus array (maks 20)');
      raw.themes.forEach(function (t) {
        if (!t || typeof t !== 'object') throw new Error('Tema tidak valid');
        var tid = str(t.id, 30);
        if (!/^[a-z0-9._-]{1,30}$/.test(tid)) throw new Error('id tema tidak valid: ' + tid);
        var base = t.base === 'vs' || t.base === 'hc-black' ? t.base : 'vs-dark';
        var colors = {}, rules = [];
        var ck = Object.keys(t.colors || {});
        if (ck.length > 80) throw new Error('Warna tema terlalu banyak');
        ck.forEach(function (k) {
          if (!/^[A-Za-z0-9.]{1,60}$/.test(k) || typeof t.colors[k] !== 'string' || !HEX.test(t.colors[k])) throw new Error('Warna tidak valid: ' + k);
          colors[k] = t.colors[k];
        });
        if (t.rules !== undefined) {
          if (!Array.isArray(t.rules) || t.rules.length > 80) throw new Error('"rules" harus array (maks 80)');
          t.rules.forEach(function (r) {
            if (!r || typeof r !== 'object') throw new Error('Rule tema tidak valid');
            var tok = str(r.token, 60);
            if (!/^[A-Za-z0-9._-]*$/.test(tok)) throw new Error('token tidak valid: ' + tok);
            var rule = { token: tok };
            if (r.foreground !== undefined) { if (typeof r.foreground !== 'string' || !HEX6.test(r.foreground)) throw new Error('foreground harus #rrggbb'); rule.foreground = r.foreground; }
            if (r.fontStyle !== undefined) { if (typeof r.fontStyle !== 'string' || !/^(italic|bold|underline)?( (italic|bold|underline))*$/.test(r.fontStyle)) throw new Error('fontStyle tidak valid'); rule.fontStyle = r.fontStyle; }
            rules.push(rule);
          });
        }
        out.themes.push({ id: tid, name: str(t.name, 40) || tid, base: base, colors: colors, rules: rules });
      });
    }
    if (raw.includes !== undefined) {
      if (!Array.isArray(raw.includes) || raw.includes.length > 8) throw new Error('"includes" harus array (maks 8)');
      raw.includes.forEach(function (i) {
        if (!i || typeof i !== 'object') throw new Error('Include tidak valid');
        var iid = str(i.id, 40), repo = str(i.repo, 100);
        if (!/^[a-z0-9._-]{1,40}$/.test(iid)) throw new Error('id include tidak valid: ' + iid);
        if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.indexOf('..') >= 0) throw new Error('repo include harus owner/repo');
        out.includes.push({ id: iid, name: str(i.name, 60) || iid, repo: repo, mode: i.mode === 'head' ? 'head' : 'release' });
      });
    }
    if (!out.snippets.length && !out.themes.length && !out.includes.length) throw new Error('Ekstensi kosong (tidak ada snippets/themes/includes)');
    return out;
  }

  // ---------- data ----------
  function all() {
    return BUILTIN.map(function (m) { return { m: m, builtin: true }; })
      .concat(state.inst.map(function (m) { return { m: m, builtin: false }; }));
  }
  function active() { return all().filter(function (e) { return !state.off[e.m.id]; }); }
  function tname(e, t) { return 'ext-' + e.m.id + '-' + t.id; }

  function applyMonaco() {
    waitMonaco(function (m) {
      if (!provReg) {
        provReg = true;
        m.languages.registerCompletionItemProvider('pawn', {
          provideCompletionItems: function (model, pos) {
            var w = model.getWordUntilPosition(pos);
            var range = { startLineNumber: pos.lineNumber, endLineNumber: pos.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
            var sug = [];
            active().forEach(function (e) {
              e.m.snippets.forEach(function (s) {
                sug.push({
                  label: s.prefix, kind: m.languages.CompletionItemKind.Snippet,
                  insertText: s.body, insertTextRules: m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                  detail: e.m.name, documentation: s.description || '', range: range
                });
              });
            });
            return { suggestions: sug };
          }
        });
      }
      active().forEach(function (e) {
        e.m.themes.forEach(function (t) {
          var rules = t.rules.map(function (r) {
            var o = { token: r.token };
            if (r.foreground) o.foreground = r.foreground.replace('#', '');
            if (r.fontStyle) o.fontStyle = r.fontStyle;
            return o;
          });
          try { m.editor.defineTheme(tname(e, t), { base: t.base, inherit: true, rules: rules, colors: t.colors }); } catch (x) { }
        });
      });
    });
  }

  function useTheme(name) {
    waitMonaco(function (m) {
      try { m.editor.setTheme(name); lsSet(K_THEME, name); setMsg('Tema dipakai. Ganti tema di Pengaturan untuk kembali ke tema lain.'); }
      catch (e) { setMsg('Gagal memakai tema: ' + e.message); }
    });
  }

  function persist() { lsSet(K_INST, state.inst); lsSet(K_OFF, state.off); }

  function addManifest(raw) {
    var m = sanitize(raw);
    for (var i = 0; i < BUILTIN.length; i++) if (BUILTIN[i].id === m.id) throw new Error('id "' + m.id + '" dipakai ekstensi bawaan');
    state.inst = state.inst.filter(function (x) { return x.id !== m.id; });
    state.inst.push(m);
    delete state.off[m.id];
    persist(); applyMonaco(); render();
    return m;
  }

  // ---------- UI ----------
  function injectCss() {
    if (document.getElementById('ext-css')) return;
    var s = document.createElement('style');
    s.id = 'ext-css';
    s.textContent =
      '#ext-modal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:12px}' +
      '#ext-modal .ext-box{background:var(--t-bg,#1e1e1e);color:var(--t-fg,#ddd);border:1px solid rgba(128,128,128,.35);border-radius:10px;width:100%;max-width:560px;max-height:90vh;display:flex;flex-direction:column;overflow:hidden}' +
      '#ext-modal .ext-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(128,128,128,.3);font-weight:600}' +
      '#ext-modal .ext-x{background:none;border:0;color:inherit;font-size:22px;line-height:1;padding:0 6px}' +
      '#ext-modal .ext-body{overflow:auto;padding:10px 14px;flex:1}' +
      '#ext-modal .ext-row{padding:10px 0;border-bottom:1px solid rgba(128,128,128,.2)}' +
      '#ext-modal .ext-row.off{opacity:.55}' +
      '#ext-modal .ext-name{font-weight:600}' +
      '#ext-modal .ext-tag{font-size:10px;font-weight:600;background:rgba(14,99,156,.9);color:#fff;border-radius:4px;padding:1px 5px;margin-left:6px}' +
      '#ext-modal .ext-sub{font-size:12px;opacity:.7;margin-top:2px;word-break:break-word}' +
      '#ext-modal .ext-act{margin-top:6px;display:flex;gap:6px;flex-wrap:wrap}' +
      '#ext-modal .ext-info{font-size:12px;opacity:.75;padding:10px 0;line-height:1.5}' +
      '#ext-modal button.ext-b{background:rgba(128,128,128,.22);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:6px 12px;font-size:13px}' +
      '#ext-modal button.ext-p{background:#0e639c;border-color:#0e639c;color:#fff}' +
      '#ext-modal .ext-foot{padding:10px 14px;border-top:1px solid rgba(128,128,128,.3);display:flex;gap:6px;flex-wrap:wrap}' +
      '#ext-modal input[type=text]{flex:1;min-width:140px;background:rgba(128,128,128,.15);color:inherit;border:1px solid rgba(128,128,128,.35);border-radius:6px;padding:7px 9px;font-size:13px}' +
      '#ext-modal .ext-msg{font-size:12px;padding:6px 14px;border-top:1px solid rgba(128,128,128,.2);min-height:18px;word-break:break-word}';
    document.head.appendChild(s);
  }

  function setMsg(m) { state.msg = m; if (root) root.querySelector('.ext-msg').textContent = m; }

  function render() {
    if (!root) return;
    var rows = all().map(function (e) {
      var m = e.m, off = !!state.off[m.id];
      var parts = [];
      if (m.snippets.length) parts.push(m.snippets.length + ' snippet');
      if (m.themes.length) parts.push(m.themes.length + ' tema');
      if (m.includes.length) parts.push(m.includes.length + ' include');
      var btns = '<button class="ext-b" data-act="toggle" data-id="' + esc(m.id) + '">' + (off ? 'Aktifkan' : 'Nonaktifkan') + '</button>';
      if (!off) {
        m.themes.forEach(function (t) {
          btns += '<button class="ext-b ext-p" data-act="theme" data-id="' + esc(m.id) + '" data-x="' + esc(t.id) + '">Pakai: ' + esc(t.name) + '</button>';
        });
        m.includes.forEach(function (i) {
          btns += '<button class="ext-b ext-p" data-act="inc" data-id="' + esc(m.id) + '" data-x="' + esc(i.id) + '">Pasang: ' + esc(i.name) + '</button>';
        });
      }
      if (!e.builtin) btns += '<button class="ext-b" data-act="remove" data-id="' + esc(m.id) + '">Hapus</button>';
      return '<div class="ext-row' + (off ? ' off' : '') + '"><div class="ext-name">' + esc(m.name) +
        ' <span style="opacity:.6;font-weight:400">v' + esc(m.version) + '</span>' + (e.builtin ? '<span class="ext-tag">Bawaan</span>' : '') + '</div>' +
        '<div class="ext-sub">' + esc(m.description) + (m.author ? ' &middot; ' + esc(m.author) : '') + '</div>' +
        '<div class="ext-sub">' + esc(parts.join(' \u00b7 ')) + '</div><div class="ext-act">' + btns + '</div></div>';
    }).join('');
    var info = '<div class="ext-info"><b>Include bawaan APK</b> (langsung bisa dipakai tanpa memasang): sscanf2, YSI, streamer, a_mysql, zcmd, izcmd, Pawn.CMD, Pawn.RakNet, crashdetect, amx_assembly, weapon-config. ' +
      'Tiap library membawa file lisensinya sendiri (LICENSE.txt di folder library). Ekstensi hanya berisi data (snippet, tema, daftar include), tidak menjalankan kode.</div>';
    root.querySelector('.ext-body').innerHTML = rows + info;
    root.querySelector('.ext-msg').textContent = state.msg;
  }

  function installFromRepo(v) {
    v = (v || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
    if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(v)) { setMsg('Format repo: owner/repo'); return; }
    setMsg('Mengunduh pawnstudio-extension.json dari ' + v + ' ...');
    fetch('https://raw.githubusercontent.com/' + v + '/HEAD/pawnstudio-extension.json')
      .then(function (r) { if (!r.ok) throw new Error('File pawnstudio-extension.json tidak ada di repo (HTTP ' + r.status + ')'); return r.text(); })
      .then(function (t) { if (t.length > 500000) throw new Error('File terlalu besar'); var m = addManifest(JSON.parse(t)); setMsg('Terpasang: ' + m.name); })
      .catch(function (e) { setMsg('Gagal: ' + (e && e.message ? e.message : e)); });
  }

  function importFile(file) {
    if (!file) return;
    if (file.size > 500000) { setMsg('File terlalu besar (maks 500 KB)'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      try { var m = addManifest(JSON.parse(String(fr.result))); setMsg('Terpasang: ' + m.name); }
      catch (e) { setMsg('Gagal: ' + e.message); }
    };
    fr.onerror = function () { setMsg('Gagal membaca file'); };
    fr.readAsText(file);
  }

  function installInclude(extId, incId) {
    var e = null; all().forEach(function (x) { if (x.m.id === extId) e = x; });
    if (!e) return;
    var inc = null; e.m.includes.forEach(function (i) { if (i.id === incId) inc = i; });
    if (!inc) return;
    var p = plugin();
    if (!p) { setMsg('Plugin library tidak tersedia'); return; }
    setMsg('Mengunduh ' + inc.name + ' ...');
    p.install({ id: inc.id, repo: inc.repo, mode: inc.mode }).then(function (r) {
      setMsg(inc.name + ' terpasang: ' + r.count + ' file (' + r.tag + ') di pawno/include.');
      document.dispatchEvent(new CustomEvent('pawnstudio:libs-changed'));
    }).catch(function (err) { setMsg('Gagal: ' + (err && err.message ? err.message : err)); });
  }

  function open() {
    injectCss();
    if (root) root.remove();
    root = document.createElement('div');
    root.id = 'ext-modal';
    root.innerHTML =
      '<div class="ext-box"><div class="ext-head"><span>Ekstensi</span><button class="ext-x" data-act="close">&times;</button></div>' +
      '<div class="ext-body"></div><div class="ext-msg"></div>' +
      '<div class="ext-foot"><input type="text" id="ext-repo" placeholder="GitHub: owner/repo" autocapitalize="off" autocomplete="off">' +
      '<button class="ext-b ext-p" data-act="repo">Pasang</button>' +
      '<button class="ext-b" data-act="file">Impor file .json</button>' +
      '<input type="file" id="ext-file" accept=".json,application/json" hidden></div></div>';
    root.addEventListener('click', function (ev) {
      if (ev.target === root) { root.remove(); root = null; return; }
      var b = ev.target.closest('[data-act]'); if (!b) return;
      var act = b.getAttribute('data-act'), id = b.getAttribute('data-id'), x = b.getAttribute('data-x');
      if (act === 'close') { root.remove(); root = null; }
      else if (act === 'toggle') { if (state.off[id]) delete state.off[id]; else state.off[id] = true; persist(); applyMonaco(); render(); }
      else if (act === 'remove') {
        if (window.confirm('Hapus ekstensi ini?')) { state.inst = state.inst.filter(function (m) { return m.id !== id; }); delete state.off[id]; persist(); render(); }
      }
      else if (act === 'theme') { useTheme('ext-' + id + '-' + x); }
      else if (act === 'inc') installInclude(id, x);
      else if (act === 'repo') installFromRepo(root.querySelector('#ext-repo').value);
      else if (act === 'file') root.querySelector('#ext-file').click();
    });
    root.querySelector('#ext-file').addEventListener('change', function (ev) { importFile(ev.target.files && ev.target.files[0]); ev.target.value = ''; });
    document.body.appendChild(root);
    render();
  }

  function addButton() {
    if (document.getElementById('activity-ext')) return true;
    var sp = document.querySelector('#activity-bar .activity-spacer');
    if (!sp || !sp.parentNode) return false;
    var b = document.createElement('button');
    b.id = 'activity-ext';
    b.className = 'activity-btn';
    b.title = 'Ekstensi';
    b.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 11H19V7a2 2 0 0 0-2-2h-4V3.5a2.5 2.5 0 0 0-5 0V5H4a2 2 0 0 0-2 2v3.8h1.5a2.7 2.7 0 0 1 0 5.4H2V20a2 2 0 0 0 2 2h3.8v-1.5a2.7 2.7 0 0 1 5.4 0V22H17a2 2 0 0 0 2-2v-4h1.5a2.5 2.5 0 0 0 0-5z"/></svg>';
    b.addEventListener('click', open);
    sp.parentNode.insertBefore(b, sp);
    return true;
  }

  function init() {
    state.inst = [];
    var saved = lsGet(K_INST, []);
    if (Array.isArray(saved)) saved.forEach(function (m) { try { state.inst.push(sanitize(m)); } catch (e) { } });
    var off = lsGet(K_OFF, {});
    state.off = off && typeof off === 'object' ? off : {};

    if (!addButton()) {
      var tries = 0, t = setInterval(function () { if (addButton() || ++tries > 40) clearInterval(t); }, 250);
    }
    applyMonaco();

    // Pulihkan tema ekstensi setelah main.js menerapkan tema Pengaturan saat start.
    waitMonaco(function (m) {
      var prev = m.editor.setTheme.bind(m.editor);
      m.editor.setTheme = function (n) {
        if (initDone && typeof n === 'string' && n.indexOf('ext-') !== 0) lsSet(K_THEME, null);
        return prev(n);
      };
      var saved = lsGet(K_THEME, null);
      function reapply() { if (saved && !initDone) { try { prev(saved); } catch (e) { } } }
      setTimeout(reapply, 1500);
      setTimeout(reapply, 4000);
      setTimeout(function () { initDone = true; }, 5000);
    });
  }

  window.PawnExt = { open: open, add: addManifest };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
