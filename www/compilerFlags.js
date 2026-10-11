// Kolom "Flag compiler tambahan" di Pengaturan
(function () {
  "use strict";
  const KEY = "pawnstudio.compilerFlags";
  function build() {
    const th = document.getElementById("setting-theme");
    if (!th || document.getElementById("setting-compiler-flags")) return;
    const row = document.createElement("div");
    row.style.cssText = "margin:12px 0";
    row.innerHTML =
      '<div style="margin-bottom:6px">Flag compiler tambahan</div>' +
      '<input id="setting-compiler-flags" placeholder="contoh: -d3 -;+ -(+" autocapitalize="off" autocomplete="off" spellcheck="false" ' +
      'style="width:100%;box-sizing:border-box;height:40px;padding:0 10px;border-radius:6px;border:1px solid #555;background:#3c3c3c;color:#eee">' +
      '<div style="opacity:.6;font-size:12px;margin-top:4px">Dipisah spasi. Diizinkan: -d0..3, -;+ -;-, -(+ -(-, -O0..3, -v0..2, -w&lt;no&gt;[+/-], -E</div>';
    const anchor = th.parentElement;
    anchor.parentElement.insertBefore(row, anchor.nextSibling);
    const inp = row.querySelector("input");
    try { inp.value = localStorage.getItem(KEY) || ""; } catch (e) {}
    inp.addEventListener("input", () => { try { localStorage.setItem(KEY, inp.value); } catch (e) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
