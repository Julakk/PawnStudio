/* Ekstensi gaya VS Code Marketplace */
(function () {
  var COLORS = ['#c586c0','#4fc1ff','#dcdcaa','#ce9178','#6a9955','#569cd6','#d7ba7d','#f48771'];
  function color(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;return COLORS[Math.abs(h)%COLORS.length];}

  function applyFilter(modal){
    var inp = modal.querySelector('.ext-search input');
    var q = inp ? inp.value.trim().toLowerCase() : '';
    modal.querySelectorAll('.ext-row').forEach(function(r){
      r.style.display = (!q || r.textContent.toLowerCase().indexOf(q) > -1) ? '' : 'none';
    });
  }

  function enhanceRow(r){
    if (r.getAttribute('data-vs')) return;
    r.setAttribute('data-vs','1');

    var nm = r.querySelector('.ext-name');
    var name = nm ? (nm.firstChild ? nm.firstChild.textContent : nm.textContent).trim() : '?';

    // ikon
    var ico = document.createElement('div');
    ico.className = 'ext-ico';
    ico.textContent = name.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase() || '?';
    ico.style.background = color(name);
    r.insertBefore(ico, r.firstChild);

    // bintang untuk ekstensi bawaan
    var tag = r.querySelector('.ext-tag');
    if (tag && /bawaan/i.test(tag.textContent)) r.classList.add('builtin');

    // pisahkan deskripsi dan baris penerbit
    var sub = r.querySelector('.ext-sub');
    if (sub && !sub.getAttribute('data-vs')) {
      sub.setAttribute('data-vs','1');
      var parts = sub.textContent.replace(/\s*\n\s*/g,' \u00b7 ').split(' \u00b7 ');
      var desc = parts.shift();
      sub.textContent = desc;
      if (parts.length) {
        var meta = document.createElement('div');
        meta.className = 'ext-meta';
        meta.textContent = parts.join(' \u00b7 ');
        sub.parentNode.insertBefore(meta, sub.nextSibling);
      }
    }
  }

  function enhance(modal){
    var rows = modal.querySelectorAll('.ext-row');
    if (!rows.length) return;

    if (!modal.querySelector('.ext-search')) {
      var box = document.createElement('div');
      box.className = 'ext-search';
      box.innerHTML = '<input type="text" placeholder="Cari ekstensi" autocomplete="off" spellcheck="false">';
      var holder = modal.querySelector('.ext-body') || rows[0].parentNode;
      holder.insertBefore(box, holder.firstChild);
      box.querySelector('input').addEventListener('input', function(){ applyFilter(modal); });
    }
    rows.forEach(enhanceRow);
    applyFilter(modal);
  }

  var busy = false;
  new MutationObserver(function(){
    if (busy) return; busy = true;
    requestAnimationFrame(function(){
      busy = false;
      var m = document.getElementById('ext-modal');
      if (m) enhance(m);
    });
  }).observe(document.body, {childList:true, subtree:true});
})();
