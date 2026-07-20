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

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

// PENTING: plugin ini nulis file LANGSUNG SATU-SATU ke storage (bukan numpuk
// di memory), dan pakai ContentResolver.query() + cursor secara langsung
// buat listing isi folder (BUKAN DocumentFile.listFiles(), yang ternyata
// kadang ngasih daftar folder yang gak lengkap buat folder besar/banyak isi).
@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private static final long MAX_FILE_SIZE = 2 * 1024 * 1024;

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
                walkAndWriteDirect(treeUri, rootDocId, "", storageRoot, counters);

                DocumentFile rootDf = DocumentFile.fromTreeUri(getContext(), treeUri);
                String folderName = (rootDf != null && rootDf.getName() != null) ? rootDf.getName() : "folder";

                JSObject ret = new JSObject();
                ret.put("count", counters[0]);
                ret.put("skipped", counters[1]);
                ret.put("folderName", folderName);
                call.resolve(ret);
            } catch (Throwable e) {
                call.reject("Gagal membaca folder: " + e.getClass().getSimpleName() + " - " + e.getMessage());
            }
        });
    }

    // Enumerasi isi folder pakai ContentResolver.query() + cursor LANGSUNG,
    // loop sampai cursor benar-benar habis (moveToNext() sampai false).
    // Ini lebih reliable dibanding DocumentFile.listFiles() yang ternyata
    // bisa truncated buat folder dengan banyak isi.
    private void walkAndWriteDirect(Uri treeUri, String parentDocId, String relPath, File destRoot, int[] counters) {
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
                    walkAndWriteDirect(treeUri, docId, childRelPath, destRoot, counters);
                } else {
                    if (size > MAX_FILE_SIZE) {
                        counters[1]++;
                        continue;
                    }

                    Uri childUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);

                    String lowerName = name.toLowerCase();
                    boolean isAlwaysTextExt = lowerName.endsWith(".pwn") || lowerName.endsWith(".inc");
                    if (!isAlwaysTextExt && isLikelyBinary(childUri)) {
                        counters[1]++;
                        continue;
                    }

                    boolean success = copyFileDirect(childUri, destRoot, childRelPath);
                    if (success) {
                        counters[0]++;
                    } else {
                        counters[1]++;
                    }
                }
            }
        } finally {
            if (cursor != null) {
                cursor.close();
            }
        }
    }

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
