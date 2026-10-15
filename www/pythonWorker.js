importScripts('vendor/pyodide/pyodide.js');
var py = null;
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
    await p.runPythonAsync(e.data.code);
  } catch (err) {
    postMessage({ t: 'err', s: String((err && err.message) || err) });
  }
  postMessage({ t: 'done' });
};
