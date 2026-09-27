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

// ==================================================
// "Buka Folder Project" - mirip "Open Folder" di VSCode.
// ==================================================
// DULU: plugin ini nyalin (copy) seluruh isi folder yang dipilih user ke
// folder sandbox privat app (Documents/PawnStudio). Proses copy itu yang
// jadi sumber hampir semua bug struktur folder - YSI/include library
// kebongkar, ke-skip, ke-corrupt, dll. Dan tiap kali gamemode-nya diedit
// di luar app, user harus re-import ulang.
//
// SEKARANG: plugin ini CUMA minta izin akses folder itu, konversi ke real
// path (/storage/emulated/0/...), dan bilang ke WorkspaceManager "pake
// folder ini sebagai project aktif". TIDAK ADA proses copy sama sekali -
// app baca/tulis/compile LANGSUNG ke folder aslinya. Kalau file diubah
// dari luar app (misal lewat file manager lain / PC), begitu balik ke
// PawnStudio ya langsung keliatan, gak perlu import ulang.
//
// Butuh izin "All Files Access" (MANAGE_EXTERNAL_STORAGE) karena compiler
// native (ProcessBuilder) butuh REAL filesystem path, bukan content:// URI
// dari SAF biasa.
@CapacitorPlugin(name = "BulkImport")
public class BulkImportPlugin extends Plugin {

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

    // Info folder project yang lagi aktif sekarang, buat ditampilin di UI
    // (breadcrumb/judul), mirip title bar VSCode yang nunjukin nama folder
    // yang lagi dibuka.
    @PluginMethod
    public void getWorkspaceInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("isCustom", WorkspaceManager.isCustomWorkspace(getContext()));
        ret.put("name", WorkspaceManager.getDisplayName(getContext()));
        ret.put("path", WorkspaceManager.getActiveRoot(getContext()).getAbsolutePath());
        call.resolve(ret);
    }

    // Balik ke folder sandbox bawaan (mirip "Close Folder" di VSCode).
    @PluginMethod
    public void closeWorkspace(PluginCall call) {
        WorkspaceManager.resetToDefault(getContext());
        JSObject ret = new JSObject();
        ret.put("name", WorkspaceManager.getDisplayName(getContext()));
        ret.put("path", WorkspaceManager.getActiveRoot(getContext()).getAbsolutePath());
        call.resolve(ret);
    }

    @PluginMethod
    public void openWorkspace(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "openWorkspaceResult");
    }

    @ActivityCallback
    private void openWorkspaceResult(PluginCall call, androidx.activity.result.ActivityResult result) {
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

        File chosenDir = new File(plainPath);
        if (!chosenDir.exists() || !chosenDir.isDirectory()) {
            call.reject("Path hasil konversi tidak valid: " + plainPath);
            return;
        }

        String folderName = chosenDir.getName();
        WorkspaceManager.setActiveRoot(getContext(), plainPath, folderName);

        JSObject ret = new JSObject();
        ret.put("name", folderName);
        ret.put("path", plainPath);
        call.resolve(ret);
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
}
