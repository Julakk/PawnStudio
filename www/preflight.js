(function () {
  var PAIRS = { ")": "(", "]": "[", "}": "{" };

  function check(text) {
    var issues = [], lines = String(text).split(/\r?\n/), stack = [], inBlock = false;
    for (var i = 0; i < lines.length; i++) {
      var l = lines[i], n = i + 1, j = 0;
      if (!inBlock) {
        var t = l.replace(/^\s+/, "");
        if (/^#\s*include\b/.test(t)) {
          var m = t.match(/^#\s*include\s*([<"])([^>"]*)[>"]/);
          if (m && /[^A-Za-z0-9_\-.\/\\ +@~]/.test(m[2])) {
            issues.push({ line: n, level: "error", msg: 'Nama include mengandung karakter aneh: "' + m[2] + '"' });
          }
          continue;
        }
      }
      while (j < l.length) {
        var c = l[j], d = l[j + 1];
        if (inBlock) {
          var k = l.indexOf("*/", j);
          if (k < 0) j = l.length; else { inBlock = false; j = k + 2; }
          continue;
        }
        if (c === "/" && d === "*") { inBlock = true; j += 2; continue; }
        if (c === "/" && d === "/") break;
        if (c === '"' || c === "'") {
          var q = c; j++;
          while (j < l.length && l[j] !== q) { if (l[j] === "\\") j++; j++; }
          j++; continue;
        }
        if (c === "{" || c === "(" || c === "[") {
          stack.push({ c: c, line: n });
        } else if (c === "}" || c === ")" || c === "]") {
          var top = stack.pop();
          if (!top) issues.push({ line: n, level: "error", msg: "Tanda '" + c + "' kelebihan (tidak ada pembuka)" });
          else if (top.c !== PAIRS[c]) issues.push({ line: n, level: "error", msg: "Tanda '" + c + "' tidak cocok dengan '" + top.c + "' dari baris " + top.line });
          if (c === "}" && /^\s*\(\s*;/.test(l.slice(j + 1))) {
            issues.push({ line: n, level: "warning", msg: 'Pola mencurigakan "}(;" (kemungkinan karakter nyasar)' });
          }
        }
        j++;
      }
    }
    for (var s = 0; s < stack.length && s < 5; s++) {
      issues.push({ line: stack[s].line, level: "error", msg: "'" + stack[s].c + "' belum ditutup" });
    }
    if (inBlock) issues.push({ line: lines.length, level: "error", msg: "Komentar /* belum ditutup */" });
    issues.sort(function (a, b) { return a.line - b.line; });
    return issues.slice(0, 20);
  }

  function format(issues) {
    return issues.map(function (x) { return "Baris " + x.line + " [" + x.level + "] " + x.msg; }).join("\n");
  }

  window.PawnPreflight = { check: check, format: format };
})();
