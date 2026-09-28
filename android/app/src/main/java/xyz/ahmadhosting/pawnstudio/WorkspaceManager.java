package xyz.ahmadhosting.pawnstudio;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Environment;

import java.io.File;

// ==================================================
// WorkspaceManager
// ==================================================
// Sumber kebenaran TUNGGAL soal "folder project mana yang lagi aktif".
// Dulu tiap plugin (NativeStorage, PawnCompiler, BulkImport) punya
// masing-masing hardcoded root folder ("Documents/PawnStudio"), yang
// artinya app SELALU nyalin file gamemode user ke folder sandbox itu
// dulu sebelum bisa dipake. Proses nyalin itu sumber dari hampir semua
// bug struktur folder (YSI kebongkar, nested folder salah, dll).
//
// Sekarang, mirip konsep "Open Folder" di VSCode: user milih folder
// project ASLI (real path di storage, bukan folder sandbox), dan
// SEMUA plugin baca lokasi itu dari sini. Gak ada proses copy sama
// sekali - app kerja langsung di folder aslinya.
//
// Kalau user belum pernah pilih folder (fresh install), fallback ke
// folder sandbox default lama, biar app tetep kepake tanpa perlu izin
// "All Files Access" dulu.
public class WorkspaceManager {

    private static final String PREFS_NAME = "pawnstudio_workspace";
    private static final String KEY_WORKSPACE_PATH = "workspace_path";
    private static final String KEY_WORKSPACE_NAME = "workspace_name";
    private static final String KEY_LAUNCH_PENDING = "launch_pending";
    private static final String KEY_RECOVERED_FROM = "recovered_from";

    private static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // Folder sandbox default (perilaku lama), dipakai sebelum user pernah
    // "Buka Folder Project" secara eksplisit.
    private static File defaultRootDir(Context ctx) {
        File docsDir = ctx.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        File dir = new File(docsDir, "PawnStudio");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    // Folder project yang lagi aktif dipakai app sekarang.
    public static File getActiveRoot(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String savedPath = p.getString(KEY_WORKSPACE_PATH, null);

        if (savedPath != null) {
            File dir = new File(savedPath);
            if (dir.exists() && dir.isDirectory()) {
                return dir;
            }
            // Folder yang disimpen udah gak valid lagi (misal kehapus/pindah),
            // otomatis balik ke sandbox default biar app gak mati total.
        }
        return defaultRootDir(ctx);
    }

    // Dipanggil pas user berhasil pilih folder lewat "Buka Folder Project".
    public static void setActiveRoot(Context ctx, String plainPath, String displayName) {
        // commit() (sinkron), bukan apply(): flag harus benar-benar tersimpan
        // SEBELUM app mulai baca folder baru, biar kalau app crash saat itu,
        // launch berikutnya tahu dan bisa pulih.
        prefs(ctx).edit()
                .putString(KEY_WORKSPACE_PATH, plainPath)
                .putString(KEY_WORKSPACE_NAME, displayName)
                .putBoolean(KEY_LAUNCH_PENDING, true)
                .commit();
    }

    // ---- Pengaman crash loop ----
    // Kalau membuka sebuah folder project bikin app crash (misal folder
    // terlalu besar), folder itu tersimpan sebagai project aktif dan app
    // crash lagi tiap dibuka. Solusinya: flag "launch_pending" dinyalakan
    // tiap proses baru & saat ganti folder, dan baru dimatikan JS setelah
    // Explorer berhasil tampil. Kalau saat launch flag masih nyala berarti
    // launch sebelumnya crash -> project custom dilepas, balik ke bawaan.
    public static void beginLaunch(Context ctx) {
        SharedPreferences p = prefs(ctx);
        boolean previousCrashed = p.getBoolean(KEY_LAUNCH_PENDING, false);
        SharedPreferences.Editor e = p.edit();
        if (previousCrashed && p.getString(KEY_WORKSPACE_PATH, null) != null) {
            String name = p.getString(KEY_WORKSPACE_NAME, null);
            e.putString(KEY_RECOVERED_FROM, name != null ? name : "folder project");
            e.remove(KEY_WORKSPACE_PATH).remove(KEY_WORKSPACE_NAME);
        }
        e.putBoolean(KEY_LAUNCH_PENDING, true);
        e.commit();
    }

    public static void markLaunchOk(Context ctx) {
        prefs(ctx).edit().putBoolean(KEY_LAUNCH_PENDING, false).commit();
    }

    // Nama folder yang dilepas gara-gara crash (sekali baca, lalu dihapus).
    public static String consumeRecoveredFrom(Context ctx) {
        SharedPreferences p = prefs(ctx);
        String name = p.getString(KEY_RECOVERED_FROM, null);
        if (name != null) p.edit().remove(KEY_RECOVERED_FROM).commit();
        return name;
    }

    // Balikin ke folder sandbox bawaan (buat tombol "Tutup Folder Project").
    public static void resetToDefault(Context ctx) {
        prefs(ctx).edit()
                .remove(KEY_WORKSPACE_PATH)
                .remove(KEY_WORKSPACE_NAME)
                .apply();
    }

    public static boolean isCustomWorkspace(Context ctx) {
        return prefs(ctx).getString(KEY_WORKSPACE_PATH, null) != null;
    }

    // Nama buat ditampilin di UI (breadcrumb/title), mirip nama folder
    // yang keliatan di title bar VSCode pas "Open Folder".
    public static String getDisplayName(Context ctx) {
        SharedPreferences p = prefs(ctx);
        if (p.getString(KEY_WORKSPACE_PATH, null) == null) {
            return "PawnStudio";
        }
        String name = p.getString(KEY_WORKSPACE_NAME, null);
        return name != null ? name : getActiveRoot(ctx).getName();
    }
}
