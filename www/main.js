// ==============================
// PawnStudio - Editor Core
// ==============================


// ============ SVG Icons ============
const ICON_FILE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ICON_FOLDER = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_RENAME = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';

const ICON_CODE = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="10 13 8 15 10 17"/><polyline points="14 13 16 15 14 17"/></svg>';
const ICON_BINARY = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>';
const ICON_TEXT = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>';

const BINARY_EXTS = new Set(["dll", "exe", "so", "amx", "bin", "dat", "db", "zip", "png", "jpg", "jpeg", "dff", "txd", "col"]);
const CODE_EXTS = new Set(["pwn", "inc", "p", "js", "json", "css", "html", "bat", "sh", "cfg", "ini", "yml", "yaml"]);

function isBinaryFile(name) {
  return BINARY_EXTS.has(getFileExt(name));
}

function getFileIcon(name) {
  if (window.psFileIcon) return window.psFileIcon(name);
  const ext = getFileExt(name);
  if (BINARY_EXTS.has(ext)) return ICON_BINARY;
  if (CODE_EXTS.has(ext)) return ICON_CODE;
  return ICON_TEXT;
}

const MONACO_CDN = window.location.origin + "/vs";

let monacoEditor = null;

// State multi-tab: { path, model, dirty }
let openTabs = [];
let activeTabPath = null;

require.config({ paths: { vs: MONACO_CDN } });

window.MonacoEnvironment = {
  getWorkerUrl: function () {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
      self.MonacoEnvironment = { baseUrl: '${MONACO_CDN}/' };
      importScripts('${MONACO_CDN}/base/worker/workerMain.js');
    `)}`;
  }
};

require(["vs/editor/editor.main"], async function () {
  registerPawnLanguage();
  registerPawnCompletion();
  if (typeof registerPawnExtras === "function") registerPawnExtras();
  if (typeof registerNodeSupport === "function") registerNodeSupport();
  await FileManager.init();
  initEditor();
  await renderFileTree();
  bindGlobalActions();
  initSettingsUI();
  initSymbolBar();
  await updateWorkspaceLabel();

  // Auto-buka file pertama yang ada
  const tree = await FileManager.listTree();
  const firstFile = findFirstFile(tree);
  if (firstFile) await openFile(firstFile.path);

  // Explorer berhasil tampil tanpa crash -> matikan pengaman crash-loop.
  try { await window.Capacitor?.Plugins?.BulkImport?.markLaunchOk(); } catch (e) {}
});

// ============ Editor Init ============

function initEditor() {
  monacoEditor = monaco.editor.create(document.getElementById("editor-container"), {
    value: "",
    language: "plaintext",
    theme: "vs-dark",
    automaticLayout: true,
    fontSize: 14,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: "off",
    tabSize: 4,
    smoothScrolling: true,
  });

  document.getElementById("editor-container").classList.add("empty");

  monacoEditor.onDidFocusEditorText(() => setSymbolBarVisible(true));
  monacoEditor.onDidBlurEditorText(() => {
    setTimeout(() => {
      if (!monacoEditor.hasTextFocus()) setSymbolBarVisible(false);
    }, 200);
  });

  monacoEditor.onDidChangeCursorPosition((e) => {
    const statusCursor = document.getElementById("status-cursor");
    if (statusCursor) {
      statusCursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    }
  });
}

function getLanguageForFile(filename) {
  if (filename.endsWith(".pwn") || filename.endsWith(".inc")) return "pawn";
  if (/\.(js|mjs|cjs)$/.test(filename)) return "javascript";
  if (filename.endsWith(".ts")) return "typescript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".css")) return "css";
  if (/\.html?$/i.test(filename)) return "html";
  return "plaintext";
}

// ============ Tab Management ============

async function openFile(path) {
  let tab = openTabs.find((t) => t.path === path);

  if (!tab) {
    const content = await FileManager.readFile(path);
    const filename = path.split("/").pop();
    const model = monaco.editor.createModel(content, getLanguageForFile(filename));

    model.onDidChangeContent(() => {
      const t = openTabs.find((x) => x.path === path);
      if (t) {
        t.dirty = true;
        renderTabs();
      }
    });

    tab = { path, model, dirty: false };
    openTabs.push(tab);
  }

  activeTabPath = path;
  document.getElementById("editor-container").classList.remove("empty");
  monacoEditor.setModel(tab.model);

  document.getElementById("status-file").textContent = path;
  document.getElementById("status-lang").textContent = getLanguageForFile(path).toUpperCase();

  updateBreadcrumb(path);
  renderTabs();
  await renderFileTree();
  closeSidebarOnMobile();
  addToRecentFiles(path);
  updateWelcomeVisibility();
}

// ============ Welcome Screen & Recent Files ============

const RECENT_KEY = "pawnstudio_recent";

