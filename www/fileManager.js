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
  const { Filesystem } = window.Capacitor.Plugins;
  // Directory & Encoding TIDAK tersedia sebagai object runtime tanpa bundler,
  // jadi kita hardcode nilai string aslinya sesuai source resmi Capacitor.
  const Directory = { Documents: "DOCUMENTS" };
  const Encoding = { UTF8: "utf8" };

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

    // AUTO-WIPE SEKALI INI SAJA: hapus SELURUH folder root sekaligus (1 operasi),
    // bukan satu-satu per child, biar gak ada kegagalan parsial.
    try {
      await Filesystem.rmdir({
        path: PROJECT_ROOT,
        directory: Directory.Documents,
        recursive: true,
      });
      alert("AUTO-WIPE: folder root berhasil dihapus total.");
    } catch (err) {
      alert("AUTO-WIPE GAGAL hapus root: " + err.message);
    }

    // Kasih jeda, buat tes teori race condition (operasi native belum ke-flush)
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Bikin ulang folder root-nya (kosong)
    await _ensureRoot();

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const treeAfterWipe = await listTree();
    alert("Cek ulang SETELAH JEDA 1.5 detik x2. Sisa item: " + treeAfterWipe.children.length + "\nNama item: " + treeAfterWipe.children.map(c => c.name).join(", "));

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
      recursive: true,
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
      recursive: true,
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
      recursive: true,
    });
  }

  async function deleteEntry(path) {
    const fullPath = `${PROJECT_ROOT}/${path}`;

    // Cek tipe entry-nya SECARA EKSPLISIT dulu (file atau folder),
    // jangan nebak lewat try/catch, karena deleteFile kadang "sukses"
    // diam-diam walau target sebenarnya folder.
    const info = await Filesystem.stat({ path: fullPath, directory: Directory.Documents });

    if (info.type === "directory") {
      await Filesystem.rmdir({
        path: fullPath,
        directory: Directory.Documents,
        recursive: true,
      });
    } else {
      await Filesystem.deleteFile({ path: fullPath, directory: Directory.Documents });
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
