// PawnStudio - icon set folder & file (SVG inline, offline)
(function () {
  var S = 'rgba(0,0,0,.5)';
  function g(inner) {
    return '<g fill="none" stroke="' + S + '" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' + inner + '</g>';
  }
  var GL = {
    code: g('<path d="M11.5 11.5L9 14l2.5 2.5M16.5 11.5L19 14l-2.5 2.5"/>'),
    gear: g('<circle cx="14" cy="14" r="2.2"/><path d="M14 9.6v1.3M14 17.1v1.3M9.6 14h1.3M17.1 14h1.3"/>'),
    db: g('<ellipse cx="14" cy="11.5" rx="3.6" ry="1.5"/><path d="M10.4 11.5v5c0 .9 1.6 1.5 3.6 1.5s3.6-.6 3.6-1.5v-5M10.4 14c0 .9 1.6 1.5 3.6 1.5s3.6-.6 3.6-1.5"/>'),
    lines: g('<path d="M10.5 11.5h7M10.5 14h7M10.5 16.5h4.5"/>'),
    plug: g('<rect x="10.5" y="11.5" width="7" height="6" rx="1"/><path d="M12.5 11.5V9.8M15.5 11.5V9.8"/>'),
    box: g('<path d="M14 10l4 2v4.5l-4 2-4-2V12zM10 12l4 2 4-2M14 14v4.5"/>'),
    lock: g('<rect x="10.8" y="13.2" width="6.4" height="4.6" rx="1"/><path d="M12.2 13.2v-1.4a1.8 1.8 0 0 1 3.6 0v1.4"/>'),
    term: g('<path d="M10 11.8l3 2.4-3 2.4M14.5 17h4"/>'),
    down: g('<path d="M14 10.5v6M11.2 14l2.8 2.8 2.8-2.8"/>'),
    up: g('<path d="M14 17v-6M11.2 13.4L14 10.6l2.8 2.8"/>'),
    image: g('<rect x="10" y="11" width="8" height="6.5" rx="1"/><path d="M10.5 16.5l2.5-2.5 2 2 1.2-1.2 1.8 1.7"/>'),
    check: g('<path d="M10.8 14.4l2.2 2.2 4.2-4.6"/>'),
    branch: g('<circle cx="11.5" cy="11.8" r="1.1"/><circle cx="11.5" cy="17" r="1.1"/><circle cx="16.8" cy="13" r="1.1"/><path d="M11.5 12.9v3M16.8 14.1c0 1.6-1.6 1.7-5.3 2"/>'),
    globe: g('<circle cx="14" cy="14" r="3.8"/><path d="M10.2 14h7.6M14 10.2c1.6 1.8 1.6 5.8 0 7.6M14 10.2c-1.6 1.8-1.6 5.8 0 7.6"/>'),
    user: g('<circle cx="14" cy="12" r="1.8"/><path d="M10.6 17.6c.4-2 1.7-3 3.4-3s3 1 3.4 3"/>'),
    bug: g('<ellipse cx="14" cy="14.5" rx="2.4" ry="3"/><path d="M14 11.5V9.8M11.6 13.2l-1.8-1M16.4 13.2l1.8-1M11.6 16l-1.8 1M16.4 16l1.8 1"/>')
  };

  var FM = {};
  function addF(names, color, glyph) {
    names.split(' ').forEach(function (n) { FM[n] = [color, glyph]; });
  }
  // folder server SA-MP / open.mp
  addF('gamemodes pawno', '#ab7df0', 'code');
  addF('filterscripts src lib libs', '#42a5f5', 'code');
  addF('npcmodes', '#ec6f9a', 'user');
  addF('commands cmds', '#ab7df0', 'term');
  addF('modules', '#7e57c2', 'box');
  addF('include includes', '#29b6f6', 'down');
  addF('plugins plugin', '#66bb6a', 'plug');
  addF('scriptfiles', '#ffa726', 'lines');
  addF('database db mysql', '#26a69a', 'db');
  addF('models', '#8d6e63', 'box');
  addF('compiled dist build out', '#78909c', 'box');
  addF('logs log', '#90a4ae', 'lines');
  // folder umum
  addF('.vscode config configs settings', '#5c9ee6', 'gear');
  addF('.git', '#ef6c3e', 'branch');
  addF('.github', '#8d99ae', 'branch');
  addF('docs doc', '#ffb74d', 'lines');
  addF('test tests', '#4db6ac', 'check');
  addF('utils helpers tools', '#26c6da', 'gear');
  addF('assets images img icons', '#ec6f9a', 'image');
  addF('public www', '#42a5f5', 'globe');
  addF('private secure', '#ef5350', 'lock');
  addF('upload uploads', '#66bb6a', 'up');
  addF('download downloads', '#42a5f5', 'down');
  addF('debug', '#ef5350', 'bug');
  addF('temp tmp backup backups', '#9e9e9e', 'lines');
  addF('node_modules', '#7cb342', 'box');
  addF('android', '#8bc34a', 'code');

  var FE = {};
  function addE(exts, color, glyph) {
    exts.split(' ').forEach(function (e) { FE[e] = [color, glyph]; });
  }
  addE('pwn p', '#ab7df0', 'code');
  addE('inc', '#42a5f5', 'down');
  addE('amx dll so', '#78909c', 'gear');
  addE('exe', '#5c9ee6', 'gear');
  addE('bat sh', '#8bc34a', 'term');
  addE('cfg ini conf', '#ffa726', 'gear');
  addE('json js mjs cjs', '#fbc02d', 'code');
  addE('ts', '#42a5f5', 'code');
  addE('css', '#42a5f5', 'code');
  addE('html', '#ef6c3e', 'code');
  addE('md txt', '#90a4ae', 'lines');
  addE('log', '#78909c', 'lines');
  addE('yml yaml', '#ef5350', 'lines');
  addE('sql db dat', '#26a69a', 'db');
  addE('png jpg jpeg', '#26c6da', 'image');
  addE('zip', '#ffa726', 'box');
  addE('bin dff txd col', '#8d6e63', 'box');

  function ext(name) {
    var i = String(name || '').lastIndexOf('.');
    return i === -1 ? '' : String(name).substring(i + 1).toLowerCase();
  }

  window.psFolderIcon = function (name) {
    var d = FM[String(name || '').toLowerCase()] || ['#dcb67a', null];
    return '<svg viewBox="0 0 24 24" width="18" height="18">' +
      '<path fill="' + d[0] + '" d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2z"/>' +
      (d[1] ? GL[d[1]] : '') + '</svg>';
  };

  window.psFileIcon = function (name) {
    var d = FE[ext(name)] || ['#90a4ae', 'lines'];
    return '<svg viewBox="0 0 24 24" width="18" height="18">' +
      '<path fill="' + d[0] + '" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>' +
      '<path fill="rgba(255,255,255,.4)" d="M14 2l6 6h-4a2 2 0 0 1-2-2z"/>' +
      '<g transform="translate(-2 1.5)">' + GL[d[1]] + '</g></svg>';
  };
})();