function addToRecentFiles(path) {
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    recent = [];
  }
  recent = recent.filter((p) => p !== path);
  recent.unshift(path);
  recent = recent.slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
}

function updateWelcomeVisibility() {
  const welcome = document.getElementById("welcome-screen");
  if (!welcome) return;

  if (openTabs.length === 0) {
    renderWelcomeScreen();
    welcome.classList.remove("hidden");
  } else {
    welcome.classList.add("hidden");
  }
}

function renderWelcomeScreen() {
  let recent = [];
  try {
    recent = JSON.parse(localStorage.getItem(RECENT_KEY)) || [];
  } catch {
    recent = [];
  }

  const recentSection = document.getElementById("welcome-recent");
  const recentList = document.getElementById("welcome-recent-list");
  if (!recentSection || !recentList) return;

  recentList.innerHTML = "";

  if (recent.length === 0) {
    recentSection.classList.add("hidden");
    return;
  }

  recentSection.classList.remove("hidden");

  recent.forEach((path) => {
    const item = document.createElement("div");
    item.className = "welcome-recent-item";
    item.innerHTML = `<span class="icon">${ICON_FILE}</span><span class="name">${path}</span>`;
    item.addEventListener("click", () => openFile(path));
    recentList.appendChild(item);
  });
}

function bindWelcomeActions() {
  const newFileBtn = document.getElementById("welcome-new-file");
  const newFolderBtn = document.getElementById("welcome-new-folder");

  if (newFileBtn) newFileBtn.addEventListener("click", handleNewFile);
  if (newFolderBtn) newFolderBtn.addEventListener("click", handleNewFolder);
}

function updateBreadcrumb(path) {
  const breadcrumb = document.getElementById("breadcrumb");
  if (!breadcrumb) return;
  const parts = path.split("/");
  breadcrumb.innerHTML = "";

  const root = document.createElement("span");
  root.className = "crumb";
  root.textContent = "PawnStudio";
  breadcrumb.appendChild(root);

  parts.forEach((part) => {
    const sep = document.createElement("span");
    sep.className = "crumb-sep";
    sep.textContent = "\u203a";
    breadcrumb.appendChild(sep);

    const crumb = document.createElement("span");
    crumb.className = "crumb";
    crumb.textContent = part;
    breadcrumb.appendChild(crumb);
  });
}

function getFileExt(filename) {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.substring(idx + 1).toLowerCase();
}

function closeTab(path, event) {
  if (event) event.stopPropagation();

  const idx = openTabs.findIndex((t) => t.path === path);
  if (idx === -1) return;

  const tab = openTabs[idx];
  if (tab.dirty) {
    const ok = confirm(`"${path.split("/").pop()}" belum disimpan. Tutup tanpa simpan?`);
    if (!ok) return;
  }

  tab.model.dispose();
  openTabs.splice(idx, 1);

  if (activeTabPath === path) {
    if (openTabs.length > 0) {
      openFile(openTabs[Math.max(0, idx - 1)].path);
    } else {
      activeTabPath = null;
      monacoEditor.setModel(null);
      document.getElementById("editor-container").classList.add("empty");
      document.getElementById("status-file").textContent = "no file open";
      document.getElementById("status-lang").textContent = "";
      renderTabs();
      updateWelcomeVisibility();
    }
  } else {
    renderTabs();
  }
}

async function saveActiveTab() {
  if (!activeTabPath) return;
  const tab = openTabs.find((t) => t.path === activeTabPath);
  if (!tab) return;

  await FileManager.writeFile(activeTabPath, tab.model.getValue());
  tab.dirty = false;
  renderTabs();
}

async function saveAllTabs() {
  for (const tab of openTabs) {
    await FileManager.writeFile(tab.path, tab.model.getValue());
    tab.dirty = false;
  }
  renderTabs();
}

// ============ Rendering: Tabs ============

