// ==============================================
// PawnStudio - File Manager (Storage Abstraction)
// ==============================================
//
// Sekarang pakai localStorage sebagai "virtual file system" biar bisa
// langsung ditest di browser tanpa build APK dulu.
//
// PAS UDAH WRAP CAPACITOR:
// Ganti isi fungsi-fungsi di bawah (readFile, writeFile, deleteEntry, dll)
// supaya manggil @capacitor/filesystem, contoh:
//
//   import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
//   await Filesystem.writeFile({
//     path: fullPath,
//     data: content,
//     directory: Directory.Documents,
//     encoding: Encoding.UTF8,
//   });
//
// Struktur data & nama fungsi di objek FileManager sengaja dibuat generik
// (readFile, writeFile, listTree, dll) supaya main.js TIDAK perlu diubah
// sama sekali waktu lo migrasi ke Capacitor. Cukup ganti isi file ini.

const STORAGE_KEY = "pawnstudio_vfs"; // menyimpan { path: content }
const TREE_KEY = "pawnstudio_tree";   // menyimpan struktur folder

const FileManager = (function () {
  function _loadFiles() {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  }

  function _saveFiles(files) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
  }

  function _loadTree() {
    const raw = localStorage.getItem(TREE_KEY);
    if (raw) return JSON.parse(raw);
    // default tree kosong
    return { type: "folder", name: "root", path: "", children: [] };
  }

  function _saveTree(tree) {
    localStorage.setItem(TREE_KEY, JSON.stringify(tree));
  }

  function _findNode(node, path) {
    if (node.path === path) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = _findNode(child, path);
        if (found) return found;
      }
    }
    return null;
  }

  function _joinPath(parent, name) {
    return parent ? `${parent}/${name}` : name;
  }

  // -------- Public API --------

  function init() {
    // Kalau belum ada file sama sekali, bikinin starter file biar gak kosong melompong
    const tree = _loadTree();
    if (tree.children.length === 0) {
      createFile("", "main.pwn", `#include <a_samp>\n\nmain()\n{\n    print("PawnStudio ready.");\n}\n`);
    }
  }

  function listTree() {
    return _loadTree();
  }

  function createFile(parentPath, name, initialContent = "") {
    const tree = _loadTree();
    const files = _loadFiles();
    const parent = parentPath ? _findNode(tree, parentPath) : tree;
    if (!parent) throw new Error("Parent folder tidak ditemukan");

    const path = _joinPath(parentPath, name);
    if (files.hasOwnProperty(path)) throw new Error("File sudah ada");

    parent.children.push({ type: "file", name, path });
    files[path] = initialContent;

    _saveTree(tree);
    _saveFiles(files);
    return path;
  }

  function createFolder(parentPath, name) {
    const tree = _loadTree();
    const parent = parentPath ? _findNode(tree, parentPath) : tree;
    if (!parent) throw new Error("Parent folder tidak ditemukan");

    const path = _joinPath(parentPath, name);
    parent.children.push({ type: "folder", name, path, children: [] });

    _saveTree(tree);
    return path;
  }

  function readFile(path) {
    const files = _loadFiles();
    if (!files.hasOwnProperty(path)) throw new Error("File tidak ditemukan: " + path);
    return files[path];
  }

  function writeFile(path, content) {
    const files = _loadFiles();
    files[path] = content;
    _saveFiles(files);
  }

  function deleteEntry(path) {
    const tree = _loadTree();
    const files = _loadFiles();

    function removeFromParent(node) {
      if (!node.children) return false;
      const idx = node.children.findIndex((c) => c.path === path);
      if (idx !== -1) {
        node.children.splice(idx, 1);
        return true;
      }
      for (const child of node.children) {
        if (removeFromParent(child)) return true;
      }
      return false;
    }

    removeFromParent(tree);

    // Hapus semua file di bawah path ini (kalau folder)
    Object.keys(files).forEach((p) => {
      if (p === path || p.startsWith(path + "/")) {
        delete files[p];
      }
    });

    _saveTree(tree);
    _saveFiles(files);
  }

  function renameEntry(path, newName) {
    const tree = _loadTree();
    const node = _findNode(tree, path);
    if (!node) throw new Error("Entry tidak ditemukan");

    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
    const newPath = _joinPath(parentPath, newName);

    if (node.type === "file") {
      const files = _loadFiles();
      files[newPath] = files[path];
      delete files[path];
      _saveFiles(files);
    }

    node.name = newName;
    node.path = newPath;

    _saveTree(tree);
    return newPath;
  }

  // Pastikan seluruh folder di sepanjang path ada (mkdir -p style).
  // Contoh: ensureFolderPath("a/b/c") bikin folder a, a/b, a/b/c kalau belum ada.
  function ensureFolderPath(folderPath) {
    if (!folderPath) return;
    const parts = folderPath.split("/");
    const tree = _loadTree();
    let currentPath = "";
    let currentNode = tree;

    parts.forEach((part) => {
      currentPath = _joinPath(currentPath, part);
      let child = currentNode.children.find((c) => c.path === currentPath && c.type === "folder");
      if (!child) {
        child = { type: "folder", name: part, path: currentPath, children: [] };
        currentNode.children.push(child);
      }
      currentNode = child;
    });

    _saveTree(tree);
  }

  // Tulis file di path manapun (termasuk bersarang), otomatis bikin folder
  // yang belum ada, dan overwrite kalau file sudah ada (dipakai buat upload).
  function writeFileAtPath(fullPath, content) {
    const parentPath = fullPath.includes("/") ? fullPath.substring(0, fullPath.lastIndexOf("/")) : "";
    const name = fullPath.includes("/") ? fullPath.substring(fullPath.lastIndexOf("/") + 1) : fullPath;

    if (parentPath) ensureFolderPath(parentPath);

    const tree = _loadTree();
    const files = _loadFiles();
    const parent = parentPath ? _findNode(tree, parentPath) : tree;

    const alreadyExists = files.hasOwnProperty(fullPath);
    if (!alreadyExists) {
      parent.children.push({ type: "file", name, path: fullPath });
      _saveTree(tree);
    }

    files[fullPath] = content;
    _saveFiles(files);
  }

  return {
    init,
    listTree,
    createFile,
    createFolder,
    readFile,
    writeFile,
    deleteEntry,
    renameEntry,
    ensureFolderPath,
    writeFileAtPath,
  };
})();
