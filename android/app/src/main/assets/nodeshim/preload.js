// PawnStudio - shim diagnostik: tunjukkan dari mana process.exit() dipanggil
(function () {
  var realExit = process.exit;
  process.exit = function (code) {
    var c = Number(code === undefined ? process.exitCode : code);
    if (c) {
      var st = (new Error().stack || '').split('\n').slice(2, 6).join('\n');
      try { process.stdout.write('[PawnStudio] process.exit(' + c + ') dipanggil dari:\n' + st + '\n'); } catch (e) {}
    }
    return realExit.apply(process, arguments);
  };
})();
