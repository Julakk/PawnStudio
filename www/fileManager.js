// ==================================================
// PawnStudio - File Manager (Native Plugin, bukan Capacitor Filesystem)
// ==================================================
// Storage sekarang lewat plugin native custom (NativeStoragePlugin.java)
// yang pakai java.io.File langsung, buat nyingkirin kemungkinan bug
// di plugin resmi @capacitor/filesystem.

const FileManager = (function () {
  const { NativeStorage } = window.Capacitor.Plugins;

  async function init() {
    await NativeStorage.init();
    const tree = await listTree();
    if (tree.children.length === 0) {
      await createFile("", "main.pwn", `#include <a_samp>\n\nmain()\n{\n    print("PawnStudio ready.");\n}\n`);
    }
  }

  async function listTree() {
    return await NativeStorage.listTree();
  }

  // Isi SATU folder (1 level) - dipakai Explorer buat muat subfolder bertahap.
  async function listDir(path) {
    return await NativeStorage.listDir({ path });
  }

  function _joinPath(parent, name) {
    return parent ? `${parent}/${name}` : name;
  }

  async function createFile(parentPath, name, initialContent = "") {
    const path = _joinPath(parentPath, name);
    await NativeStorage.writeFile({ path, content: initialContent });
    return path;
  }

  async function createFolder(parentPath, name) {
    const path = _joinPath(parentPath, name);
    await NativeStorage.createFolder({ path });
    return path;
  }

  async function readFile(path) {
    const result = await NativeStorage.readFile({ path });
    return result.data;
  }

  async function writeFile(path, content) {
    await NativeStorage.writeFile({ path, content });
  }

  async function ensureFolderPath(folderPath) {
    if (!folderPath) return;
    await NativeStorage.createFolder({ path: folderPath });
  }

  async function writeFileAtPath(fullPath, content) {
    await NativeStorage.writeFile({ path: fullPath, content });
  }

  async function deleteEntry(path) {
    const result = await NativeStorage.deleteEntry({ path });
    if (!result.success || result.stillExists) {
      throw new Error("Hapus gagal, item masih ada setelah dihapus: " + path);
    }
  }

  async function renameEntry(path, newName) {
    const result = await NativeStorage.renameEntry({ path, newName });
    return result.newPath;
  }

  return {
    init,
    listTree,
    listDir,
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
