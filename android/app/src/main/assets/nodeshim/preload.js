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
