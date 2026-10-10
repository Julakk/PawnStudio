// PS_NATIVE_COPY v1.8.7
// Android menolak dlopen dari storage bersama; salin .node ke folder internal app dulu.
(function () {
  try {
    var fs = require('fs'), path = require('path'), crypto = require('crypto');
    var origDlopen = process.dlopen;
    var cacheDir = path.join(process.env.HOME || '/data/local/tmp', '.ps-native');
    process.dlopen = function (module, filename) {
      var args = Array.prototype.slice.call(arguments);
      try {
        if (typeof filename === 'string' && /^\/(storage|sdcard)\//.test(filename)) {
          fs.mkdirSync(cacheDir, { recursive: true });
          var st = fs.statSync(filename);
          var key = crypto.createHash('md5')
            .update(filename + ':' + st.size + ':' + st.mtimeMs).digest('hex').slice(0, 10);
          var dest = path.join(cacheDir, key + '-' + path.basename(filename));
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(filename, dest + '.tmp');
            fs.renameSync(dest + '.tmp', dest);
          }
          args[1] = dest;
        }
      } catch (e) { /* kalau gagal salin, biarkan jalur asli */ }
      return origDlopen.apply(this, args);
    };
  } catch (e) { /* jangan sampai preload ikut crash */ }
})();
// PS_REGEX_COMPAT v1.8.6
// Node di APK tanpa ICU: semua \p{...} diganti range Unicode setara sebelum modul dikompilasi.
(function () {
  try {
    var M = require('module');
    var orig = M.prototype._compile;

    var LU = 'A-Z\\u00C0-\\u00D6\\u00D8-\\u00DE\\u0391-\\u03A1\\u03A3-\\u03A9\\u0410-\\u042F';
    var LL = 'a-z\\u00B5\\u00DF-\\u00F6\\u00F8-\\u00FF\\u03B1-\\u03C9\\u0430-\\u044F';
    var LT = '\\u01C5\\u01C8\\u01CB\\u01F2';
    var LM = '\\u02B0-\\u02C1\\u02C6-\\u02D1\\u3005\\u3031-\\u3035\\u309D\\u309E\\u30FC-\\u30FE';
    var LO = '\\u00AA\\u00BA\\u01BB\\u05D0-\\u05EA\\u0620-\\u063F\\u0641-\\u064A\\u0904-\\u0939\\u0E01-\\u0E30\\u3041-\\u3096\\u30A1-\\u30FA\\u3400-\\u9FFF\\uAC00-\\uD7A3';
    var LETTER = LU + LL + LT + LM + LO + '\\u0100-\\u02AF\\u0370-\\u03FF\\u0400-\\u052F\\u0531-\\u0587\\u0E81-\\u0EDF\\u1E00-\\u1FFF\\uF900-\\uFAFF\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\u{10000}-\\u{10FFFF}';
    var ND = '0-9\\u0660-\\u0669\\u06F0-\\u06F9\\u0966-\\u096F\\u0E50-\\u0E59\\uFF10-\\uFF19';
    var NL = '\\u16EE-\\u16F0\\u2160-\\u2182\\u3007';
    var NO = '\\u00B2\\u00B3\\u00B9\\u00BC-\\u00BE';
    var NUMBER = ND + NL + NO;
    var MARK = '\\u0300-\\u036F\\u0483-\\u0489\\u0591-\\u05BD\\u064B-\\u065F\\u0900-\\u0903\\u093A-\\u094F\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E';
    var DEVA = '\\u0900-\\u097F';
    var THAI = '\\u0E00-\\u0E7F';

    var PROPS = {};
    function add(names, val) { for (var i = 0; i < names.length; i++) PROPS[names[i]] = val; }
    add(['L', 'Letter'], LETTER);
    add(['Lu', 'Uppercase_Letter'], LU);
    add(['Ll', 'Lowercase_Letter'], LL);
    add(['Lt', 'Titlecase_Letter'], LT);
    add(['Lm', 'Modifier_Letter'], LM);
    add(['Lo', 'Other_Letter'], LO);
    add(['N', 'Number'], NUMBER);
    add(['Nd', 'Decimal_Number'], ND);
    add(['Nl', 'Letter_Number'], NL);
    add(['No', 'Other_Number'], NO);
    add(['M', 'Mark', 'Mn', 'Mc', 'Me', 'Nonspacing_Mark', 'Spacing_Mark'], MARK);
    add(['sc=Deva', 'sc=Devanagari', 'scx=Deva', 'Script=Deva', 'Script=Devanagari', 'Script_Extensions=Deva'], DEVA);
    add(['sc=Thai', 'scx=Thai', 'Script=Thai', 'Script_Extensions=Thai'], THAI);

    function transform(src) {
      var out = '', i = 0, n = src.length, inCls = false;
      while (i < n) {
        var c = src[i];
        if (c === '\n') { inCls = false; out += c; i++; continue; }
        if (c === '\\') {
          var nx = src[i + 1];
          if (nx === 'p' && src[i + 2] === '{') {
            var j = src.indexOf('}', i + 3);
            if (j > 0 && j - i < 64) {
              var name = src.slice(i + 3, j).replace(/^(General_Category|gc)=/, '');
              var r = PROPS[name];
              if (r) { out += inCls ? r : '[' + r + ']'; i = j + 1; continue; }
            }
          }
          out += c + (nx === undefined ? '' : nx);
          i += 2;
          continue;
        }
        if (c === '[') inCls = true; else if (c === ']') inCls = false;
        out += c; i++;
      }
      return out;
    }

    M._psRegexCompat = transform;
    M.prototype._compile = function (content, filename) {
      if (typeof content === 'string' && content.indexOf('\\p{') !== -1) {
        content = transform(content);
      }
      arguments[0] = content;
      return orig.apply(this, arguments);
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
