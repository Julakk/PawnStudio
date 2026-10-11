// Pilihan Versi SA-MP di Pengaturan
(function () {
  "use strict";
  const KEY = "pawnstudio.sampVersion";
  function build() {
    const th = document.getElementById("setting-theme");
    if (!th || document.getElementById("setting-samp-version")) return;
    const row = document.createElement("div");
    row.style.cssText = "margin:12px 0";
    row.innerHTML =
      '<div style="margin-bottom:6px">Versi SA-MP (target compile)</div>' +
      '<select id="setting-samp-version" style="width:100%;box-sizing:border-box;height:40px;padding:0 10px;border-radius:6px;border:1px solid #555;background:#3c3c3c;color:#eee">' +
      '<option value="dl-r1">0.3.DL-R1</option>' +
      '<option value="037-r2-1">0.3.7-R2-1</option>' +
      '<option value="037-r3">0.3.7-R3</option></select>' +
      '<div style="opacity:.6;font-size:12px;margin-top:4px">Untuk 0.3.7, fungsi khusus 0.3.DL (AddSimpleModel, dll) dianggap tidak ada. Tidak berlaku di mode open.mp.</div>';
    const anchor = th.parentElement;
    anchor.parentElement.insertBefore(row, anchor.nextSibling);
    const sel = row.querySelector("select");
    try { sel.value = localStorage.getItem(KEY) || "dl-r1"; } catch (e) {}
    sel.addEventListener("change", () => { try { localStorage.setItem(KEY, sel.value); } catch (e) {} });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