function renderTabs() {
  const tabbar = document.getElementById("tabbar");
  tabbar.innerHTML = "";

  const openEditorsList = document.getElementById("open-editors-list");
  if (openEditorsList) openEditorsList.innerHTML = "";

  openTabs.forEach((tab) => {
    const el = document.createElement("div");
    const fileName = tab.path.split("/").pop();
    el.className = "tab-item" + (tab.path === activeTabPath ? " active" : "") + (tab.dirty ? " dirty" : "");
    el.setAttribute("data-ext", getFileExt(fileName));

    const icon = document.createElement("span");
    icon.className = "tab-icon";
    icon.innerHTML = getFileIcon(fileName);

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = fileName;

    const dot = document.createElement("span");
    dot.className = "tab-dot";

    const close = document.createElement("span");
    close.className = "tab-close";
    close.innerHTML = ICON_CLOSE;
    close.addEventListener("click", (e) => closeTab(tab.path, e));

    el.appendChild(icon);
    el.appendChild(name);
    el.appendChild(dot);
    el.appendChild(close);
    el.addEventListener("click", () => openFile(tab.path));

    tabbar.appendChild(el);

    if (openEditorsList) {
      const oeEl = document.createElement("div");
      oeEl.className = "open-editor-item" + (tab.path === activeTabPath ? " active" : "") + (tab.dirty ? " dirty" : "");

      const oeIcon = document.createElement("span");
      oeIcon.className = "oe-icon";
      oeIcon.innerHTML = ICON_FILE;

      const oeName = document.createElement("span");
      oeName.className = "oe-name";
      oeName.textContent = fileName;

      const oeDot = document.createElement("span");
      oeDot.className = "oe-dot";

      const oeClose = document.createElement("span");
      oeClose.className = "oe-close";
      oeClose.innerHTML = ICON_CLOSE;
      oeClose.addEventListener("click", (e) => closeTab(tab.path, e));

      oeEl.appendChild(oeIcon);
      oeEl.appendChild(oeName);
      oeEl.appendChild(oeDot);
      oeEl.appendChild(oeClose);
      oeEl.addEventListener("click", (e) => {
        if (e.target.closest(".oe-close")) return;
        openFile(tab.path);
      });

      openEditorsList.appendChild(oeEl);
    }
  });
}

// ============ Rendering: File Tree ============

async function renderFileTree() {
  const container = document.getElementById("file-tree");
  container.innerHTML = "";
  const tree = await FileManager.listTree();
  renderNode(tree, container);
}

// Path folder yang lagi terbuka di Explorer (buat dipulihkan saat refresh)
const expandedFolders = new Set();

function renderNode(node, container) {
  if (!node.children) return;

  if (node.truncated) {
    const note = document.createElement("div");
    note.className = "file-item";
    note.style.opacity = "0.6";
    note.textContent = "… sebagian isi folder tidak ditampilkan (terlalu banyak file)";
    container.appendChild(note);
  }

  node.children
    .slice()
    .sort((a, b) => {
      if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
      return a.name.localeCompare(b.name);
    })
    .forEach((child) => {
      if (child.type === "folder") {
        const folderEl = document.createElement("div");
        folderEl.className = "folder-item";
        folderEl.innerHTML = `
          <span class="icon">${window.psFolderIcon ? window.psFolderIcon(child.name) : ICON_FOLDER}</span>
          <span class="entry-name">${escapeHtml(child.name)}</span>
          <span class="item-actions"><button class="btn-more"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
            <button class="btn-rename">${ICON_RENAME}</button>
            <button class="btn-delete">${ICON_TRASH}</button>
          </span>
        `;

        const childrenEl = document.createElement("div");
        childrenEl.className = "folder-children";

        // Isi subfolder dimuat BERTAHAP (saat diketuk), bukan semuanya di
        // awal - folder server bisa berisi ribuan file dan bikin app crash.
        let loaded = !child.lazy;
        if (loaded) {
          renderNode(child, childrenEl);
        } else {
          childrenEl.style.display = "none";
        }

        const loadChildren = async () => {
          try {
            const sub = await FileManager.listDir(child.path);
            renderNode(sub, childrenEl);
            loaded = true;
            return true;
          } catch (err) {
            alert("Gagal membuka folder: " + err.message);
            return false;
          }
        };

        // Pertahankan folder yang tadinya terbuka waktu tree di-refresh
        if (!loaded && expandedFolders.has(child.path)) {
          loadChildren().then((ok) => {
            if (ok) childrenEl.style.display = "block";
          });
        }

        folderEl.addEventListener("click", async (e) => {
          if (e.target.closest(".item-actions")) return;

          if (!loaded) {
            if (!(await loadChildren())) return;
            childrenEl.style.display = "block";
            expandedFolders.add(child.path);
            return;
          }

          const nowHidden = childrenEl.style.display !== "none";
          childrenEl.style.display = nowHidden ? "none" : "block";
          if (nowHidden) expandedFolders.delete(child.path);
          else expandedFolders.add(child.path);
        });

        folderEl.querySelector(".btn-rename").addEventListener("click", (e) => {
          e.stopPropagation();
          handleRenameEntry(child.path, child.name);
        });

        folderEl.querySelector(".btn-delete").addEventListener("click", (e) => {
          e.stopPropagation();
          handleDeleteEntry(child.path);
        });

        container.appendChild(folderEl);
        container.appendChild(childrenEl);
      } else {
        const fileEl = document.createElement("div");
        fileEl.className = "file-item" + (child.path === activeTabPath ? " active" : "") + (isBinaryFile(child.name) ? " file-binary" : "");
        fileEl.setAttribute("data-ext", getFileExt(child.name));
        fileEl.innerHTML = `
          <span class="icon">${getFileIcon(child.name)}</span>
          <span class="entry-name">${escapeHtml(child.name)}</span>
          <span class="item-actions"><button class="btn-more"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
            <button class="btn-rename">${ICON_RENAME}</button>
            <button class="btn-delete">${ICON_TRASH}</button>
          </span>
        `;

        fileEl.addEventListener("click", (e) => {
          if (e.target.closest(".item-actions")) return;
          openFile(child.path);
        });

        fileEl.querySelector(".btn-rename").addEventListener("click", (e) => {
          e.stopPropagation();
          handleRenameEntry(child.path, child.name);
        });

        fileEl.querySelector(".btn-delete").addEventListener("click", (e) => {
          e.stopPropagation();
          handleDeleteEntry(child.path);
        });

        container.appendChild(fileEl);
      }
    });
}

