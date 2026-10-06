(function () {
  "use strict";

  var LS_NAME = "git_author_name", LS_EMAIL = "git_author_email";
  var busy = false;
  var built = false;

  function plugin() { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Git; }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function setMsg(text, kind) {
    var el = $("git-msgbox");
    if (!el) return;
    el.className = kind || "";
    el.textContent = text || "";
  }

  function setBusy(b) {
    ["git-init", "git-remote-save", "git-token-save", "git-token-clear", "git-commit", "git-push", "git-pull", "git-refresh"]
      .forEach(function (id) { var e = $(id); if (e) e.disabled = b; });
  }

  async function run(label, fn) {
    if (busy) return;
    var g = plugin();
    if (!g) { setMsg("Plugin Git tidak ditemukan. Jalankan sebagai APK, bukan di browser.", "error"); return; }
    busy = true; setBusy(true);
    if (label) setMsg(label + "...", "info");
    try { await fn(g); }
    catch (e) { setMsg((e && e.message) || String(e), "error"); }
    finally { busy = false; setBusy(false); }
  }

  async function refresh(g) {
    var st = await g.status();
    var info = "Folder: <b>" + esc(st.rootName || "?") + "</b>";
    if (st.isRepo) {
      info += " · Branch: <b>" + esc(st.branch || "-") + "</b>";
      info += "<br>Remote: " + (st.remote ? esc(st.remote) : "<i>belum diatur</i>");
    }
    info += "<br>Token: " + (st.hasToken ? "tersimpan ✓" : "belum ada");
    $("git-info").innerHTML = info;

    $("git-init-box").classList.toggle("hidden", !!st.isRepo);
    $("git-main").classList.toggle("hidden", !st.isRepo);
    if (!st.isRepo) return;

    if (st.remote && document.activeElement !== $("git-remote")) $("git-remote").value = st.remote;

    var ch = st.changes || [];
    var html = "<b>Perubahan (" + (st.changeCount || 0) + ")</b>";
    if (!ch.length) html += "<br><i>bersih, tidak ada perubahan</i>";
    ch.forEach(function (c) { html += "<br><code>" + esc(c.state) + "</code> " + esc(c.path); });
    if ((st.changeCount || 0) > ch.length) html += "<br>… dan " + (st.changeCount - ch.length) + " lainnya";
    $("git-changes").innerHTML = html;

    var lg = await g.log({ limit: 6 });
    var lh = "<b>Riwayat terakhir</b>";
    var cs = lg.commits || [];
    if (!cs.length) lh += "<br><i>belum ada commit</i>";
    cs.forEach(function (c) { lh += "<br><code>" + esc(c.hash) + "</code> " + esc(c.message) + " <small>(" + esc(c.author) + ", " + esc(c.when) + ")</small>"; });
    $("git-log").innerHTML = lh;
  }

  function build() {
    if (built) return;
    built = true;
    var o = document.createElement("div");
    o.id = "git-overlay";
    o.className = "hidden";
    o.innerHTML =
      '<div id="git-panel">' +
      '<div id="git-head"><b>Git</b><button id="git-close">✕</button></div>' +
      '<div id="git-info"></div>' +
      '<div id="git-init-box" class="hidden"><p>Folder ini belum jadi repo Git.</p><button id="git-init">Init repo</button></div>' +
      '<div id="git-main" class="hidden">' +
      '<details><summary>Remote &amp; token GitHub</summary>' +
      '<input id="git-remote" placeholder="https://github.com/user/repo.git" autocomplete="off">' +
      '<button id="git-remote-save">Simpan remote</button>' +
      '<input id="git-user" placeholder="Username GitHub" autocomplete="off">' +
      '<input id="git-token" type="password" placeholder="Personal Access Token" autocomplete="off">' +
      '<button id="git-token-save">Simpan token</button><button id="git-token-clear">Hapus token</button>' +
      '</details>' +
      '<div class="git-row"><input id="git-aname" placeholder="Nama author" autocomplete="off"><input id="git-aemail" placeholder="Email author" autocomplete="off"></div>' +
      '<input id="git-msg" placeholder="Pesan commit" autocomplete="off">' +
      '<div class="git-row"><button id="git-commit">Commit</button><button id="git-push">Push</button><button id="git-pull">Pull</button><button id="git-refresh">↻</button></div>' +
      '<div id="git-hint">Simpan file (💾) dulu sebelum commit. Commit memasukkan semua perubahan.</div>' +
      '<div id="git-changes"></div><div id="git-log"></div>' +
      '</div>' +
      '<div id="git-msgbox"></div>' +
      '</div>';
    document.body.appendChild(o);

    o.addEventListener("click", function (e) { if (e.target === o) o.classList.add("hidden"); });
    $("git-close").onclick = function () { o.classList.add("hidden"); };

    $("git-init").onclick = function () {
      run("Membuat repo", async function (g) { await g.init(); setMsg("Repo dibuat (branch main).", "ok"); await refresh(g); });
    };
    $("git-remote-save").onclick = function () {
      run("Menyimpan remote", async function (g) { await g.setRemote({ url: $("git-remote").value }); setMsg("Remote disimpan.", "ok"); await refresh(g); });
    };
    $("git-token-save").onclick = function () {
      run("Menyimpan token", async function (g) {
        await g.saveCredentials({ user: $("git-user").value, token: $("git-token").value });
        $("git-token").value = "";
        setMsg("Token disimpan di perangkat.", "ok");
        await refresh(g);
      });
    };
    $("git-token-clear").onclick = function () {
      run("Menghapus token", async function (g) { await g.clearCredentials(); setMsg("Token dihapus.", "ok"); await refresh(g); });
    };
    $("git-commit").onclick = function () {
      run("Commit", async function (g) {
        var message = $("git-msg").value.trim(), name = $("git-aname").value.trim(), email = $("git-aemail").value.trim();
        if (!message) throw new Error("Isi pesan commit dulu.");
        if (!name || !email) throw new Error("Isi nama dan email author dulu.");
        lsSet(LS_NAME, name); lsSet(LS_EMAIL, email);
        var r = await g.commit({ message: message, name: name, email: email });
        $("git-msg").value = "";
        setMsg("Commit " + r.hash + " berhasil.", "ok");
        await refresh(g);
      });
    };
    $("git-push").onclick = function () {
      run("Push", async function (g) {
        var r = await g.push();
        setMsg(r.upToDate ? "Sudah up-to-date." : "Push berhasil.", "ok");
        await refresh(g);
      });
    };
    $("git-pull").onclick = function () {
      run("Pull", async function (g) { await g.pull(); setMsg("Pull selesai.", "ok"); await refresh(g); });
    };
    $("git-refresh").onclick = function () { run("", function (g) { return refresh(g); }); };
  }

  function openDialog() {
    build();
    $("git-aname").value = lsGet(LS_NAME);
    $("git-aemail").value = lsGet(LS_EMAIL);
    setMsg("", "");
    $("git-overlay").classList.remove("hidden");
    run("", function (g) { return refresh(g); });
  }

  function injectButton() {
    if ($("status-git")) return;
    var right = $("statusbar-right");
    if (!right) return;
    var b = document.createElement("button");
    b.id = "status-git";
    b.title = "Git";
    b.textContent = "⎇ Git";
    right.insertBefore(b, $("status-cursor") || null);
    b.addEventListener("click", openDialog);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", injectButton);
  else injectButton();
})();
