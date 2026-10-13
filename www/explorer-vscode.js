// PawnStudio - Explorer ala VS Code: OPEN EDITORS (ikon per tipe file + nama folder),
// header root project (refresh / collapse semua). Selalu tampil, tanpa nunggu klik file.
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var ICO_REFRESH = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
  var ICO_COLLAPSE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="8" y1="12" x2="16" y2="12"/></svg>';

  function openTabsSafe() {
    try { return (typeof openTabs !== 'undefined' && openTabs) || []; } catch (e) { return []; }
  }

  function fixOpenEditors() {
    var list = $('open-editors-list');
    if (!list) return;
    var tabs = openTabsSafe();
    list.querySelectorAll('.open-editor-item').forEach(function (el, i) {
      var t = tabs[i];
      if (!t || !t.path) return;
      var parts = String(t.path).split('/');
      var name = parts.pop();
      var ic = el.querySelector('.oe-icon');
      if (ic && window.psFileIcon && ic.getAttribute('data-ps') !== name) {
        ic.innerHTML = window.psFileIcon(name);
        ic.setAttribute('data-ps', name);
      }
      if (!el.querySelector('.oe-dir')) {
        var d = document.createElement('span');
        d.className = 'oe-dir';
        d.textContent = parts.length ? parts[parts.length - 1] : '';
        var nm = el.querySelector('.oe-name');
        if (nm && nm.parentNode) nm.parentNode.insertBefore(d, nm.nextSibling);
      }
    });
  }

  function rootName() {
    var l = $('workspace-name');
    var t = l ? l.textContent.replace(/^[\s\u2014-]+/, '').trim() : '';
    return t || 'WORKSPACE';
  }

  function buildRoot() {
    var tree = $('file-tree');
    if (!tree || $('explorer-root-header')) return;
    var h = document.createElement('div');
    h.id = 'explorer-root-header';
    h.innerHTML = '<span class="erh-name"></span>' +
      '<button type="button" data-a="refresh" title="Refresh">' + ICO_REFRESH + '</button>' +
      '<button type="button" data-a="collapse" title="Tutup semua folder">' + ICO_COLLAPSE + '</button>';
    tree.parentNode.insertBefore(h, tree);
    function setName() { h.querySelector('.erh-name').textContent = rootName(); }
    setName();
    var wl = $('workspace-name');
    if (wl) new MutationObserver(setName).observe(wl, { childList: true, characterData: true, subtree: true });
    h.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (b) {
        e.stopPropagation();
        if (b.getAttribute('data-a') === 'collapse') {
          try { if (typeof expandedFolders !== 'undefined') expandedFolders.clear(); } catch (x) { }
        }
        if (typeof renderFileTree === 'function') renderFileTree();
        return;
      }
      h.classList.toggle('collapsed');
      tree.classList.toggle('erh-hidden', h.classList.contains('collapsed'));
    });
  }

  function init() {
    buildRoot();
    var list = $('open-editors-list');
    if (list) {
      new MutationObserver(fixOpenEditors).observe(list, { childList: true });
      fixOpenEditors();
    }
    var oh = $('open-editors-header');
    if (oh && list) {
      oh.addEventListener('click', function () {
        oh.classList.toggle('collapsed');
        list.classList.toggle('oe-hidden', oh.classList.contains('collapsed'));
      });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
