package xyz.ahmadhosting.pawnstudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    // Proses folder di background thread, JANGAN di UI thread
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    // Batas ukuran file yang boleh dibaca sebagai teks (2 MB)
    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024;

    // Hanya ekstensi ini yang dianggap source code / teks
    // Sesuaikan dengan kebutuhan PawnStudio (tambah/kurangi sesuai jenis file yang perlu dibuka)
    private static final List<String> ALLOWED_EXTENSIONS = Arrays.asList(
            ".pwn", ".inc", ".txt", ".json", ".md", ".cfg", ".ini", ".xml"
    );

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Pemilihan folder dibatalkan");
            return;
        }

        Uri treeUri = result.getData().getData();

        // Ambil izin akses persist di UI thread dulu (operasi ringan, aman di sini)
        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception e) {
            call.reject("Gagal mendapatkan izin folder: " + e.getMessage());
            return;
        }

        // Proses berat (walk + baca isi file) dipindah ke background thread
        // supaya tidak nge-freeze UI saat folder besar / berisi file binary besar
        executor.execute(() -> {
            try {
                DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
                JSArray filesArray = new JSArray();
                walkDocumentTree(root, "", filesArray);

                JSObject ret = new JSObject();
                ret.put("files", filesArray);
                ret.put("folderName", root != null ? root.getName() : "");

                // call.resolve() aman dipanggil dari background thread di Capacitor,
                // tapi kalau ingin lebih aman bisa dibungkus getActivity().runOnUiThread(...)
                call.resolve(ret);
            } catch (Exception e) {
                call.reject("Gagal membaca folder: " + e.getMessage());
            }
        });
    }

    private void walkDocumentTree(DocumentFile dir, String relPath, JSArray filesArray) {
        if (dir == null || dir.listFiles() == null) return;

        for (DocumentFile child : dir.listFiles()) {
            if (child.getName() == null) continue;
            String childRelPath = relPath.isEmpty() ? child.getName() : relPath + "/" + child.getName();

            if (child.isDirectory()) {
                walkDocumentTree(child, childRelPath, filesArray);
            } else {
                // Semua jenis file diizinkan (tanpa filter ekstensi).
                // CATATAN: file binary tetap dibaca sebagai teks, jadi bisa
                // corrupt kalau dipakai lagi sebagai file binary asli.
                // Skip file yang kegedean untuk dibaca sebagai teks
                if (child.length() > MAX_FILE_SIZE) {
                    continue;
                }

                String content = readDocumentFileAsString(child.getUri());
                JSObject fileObj = new JSObject();
                fileObj.put("path", childRelPath);
                fileObj.put("content", content);
                filesArray.put(fileObj);
            }
        }
    }

    private boolean isAllowedFile(String name) {
        String lower = name.toLowerCase();
        for (String ext : ALLOWED_EXTENSIONS) {
            if (lower.endsWith(ext)) return true;
        }
        return false;
    }

    private String readDocumentFileAsString(Uri uri) {
        try (InputStream is = getContext().getContentResolver().openInputStream(uri);
             BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
