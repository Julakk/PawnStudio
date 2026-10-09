// PawnStudio - jalanin Node.js di dalam app (lewat plugin native NodeRunner)
(function () {
  var running = false, outH = null, exitH = null, buf = '', flushT = null, runBtn = null, runIcon = '';
  var MAX_LINES = 3000;
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
  function lineType(t) { return /\b(\w*Error|Uncaught|ENOENT|EADDRINUSE|ECONNREFUSED)\b/.test(t) ? 'error' : 'plain'; }

  function flush() { if (buf) { addLine(buf, lineType(buf)); buf = ''; } }
  function pushText(t) {
    buf += String(t).replace(/\r\n/g, '\n');
    var parts = buf.split('\n');
    buf = parts.pop();
    parts.forEach(function (l) { addLine(l, lineType(l)); });
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
    if (ev.stopped) {
      addLine('[Dihentikan]', 'info');
      setStatus('idle', '● Siap');
    } else if (ev.exitCode === 0) {
      addLine('[Selesai, kode 0, ' + secs + 's]', 'success');
      setStatus('success', '✓ Node selesai (' + secs + 's)');
    } else {
      if (ev.exitCode === 127) addLine('Runtime Node.js gagal dimuat (cek libnode.so di APK).', 'error');
      addLine('[Keluar dengan kode ' + ev.exitCode + ', ' + secs + 's]', 'error');
      setStatus('fail', '✕ Node kode ' + ev.exitCode);
    }
  }

  function notAvailable(reason) {
    showOutputPanel();
    setOutputLines([
      { text: 'Node.js tidak bisa dijalankan: ' + reason + '.', type: 'error' },
      { text: 'Pastikan APK dibuild dengan runtime Node.js (versi 1.7.0 ke atas).', type: 'info' }
    ]);
  }

  async function start(path) {
    var p = plug();
    if (!p) { notAvailable('plugin NodeRunner tidak ditemukan (jalankan sebagai APK, bukan browser)'); return; }
    try { if (typeof saveActiveTab === 'function') await saveActiveTab(); } catch (e) {}
    var st;
    try { st = await p.status(); } catch (e) { st = { available: false }; }
    if (!st || !st.available) { notAvailable('APK ini dibuild tanpa runtime Node.js'); return; }

    showOutputPanel();
    setOutputLines([{ text: '$ node ' + path, type: 'info' }]);
    buf = '';
    setStatus('running', '⟳ Node: jalan');
    try {
      outH = await p.addListener('output', function (ev) { pushText((ev && ev.text) || ''); });
      exitH = await p.addListener('exit', handleExit);
      setRunning(true);
      await p.run({ path: path });
    } catch (e) {
      cleanup();
      setRunning(false);
      addLine('Gagal menjalankan: ' + (e && e.message ? e.message : e), 'error');
      setStatus('fail', '✕ Node gagal');
    }
  }

  async function stop() {
    var p = plug();
    try { if (p) await p.stop(); } catch (e) {}
  }

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
    start(path);
    return true;
  };
})();
