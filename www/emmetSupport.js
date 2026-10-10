// PawnStudio - Emmet untuk HTML dan CSS (v1.11.0)
// Ketik singkatan (misal ul>li*3, m10-20), lalu pilih saran "Emmet" dari daftar saran.
// Butuh emmet.bundle.js (window.PSEmmet) dimuat lebih dulu.
(function () {
  'use strict';
  var done = false;
  var TAGS = ('a abbr article aside audio b blockquote body br button canvas caption code div em fieldset figure ' +
    'footer form h1 h2 h3 h4 h5 h6 head header hr html i iframe img input label legend li link main meta nav ol ' +
    'option p pre section select small span strong style sub sup table tbody td textarea tfoot th thead title tr ' +
    'u ul video').split(' ');

  function E() { return window.PSEmmet; }

  function extractAt(before, type) {
    try {
      var r = E().extract(before, before.length, { type: type === 'css' ? 'stylesheet' : 'markup' });
      return r && r.abbreviation ? { abbr: r.abbreviation, start: r.start } : null;
    } catch (e) { return null; }
  }

  function expand(abbr, type) {
    return E().default(abbr, {
      type: type === 'css' ? 'stylesheet' : 'markup',
      options: {
        // titik isi (tab stop) memakai sintaks snippet Monaco; teks biasa di-escape
        'output.field': function (i, ph) { return '${' + i + (ph ? ':' + ph : '') + '}'; },
        'output.text': function (t) { return String(t).replace(/[\\$}]/g, '\\$&'); }
      }
    });
  }

  // Di HTML: hanya tawarkan kalau terlihat seperti singkatan (ada operator, atau nama tag yang dikenal),
  // supaya teks biasa tidak dipenuhi saran. Tidak aktif saat kursor berada di dalam tag.
  function looksLikeAbbr(abbr, before) {
    var lt = before.lastIndexOf('<'), gt = before.lastIndexOf('>');
    if (lt > gt) return false;
    if (/[.#>+*\[\]{}()$@^!:]/.test(abbr)) return true;
    return TAGS.indexOf(abbr.toLowerCase()) >= 0;
  }

  function provider(type) {
    return {
      triggerCharacters: ['.', '#', '>', '*', '+', ']', '}', ')', '$', '!'],
      provideCompletionItems: function (model, position) {
        if (!E()) return { suggestions: [] };
        var line = model.getLineContent(position.lineNumber);
        var before = line.slice(0, position.column - 1);
        var x = extractAt(before, type);
        if (!x) return { suggestions: [] };
        if (type !== 'css' && !looksLikeAbbr(x.abbr, before)) return { suggestions: [] };
        var snippet;
        try { snippet = expand(x.abbr, type); } catch (e) { return { suggestions: [] }; }
        if (!snippet || snippet === x.abbr) return { suggestions: [] };
        var plain = snippet.replace(/\$\{\d+(?::([^}]*))?\}/g, '$1').replace(/\\([\\$}])/g, '$1');
        return {
          suggestions: [{
            label: x.abbr,
            kind: monaco.languages.CompletionItemKind.Snippet,
            detail: 'Emmet',
            documentation: { value: '```\n' + plain + '\n```' },
            insertText: snippet,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            filterText: x.abbr,
            sortText: '0000',
            range: new monaco.Range(position.lineNumber, x.start + 1, position.lineNumber, position.column)
          }]
        };
      }
    };
  }

  function register() {
    if (done) return;
    try {
      if (typeof monaco === 'undefined' || !monaco.languages || !E()) return;
      monaco.languages.registerCompletionItemProvider('html', provider('html'));
      monaco.languages.registerCompletionItemProvider('css', provider('css'));
      done = true;
    } catch (e) {}
  }

  var t = setInterval(function () { register(); if (done) clearInterval(t); }, 500);
})();
