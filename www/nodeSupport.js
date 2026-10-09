// PawnStudio - dukungan penulisan Node.js (auto-complete, hover, snippet)
(function () {
  var typesLoaded = false;

  function ensureTypes(m) {
    if (typesLoaded) return;
    typesLoaded = true;
    fetch('node-types.d.ts')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        if (!txt) return;
        var ts = m.languages.typescript;
        ts.javascriptDefaults.addExtraLib(txt, 'file:///node_modules/@types/node/index.d.ts');
        ts.typescriptDefaults.addExtraLib(txt, 'file:///node_modules/@types/node/index.d.ts');
      })
      .catch(function () {});
  }

  var SNIPPETS = [
    ['req', "const ${1:mod} = require('${2:mod}');", 'require modul'],
    ['reqfs', "const fs = require('fs');\nconst path = require('path');", 'require fs + path'],
    ['readfile', "const ${1:data} = fs.readFileSync(${2:'file.txt'}, 'utf8');", 'baca file (sync)'],
    ['httpserver', "const http = require('http');\n\nconst server = http.createServer((req, res) => {\n\tres.writeHead(200, { 'Content-Type': 'text/plain' });\n\tres.end('${1:Halo dari Node.js}');\n});\n\nserver.listen(${2:3000}, () => {\n\tconsole.log('Server jalan di port ' + $2);\n});", 'HTTP server dasar'],
    ['express', "const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => {\n\tres.send('${1:Halo}');\n});\n\napp.listen(${2:3000}, () => console.log('Server jalan di port ' + $2));", 'Express app dasar'],
    ['discordbot', "const { Client, GatewayIntentBits } = require('discord.js');\n\nconst client = new Client({ intents: [GatewayIntentBits.Guilds] });\n\nclient.once('ready', () => {\n\tconsole.log('Login sebagai ' + client.user.tag);\n});\n\nclient.login(process.env.TOKEN);", 'Bot discord.js dasar'],
    ['asyncfn', "async function ${1:nama}(${2}) {\n\t$0\n}", 'async function'],
    ['trycatch', "try {\n\t$1\n} catch (err) {\n\tconsole.error(err);\n}", 'try / catch']
  ];

  window.registerNodeSupport = function () {
    try {
      var m = window.monaco;
      if (!m || !m.languages || !m.languages.typescript) return;
      var ts = m.languages.typescript;

      var opts = {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.NodeJs,
        allowNonTsExtensions: true,
        allowJs: true
      };
      ts.javascriptDefaults.setCompilerOptions(opts);
      ts.typescriptDefaults.setCompilerOptions(opts);

      var ignore = [2307, 7016, 80001, 80002, 80005, 80006];
      ts.javascriptDefaults.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
      ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false, diagnosticCodesToIgnore: ignore });

      // Tipe Node dimuat sekali, hanya saat ada file JS/TS dibuka (user PAWN murni tidak kena beban)
      function check(model) {
        var l = model.getLanguageId();
        if (l === 'javascript' || l === 'typescript') ensureTypes(m);
      }
      m.editor.onDidCreateModel(check);
      m.editor.getModels().forEach(check);

      m.languages.registerCompletionItemProvider(['javascript', 'typescript'], {
        provideCompletionItems: function (model, position) {
          var w = model.getWordUntilPosition(position);
          var range = { startLineNumber: position.lineNumber, endLineNumber: position.lineNumber, startColumn: w.startColumn, endColumn: w.endColumn };
          return {
            suggestions: SNIPPETS.map(function (s) {
              return {
                label: s[0],
                kind: m.languages.CompletionItemKind.Snippet,
                insertText: s[1],
                insertTextRules: m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                documentation: s[2],
                range: range
              };
            })
          };
        }
      });
    } catch (e) {
      console.warn('registerNodeSupport gagal:', e);
    }
  };

  // Tombol Run di file Node.js/TypeScript: jangan dilempar ke compiler PAWN
  window.psNodeRunGuard = function (path) {
    if (!/\.(js|mjs|cjs|ts)$/i.test(path || '')) return false;
    var name = String(path).split('/').pop();
    try { showOutputPanel(); } catch (e) {}
    setOutputLines([
      { text: 'Node.js: ' + name + ' belum bisa dijalankan langsung di dalam app.', type: 'info' },
      { text: 'Editor sudah mendukung penulisan Node.js (auto-complete modul bawaan + snippet).', type: 'info' },
      { text: 'Menjalankan Node.js di dalam app direncanakan untuk versi berikutnya.', type: 'info' },
      { text: 'Sementara itu jalankan lewat Termux: node ' + name, type: 'info' }
    ]);
    return true;
  };
})();
