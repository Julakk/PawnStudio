(function(){
'use strict';
var KEY='pawnstudio_v151';
var DEF={theme:'default',font:'default',ligature:false,tab:4,spaces:false,autosave:true,autoclose:true,minimap:false,ws:false,linehl:true,sticky:true,smooth:true,toolbar:true,awake:false};
var S;
try{S=Object.assign({},DEF,JSON.parse(localStorage.getItem(KEY)||'{}'));}catch(e){S=Object.assign({},DEF);}
var saveT=null,bound=new WeakSet(),lastEd=null,wl=null,themed=false,bar=null;

function store(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function el(t,c,x){var e=document.createElement(t);if(c)e.className=c;if(x!=null)e.textContent=x;return e;}
function toast(msg){var t=document.getElementById('v151-toast');if(!t){t=el('div');t.id='v151-toast';document.body.appendChild(t);}t.textContent=msg;t.className='show';clearTimeout(t._h);t._h=setTimeout(function(){t.className='';},2500);}
function M(){return(window.monaco&&window.monaco.editor&&window.monaco.editor.getEditors)?window.monaco:null;}

function defThemes(m){
  function d(n,base,bg,fg,sel,line,c,s,nu,k,ty,fn){
    m.editor.defineTheme(n,{base:base,inherit:true,
      rules:[{token:'comment',foreground:c},{token:'string',foreground:s},{token:'number',foreground:nu},{token:'keyword',foreground:k},{token:'type',foreground:ty},{token:'function',foreground:fn},{token:'predefined',foreground:fn}],
      colors:{'editor.background':'#'+bg,'editor.foreground':'#'+fg,'editor.selectionBackground':'#'+sel,'editor.lineHighlightBackground':'#'+line}});
  }
  d('v151-monokai','vs-dark','272822','f8f8f2','49483e','3e3d32','75715e','e6db74','ae81ff','f92672','66d9ef','a6e22e');
  d('v151-dracula','vs-dark','282a36','f8f8f2','44475a','343746','6272a4','f1fa8c','bd93f9','ff79c6','8be9fd','50fa7b');
  d('v151-onedark','vs-dark','282c34','abb2bf','3e4451','2c313c','5c6370','98c379','d19a66','c678dd','e5c07b','61afef');
  d('v151-amoled','vs-dark','000000','d4d4d4','264f78','111111','6a9955','ce9178','b5cea8','569cd6','4ec9b0','dcdcaa');
}

function applyAll(){
  var m=M();if(!m)return;
  if(!themed){defThemes(m);themed=true;}
  m.editor.getEditors().forEach(function(ed){
    var o={tabSize:S.tab,insertSpaces:S.spaces,detectIndentation:false,
      minimap:{enabled:S.minimap},renderWhitespace:S.ws?'all':'none',
      renderLineHighlight:S.linehl?'all':'none',
      autoClosingBrackets:S.autoclose?'languageDefined':'never',
      autoClosingQuotes:S.autoclose?'languageDefined':'never',
      autoIndent:'full',fontLigatures:S.ligature,smoothScrolling:S.smooth,
      cursorBlinking:S.smooth?'smooth':'blink',
      cursorSmoothCaretAnimation:S.smooth?'on':'off',
      bracketPairColorization:{enabled:true},
      guides:{indentation:true,bracketPairs:true},
      stickyScroll:{enabled:S.sticky},
      padding:{bottom:S.toolbar?52:0}};
    if(S.font!=='default')o.fontFamily="'"+S.font+"', monospace";
    try{ed.updateOptions(o);}catch(e){}
    var md=ed.getModel();
    if(md){try{md.updateOptions({tabSize:S.tab,insertSpaces:S.spaces});}catch(e){}}
  });
  if(S.theme!=='default')m.editor.setTheme(S.theme);
  if(S.font!=='default'&&document.fonts){document.fonts.load('14px "'+S.font+'"').then(function(){m.editor.remeasureFonts();});}
}

function doSave(){
  var bs=document.querySelectorAll('button,[role=button]');
  for(var i=0;i<bs.length;i++){
    var b=bs[i];
    var s=(b.id+' '+b.className+' '+(b.title||'')+' '+(b.getAttribute('aria-label')||''));
    if(/(?<!un)save|simpan/i.test(s)&&b.offsetParent!==null){b.click();return;}
  }
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'s',code:'KeyS',keyCode:83,ctrlKey:true,bubbles:true,cancelable:true}));
}

function showBar(on){if(bar)bar.className=(on&&S.toolbar)?'show':'';}

var focused=false,kbOpen=false,baseH=0,baseW=0;
function refreshBar(){showBar(focused&&kbOpen);}
function kbCheck(){
  var vv=window.visualViewport;
  var h=vv?vv.height:window.innerHeight,w=window.innerWidth;
  if(!baseH||w!==baseW){baseH=h;baseW=w;}
  if(h>baseH)baseH=h;
  var open=(baseH-h)>120;
  if(open===kbOpen)return;
  kbOpen=open;
  if(!open&&focused){var a=document.activeElement;if(a&&a.blur)a.blur();}
  refreshBar();
}

