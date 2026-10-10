// PS_REGEX_COMPAT v1.8.4
// Node di APK gak support \p{sc=...}; ganti jadi range Unicode sebelum modul dikompilasi.
(function () {
  try {
    var M = require('module');
    var orig = M.prototype._compile;
    var MAP = [
      ['\\p{sc=Deva}', '\\u0900-\\u097F'],
      ['\\p{sc=Devanagari}', '\\u0900-\\u097F'],
      ['\\p{sc=Thai}', '\\u0E00-\\u0E7F'],
      ['\\p{Script=Deva}', '\\u0900-\\u097F'],
      ['\\p{Script=Devanagari}', '\\u0900-\\u097F'],
      ['\\p{Script=Thai}', '\\u0E00-\\u0E7F']
    ];
    // PS_REGEX_COMPAT_2: runtime tanpa ICU gak kenal \p{...} sama sekali
    var LETTER = 'A-Za-z\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u0370-\\u1FFF\\u2C00-\\uD7FF\\uF900-\\uFDFF\\uFE70-\\uFEFC\\u{10000}-\\u{10FFFF}';
    var NUMBER = '0-9\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE\\u0660-\\u0669\\u06F0-\\u06F9\\u0966-\\u096F\\u0E50-\\u0E59\\uFF10-\\uFF19';
    MAP.push(
      ['\\p{Letter}', LETTER],
      ['\\p{L}', LETTER],
      ['\\p{Number}', NUMBER],
      ['\\p{N}', NUMBER]
    );
    M.prototype._compile = function (content, filename) {
      if (typeof content === 'string' &&
          (content.indexOf('\\p{sc=') !== -1 || content.indexOf('\\p{Script=') !== -1)) {
        for (var i = 0; i < MAP.length; i++) {
          content = content.split(MAP[i][0]).join(MAP[i][1]);
        }
      }
      arguments[0] = content; return orig.apply(this, arguments);
    };
  } catch (e) { /* jangan sampai preload ikut crash */ }
})();
// PawnStudio - shim diagnostik Node.js (di-preload ke setiap script)
(function () {
  var out = process.stdout;
  function say(s) { try { out.write(s); } catch (e) {} }

  // 1) process.exit(kode != 0): tunjukkan dari mana dipanggil
  var realExit = process.exit;
  process.exit = function (code) {
    var c = Number(code === undefined ? process.exitCode : code);
    if (c) {
      var st = (new Error().stack || '').split('\n').slice(2, 6).join('\n');
      say('[PawnStudio] process.exit(' + c + ') dipanggil dari:\n' + st + '\n');
    }
    return realExit.apply(process, arguments);
  };

  // 2) error yang tidak tertangkap: tampilkan lewat stdout (perilaku tidak berubah, proses tetap crash)
  process.on('uncaughtExceptionMonitor', function (err, origin) {
    if (process.listenerCount('uncaughtException') > 0) return;
    var s = err && err.stack ? err.stack : String(err);
    say('[PawnStudio] ' + (origin === 'unhandledRejection' ? 'Promise ditolak tanpa catch' : 'Error tidak tertangkap') + ':\n' + s + '\n');
  });

  // 3) kalau stderr bukan pipa yang sama dengan stdout, teruskan juga ke stdout supaya tidak hilang
  try {
    var fs = require('fs');
    var a = fs.fstatSync(1), b = fs.fstatSync(2);
    if (a.ino !== b.ino || a.dev !== b.dev) {
      var realWrite = process.stderr.write;
      process.stderr.write = function (chunk, enc) {
        try { out.write(chunk, typeof enc === 'string' ? enc : undefined); } catch (e) {}
        return realWrite.apply(process.stderr, arguments);
      };
    }
  } catch (e) {}
})();
