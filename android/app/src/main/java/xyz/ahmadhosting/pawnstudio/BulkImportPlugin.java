package xyz.ahmadhosting.pawnstudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;

// Plugin buat upload folder gede/kompleks. Bedanya sama FolderPickerPlugin:
// di sini SAF (folder picker dialog) CUMA dipakai buat user milih folder mana
// (UX bagus, native), tapi begitu dapet lokasinya, kita convert ke path biasa
// (/storage/emulated/0/...) dan baca/tulis pakai java.io.File MURNI - skip
// total DocumentFile/ContentResolver yang ternyata gak reliable buat folder
// gede/banyak isi. Butuh izin "All Files Access" (MANAGE_EXTERNAL_STORAGE).
@CapacitorPlugin(name = "BulkImport")
public class BulkImportPlugin extends Plugin {

    private static final long MAX_FILE_SIZE = 5L * 1024 * 1024; // 5MB per file

    @PluginMethod
    public void checkAllFilesAccess(PluginCall call) {
        boolean granted;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            granted = Environment.isExternalStorageManager();
        } else {
            granted = true; // Android lama gak butuh izin khusus ini
        }
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestAllFilesAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
            } catch (Exception e) {
                try {
                    getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION));
                } catch (Exception e2) {
                    call.reject("Gagal buka halaman izin: " + e2.getMessage());
                    return;
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void pickFolderAndImport(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "bulkImportResult");
    }

    @ActivityCallback
    private void bulkImportResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Pemilihan folder dibatalkan");
            return;
        }

        Uri treeUri = result.getData().getData();
        String plainPath = uriToPlainPath(treeUri);

        if (plainPath == null) {
            call.reject("Gagal konversi ke path biasa. Coba pilih folder yang ada di penyimpanan utama HP (bukan SD card eksternal).");
            return;
        }

        File sourceDir = new File(plainPath);
        if (!sourceDir.exists() || !sourceDir.isDirectory()) {
            call.reject("Path hasil konversi tidak valid: " + plainPath);
            return;
        }

        File destRoot = getStorageRootDir();

        int[] counters = { 0, 0 };
        try {
            walkAndCopyPlain(sourceDir, "", destRoot, counters);

            JSObject ret = new JSObject();
            ret.put("count", counters[0]);
            ret.put("skipped", counters[1]);
            ret.put("folderName", sourceDir.getName());
            call.resolve(ret);
        } catch (Throwable e) {
            call.reject("Gagal copy folder: " + e.getClass().getSimpleName() + " - " + e.getMessage());
        }
    }

    // Convert SAF tree URI ke path filesystem biasa, PAKAI TRIK yang sama
    // kayak referensi: baca document ID, kalau "primary:xxx" berarti itu
    // storage utama HP, tinggal gabung sama /storage/emulated/0/
    private String uriToPlainPath(Uri treeUri) {
        try {
            String docId = DocumentsContract.getTreeDocumentId(treeUri);
            if (docId.startsWith("primary:")) {
                String relative = docId.substring("primary:".length());
                return Environment.getExternalStorageDirectory().getAbsolutePath() + "/" + relative;
            }
            return null; // SD card eksternal / storage lain, gak didukung versi ini
        } catch (Exception e) {
            return null;
        }
    }

    private File getStorageRootDir() {
        File docsDir = getContext().getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        File dir = new File(docsDir, "PawnStudio");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    // Rekursif copy pakai java.io.File MURNI, gak ada SAF/DocumentFile sama
    // sekali di sini. Ini API paling dasar & stabil, terbukti gak ada masalah
    // enumerasi kayak yang kita alamin sama SAF sebelumnya.
    private void walkAndCopyPlain(File sourceDir, String relPath, File destRoot, int[] counters) {
        File[] children = sourceDir.listFiles();
        if (children == null) return;

        for (File child : children) {
            String childRelPath = relPath.isEmpty() ? child.getName() : relPath + "/" + child.getName();

            if (child.isDirectory()) {
                File destSubDir = new File(destRoot, childRelPath);
                if (!destSubDir.exists()) destSubDir.mkdirs();
                walkAndCopyPlain(child, childRelPath, destRoot, counters);
            } else {
                if (child.length() > MAX_FILE_SIZE) {
                    counters[1]++;
                    continue;
                }

                File destFile = new File(destRoot, childRelPath);
                File parent = destFile.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();

                // File .pwn/.inc dibaca sebagai teks & backslash di baris #include
                // dinormalisasi ke forward slash (banyak library kayak YSI nulis
                // include gaya Windows). File lain (gambar, database, dll) tetap
                // di-copy mentah byte-per-byte apa adanya.
                String lowerName = child.getName().toLowerCase();
                boolean isPawnSource = lowerName.endsWith(".pwn") || lowerName.endsWith(".inc") || lowerName.endsWith(".p");

                boolean success = isPawnSource
                        ? copyPawnFileNormalized(child, destFile)
                        : copyFileBytes(child, destFile);
                if (success) counters[0]++; else counters[1]++;
            }
        }
    }

    // Copy byte-per-byte, TANPA nebak teks/binary. Semua jenis file
    // (source code, gambar, font, dll) ke-copy dengan benar apa adanya.
    // Khusus file .pwn/.inc: baca sebagai teks, normalisasi backslash jadi
    // forward slash di baris #include (kode YSI/library Windows-style pakai
    // backslash, gak dikenali compiler Linux/Android), baru ditulis.
    private boolean copyPawnFileNormalized(File src, File dst) {
        try {
            java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(new FileInputStream(src), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();

            String normalized = normalizeIncludeSeparators(sb.toString());

            java.io.FileOutputStream fos = new java.io.FileOutputStream(dst);
            fos.write(normalized.getBytes("UTF-8"));
            fos.close();
            return true;
        } catch (Exception e) {
            return copyFileBytes(src, dst); // fallback: kalau gagal baca teks, copy byte biasa aja
        }
    }

    private String normalizeIncludeSeparators(String source) {
        if (source == null) return source;
        java.util.regex.Pattern pattern = java.util.regex.Pattern.compile(
                "(?m)^(\\s*#include\\s*[<\"])([^>\"]*)([>\"])"
        );
        java.util.regex.Matcher matcher = pattern.matcher(source);
        StringBuilder result = new StringBuilder();
        while (matcher.find()) {
            String path = matcher.group(2).replace("\\", "/");
            String replacement = java.util.regex.Matcher.quoteReplacement(
                    matcher.group(1) + path + matcher.group(3)
            );
            matcher.appendReplacement(result, replacement);
        }
        matcher.appendTail(result);
        return result.toString();
    }

    private boolean copyFileBytes(File src, File dst) {
        try (FileInputStream fis = new FileInputStream(src);
             FileOutputStream fos = new FileOutputStream(dst)) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = fis.read(buffer)) != -1) {
                fos.write(buffer, 0, read);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
