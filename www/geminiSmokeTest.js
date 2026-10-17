/* SEMENTARA: smoke test GeminiPlugin. Hapus sebelum rilis. */
(function () {
  'use strict';
  var P = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.GeminiNative;
  if (!P) { console.warn('[GeminiTest] GeminiNative tidak ditemukan'); return; }
  var MK = 'pawn.gemini.testModel';
  var runs = {};
  function show(t) { console.log('[GeminiTest]', t); try { alert(String(t).slice(0, 1500)); } catch (e) {} }
  function fail(e) { show('ERROR ' + (e && e.code ? e.code : '') + ': ' + (e && e.message ? e.message : e)); }

  P.addListener('geminiChunk', function (e) { var r = runs[e.requestId]; if (r) r.text += e.text; });
  P.addListener('geminiDone', function (e) {
    var r = runs[e.requestId]; if (!r) return; delete runs[e.requestId];
    show('SELESAI (' + e.finishReason + ', ' + e.ms + ' ms, token ' + (e.usage && e.usage.totalTokens) + ')\n\n' + r.text);
  });
  P.addListener('geminiError', function (e) {
    var r = runs[e.requestId]; if (!r) return; delete runs[e.requestId];
    show('EVENT ERROR ' + e.code + ': ' + e.message + (r.text ? '\n\nSebagian:\n' + r.text.slice(0, 400) : ''));
  });

  async function gen(stopAfterMs) {
    var model = localStorage.getItem(MK);
    if (!model) { show('Pilih model dulu (menu 5).'); return; }
    var text = prompt('Prompt:', stopAfterMs
      ? 'Tulis cerita panjang sekitar 2000 kata tentang server SA-MP.'
      : 'Jelaskan callback OnPlayerConnect di SA-MP dalam 3 kalimat.');
    if (!text) return;
    var id = 't' + Date.now();
    runs[id] = { text: '' };
    await P.generate({ requestId: id, model: model, prompt: text });
    if (stopAfterMs) setTimeout(function () { P.cancel({ requestId: id }).catch(fail); }, stopAfterMs);
  }

  async function menu() {
    var c = prompt('Gemini test (model: ' + (localStorage.getItem(MK) || '-') + ')\n' +
      '1 simpan key\n2 status key\n3 tes koneksi\n4 daftar model\n5 pilih model\n6 generate\n7 generate + stop 2 dtk\n8 hapus key');
    try {
      if (c === '1') { var k = prompt('Tempel API key Gemini:'); if (k) show(JSON.stringify(await P.setApiKey({ key: k }))); }
      else if (c === '2') show(JSON.stringify(await P.getKeyStatus()));
      else if (c === '3') show(JSON.stringify(await P.testConnection({ model: localStorage.getItem(MK) || undefined })));
      else if (c === '4') { var r = await P.listModels(); show(r.count + ' model:\n' + r.models.slice(0, 40).map(function (m) { return m.id; }).join('\n')); }
      else if (c === '5') { var m = prompt('ID model (dari menu 4):', localStorage.getItem(MK) || ''); if (m) localStorage.setItem(MK, m.trim()); }
      else if (c === '6') await gen(0);
      else if (c === '7') await gen(2000);
      else if (c === '8') show(JSON.stringify(await P.clearApiKey()));
    } catch (e) { fail(e); }
  }

  function addBtn() {
    var b = document.createElement('button');
    b.textContent = 'G';
    b.style.cssText = 'position:fixed;left:6px;bottom:60px;z-index:99999;width:34px;height:34px;border-radius:17px;border:0;background:#0e639c;color:#fff;font-weight:bold;opacity:.7';
    b.onclick = menu;
    document.body.appendChild(b);
  }
  if (document.body) addBtn(); else document.addEventListener('DOMContentLoaded', addBtn);
})();
