package xyz.ahmadhosting.pawnstudio;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Environment;
import android.provider.DocumentsContract;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// FIX: copy sekarang byte-per-byte (InputStream -> FileOutputStream), bukan
// BufferedReader/FileWriter mode teks. Ini menghilangkan kebutuhan nebak
// binary/teks sepenuhnya, jadi semua jenis file (source, gambar, font, dll)
// ke-copy dengan benar tanpa risiko corrupt atau ke-skip salah deteksi.
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    // FIX: dinaikin dari 2MB -> 50MB supaya asset project gak keskip diam-diam.
    private static final long MAX_FILE_SIZE = 50L * 1024 * 1024;

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
                String rootDocId = DocumentsContract.getTreeDocumentId(treeUri);
                File storageRoot = getStorageRootDir();

                int[] counters = { 0, 0 }; // [written, skipped]
                java.util.List<String> skippedNames = new java.util.ArrayList<>();
                walkAndWriteDirect(treeUri, rootDocId, "", storageRoot, counters, skippedNames);

                DocumentFile rootDf = DocumentFile.fromTreeUri(getContext(), treeUri);
                String folderName = (rootDf != null && rootDf.getName() != null) ? rootDf.getName() : "folder";

                com.getcapacitor.JSArray skippedArr = new com.getcapacitor.JSArray();
                for (String s : skippedNames) skippedArr.put(s);

                JSObject ret = new JSObject();
                ret.put("count", counters[0]);
                ret.put("skipped", counters[1]);
                ret.put("skippedNames", skippedArr);
                ret.put("folderName", folderName);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Gagal membaca folder: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            }
        });
    }

    private void walkAndWriteDirect(Uri treeUri, String parentDocId, String relPath, File destRoot, int[] counters, java.util.List<String> skippedNames) {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId);

        Cursor cursor = null;
        try {
            cursor = getContext().getContentResolver().query(
                    childrenUri,
                    new String[] {
                            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                            DocumentsContract.Document.COLUMN_MIME_TYPE,
                            DocumentsContract.Document.COLUMN_SIZE
                    },
                    null, null, null
            );

            if (cursor == null) return;

            while (cursor.moveToNext()) {
                String docId = cursor.getString(0);
                String name = cursor.getString(1);
                String mimeType = cursor.getString(2);
                long size = cursor.getLong(3);

                if (name == null || docId == null) continue;

                String childRelPath = relPath.isEmpty() ? name : relPath + "/" + name;
                boolean isDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(mimeType);

                if (isDir) {
                    File destSubDir = new File(destRoot, childRelPath);
                    if (!destSubDir.exists()) {
                        destSubDir.mkdirs();
                    }
                    walkAndWriteDirect(treeUri, docId, childRelPath, destRoot, counters, skippedNames);
                } else {
                    if (size > MAX_FILE_SIZE) {
                        counters[1]++;
                        skippedNames.add(childRelPath + " (terlalu besar)");
                        continue;
                    }

                    Uri childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);

                    boolean success = copyFileBytes(childUri, destRoot, childRelPath);
                    if (success) {
                        counters[0]++;
                    } else {
                        counters[1]++;
                        skippedNames.add(childRelPath + " (gagal tulis)");
                    }
                }
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

    // FIX: copy mentah byte-per-byte, aman buat teks maupun binary, tanpa
    // perlu deteksi jenis file sama sekali.
    private boolean copyFileBytes(Uri sourceUri, File destRoot, String relPath) {
        File destFile = new File(destRoot, relPath);
        File parent = destFile.getParentFile();
        if (parent != null && !parent.exists()) {
            parent.mkdirs();
        }

        try (InputStream is = getContext().getContentResolver().openInputStream(sourceUri);
             FileOutputStream os = new FileOutputStream(destFile, false)) {

            if (is == null) return false;

            byte[] buffer = new byte[8192];
            int read;
            while ((read = is.read(buffer)) != -1) {
                os.write(buffer, 0, read);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