function findFirstFile(node) {
  if (!node.children) return null;
  for (const child of node.children) {
    if (child.type === "file") return child;
    const found = findFirstFile(child);
    if (found) return found;
  }
  return null;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============ File Actions ============

async function handleNewFile() {
  const name = prompt("Nama file baru (contoh: script.pwn):");
  if (!name) return;
  try {
    const path = await FileManager.createFile("", name, "");
    await renderFileTree();
    await openFile(path);
  } catch (err) {
    alert(err.message);
  }
}

async function handleNewFolder() {
  const name = prompt("Nama folder baru:");
  if (!name) return;
  try {
    await FileManager.createFolder("", name);
    await renderFileTree();
  } catch (err) {
    alert(err.message);
  }
}

async function handleDeleteEntry(path) {
  const ok = confirm(`Hapus "${path}"? Tindakan ini tidak bisa dibatalkan.`);
  if (!ok) return;

  await FileManager.deleteEntry(path);

  const tab = openTabs.find((t) => t.path === path);
  if (tab) closeTab(path);

  await renderFileTree();
}

async function handleRenameEntry(path, currentName) {
  const newName = prompt("Nama baru:", currentName);
  if (!newName || newName === currentName) return;

  try {
    const newPath = await FileManager.renameEntry(path, newName);

    // Kalau file yang di-rename lagi kebuka di tab, update referensinya juga
    const tab = openTabs.find((t) => t.path === path);
    if (tab) {
      tab.path = newPath;
      if (activeTabPath === path) activeTabPath = newPath;
    }

    await renderFileTree();
    renderTabs();
    if (activeTabPath === newPath) {
      document.getElementById("status-file").textContent = newPath;
      updateBreadcrumb(newPath);
    }
  } catch (err) {
    alert(err.message);
  }
}

// ============ Upload File & Folder ============

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

async function handleUploadFiles(fileList) {
  const files = Array.from(fileList);
  if (files.length === 0) return;

  for (const file of files) {
    try {
      const content = await readFileAsText(file);
      // webkitRelativePath ada isinya kalau upload folder, kosong kalau upload file biasa
      const relativePath = file.webkitRelativePath && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name;

      await FileManager.writeFileAtPath(relativePath, content);
    } catch (err) {
      console.error("Gagal upload " + file.name, err);
    }
  }

  await renderFileTree();
  alert(`${files.length} file berhasil diupload.`);
}

async function handlePickFolderNative() {
  const FolderPicker = window.Capacitor?.Plugins?.FolderPicker;
  if (!FolderPicker) {
    alert("Plugin FolderPicker tidak ditemukan. Pastikan app dijalankan sebagai APK (bukan browser biasa).");
    return;
  }

  try {
    // Sekarang plugin native nulis file LANGSUNG ke storage satu-satu,
    // JS cuma nerima ringkasan hasil (count, skipped, folderName) -
    // bukan isi semua file sekaligus, jadi jauh lebih hemat memory.
    const result = await FolderPicker.pickFolder();

    await renderFileTree();
    await renderWelcomeIfNeeded();

    let msg = `${result.count} file dari folder "${result.folderName}" berhasil diupload.`;
    if (result.skipped > 0) {
      msg += `\n\n${result.skipped} file dilewati:\n`;
      const names = result.skippedNames || [];
      msg += names.slice(0, 20).join("\n");
      if (names.length > 20) {
        msg += `\n...dan ${names.length - 20} lainnya`;
      }
    }
    alert(msg);
  } catch (err) {
    if (err.message && err.message.includes("dibatalkan")) return;
    alert("Gagal upload folder: " + err.message);
  }
}

async function renderWelcomeIfNeeded() {
  if (typeof updateWelcomeVisibility === "function") {
    updateWelcomeVisibility();
  }
}

function bindUploadActions() {
  document.getElementById("btn-upload-file").addEventListener("click", () => {
    document.getElementById("input-upload-file").click();
  });

  document.getElementById("input-upload-file").addEventListener("change", (e) => {
    handleUploadFiles(e.target.files);
    e.target.value = "";
  });
}

// ============ Global UI Actions ============

function openFindReplaceLama() {
  if (!monacoEditor) return;
  monacoEditor.focus();
  const act = monacoEditor.getAction("editor.action.startFindReplace");
  if (act) act.run();
}

function openFindReplace() {
  if (!monacoEditor) { alert("Editor belum siap"); return; }
  monacoEditor.focus();
  const ids = ["editor.action.startFindReplace", "actions.find", "editor.action.startFind"];
  for (const id of ids) {
    const act = monacoEditor.getAction(id);
    if (act) {
      Promise.resolve(act.run()).catch((e) => alert("Cari gagal: " + e.message));
      return;
    }
  }
  try { monacoEditor.trigger("btn-find", "actions.find", null); return; } catch (e) {}
  alert("Panel Cari tidak tersedia di build Monaco ini");
}

function bindGlobalActions() {
  document.getElementById("btn-run").addEventListener("click", () => {
    runCompiler();
  });

  document.getElementById("btn-save").addEventListener("click", saveActiveTab);
  document.getElementById("btn-find").addEventListener("click", openFindReplace);

  document.getElementById("btn-new-file").addEventListener("click", handleNewFile);
  document.getElementById("btn-new-folder").addEventListener("click", handleNewFolder);
  bindUploadActions();
  bindWelcomeActions();
  bindWorkspaceAction();

  document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
  });

  document.getElementById("activity-explorer").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
    document.getElementById("activity-explorer").classList.add("active");
    document.getElementById("activity-search").classList.remove("active");
  });

  document.getElementById("activity-settings").addEventListener("click", () => {
    document.getElementById("settings-overlay").classList.remove("hidden");
  });

  // Ctrl+S / keyboard save
  document.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      saveActiveTab();
    }
  });
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 480) {
    document.getElementById("sidebar").classList.add("hidden");
  }
}

