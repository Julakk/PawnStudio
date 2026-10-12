// PawnStudio - Cek Kompatibilitas HP (v1.14.1)
// Pengaturan -> "Cek HP": info HP, status izin, dan fitur mana yang didukung di HP ini.
(function () {
  'use strict';
  var panel = null, body = null, busy = false, report = '';
  var COL = { ok: '#73c991', warn: '#e2c08d', bad: '#f48771' };
  var ICO = { ok: '✅', warn: '⚠️', bad: '❌' };
  var BG = 'var(--t-bg,#1e1e1e)', SIDE = 'var(--t-side,#252526)', FG = 'var(--t-fg,#d4d4d4)';
  var DIM = 'var(--t-dim,#a3a3a3)', BORDER = 'var(--t-border,#3c3c3c)', BTNBG = 'var(--t-btn,#37373d)';
  var BTN = 'background:' + BTNBG + ';border:1px solid ' + BORDER + ';border-radius:4px;color:' + FG + ';font-size:12px;font-weight:600;padding:6px 12px;';
  var OEM = /xiaomi|redmi|poco|oppo|realme|oneplus|vivo|iqoo|huawei|honor|samsung|infinix|tecno|itel|meizu|asus/i;

  function plug() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.DeviceCheck; }
  function nodePlug() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.NodeRunner; }
  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }
  function gb(mb) { return (mb / 1024).toFixed(1) + ' GB'; }
  function appVersion() { var v = document.getElementById('app-version'); return v ? v.textContent : ''; }

  function evaluate(d, ns) {
    var items = [];
    function add(title, level, text, act) { items.push({ title: title, level: level, text: text, act: act || null }); }
    var abis = (d.abis || []).join(', ') || '-';

    add('Android', 'ok', 'Android ' + d.release + ' (API ' + d.sdk + '). App butuh Android 8.0 ke atas.');
    if (d.arm64) add('CPU', 'ok', 'arm64-v8a didukung (' + abis + ').');
    else add('CPU', 'bad', 'HP ini tidak punya arm64-v8a (' + abis + '). Compiler PAWN dan Node.js hanya tersedia untuk arm64.');

    if (!d.arm64) add('Compiler PAWN', 'bad', 'Tidak didukung di HP non-arm64.');
    else if (!d.compilerLib) add('Compiler PAWN', 'bad', 'File compiler tidak ada di APK ini.');
    else if (d.compilerRuns === false) add('Compiler PAWN', 'bad', 'File compiler ada, tetapi tidak bisa dijalankan di HP ini.');
    else add('Compiler PAWN', 'ok', 'Siap dipakai.');

    if (!d.arm64) add('Node.js', 'bad', 'Tidak didukung di HP non-arm64.');
    else if (!d.nodeLib) add('Node.js', 'warn', 'Runtime Node.js tidak disertakan di APK ini.');
    else if (d.nodeRuns === false) add('Node.js', 'bad', 'Runtime ada, tetapi tidak bisa dijalankan di HP ini.');
    else add('Node.js', 'ok', (d.nodeVersion ? 'Node.js ' + d.nodeVersion : 'Siap dipakai') + (ns && ns.npm ? ', npm tersedia.' : '.'));

    add('Git', 'ok', 'Git bawaan (JGit) jalan di semua HP yang bisa memasang app ini. Push dan Pull butuh internet.');

    if (d.allFiles) add('Akses semua file', 'ok', 'Aktif.');
    else add('Akses semua file', 'warn', 'Belum aktif. Dibutuhkan untuk membuka folder project di penyimpanan HP.', { label: 'Buka pengaturan', what: 'allfiles' });

    if (d.notif) add('Notifikasi', 'ok', 'Aktif.');
    else add('Notifikasi', 'warn', 'Belum aktif. Notifikasi "Node.js berjalan" dan tombol Stop tidak akan muncul (Android 13 ke atas butuh izin ini).', { label: 'Buka pengaturan', what: 'notif' });

    if (d.battery) add('Penghematan baterai', 'ok', 'Tidak dibatasi untuk PawnStudio.');
    else add('Penghematan baterai', 'warn', 'Masih dibatasi. Node.js di latar belakang bisa dimatikan sistem saat layar mati.', { label: 'Izinkan', what: 'battery' });

    if (OEM.test((d.manufacturer || '') + ' ' + (d.brand || ''))) {
      add('Merek HP', 'warn', d.manufacturer + ' sering mematikan aplikasi di latar belakang. Selain izin baterai di atas, kunci PawnStudio di daftar recent apps dan atur penggunaan baterainya ke "Tanpa batasan".');
    }

    if (d.ramMb) {
      if (d.ramMb < 3072) add('RAM', 'warn', gb(d.ramMb) + '. RAM kecil: compile gamemode besar atau menjalankan Node bisa berat.');
      else add('RAM', 'ok', gb(d.ramMb) + '.');
    }
    if (d.freeMb != null) {
      if (d.freeMb < 500) add('Penyimpanan', 'warn', 'Sisa ' + gb(d.freeMb) + '. Penyimpanan hampir penuh.');
      else add('Penyimpanan', 'ok', 'Sisa ' + gb(d.freeMb) + '.');
    }
    return items;
  }

  function summary(items) {
    var comp = items.filter(function (i) { return i.title === 'Compiler PAWN'; })[0];
    var notes = items.filter(function (i) { return i.level !== 'ok'; }).length;
    if (comp && comp.level === 'bad') return { level: 'bad', text: 'Fitur utama (compile PAWN) tidak jalan di HP ini.' };
    if (notes) return { level: 'warn', text: 'Sebagian fitur terbatas atau perlu diaktifkan (' + notes + ' catatan).' };
    return { level: 'ok', text: 'Semua fitur didukung di HP ini.' };
  }

  function buildReport(d, items, sum) {
    var lines = [
      'PawnStudio ' + appVersion() + ' - Laporan kompatibilitas HP',
      'HP: ' + (d.manufacturer || '') + ' ' + (d.model || ''),
      'Android ' + d.release + ' (API ' + d.sdk + ')',
      'CPU: ' + ((d.abis || []).join(', ') || '-'),
      'Kesimpulan: ' + sum.text,
      ''
    ];
    items.forEach(function (i) { lines.push(ICO[i.level] + ' ' + i.title + ': ' + i.text); });
    return lines.join('\n');
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;';
      document.body.appendChild(ta); ta.focus(); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta);
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }, function () { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  function render(d, ns) {
    var items = evaluate(d, ns), sum = summary(items);
    report = buildReport(d, items, sum);
    body.innerHTML = '';

    var box = el('div', 'border:1px solid ' + COL[sum.level] + ';border-radius:8px;padding:12px;margin-bottom:12px;background:' + SIDE + ';');
    box.appendChild(el('div', 'font-size:15px;font-weight:700;color:' + COL[sum.level] + ';', ICO[sum.level] + ' ' + sum.text));
    box.appendChild(el('div', 'margin-top:6px;font-size:13px;color:' + DIM + ';', (d.manufacturer || '') + ' ' + (d.model || '') + '  ·  Android ' + d.release + '  ·  ' + appVersion()));
    body.appendChild(box);

    items.forEach(function (i) {
      var row = el('div', 'padding:10px 4px;border-bottom:1px solid ' + BORDER + ';');
      var top = el('div', 'display:flex;align-items:center;gap:8px;');
      top.appendChild(el('span', 'font-size:15px;', ICO[i.level]));
      top.appendChild(el('span', 'flex:1;font-size:14px;font-weight:600;color:' + FG + ';', i.title));
      if (i.act) {
        var b = el('button', BTN, i.act.label);
        b.addEventListener('click', function () {
          var p = plug(); if (p) p.openSettings({ what: i.act.what });
        });
        top.appendChild(b);
      }
      row.appendChild(top);
      row.appendChild(el('div', 'margin:4px 0 0 28px;font-size:13px;line-height:1.45;color:' + DIM + ';word-break:break-word;', i.text));
      body.appendChild(row);
    });

    var cp = el('button', BTN + 'width:100%;margin-top:16px;padding:10px;', 'Salin laporan');
    cp.addEventListener('click', function () {
      copyText(report).then(function (ok) { cp.textContent = ok ? 'Laporan disalin' : 'Gagal menyalin'; setTimeout(function () { cp.textContent = 'Salin laporan'; }, 2000); });
    });
    body.appendChild(cp);
  }

  async function run() {
    if (busy) return;
    var p = plug();
    body.innerHTML = '';
    if (!p) { body.appendChild(el('div', 'padding:12px;font-size:13px;color:' + COL.bad + ';', 'Plugin Cek HP tidak ditemukan. Jalankan sebagai APK versi terbaru.')); return; }
    busy = true;
    body.appendChild(el('div', 'padding:12px;font-size:13px;color:' + DIM + ';', 'Memeriksa HP… (compiler dan Node.js dijalankan sebentar)'));
    try {
      var d = await p.info();
      var ns = null;
      try { var np = nodePlug(); if (np) ns = await np.status(); } catch (e) {}
      render(d, ns);
    } catch (e) {
      body.innerHTML = '';
      body.appendChild(el('div', 'padding:12px;font-size:13px;color:' + COL.bad + ';', 'Gagal memeriksa: ' + ((e && e.message) || e)));
    }
    busy = false;
  }

  function build() {
    if (panel) return;
    panel = el('div', 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:300;display:none;flex-direction:column;background:' + BG + ';color:' + FG + ';font-family:sans-serif;');
    var head = el('div', 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:calc(10px + env(safe-area-inset-top,0px)) 12px 10px;background:' + SIDE + ';border-bottom:1px solid ' + BORDER + ';');
    head.appendChild(el('span', 'flex:1;font-size:12px;font-weight:700;letter-spacing:.5px;color:' + DIM + ';', 'CEK KOMPATIBILITAS HP'));
    var again = el('button', BTN, '⟳'); again.addEventListener('click', run);
    var close = el('button', BTN, 'Tutup'); close.addEventListener('click', function () { panel.style.display = 'none'; });
    head.appendChild(again); head.appendChild(close);
    body = el('div', 'flex:1;overflow-y:auto;padding:12px;-webkit-user-select:text;user-select:text;');
    panel.appendChild(head); panel.appendChild(body);
    document.body.appendChild(panel);
  }

  function open() {
    var ov = document.getElementById('settings-overlay');
    if (ov) ov.classList.add('hidden');
    build();
    panel.style.display = 'flex';
    run();
  }

  function addEntry() {
    var sb = document.getElementById('settings-body');
    if (!sb || document.getElementById('devcheck-row')) return;
    var row = el('div', 'display:flex;align-items:center;justify-content:space-between;gap:10px;');
    row.id = 'devcheck-row';
    row.className = 'setting-row';
    row.appendChild(el('label', '', 'Kompatibilitas HP'));
    var b = el('button', BTN, 'Cek HP');
    b.type = 'button';
    b.addEventListener('click', open);
    row.appendChild(b);
    sb.appendChild(row);
  }

  // Kembali dari layar pengaturan sistem: periksa ulang supaya status izin langsung diperbarui.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && panel && panel.style.display === 'flex') run();
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addEntry);
  else addEntry();
})();
