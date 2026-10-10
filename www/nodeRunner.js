// PawnStudio - jalanin Node.js dan npm di dalam app (lewat plugin native NodeRunner)
(function () {
  var running = false, kind = 'node', outH = null, exitH = null, buf = '', flushT = null, runBtn = null, runIcon = '';
  var MAX_LINES = 3000;
  var outLines = 0;
  var NPM_CMDS = ['install', 'i', 'add', 'uninstall', 'remove', 'rm', 'update', 'ls', 'list', 'init'];
  var STOP_ICON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1.5"/></svg>';

  function plug() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NodeRunner; }
  function isNodeFile(p) { return /\.(js|mjs|cjs)$/i.test(p || ''); }
  function isTsFile(p) { return /\.ts$/i.test(p || ''); }
  function body() { return document.getElementById('output-panel-body'); }
  function setStatus(cls, text) {
    var el = document.getElementById('status-compile');
    if (el) { el.className = cls; el.textContent = text; }
  }

  function addLine(text, type) {
    var b = body();
    if (!b) return;
    var el = document.createElement('div');
    el.className = 'output-line ' + (type || 'plain');
    el.textContent = text;
    b.appendChild(el);
    while (b.children.length > MAX_LINES) b.removeChild(b.firstChild);
    b.scrollTop = b.scrollHeight;
  }
  function lineType(t) {
    if (/^npm (ERR!|error)/.test(t) || /\b(\w*Error|Uncaught|ENOENT|EADDRINUSE|ECONNREFUSED)\b/.test(t)) return 'error';
    if (/^npm (WARN|warn)/.test(t)) return 'warning';
    return 'plain';
  }

  function flush() { if (buf) { if (buf.trim()) outLines++; addLine(buf, lineType(buf)); buf = ''; } }
  function pushText(t) {
    buf += String(t).replace(/\r\n/g, '\n');
    var parts = buf.split('\n');
    buf = parts.pop();
    parts.forEach(function (l) { if (l.trim()) outLines++; addLine(l, lineType(l)); });
    clearTimeout(flushT);
    if (buf) flushT = setTimeout(flush, 200);
  }

  function setRunning(on) {
    if (on === running) return;
    running = on;
    runBtn = runBtn || document.getElementById('btn-run');
    if (!runBtn) return;
    if (on) { runIcon = runBtn.innerHTML; runBtn.innerHTML = STOP_ICON; runBtn.title = 'Stop'; }
    else { if (runIcon) runBtn.innerHTML = runIcon; runBtn.title = 'Run'; }
  }

  function cleanup() {
    try { if (outH) outH.remove(); } catch (e) {}
    try { if (exitH) exitH.remove(); } catch (e) {}
    outH = exitH = null;
  }

  function handleExit(ev) {
    clearTimeout(flushT);
    flush();
    cleanup();
    setRunning(false);
    var secs = ((ev.durationMs || 0) / 1000).toFixed(1);
    var name = kind === 'npm' ? 'npm' : 'Node';
    if (ev.stopped) {
      addLine('[Dihentikan]', 'info');
      setStatus('idle', '● Siap');
    } else if (ev.exitCode === 0) {
      addLine('[Selesai, kode 0, ' + secs + 's]', 'success');
      setStatus('success', '✓ ' + name + ' OK (' + secs + 's)');
    } else {
      if (ev.exitCode === 127) addLine('Runtime Node.js gagal dimuat (cek libnode.so di APK).', 'error');
      if (outLines === 0 && kind === 'node' && ev.exitCode !== 127) addLine('Tidak ada output sama sekali dan bukan dari process.exit(). Kemungkinan Node crash saat memuat modul (mis. modul native).', 'info');
      addLine('[Keluar dengan kode ' + ev.exitCode + ', ' + secs + 's]', 'error');
      setStatus('fail', '✕ ' + name + ' kode ' + ev.exitCode);
    }
    // npm bisa bikin package.json / node_modules, muat ulang Explorer
    if (kind === 'npm' && typeof renderFileTree === 'function') {
      try { renderFileTree(); } catch (e) {}
    }
  }

  function notAvailable(reason) {
    showOutputPanel();
    setOutputLines([
      { text: 'Tidak bisa dijalankan: ' + reason + '.', type: 'error' },
      { text: 'Pastikan APK dibuild dengan runtime Node.js (versi 1.7.0 ke atas).', type: 'info' }
    ]);
  }

  // Satu pintu untuk Run file Node maupun npm. invoke(plugin) memanggil run/npm di native.
  async function launch(k, label, needNpm, invoke) {
    var p = plug();
    if (!p) { notAvailable('plugin NodeRunner tidak ditemukan (jalankan sebagai APK, bukan browser)'); return; }
    try { if (typeof saveActiveTab === 'function') await saveActiveTab(); } catch (e) {}
    var st;
    try { st = await p.status(); } catch (e) { st = { available: false }; }
    if (!st || !st.available) { notAvailable('APK ini dibuild tanpa runtime Node.js'); return; }
    if (needNpm && !st.npm) {
      showOutputPanel();
      setOutputLines([
        { text: 'npm tidak ada di APK ini.', type: 'error' },
        { text: 'Pastikan APK dibuild dengan npm (versi 1.8.8 ke atas).', type: 'info' }
      ]);
      return;
    }

    kind = k;
    showOutputPanel();
    setOutputLines([{ text: '$ ' + label, type: 'info' }]);
    buf = '';
    outLines = 0;
    setStatus('running', '⟳ ' + (k === 'npm' ? 'npm' : 'Node'));
    try {
      outH = await p.addListener('output', function (ev) { pushText((ev && ev.text) || ''); });
      exitH = await p.addListener('exit', handleExit);
      setRunning(true);
      await invoke(p);
    } catch (e) {
      cleanup();
      setRunning(false);
      addLine('Gagal menjalankan: ' + (e && e.message ? e.message : e), 'error');
      setStatus('fail', '✕ ' + (k === 'npm' ? 'npm' : 'Node') + ' gagal');
    }
  }

  function startNode(path) {
    return launch('node', 'node ' + path, false, function (p) { return p.run({ path: path }); });
  }

  function startNpm(args) {
    return launch('npm', 'npm ' + args.join(' '), true, function (p) { return p.npm({ args: args }); });
  }

  async function stop() {
    var p = plug();
    try { if (p) await p.stop(); } catch (e) {}
  }

  // Tombol npm di Explorer: ketik perintah, contoh "install discord.js"
  window.psNpmPrompt = function () {
    if (running) { alert('Masih ada proses yang berjalan. Hentikan dulu (tombol Stop).'); return; }
    var s = prompt('npm (contoh: install discord.js  |  uninstall express  |  ls)', 'install ');
    if (s == null) return;
    var args = s.trim().split(/\s+/).filter(Boolean);
    if (args[0] === 'npm') args.shift();
    if (!args.length) return;
    if (NPM_CMDS.indexOf(args[0]) < 0) {
      alert('Perintah npm tidak didukung: ' + args[0] + '\nYang didukung: ' + NPM_CMDS.join(', '));
      return;
    }
    startNpm(args);
  };

  // Dipanggil dari runCompiler() di main.js sebelum compile PAWN
  window.psNodeRunGuard = function (path) {
    if (isTsFile(path)) {
      showOutputPanel();
      setOutputLines([
        { text: 'TypeScript belum bisa dijalankan langsung.', type: 'info' },
        { text: 'Compile ke .js dulu (tsc), lalu tekan Run di file .js-nya.', type: 'info' }
      ]);
      return true;
    }
    if (!isNodeFile(path)) return false;
    if (running) { stop(); return true; }
    startNode(path);
    return true;
  };

  function bindNpmButton() {
    var b = document.getElementById('btn-npm');
    if (b) b.addEventListener('click', function () { window.psNpmPrompt(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bindNpmButton);
  else bindNpmButton();
})();