// ============ Compiler Integration ============

let errorLineDecorations = [];

function runCompiler() {
  if (window.psNodeRunGuard && window.psNodeRunGuard(activeTabPath)) return;
  if (!activeTabPath) {
    alert("Buka file dulu sebelum Run.");
    return;
  }

  const tab = openTabs.find((t) => t.path === activeTabPath);
  const code = tab.model.getValue();
  const fileName = activeTabPath.split("/").pop();

  clearErrorHighlight();
  showOutputPanel();
  setOutputLines([{ text: "Compiling " + fileName + "...", type: "info" }]);
  const compileStart = Date.now();
  setCompileStatus("running");

  const PawnCompiler = window.Capacitor?.Plugins?.PawnCompiler;
  if (!PawnCompiler) {
    setOutputLines([{ text: "Error: plugin PawnCompiler tidak ditemukan. Pastikan app dijalankan sebagai APK (bukan browser biasa).", type: "error" }]);
    return;
  }

  // Preflight: cek kurung seimbang & karakter nyasar (tidak memblokir compile)
  let preLines = [];
  try {
    if (window.PawnPreflight) {
      const found = window.PawnPreflight.check(code);
      found.forEach((f) => preLines.push({ text: "🔍 Preflight baris " + f.line + ": " + f.msg, type: "warning", lineNumber: f.line }));
      if (found.length) preLines.push({ text: "🔍 Preflight cuma pengecekan cepat (heuristik), compile tetap dijalankan.", type: "info" });
    }
  } catch (e) { preLines = []; }

  PawnCompiler.compile({ source: code, fileName: fileName, path: activeTabPath, sampVersion: (function(){ try { return localStorage.getItem("pawnstudio.sampVersion") || "dl-r1"; } catch (e) { return "dl-r1"; } })(), flags: (function(){ try { return localStorage.getItem("pawnstudio.compilerFlags") || ""; } catch (e) { return ""; } })() })
    .then((result) => {
      const lines = preLines.slice();
      if (result.debugCmd) {
        lines.push({ text: "CMD: " + result.debugCmd, type: "info" });
      }
      if (result.autoFixed && result.autoFixed.length > 0) {
        lines.push({ text: `🔧 Auto-fix beda huruf besar/kecil (${result.autoFixed.length}):`, type: "info" });
        result.autoFixed.forEach((f) => lines.push({ text: "  - " + f, type: "info" }));
      }
      const rawOutput = (result.stdout || "") + "\n" + (result.stderr || "");

      rawOutput.split("\n").forEach((line) => {
        if (!line.trim()) return;
        const errorMatch = line.match(/\((\d+)\)\s*:\s*error/i);
        const warningMatch = line.match(/\((\d+)\)\s*:\s*warning/i);

        if (errorMatch) {
          lines.push({ text: line, type: "error", lineNumber: parseInt(errorMatch[1], 10) });
        } else if (warningMatch) {
          lines.push({ text: line, type: "warning", lineNumber: parseInt(warningMatch[1], 10) });
        } else {
          lines.push({ text: line, type: "plain" });
        }
      });

      if (result.success) {
        lines.push({ text: `✅ Compile berhasil (${result.amxSize} bytes)`, type: "success" });
        lines.push({ text: result.amxPath, type: "info" });
        renderFileTree();
      } else {
        lines.push({ text: `❌ Compile gagal (exit code ${result.exitCode})`, type: "error" });
        if (result.hint) {
          result.hint.split("\n").forEach((h) => lines.push({ text: h, type: "info" }));
        }
      }

      const MAX_WARN = 100;
        let shownWarn = 0;
        let hiddenWarn = 0;
        const shown = lines.filter((l) => {
          if (l.type !== "warning") return true;
          if (shownWarn < MAX_WARN) { shownWarn++; return true; }
          hiddenWarn++;
          return false;
        });
        if (hiddenWarn > 0) {
          shown.splice(shown.length - 1, 0, {
            text: `⚠ ${hiddenWarn} warning lainnya disembunyikan (total ${shownWarn + hiddenWarn})`,
            type: "info",
          });
        }

        setOutputLines(shown);
        updateProblemsStatusBar(lines);
        setCompileStatus(result.success ? "success" : "fail", Date.now() - compileStart);
    })
    .catch((err) => {
      setOutputLines([{ text: "Error menjalankan compiler: " + err.message, type: "error" }]);
      updateProblemsStatusBar([]);
      setCompileStatus("fail", Date.now() - compileStart);
    });
}

