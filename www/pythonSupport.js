(function () {
  'use strict';
  var worker = null, running = false;

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text) e.textContent = text;
    return e;
  }

  var btn = el('button', 'position:fixed;right:14px;bottom:70px;z-index:9998;display:none;padding:10px 16px;border:0;border-radius:24px;background:#3fb950;color:#000;font-weight:700;font-size:14px;box-shadow:0 2px 8px #0008', '\u25B6 Run Python');
  var panel = el('div', 'position:fixed;left:0;right:0;bottom:0;height:40%;z-index:9999;display:none;flex-direction:column;background:#1e1e1e;color:#ddd;border-top:2px solid #3fb950;font-family:monospace;font-size:13px');
  var bar = el('div', 'display:flex;gap:8px;align-items:center;padding:6px 10px;background:#252526');
  var title = el('span', 'flex:1;font-weight:700', 'Python Output');
  var stopBtn = el('button', 'padding:4px 10px', '\u25A0 Stop');
  var clearBtn = el('button', 'padding:4px 10px', 'Clear');
  var closeBtn = el('button', 'padding:4px 10px', 'X');
  var out = el('pre', 'flex:1;margin:0;padding:8px 10px;overflow:auto;white-space:pre-wrap;word-break:break-word');
  bar.appendChild(title); bar.appendChild(stopBtn); bar.appendChild(clearBtn); bar.appendChild(closeBtn);
  panel.appendChild(bar); panel.appendChild(out);
  document.body.appendChild(btn);
  document.body.appendChild(panel);

  function log(text, color) {
    var s = el('span', color ? 'color:' + color : '', text);
    out.appendChild(s);
    out.scrollTop = out.scrollHeight;
  }
  function setRunning(v) {
    running = v;
    btn.textContent = v ? '\u23F3 Running...' : '\u25B6 Run Python';
    btn.style.opacity = v ? '0.6' : '1';
  }
  function startWorker() {
    worker = new Worker('pythonWorker.js');
    worker.onmessage = function (e) {
      var m = e.data;
      if (m.t === 'out') log(m.s + '\n');
      else if (m.t === 'err') log(m.s + '\n', '#f85149');
      else if (m.t === 'status') log(m.s + '\n', '#8b949e');
      else if (m.t === 'done') setRunning(false);
    };
    worker.onerror = function (e) {
      log('Worker error: ' + (e.message || e) + '\n', '#f85149');
      setRunning(false);
    };
  }
  function getEditor() {
    var m = window.monaco;
    if (!m || !m.editor || !m.editor.getEditors) return null;
    var eds = m.editor.getEditors();
    for (var i = 0; i < eds.length; i++) {
      if (eds[i].hasTextFocus && eds[i].hasTextFocus()) return eds[i];
    }
    return eds[0] || null;
  }
  function isPy(model) {
    if (!model) return false;
    var lang = model.getLanguageId ? model.getLanguageId() : '';
    return lang === 'python' || /\.py$/i.test((model.uri && model.uri.path) || '');
  }
  function run() {
    var ed = getEditor();
    if (!ed || !ed.getModel() || running) return;
    panel.style.display = 'flex';
    out.textContent = '';
    if (!worker) startWorker();
    setRunning(true);
    worker.postMessage({ code: ed.getValue() });
  }
  function stop() {
    if (worker) { worker.terminate(); worker = null; }
    if (running) log('[dihentikan]\n', '#d29922');
    setRunning(false);
  }

  btn.onclick = run;
  window.psPyRun = function () { if (running) stop(); else run(); };
  stopBtn.onclick = stop;
  clearBtn.onclick = function () { out.textContent = ''; };
  closeBtn.onclick = function () { panel.style.display = 'none'; };

  setInterval(function () {
    var m = window.monaco;
    if (!m || !m.editor) return;
    if (m.editor.getModels) {
      m.editor.getModels().forEach(function (mod) {
        if (/\.py$/i.test((mod.uri && mod.uri.path) || '') && mod.getLanguageId() === 'plaintext') {
          m.editor.setModelLanguage(mod, 'python');
        }
      });
    }
    var ed = getEditor();
    btn.style.display = (ed && isPy(ed.getModel())) ? 'block' : 'none';
  }, 600);
})();
