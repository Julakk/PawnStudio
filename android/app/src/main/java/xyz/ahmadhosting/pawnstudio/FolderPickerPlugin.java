package xyz.ahmadhosting.pawnstudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// PENTING: plugin ini SEKARANG NULIS FILE LANGSUNG SATU-SATU ke storage,
// bukan numpuk semua isi file di memory dulu baru dikirim borongan ke JS.
// Ini nyegah proses di-kill paksa sama Android gara-gara kehabisan memory
// pas folder-nya gede (banyak file/subfolder).
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024;

    // Path root ini HARUS SAMA PERSIS dengan yang dipakai NativeStoragePlugin,
    // biar file yang ditulis di sini langsung kebaca di Explorer.
    private File getStorageRootDir() {
        File docsDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        File dir = new File(docsDir, "PawnStudio");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

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

        try {
            getContext().getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );
        } catch (Exception e) {
            call.reject("Gagal mendapatkan izin folder: " + e.getMessage());
            return;
        }

        executor.execute(() -> {
            try {
                DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
                File storageRoot = getStorageRootDir();

                int[] counters = { 0, 0 }; // [written, skipped]
                walkAndWriteDirect(root, "", storageRoot, counters);

                JSObject ret = new JSObject();
                ret.put("count", counters[0]);
                ret.put("skipped", counters[1]);
                ret.put("folderName", root != null ? root.getName() : "");
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Gagal membaca folder: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            }
        });
    }

    // Jalan-jalan di folder sumber (SAF), dan LANGSUNG nulis tiap file yang
    // ketemu ke storage tujuan. Gak pernah nyimpen lebih dari 1 file di
    // memory dalam satu waktu.
    private void walkAndWriteDirect(DocumentFile sourceDir, String relPath, File destRoot, int[] counters) {
        if (sourceDir == null || sourceDir.listFiles() == null) return;

        for (DocumentFile child : sourceDir.listFiles()) {
            if (child.getName() == null) continue;
            String childRelPath = relPath.isEmpty() ? child.getName() : relPath + "/" + child.getName();

            if (child.isDirectory()) {
                walkAndWriteDirect(child, childRelPath, destRoot, counters);
            } else {
                if (child.length() > MAX_FILE_SIZE) {
                    counters[1]++;
                    continue;
                }
                if (isLikelyBinary(child.getUri())) {
                    counters[1]++;
                    continue;
                }

                boolean success = copyFileDirect(child.getUri(), destRoot, childRelPath);
                if (success) {
                    counters[0]++;
                } else {
                    counters[1]++;
                }
            }
        }
    }

    // Baca 1 file dari SAF, langsung tulis ke tujuan, tanpa nyimpen isinya
    // di variabel String/JSObject apapun.
    private boolean copyFileDirect(Uri sourceUri, File destRoot, String relPath) {
        File destFile = new File(destRoot, relPath);
        File parent = destFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        try (InputStream is = getContext().getContentResolver().openInputStream(sourceUri);
             BufferedReader reader = new BufferedReader(new InputStreamReader(is));
             FileWriter writer = new FileWriter(destFile, false)) {

            char[] buffer = new char[4096];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                writer.write(buffer, 0, read);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean isLikelyBinary(Uri uri) {
        try (InputStream is = getContext().getContentResolver().openInputStream(uri)) {
            byte[] buffer = new byte[512];
            int read = is.read(buffer);
            for (int i = 0; i < read; i++) {
                if (buffer[i] == 0) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return true;
        }
    }
}