function setCompileStatus(state, ms) {
  const el = document.getElementById("status-compile");
  if (!el) return;
  const secs = ms != null ? " (" + (ms / 1000).toFixed(1) + "s)" : "";
  const labels = {
    idle: "● Siap",
    running: "⟳ Compiling...",
    success: "✓ Compile OK" + secs,
    fail: "✕ Compile gagal" + secs,
  };
  el.className = state;
  el.textContent = labels[state] || labels.idle;
}

function updateProblemsStatusBar(lines) {
  const badge = document.getElementById("status-problems");
  if (!badge) return;

  const errorCount = lines.filter((l) => l.type === "error" && l.lineNumber).length;
  const warningCount = lines.filter((l) => l.type === "warning" && l.lineNumber).length;

  if (errorCount === 0 && warningCount === 0) {
    badge.classList.add("hidden");
    badge.innerHTML = "";
    return;
  }

  badge.classList.remove("hidden");
  badge.innerHTML = "";

  if (errorCount > 0) {
    const errSpan = document.createElement("span");
    errSpan.className = "count-error";
    errSpan.textContent = "\u26D4 " + errorCount;
    badge.appendChild(errSpan);
  }

  if (warningCount > 0) {
    const warnSpan = document.createElement("span");
    warnSpan.className = "count-warning";
    warnSpan.textContent = "\u26A0 " + warningCount;
    badge.appendChild(warnSpan);
  }
}

function showOutputPanel() {
  let panel = document.getElementById("output-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "output-panel";
    panel.innerHTML = `
      <div id="output-panel-header">
        <span>OUTPUT</span>
        <span id="output-panel-actions"><button id="output-panel-copy">Salin</button><button id="output-panel-close">×</button></span>
      </div>
      <div id="output-panel-body"></div>
    `;
    document.getElementById("main-area").appendChild(panel);
    const copyBtn = document.getElementById("output-panel-copy");
    copyBtn.addEventListener("click", async () => {
      const bodyEl = document.getElementById("output-panel-body");
      const text = Array.from(bodyEl.children).map((n) => n.textContent).join("\n");
      let ok = false;
      try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {}
      if (!ok) {
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (e) {}
      }
      copyBtn.textContent = ok ? "Tersalin ✓" : "Gagal";
      setTimeout(() => { copyBtn.textContent = "Salin"; }, 1500);
    });
    document.getElementById("output-panel-close").addEventListener("click", () => {
      panel.classList.add("hidden");
      clearErrorHighlight();
    });
  }
  panel.classList.remove("hidden");
}

function setOutputLines(lines) {
  const body = document.getElementById("output-panel-body");
  if (!body) return;
  body.innerHTML = "";

  lines.forEach((line) => {
    const el = document.createElement("div");
    el.className = "output-line " + line.type;
    el.textContent = line.text;

    if (line.lineNumber) {
      el.addEventListener("click", () => jumpToLine(line.lineNumber));
    }

    body.appendChild(el);
  });

  body.scrollTop = body.scrollHeight;
}

function jumpToLine(lineNumber) {
  if (!monacoEditor) return;

  monacoEditor.revealLineInCenter(lineNumber);
  monacoEditor.setPosition({ lineNumber: lineNumber, column: 1 });
  monacoEditor.focus();

  clearErrorHighlight();
  errorLineDecorations = monacoEditor.deltaDecorations([], [
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true,
        className: "error-line-highlight",
      },
    },
  ]);
}

function clearErrorHighlight() {
  if (monacoEditor && errorLineDecorations.length > 0) {
    errorLineDecorations = monacoEditor.deltaDecorations(errorLineDecorations, []);
  }
}

// ============ Settings ============

