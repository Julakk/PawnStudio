// ==============================
// PawnStudio - Editor Core
// ==============================


// ============ SVG Icons ============
const ICON_FILE = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
const ICON_FOLDER = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>';
const ICON_TRASH = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
const ICON_RENAME = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>';

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
  await FileManager.init();
  initEditor();
  await renderFileTree();
  bindGlobalActions();
  initSettingsUI();
  bindRootHeaderToggle();

  // Auto-buka file pertama yang ada
  const tree = await FileManager.listTree();
  const firstFile = findFirstFile(tree);
  if (firstFile) await openFile(firstFile.path);
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
    wordWrap: "on",
    tabSize: 4,
    smoothScrolling: true,
  });

  document.getElementById("editor-container").classList.add("empty");

  monacoEditor.onDidChangeCursorPosition((e) => {
    const statusCursor = document.getElementById("status-cursor");
    if (statusCursor) {
      statusCursor.textContent = `Ln ${e.position.lineNumber}, Col ${e.position.column}`;
    }
  });
}

function getLanguageForFile(filename) {
  if (filename.endsWith(".pwn") || filename.endsWith(".inc")) return "pawn";
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
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
    icon.innerHTML = ICON_FILE;

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

function bindRootHeaderToggle() {
  const header = document.getElementById("explorer-root-header");
  const tree = document.getElementById("file-tree");
  if (!header || !tree) return;

  header.addEventListener("click", () => {
    header.classList.toggle("collapsed");
    tree.classList.toggle("collapsed");
  });
}

function renderNode(node, container) {
  if (!node.children) return;

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
          <span class="icon">${ICON_FOLDER}</span>
          <span class="entry-name">${escapeHtml(child.name)}</span>
          <span class="item-actions">
            <button class="btn-rename">${ICON_RENAME}</button>
            <button class="btn-delete">${ICON_TRASH}</button>
          </span>
        `;

        const childrenEl = document.createElement("div");
        childrenEl.className = "folder-children";
        renderNode(child, childrenEl);

        folderEl.addEventListener("click", (e) => {
          if (e.target.closest(".item-actions")) return;
          childrenEl.style.display = childrenEl.style.display === "none" ? "block" : "none";
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
        fileEl.className = "file-item" + (child.path === activeTabPath ? " active" : "");
        fileEl.setAttribute("data-ext", getFileExt(child.name));
        fileEl.innerHTML = `
          <span class="icon">${ICON_FILE}</span>
          <span class="entry-name">${escapeHtml(child.name)}</span>
          <span class="item-actions">
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

function bindUploadActions() {
  document.getElementById("btn-upload-file").addEventListener("click", () => {
    document.getElementById("input-upload-file").click();
  });

  document.getElementById("btn-upload-folder").addEventListener("click", () => {
    document.getElementById("input-upload-folder").click();
  });

  document.getElementById("input-upload-file").addEventListener("change", (e) => {
    handleUploadFiles(e.target.files);
    e.target.value = "";
  });

  document.getElementById("input-upload-folder").addEventListener("change", async (e) => {
    const zipFile = e.target.files[0];
    e.target.value = "";
    if (!zipFile) return;

    try {
      const zip = await JSZip.loadAsync(zipFile);
      let count = 0;

      for (const relPath of Object.keys(zip.files)) {
        const entry = zip.files[relPath];
        if (entry.dir) continue;
        const content = await entry.async("string");
        await FileManager.writeFileAtPath(relPath, content);
        count++;
      }

      await renderFileTree();
      alert(`${count} file dari folder .zip berhasil diupload.`);
    } catch (err) {
      alert("Gagal extract .zip: " + err.message);
    }
  });
}

// ============ Global UI Actions ============

function bindGlobalActions() {
  document.getElementById("btn-run").addEventListener("click", () => {
    runCompiler();
  });

  document.getElementById("btn-save").addEventListener("click", saveActiveTab);

  document.getElementById("btn-new-file").addEventListener("click", handleNewFile);
  document.getElementById("btn-new-folder").addEventListener("click", handleNewFolder);
  bindUploadActions();

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

  const PawnCompiler = window.Capacitor?.Plugins?.PawnCompiler;
  if (!PawnCompiler) {
    setOutputLines([{ text: "Error: plugin PawnCompiler tidak ditemukan. Pastikan app dijalankan sebagai APK (bukan browser biasa).", type: "error" }]);
    return;
  }

  PawnCompiler.compile({ source: code, fileName: fileName })
    .then((result) => {
      const lines = [];
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
      } else {
        lines.push({ text: `❌ Compile gagal (exit code ${result.exitCode})`, type: "error" });
      }

      setOutputLines(lines);
    })
    .catch((err) => {
      setOutputLines([{ text: "Error menjalankan compiler: " + err.message, type: "error" }]);
    });
}

function showOutputPanel() {
  let panel = document.getElementById("output-panel");
  if (!panel) {
    panel = document.createElement("div");
    panel.id = "output-panel";
    panel.innerHTML = `
      <div id="output-panel-header">
        <span>OUTPUT</span>
        <button id="output-panel-close">×</button>
      </div>
      <div id="output-panel-body"></div>
    `;
    document.getElementById("main-area").appendChild(panel);
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

function loadSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  const defaults = { fontSize: 14, theme: "vs-dark", wordWrap: true };
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
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
    };
    saveSettings(newSettings);
    applySettings(newSettings);
  }

  document.getElementById("setting-font-size").addEventListener("change", updateAndSave);
  document.getElementById("setting-theme").addEventListener("change", updateAndSave);
  document.getElementById("setting-wordwrap").addEventListener("change", updateAndSave);
}
