// PawnStudio - Auto-complete PAWN dari project (v1.11.0)
// Memindai .inc dan .pwn di workspace (di latar belakang) dan menambah saran: native, stock, forward, public,
// #define, enum beserta isinya. File yang sedang diedit dipindai langsung dari editor.
(function () {
  'use strict';
  var MAX_FILES = 400, MAX_DEPTH = 5, MAX_CHARS = 700000, MAX_ITEMS = 300;
  var SKIP = /^(node_modules|\.git|scriptfiles|models|npcmodes|plugins|components|logs|cache)$/i;
  var index = {}, scanId = 0, rootSig = null, staticSet = null, local = { key: '', syms: [] };

  function norm(p) { return String(p || '').replace(/^\/+/, ''); }
  function baseName(p) { return norm(p).split('/').pop(); }
  function tick() { return new Promise(function (r) { setTimeout(r, 0); }); }

  function stripComments(t) {
    return t.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:"'\\])\/\/.*$/gm, '$1');
  }

  function splitTop(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '{' || c === '[' || c === '(') depth++;
      else if (c === '}' || c === ']' || c === ')') depth--;
      if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
    }
    if (cur.trim()) out.push(cur);
    return out;
  }

  function paramNames(p) {
    if (p == null) return [];
    var s = String(p).replace(/\s+/g, ' ').trim();
    if (!s || s === 'void') return [];
    var names = [];
    splitTop(s).forEach(function (x) {
      x = x.split('=')[0].trim();
      if (x.indexOf('...') >= 0) return;
      var m = /([A-Za-z_]\w*|%\d+)\s*(?:\[[^\]]*\]\s*)*$/.exec(x);
      if (m) names.push(m[1]);
    });
    return names;
  }

  function parseSymbols(text, src) {
    var t = stripComments(String(text)), out = [], m;
    var fn = /^[ \t]*(?:static[ \t]+)?(native|stock|forward|public)[ \t]+(?:static[ \t]+)?(?:(?:\{[^}\n]*\}|[A-Za-z_]\w*):)?([A-Za-z_]\w*)[ \t]*\(([^)]*)\)/gm;
    while ((m = fn.exec(t))) {
      if (/^On[A-Z]/.test(m[2])) continue;                // callback: sudah ada di snippet
      out.push({ n: m[2], k: m[1], p: m[3].replace(/\s+/g, ' ').trim(), s: src });
    }
    var df = /^[ \t]*#define[ \t]+([A-Za-z_]\w*)(?:\(([^)\n]*)\))?[ \t]*(.*)$/gm;
    while ((m = df.exec(t))) {
      var body = (m[3] || '').trim();
      if (m[2] == null && !body) continue;                // include guard
      out.push({ n: m[1], k: 'define', p: m[2] == null ? null : m[2], d: body.slice(0, 80), s: src });
    }
    var en = /^[ \t]*enum[ \t]*(?:(?:\{[^}\n]*\}|[A-Za-z_]\w*):)?([A-Za-z_]\w*)?[ \t]*(?:\([^)]*\))?[ \t\n]*\{([^}]{0,4000})\}/gm;
    while ((m = en.exec(t))) {
      var en_name = m[1] || '';
      if (en_name) out.push({ n: en_name, k: 'enum', p: null, s: src });
      splitTop(m[2]).forEach(function (mem) {
        var mm = /^\s*(?:(?:\{[^}]*\}|[A-Za-z_]\w*):)?([A-Za-z_]\w*)\s*(?:\[[^\]]*\]\s*)*(?:=.*)?$/.exec(mem.replace(/\s+/g, ' '));
        if (mm) out.push({ n: mm[1], k: 'member', p: null, d: en_name ? 'enum ' + en_name : 'enum', s: src });
      });
    }
    return out;
  }

  // ---- pemindaian workspace ----
  async function scanWorkspace() {
    var my = ++scanId;
    var files = [], queue = [''], depth = { '': 0 };
    while (queue.length && files.length < MAX_FILES * 3) {
      var dir = queue.shift(), node;
      try { node = await FileManager.listDir(dir); } catch (e) { continue; }
      var kids = (node && node.children) || [];
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        if (c.type === 'folder') {
          if (!SKIP.test(c.name) && depth[dir] < MAX_DEPTH) { queue.push(c.path); depth[c.path] = depth[dir] + 1; }
        } else if (/\.(inc|pwn)$/i.test(c.name)) files.push(c.path);
      }
      if (my !== scanId) return;
      await tick();
    }
    files.sort(function (a, b) { return (/\.inc$/i.test(b) ? 1 : 0) - (/\.inc$/i.test(a) ? 1 : 0); });
    files = files.slice(0, MAX_FILES);
    var next = {};
    for (var j = 0; j < files.length; j++) {
      try {
        var txt = await FileManager.readFile(files[j]);
        if (txt && txt.length <= MAX_CHARS) next[norm(files[j])] = parseSymbols(txt, baseName(files[j]));
      } catch (e) {}
      if (my !== scanId) return;
      await tick();
    }
    index = next;
  }

  function sigOf(node) {
    return ((node && node.children) || []).map(function (c) { return c.name; }).sort().join('|');
  }
  async function watchRoot() {
    try {
      var sig = sigOf(await FileManager.listDir(''));
      if (sig !== rootSig) { rootSig = sig; scanWorkspace(); }
    } catch (e) {}
  }

  // ---- provider ----
  function staticNames() {
    if (staticSet) return staticSet;
    staticSet = {};
    function add(arr) {
      (arr || []).forEach(function (s) {
        var l = typeof s.label === 'string' ? s.label : (s.label && s.label.label);
        if (l) staticSet[l] = 1;
      });
    }
    var r = { startLineNumber: 1, endLineNumber: 1, startColumn: 1, endColumn: 1 };
    try { add(getFunctionSuggestions(r)); } catch (e) {}
    try { add(getSnippetSuggestions(r)); } catch (e) {}
    return staticSet;
  }
  function subseq(name, w) {
    name = name.toLowerCase(); w = w.toLowerCase();
    var j = 0;
    for (var i = 0; i < name.length && j < w.length; i++) if (name[i] === w[j]) j++;
    return j === w.length;
  }
  function esc(s) { return String(s).replace(/[\\$}]/g, '\\$&'); }

  function currentPath(model) {
    try { var t = openTabs.find(function (x) { return x.model === model; }); return t ? norm(t.path) : null; } catch (e) { return null; }
  }
  function localSyms(model) {
    var key = model.uri.toString() + '@' + model.getVersionId();
    if (local.key !== key) {
      var p = currentPath(model);
      local = { key: key, syms: parseSymbols(model.getValue(), p ? baseName(p) : 'file ini') };
    }
    return local.syms;
  }

  function toItem(sym, range, sort) {
    var K = monaco.languages.CompletionItemKind, R = monaco.languages.CompletionItemInsertTextRule;
    var names = paramNames(sym.p), kind, insert, sig;
    if (sym.k === 'enum') { kind = K.Enum; insert = sym.n; sig = 'enum ' + sym.n; }
    else if (sym.k === 'member') { kind = K.EnumMember; insert = sym.n; sig = sym.d; }
    else if (sym.k === 'define' && sym.p == null) { kind = K.Constant; insert = sym.n; sig = '#define ' + sym.n + (sym.d ? ' ' + sym.d : ''); }
    else {
      kind = K.Function;
      insert = sym.n + '(' + names.map(function (n, i) { return '${' + (i + 1) + ':' + esc(n) + '}'; }).join(', ') + ')';
      sig = (sym.k === 'define' ? '#define ' : sym.k + ' ') + sym.n + '(' + (sym.p || '') + ')';
    }
    return {
      label: sym.n, kind: kind, detail: sig + '  · ' + sym.s,
      documentation: { value: '```pawn\n' + sig + '\n```\n' + sym.s },
      insertText: insert, insertTextRules: R.InsertAsSnippet, range: range, sortText: sort + sym.n
    };
  }

  var provider = {
    provideCompletionItems: function (model, position, context) {
      var w = model.getWordUntilPosition(position);
      var invoked = context && context.triggerKind === 0;
      if (!w.word && !invoked) return { suggestions: [] };
      var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
      var stat = staticNames(), seen = {}, out = [], me = currentPath(model);
      function take(list, sort) {
        for (var i = 0; i < list.length && out.length < MAX_ITEMS; i++) {
          var s = list[i];
          if (seen[s.n] || stat[s.n]) continue;
          if (w.word && !subseq(s.n, w.word)) continue;
          seen[s.n] = 1;
          out.push(toItem(s, range, sort));
        }
      }
      take(localSyms(model), '1');
      Object.keys(index).forEach(function (f) { if (f !== me) take(index[f], '2'); });
      return { suggestions: out };
    }
  };

  var done = false;
  function register() {
    if (done) return;
    try {
      if (typeof monaco === 'undefined' || !monaco.languages || typeof FileManager === 'undefined') return;
      monaco.languages.registerCompletionItemProvider('pawn', provider);
      var ow = FileManager.writeFile;
      FileManager.writeFile = async function (path) {
        var r = await ow.apply(FileManager, arguments);
        try { if (/\.(inc|pwn)$/i.test(path)) index[norm(path)] = parseSymbols(String(arguments[1]), baseName(path)); } catch (e) {}
        return r;
      };
      done = true;
      setTimeout(watchRoot, 2500);
      setInterval(watchRoot, 15000);
    } catch (e) {}
  }
  var t = setInterval(function () { register(); if (done) clearInterval(t); }, 500);

})();
