package xyz.ahmadhosting.pawnstudio;

import android.os.Environment;

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
        File docsDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        File dir = new File(docsDir, "PawnStudio");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    @PluginMethod
    public void init(PluginCall call) {
        getRootDir();
        call.resolve();
    }

    @PluginMethod
    public void listTree(PluginCall call) {
        File root = getRootDir();
        JSObject tree = buildTree(root, "");
        call.resolve(tree);
    }

    private JSObject buildTree(File dir, String relPath) {
        JSObject node = new JSObject();
        node.put("type", "folder");
        node.put("name", relPath.isEmpty() ? "root" : new File(relPath).getName());
        node.put("path", relPath);

        JSArray children = new JSArray();
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) {
                String childRelPath = relPath.isEmpty() ? f.getName() : relPath + "/" + f.getName();
                if (f.isDirectory()) {
                    children.put(buildTree(f, childRelPath));
                } else {
                    JSObject fileNode = new JSObject();
                    fileNode.put("type", "file");
                    fileNode.put("name", f.getName());
                    fileNode.put("path", childRelPath);
                    children.put(fileNode);
                }
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
