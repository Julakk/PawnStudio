importScripts('vendor/pyodide/pyodide.js');
var py = null;

// Buang baris internal Pyodide, sisakan traceback dari kode pengguna
function clean(msg) {
  msg = String(msg || '');
  var lines = msg.split('\n');
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('File "<exec>"') >= 0) {
      return ['Traceback (most recent call last):'].concat(lines.slice(i)).join('\n').trim();
    }
  }
  return msg.trim();
}

async function init() {
  if (py) return py;
  postMessage({ t: 'status', s: '[Memuat Python, tunggu sebentar...]' });
  py = await loadPyodide({
    indexURL: new URL('vendor/pyodide/', self.location.href).href
  });
  py.setStdout({ batched: function (s) { postMessage({ t: 'out', s: s }); } });
  py.setStderr({ batched: function (s) { postMessage({ t: 'err', s: s }); } });
  py.setStdin({ stdin: function () { return undefined; } });
  return py;
}

self.onmessage = async function (e) {
  try {
    var p = await init();
    postMessage({ t: 'start' });
    await p.runPythonAsync(e.data.code);
  } catch (err) {
    postMessage({ t: 'err', s: clean((err && err.message) || err) });
  }
  postMessage({ t: 'done' });
};
