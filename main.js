// ==============================
// PawnStudio - Editor Core
// ==============================

const MONACO_CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs";

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

require(["vs/editor/editor.main"], function () {
  FileManager.init();
  initEditor();
  renderFileTree();
  bindGlobalActions();

  // Auto-buka file pertama yang ada
  const tree = FileManager.listTree();
  const firstFile = findFirstFile(tree);
  if (firstFile) openFile(firstFile.path);
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
}

function getLanguageForFile(filename) {
  if (filename.endsWith(".pwn") || filename.endsWith(".inc")) return "plaintext"; // ganti "pawn" kalau custom language udah didaftarkan
  if (filename.endsWith(".js")) return "javascript";
  if (filename.endsWith(".json")) return "json";
  if (filename.endsWith(".css")) return "css";
  if (filename.endsWith(".html")) return "html";
  return "plaintext";
}

// ============ Tab Management ============

function openFile(path) {
  let tab = openTabs.find((t) => t.path === path);

  if (!tab) {
    const content = FileManager.readFile(path);
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

  renderTabs();
  renderFileTree();
  closeSidebarOnMobile();
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

function saveActiveTab() {
  if (!activeTabPath) return;
  const tab = openTabs.find((t) => t.path === activeTabPath);
  if (!tab) return;

  FileManager.writeFile(activeTabPath, tab.model.getValue());
  tab.dirty = false;
  renderTabs();
}

function saveAllTabs() {
  openTabs.forEach((tab) => {
    FileManager.writeFile(tab.path, tab.model.getValue());
    tab.dirty = false;
  });
  renderTabs();
}

// ============ Rendering: Tabs ============

function renderTabs() {
  const tabbar = document.getElementById("tabbar");
  tabbar.innerHTML = "";

  openTabs.forEach((tab) => {
    const el = document.createElement("div");
    el.className = "tab-item" + (tab.path === activeTabPath ? " active" : "") + (tab.dirty ? " dirty" : "");

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = tab.path.split("/").pop();

    const dot = document.createElement("span");
    dot.className = "tab-dot";

    const close = document.createElement("span");
    close.className = "tab-close";
    close.textContent = "×";
    close.addEventListener("click", (e) => closeTab(tab.path, e));

    el.appendChild(name);
    el.appendChild(dot);
    el.appendChild(close);
    el.addEventListener("click", () => openFile(tab.path));

    tabbar.appendChild(el);
  });
}

// ============ Rendering: File Tree ============

function renderFileTree() {
  const container = document.getElementById("file-tree");
  container.innerHTML = "";
  const tree = FileManager.listTree();
  renderNode(tree, container);
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
        folderEl.innerHTML = `<span class="icon">📁</span><span>${escapeHtml(child.name)}</span>`;

        const childrenEl = document.createElement("div");
        childrenEl.className = "folder-children";
        renderNode(child, childrenEl);

        folderEl.addEventListener("click", () => {
          childrenEl.style.display = childrenEl.style.display === "none" ? "block" : "none";
        });

        container.appendChild(folderEl);
        container.appendChild(childrenEl);
      } else {
        const fileEl = document.createElement("div");
        fileEl.className = "file-item" + (child.path === activeTabPath ? " active" : "");
        fileEl.innerHTML = `<span class="icon">📄</span><span>${escapeHtml(child.name)}</span><span class="file-delete">🗑</span>`;

        fileEl.addEventListener("click", (e) => {
          if (e.target.classList.contains("file-delete")) return;
          openFile(child.path);
        });

        fileEl.querySelector(".file-delete").addEventListener("click", (e) => {
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

function handleNewFile() {
  const name = prompt("Nama file baru (contoh: script.pwn):");
  if (!name) return;
  try {
    const path = FileManager.createFile("", name, "");
    renderFileTree();
    openFile(path);
  } catch (err) {
    alert(err.message);
  }
}

function handleNewFolder() {
  const name = prompt("Nama folder baru:");
  if (!name) return;
  try {
    FileManager.createFolder("", name);
    renderFileTree();
  } catch (err) {
    alert(err.message);
  }
}

function handleDeleteEntry(path) {
  const ok = confirm(`Hapus "${path}"? Tindakan ini tidak bisa dibatalkan.`);
  if (!ok) return;

  FileManager.deleteEntry(path);

  const tab = openTabs.find((t) => t.path === path);
  if (tab) closeTab(path);

  renderFileTree();
}

// ============ Global UI Actions ============

function bindGlobalActions() {
  document.getElementById("btn-run").addEventListener("click", () => {
    if (!activeTabPath) return;
    const tab = openTabs.find((t) => t.path === activeTabPath);
    console.log("RUN:", tab.model.getValue());
    // TODO: kirim ke compiler backend
  });

  document.getElementById("btn-save").addEventListener("click", saveActiveTab);

  document.getElementById("btn-new-file").addEventListener("click", handleNewFile);
  document.getElementById("btn-new-folder").addEventListener("click", handleNewFolder);

  document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("hidden");
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