function buildBar(){
  bar=el('div');bar.id='v151-bar';
  function btn(label,fn){
    var b=el('button','',label);b.type='button';
    b.onclick=function(){
      var m=M();var ed=lastEd||(m&&m.editor.getEditors()[0]);
      if(!ed)return;ed.focus();fn(ed);
    };
    bar.appendChild(b);
  }
  [['⇥','tab'],['↶','undo'],['↷','redo'],['◀','cursorLeft'],['▶','cursorRight'],['▲','cursorUp'],['▼','cursorDown']].forEach(function(k){
    btn(k[0],function(ed){ed.trigger('v151',k[1],null);});
  });
  ['{','}','(',')','[',']',';','"',"'",'#','<','>','=','!','&','|',',','.','@','_',':','%','+','-','*','/','\\'].forEach(function(c){
    btn(c,function(ed){ed.trigger('v151','type',{text:c});});
  });
  bar.addEventListener('mousedown',function(e){e.preventDefault();});
  document.body.appendChild(bar);
}

function awake(){
  if(!('wakeLock' in navigator))return;
  if(S.awake){navigator.wakeLock.request('screen').then(function(l){wl=l;}).catch(function(){});}
  else if(wl){try{wl.release();}catch(e){}wl=null;}
}
document.addEventListener('visibilitychange',function(){if(S.awake&&document.visibilityState==='visible')awake();});

function commit(){store();applyAll();awake();if(!S.toolbar)showBar(false);}

function buildPanel(){
  var old=document.getElementById('v151-panel');if(old)old.remove();
  var p=el('div');p.id='v151-panel';
  p.addEventListener('click',function(e){if(e.target===p)p.className='';});
  var sh=el('div','v151-sheet'),hd=el('div','v151-head');
  hd.appendChild(el('span','','PENGATURAN LANJUTAN · v1.8.3'));
  var x=el('button','','×');x.onclick=function(){p.className='';};
  hd.appendChild(x);sh.appendChild(hd);
  function sec(t){sh.appendChild(el('div','v151-sec',t));}
  function row(l,c){var r=el('div','v151-row');r.appendChild(el('span','',l));r.appendChild(c);sh.appendChild(r);}
  function sel(k,opts,num){
    var s=el('select');
    opts.forEach(function(o){var op=el('option','',o[1]);op.value=o[0];s.appendChild(op);});
    s.value=String(S[k]);
    s.onchange=function(){S[k]=num?Number(s.value):s.value;commit();};
    return s;
  }
  function chk(k){var c=el('input');c.type='checkbox';c.checked=!!S[k];c.onchange=function(){S[k]=c.checked;commit();};return c;}
  sec('Tema & font');
  row('Tema tambahan',sel('theme',[['default','Bawaan app (restart)'],['v151-monokai','Monokai'],['v151-dracula','Dracula'],['v151-onedark','One Dark'],['v151-amoled','AMOLED Black'],['vs','Light']]));
  row('Font editor',sel('font',[['default','Bawaan'],['JetBrains Mono','JetBrains Mono'],['Fira Code','Fira Code']]));
  row('Ligature font',chk('ligature'));
  sec('Penulisan');
  row('Tab size',sel('tab',[['2','2'],['4','4'],['8','8']],true));
  row('Pakai spasi (bukan tab)',chk('spaces'));
  row('Auto-close bracket/quote',chk('autoclose'));
  row('Auto-save (2 detik)',chk('autosave'));
  row('Toolbar simbol',chk('toolbar'));
  sec('Tampilan');
  row('Minimap',chk('minimap'));
  row('Tampilkan whitespace',chk('ws'));
  row('Highlight baris aktif',chk('linehl'));
  row('Sticky scope',chk('sticky'));
  row('Animasi halus',chk('smooth'));
  row('Layar tetap nyala',chk('awake'));
  sec('Lainnya');
  var rb=el('button','v151-reset','Reset pengaturan lanjutan');
  rb.onclick=function(){
    if(confirm('Reset semua pengaturan lanjutan?')){
      S=Object.assign({},DEF);store();buildPanel();open();applyAll();awake();showBar(false);
    }
  };
  sh.appendChild(rb);
  p.appendChild(sh);document.body.appendChild(p);
}

function open(){var p=document.getElementById('v151-panel');if(p)p.className='show';}

function hook(){
  if(document.querySelector('.v151-open'))return;
  var n=document.evaluate("//*[text()[normalize-space(.)='Word Wrap']]",document,null,9,null).singleNodeValue;
  if(!n||!n.parentElement||!n.parentElement.parentElement)return;
  var row=n.parentElement,box=row.parentElement;
  var b=el('button','v151-open','⚙ Pengaturan Lanjutan');
  b.onclick=open;
  box.insertBefore(b,row.nextSibling);
}

function bindAll(){
  var m=M();if(!m)return;
  m.editor.getEditors().forEach(function(ed){
    if(bound.has(ed))return;
    bound.add(ed);
    applyAll();
    ed.onDidChangeModelContent(function(){
      if(!S.autosave)return;
      clearTimeout(saveT);saveT=setTimeout(doSave,2000);
    });
    ed.onDidFocusEditorText(function(){lastEd=ed;focused=true;refreshBar();});
    ed.onDidBlurEditorText(function(){setTimeout(function(){if(!ed.hasTextFocus()){focused=false;refreshBar();}},200);});
  });
}

function init(){
  buildBar();buildPanel();
  setInterval(function(){bindAll();hook();},1000);
  bindAll();
  kbCheck();
  window.addEventListener('resize',kbCheck);
  if(window.visualViewport)window.visualViewport.addEventListener('resize',kbCheck);
  if(S.awake)awake();
  window.PawnV151={open:open,state:function(){return S;}};
  setTimeout(function(){if(!M())toast('v1.8.3: Monaco tidak terdeteksi');},20000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
