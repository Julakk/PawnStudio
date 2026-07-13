// ==============================
// PawnStudio - Monaco Editor Init
// ==============================

const MONACO_CDN = "https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.47.0/min/vs";

let editor = null;

// Konfigurasi AMD loader Monaco
require.config({ paths: { vs: MONACO_CDN } });

// Beberapa versi Monaco butuh worker global ini biar gak error di WebView
window.MonacoEnvironment = {
  getWorkerUrl: function () {
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(`
      self.MonacoEnvironment = { baseUrl: '${MONACO_CDN}/' };
      importScripts('${MONACO_CDN}/base/worker/workerMain.js');
    `)}`;
  }
};

require(["vs/editor/editor.main"], function () {
  initEditor();
});

function initEditor() {
  const starterCode = `#include <a_samp>

main()
{
    print("PawnStudio ready.");
}
`;

  editor = monaco.editor.create(document.getElementById("editor-container"), {
    value: starterCode,
    language: "pawn", // fallback ke plaintext highlighting kalau bahasa 'pawn' belum didaftarkan
    theme: "vs-dark",
    automaticLayout: true, // penting: auto resize saat rotate/keyboard muncul
    fontSize: 14,
    minimap: { enabled: false }, // hemat ruang di layar HP
    scrollBeyondLastLine: false,
    wordWrap: "on",
    tabSize: 4,
    smoothScrolling: true,
  });

  bindUIActions();
}

function bindUIActions() {
  document.getElementById("btn-run").addEventListener("click", () => {
    const code = editor.getValue();
    console.log("RUN:", code);
    // TODO: kirim ke compiler/backend
  });

  document.getElementById("btn-save").addEventListener("click", () => {
    const code = editor.getValue();
    localStorage.setItem("pawnstudio_last_file", code);
    console.log("Saved to localStorage.");
    // TODO: nanti ganti pakai Capacitor Filesystem API
  });

  // Auto-restore draft terakhir kalau ada
  const saved = localStorage.getItem("pawnstudio_last_file");
  if (saved) {
    editor.setValue(saved);
  }
}
