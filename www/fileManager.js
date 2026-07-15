// ==================================================
// PawnStudio - File Manager (Capacitor Filesystem)
// ==================================================
// Semua file project disimpan di storage ASLI perangkat lewat
// Capacitor Filesystem API (folder Documents), bukan localStorage lagi.
// Kapasitasnya sebesar storage HP, bukan dibatasi WebView (~5-10MB).
//
// Semua fungsi di sini ASYNC (return Promise) karena Filesystem API
// Capacitor memang berbasis Promise.

const PROJECT_ROOT = "PawnStudio";

const FileManager = (function () {
  const { Filesystem, Directory, Encoding } = window.Capacitor.Plugins;

  async function _ensureRoot() {
    try {
      await Filesystem.mkdir({
        path: PROJECT_ROOT,
        directory: Directory.Documents,
        recursive: true,
      });
    } catch (e) {
      // Folder root udah ada, aman diabaikan
    }
  }

  async function init() {
    await _ensureRoot();
    const tree = await listTree();
    if (tree.children.length === 0) {
      await createFile("", "main.pwn", `#include <a_samp>\n\nmain()\n{\n    print("PawnStudio ready.");\n}\n`);
    }
  }

  // Baca struktur folder secara rekursif langsung dari filesystem asli
  async function listTree() {
    return await _readDir("");
  }

  async function _readDir(relativePath) {
    const fsPath = relativePath ? `${PROJECT_ROOT}/${relativePath}` : PROJECT_ROOT;
    const node = {
      type: "folder",
      name: relativePath ? relativePath.split("/").pop() : "root",
      path: relativePath,
      children: [],
    };

    let entries;
    try {
      const result = await Filesystem.readdir({ path: fsPath, directory: Directory.Documents });
      entries = result.files;
    } catch (e) {
      return node;
    }

    for (const entry of entries) {
      const entryRelPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      if (entry.type === "directory") {
        const childNode = await _readDir(entryRelPath);
        node.children.push(childNode);
      } else {
        node.children.push({ type: "file", name: entry.name, path: entryRelPath });
      }
    }

    return node;
  }

  function _joinPath(parent, name) {
    return parent ? `${parent}/${name}` : name;
  }

  async function ensureFolderPath(folderPath) {
    if (!folderPath) return;
    await Filesystem.mkdir({
      path: `${PROJECT_ROOT}/${folderPath}`,
      directory: Directory.Documents,
      recursive: true,
    }).catch(() => {});
  }

  async function createFile(parentPath, name, initialContent = "") {
    const path = _joinPath(parentPath, name);
    if (parentPath) await ensureFolderPath(parentPath);

    await Filesystem.writeFile({
      path: `${PROJECT_ROOT}/${path}`,
      data: initialContent,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });

    return path;
  }

  async function createFolder(parentPath, name) {
    const path = _joinPath(parentPath, name);
    await Filesystem.mkdir({
      path: `${PROJECT_ROOT}/${path}`,
      directory: Directory.Documents,
      recursive: true,
    });
    return path;
  }

  async function readFile(path) {
    const result = await Filesystem.readFile({
      path: `${PROJECT_ROOT}/${path}`,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
    return result.data;
  }

  async function writeFile(path, content) {
    await Filesystem.writeFile({
      path: `${PROJECT_ROOT}/${path}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  }

  async function writeFileAtPath(fullPath, content) {
    const parentPath = fullPath.includes("/") ? fullPath.substring(0, fullPath.lastIndexOf("/")) : "";
    if (parentPath) await ensureFolderPath(parentPath);

    await Filesystem.writeFile({
      path: `${PROJECT_ROOT}/${fullPath}`,
      data: content,
      directory: Directory.Documents,
      encoding: Encoding.UTF8,
    });
  }

  async function deleteEntry(path) {
    try {
      await Filesystem.deleteFile({ path: `${PROJECT_ROOT}/${path}`, directory: Directory.Documents });
    } catch (e) {
      // Kalau gagal (karena itu folder, bukan file), coba hapus sebagai folder
      await Filesystem.rmdir({
        path: `${PROJECT_ROOT}/${path}`,
        directory: Directory.Documents,
        recursive: true,
      }).catch(() => {});
    }
  }

  async function renameEntry(path, newName) {
    const parentPath = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
    const newPath = _joinPath(parentPath, newName);

    await Filesystem.rename({
      from: `${PROJECT_ROOT}/${path}`,
      to: `${PROJECT_ROOT}/${newPath}`,
      directory: Directory.Documents,
    });

    return newPath;
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