const SETTINGS_KEY = "pawnstudio_settings";
const SETTINGS_VERSION = 2;
const APP_VERSION = "1.14.3";

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const defaults = { fontSize: 14, theme: "vs-dark", wordWrap: false, settingsVersion: SETTINGS_VERSION };
  if (!raw) return defaults;
  try {
    const saved = JSON.parse(raw);
    // Migrasi v1.5.1: word wrap sekarang default mati, termasuk buat user lama
    if ((saved.settingsVersion || 0) < SETTINGS_VERSION) {
      saved.wordWrap = false;
      saved.settingsVersion = SETTINGS_VERSION;
    }
    return { ...defaults, ...saved };
  } catch {
    return defaults;
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings(settings) {
  if (!monacoEditor) return;
  monacoEditor.updateOptions({
    fontSize: settings.fontSize,
    wordWrap: settings.wordWrap ? "on" : "off",
  });
  monaco.editor.setTheme(settings.theme);
  updateWrapButton(settings.wordWrap);
}

function updateWrapButton(on) {
  const btn = document.getElementById("status-wrap");
  if (!btn) return;
  btn.textContent = "Wrap: " + (on ? "On" : "Off");
  btn.classList.toggle("on", !!on);
}

function toggleWordWrap() {
  const cur = loadSettings();
  const next = { ...cur, wordWrap: !cur.wordWrap, settingsVersion: SETTINGS_VERSION };
  saveSettings(next);
  applySettings(next);
  const cb = document.getElementById("setting-wordwrap");
  if (cb) cb.checked = next.wordWrap;
}

// ============ Bar simbol di atas keyboard ============
function setSymbolBarVisible(show) {
  const bar = document.getElementById("symbol-bar");
  if (bar) bar.classList.toggle("hidden", !show);
}

function initSymbolBar() {
  const bar = document.getElementById("symbol-bar");
  if (!bar) return;

  // pointerdown + preventDefault: editor tetap fokus, keyboard gak nutup
  // Tap-only: insert pas jari diangkat, bukan pas nempel.
  // Jadi geser (scroll) bar simbol gak ikut nge-insert karakter.
  const MOVE_TOL = 10;
  let down = null;

  function doInsert(btn) {
    if (!monacoEditor) return;
    const ins = btn.getAttribute("data-ins");
    monacoEditor.focus();
    if (ins === "Tab") monacoEditor.trigger("symbolbar", "tab", null);
    else monacoEditor.trigger("symbolbar", "type", { text: ins });
  }

  // jaga editor tetap fokus & keyboard gak nutup
  bar.addEventListener("mousedown", (e) => {
    if (e.target.closest("button[data-ins]")) e.preventDefault();
  });

  bar.addEventListener("pointerdown", (e) => {
    const btn = e.target.closest("button[data-ins]");
    if (!btn) { down = null; return; }
    e.preventDefault();
    down = { x: e.clientX, y: e.clientY, btn: btn };
  });

  bar.addEventListener("pointermove", (e) => {
    if (!down) return;
    if (Math.abs(e.clientX - down.x) > MOVE_TOL || Math.abs(e.clientY - down.y) > MOVE_TOL) {
      down = null; // user lagi scroll, batalin
    }
  });

  bar.addEventListener("pointercancel", () => { down = null; });

  bar.addEventListener("pointerup", (e) => {
    if (!down) return;
    const btn = e.target.closest("button[data-ins]");
    const ok = btn && btn === down.btn;
    const d = down;
    down = null;
    if (ok) doInsert(d.btn);
  });

  const sw = document.getElementById("status-wrap");
  if (sw) sw.addEventListener("click", toggleWordWrap);

  const sp = document.getElementById("status-problems");
  if (sp) sp.addEventListener("click", () => showOutputPanel());

  const v = document.getElementById("app-version");
  if (v) v.textContent = "v" + APP_VERSION;
}

function initSettingsUI() {
  const settings = loadSettings();

  document.getElementById("setting-font-size").value = settings.fontSize;
  document.getElementById("setting-theme").value = settings.theme;
  document.getElementById("setting-wordwrap").checked = settings.wordWrap;

  applySettings(settings);

  document.getElementById("btn-settings").addEventListener("click", () => {
    document.getElementById("settings-overlay").classList.remove("hidden");
  });

  document.getElementById("btn-close-settings").addEventListener("click", () => {
    document.getElementById("settings-overlay").classList.add("hidden");
  });

  document.getElementById("settings-overlay").addEventListener("click", (e) => {
    if (e.target.id === "settings-overlay") {
      document.getElementById("settings-overlay").classList.add("hidden");
    }
  });

  function updateAndSave() {
    const newSettings = {
      fontSize: parseInt(document.getElementById("setting-font-size").value, 10),
      theme: document.getElementById("setting-theme").value,
      wordWrap: document.getElementById("setting-wordwrap").checked,
      settingsVersion: SETTINGS_VERSION,
    };
    saveSettings(newSettings);
    applySettings(newSettings);
  }

  document.getElementById("setting-font-size").addEventListener("change", updateAndSave);
  document.getElementById("setting-theme").addEventListener("change", updateAndSave);
  document.getElementById("setting-wordwrap").addEventListener("change", updateAndSave);
}

// ============ Workspace ("Buka Folder Project", mirip Open Folder VSCode) ============
// Beda sama "Bulk Import" versi lama: sekarang TIDAK ADA proses copy file
// sama sekali. Plugin cuma nunjuk WorkspaceManager di sisi native ke folder
// asli yang dipilih user, jadi app baca/tulis/compile LANGSUNG di situ.

function bindWorkspaceAction() {
  const btn = document.getElementById("btn-open-folder");
  if (!btn) return;
  btn.addEventListener("click", handleOpenOrCloseWorkspace);
}

async function updateWorkspaceLabel() {
  const BulkImport = window.Capacitor?.Plugins?.BulkImport;
  const label = document.getElementById("workspace-name");
  const btn = document.getElementById("btn-open-folder");
  if (!BulkImport || !label) return;

  try {
    const info = await BulkImport.getWorkspaceInfo();
    if (info.recoveredFrom) {
      alert(
        `Folder "${info.recoveredFrom}" bikin app crash pas dibuka (kemungkinan kebanyakan file), ` +
        `jadi otomatis dilepas dan app balik ke workspace bawaan biar nggak crash terus.\n\n` +
        `Coba buka lagi folder yang lebih spesifik (misal folder "gamemodes"-nya aja, ` +
        `bukan folder server lengkap), lewat tombol "Buka Folder Project".`
      );
    }
    if (info.isCustom) {
      label.textContent = "— " + info.name;
      label.classList.remove("hidden");
      if (btn) btn.title = `Folder aktif: ${info.name}. Tap buat ganti/tutup folder.`;
    } else {
      label.textContent = "";
      label.classList.add("hidden");
      if (btn) btn.title = "Buka Folder Project (langsung dari lokasi aslinya, tanpa copy)";
    }
  } catch (err) {
    // Plugin belum ada (mode browser testing) - diemin aja, gak fatal.
  }
}

async function handleOpenOrCloseWorkspace() {
  const BulkImport = window.Capacitor?.Plugins?.BulkImport;
  if (!BulkImport) {
    alert("Plugin BulkImport tidak ditemukan. Pastikan app dijalankan sebagai APK.");
    return;
  }

  try {
    const info = await BulkImport.getWorkspaceInfo();

    // Kalau lagi buka folder custom, tombol yang sama dipakai buat nutup
    // folder itu (balik ke sandbox bawaan) - mirip "Close Folder" VSCode.
    if (info.isCustom) {
      const wantClose = confirm(
        `Lagi buka folder "${info.name}".\n\nTutup folder ini dan balik ke workspace bawaan PawnStudio?`
      );
      if (!wantClose) return;

      await BulkImport.closeWorkspace();
      await afterWorkspaceChange();
      return;
    }

    const accessCheck = await BulkImport.checkAllFilesAccess();
    if (!accessCheck.granted) {
      const proceed = confirm(
        "Fitur ini butuh izin 'All Files Access' (izin akses semua file), soalnya compiler PAWN " +
        "butuh baca file langsung dari lokasi aslinya, tanpa disalin dulu.\n\n" +
        "Setelah tap OK, halaman Settings Android akan terbuka. " +
        "Aktifkan toggle izin buat PawnStudio, lalu kembali ke app ini dan " +
        "tap tombol Buka Folder Project lagi."
      );
      if (!proceed) return;

      await BulkImport.requestAllFilesAccess();
      return;
    }

    const result = await BulkImport.openWorkspace();
    await afterWorkspaceChange();
    alert(`Folder "${result.name}" sekarang jadi project aktif.\nSemua perubahan langsung ke folder aslinya, gak ada file yang disalin.`);
  } catch (err) {
    if (err.message && err.message.includes("dibatalkan")) return;
    alert("Gagal buka folder: " + err.message);
  }
}

async function afterWorkspaceChange() {
  // Ganti workspace berarti file yang lagi kebuka di tab bisa aja udah
  // gak relevan (folder lama), jadi tab lama ditutup semua biar gak
  // ketuker/nyimpen ke folder yang salah.
  openTabs = [];
  activeTabPath = null;
  renderTabs();
  document.getElementById("editor-container").innerHTML = "";

  await updateWorkspaceLabel();
  await renderFileTree();
  updateWelcomeVisibility();

  const tree = await FileManager.listTree();
  const firstFile = findFirstFile(tree);
  if (firstFile) await openFile(firstFile.path);

  try { await window.Capacitor?.Plugins?.BulkImport?.markLaunchOk(); } catch (e) {}
}
