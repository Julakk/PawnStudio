/* Ekstensi gaya VS Code: kolom cari + ikon */
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

    rows.forEach(function(r){
      if (r.querySelector('.ext-ico')) return;
      var nm = r.querySelector('.ext-name');
      var name = nm ? nm.textContent.trim() : '?';
      var ico = document.createElement('div');
      ico.className = 'ext-ico';
      ico.textContent = name.replace(/[^A-Za-z0-9]/g,'').slice(0,2).toUpperCase() || '?';
      ico.style.background = color(name);
      r.insertBefore(ico, r.firstChild);
    });
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
