package xyz.ahmadhosting.pawnstudio;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileWriter;
import java.io.FileReader;
import java.io.BufferedReader;

// Plugin storage NATIVE, pakai java.io.File langsung, TIDAK lewat
// @capacitor/filesystem sama sekali. Ini buat ngetes/nyingkirin
// kemungkinan bug di plugin Capacitor Filesystem resmi.
@CapacitorPlugin(name = "NativeStorage")
public class NativeStoragePlugin extends Plugin {

    private File getRootDir() {
        return WorkspaceManager.getActiveRoot(getContext());
    }

    @PluginMethod
    public void init(PluginCall call) {
        getRootDir();
        call.resolve();
    }

    // Batas jumlah entri per folder yang dikirim ke UI. Folder server SA-MP
    // bisa punya ribuan file (models, scriptfiles, dst); tanpa batas, HP
    // low-end bisa kehabisan memori.
    private static final int MAX_ENTRIES_PER_DIR = 3000;

    // Daftar isi ROOT saja (1 level). Subfolder dikirim sebagai node "lazy"
    // dan baru dibuka lewat listDir() saat user mengetuknya - seperti VSCode.
    @PluginMethod
    public void listTree(PluginCall call) {
        try {
            call.resolve(buildShallowNode(getRootDir(), ""));
        } catch (Throwable t) {
            call.reject("Gagal membaca folder project: " + t.getMessage());
        }
    }

    // Daftar isi SATU folder (1 level), path relatif terhadap root project.
    @PluginMethod
    public void listDir(PluginCall call) {
        String path = call.getString("path", "");
        try {
            File dir = path.isEmpty() ? getRootDir() : new File(getRootDir(), path);
            call.resolve(buildShallowNode(dir, path));
        } catch (Throwable t) {
            call.reject("Gagal membaca folder: " + t.getMessage());
        }
    }

    private JSObject buildShallowNode(File dir, String relPath) {
        JSObject node = new JSObject();
        node.put("type", "folder");
        node.put("name", relPath.isEmpty() ? "root" : new File(relPath).getName());
        node.put("path", relPath);

        JSArray children = new JSArray();
        File[] files = dir.listFiles();
        int count = 0;
        if (files != null) {
            for (File f : files) {
                if (count >= MAX_ENTRIES_PER_DIR) {
                    node.put("truncated", true);
                    break;
                }
                count++;

                String childRelPath = relPath.isEmpty() ? f.getName() : relPath + "/" + f.getName();
                JSObject child = new JSObject();
                child.put("name", f.getName());
                child.put("path", childRelPath);
                if (f.isDirectory()) {
                    child.put("type", "folder");
                    child.put("lazy", true);
                    child.put("children", new JSArray());
                } else {
                    child.put("type", "file");
                }
                children.put(child);
            }
        }
        node.put("children", children);
        return node;
    }

    @PluginMethod
    public void readFile(PluginCall call) {
        String path = call.getString("path");
        File file = new File(getRootDir(), path);

        try {
            BufferedReader reader = new BufferedReader(new FileReader(file));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();

            JSObject ret = new JSObject();
            ret.put("data", sb.toString());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal baca file: " + e.getMessage());
        }
    }

    // Baca file sebagai base64 (untuk gambar di preview HTML). Dibatasi 4 MB dan hanya di dalam workspace.
    @PluginMethod
    public void readFileBase64(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("path kosong");
            return;
        }
        try {
            File root = new File(getRootDir().toString());
            File file = new File(getRootDir(), path);
            if (!file.getCanonicalPath().startsWith(root.getCanonicalPath() + File.separator)) {
                call.reject("Path di luar workspace");
                return;
            }
            if (file.length() > 4L * 1024 * 1024) {
                call.reject("File lebih dari 4 MB");
                return;
            }
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream((int) file.length());
            try (java.io.FileInputStream in = new java.io.FileInputStream(file)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) bos.write(buf, 0, n);
            }
            JSObject ret = new JSObject();
            ret.put("data", android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP));
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal baca file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String path = call.getString("path");
        String content = call.getString("content");
        File file = new File(getRootDir(), path);

        try {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            FileWriter writer = new FileWriter(file, false);
            writer.write(content);
            writer.close();
            call.resolve();
        } catch (Exception e) {
            call.reject("Gagal tulis file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void createFolder(PluginCall call) {
        String path = call.getString("path");
        File dir = new File(getRootDir(), path);
        boolean success = dir.mkdirs();
        JSObject ret = new JSObject();
        ret.put("success", success || dir.exists());
        call.resolve(ret);
    }

    private boolean deleteRecursive(File file) {
        if (file.isDirectory()) {
            File[] children = file.listFiles();
            if (children != null) {
                for (File child : children) {
                    deleteRecursive(child);
                }
            }
        }
        return file.delete();
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String path = call.getString("path");
        File target = new File(getRootDir(), path);
        boolean success = deleteRecursive(target);

        JSObject ret = new JSObject();
        ret.put("success", success);
        ret.put("stillExists", target.exists());
        call.resolve(ret);
    }

    @PluginMethod
    public void renameEntry(PluginCall call) {
        String path = call.getString("path");
        String newName = call.getString("newName");
        File oldFile = new File(getRootDir(), path);
        File newFile = new File(oldFile.getParentFile(), newName);

        boolean success = oldFile.renameTo(newFile);
        if (success) {
            String parentPath = path.contains("/") ? path.substring(0, path.lastIndexOf("/")) : "";
            String newPath = parentPath.isEmpty() ? newName : parentPath + "/" + newName;
            JSObject ret = new JSObject();
            ret.put("newPath", newPath);
            call.resolve(ret);
        } else {
            call.reject("Gagal rename file/folder");
        }
    }
}
