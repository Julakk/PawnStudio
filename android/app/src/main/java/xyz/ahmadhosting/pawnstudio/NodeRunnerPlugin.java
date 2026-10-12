package xyz.ahmadhosting.pawnstudio;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Jalanin file Node.js dan perintah npm di folder project aktif. Output dikirim
// live lewat event "output", dan event "exit" waktu proses selesai / dihentikan.
// Prosesnya dipegang NodeSession + NodeKeepAliveService, jadi tetap jalan di latar belakang.
@CapacitorPlugin(name = "NodeRunner")
public class NodeRunnerPlugin extends Plugin {

    private static final String EXEC_NAME = "libnodeexec.so";
    private static final String LIB_NAME = "libnode.so";
    private static final String NPM_ASSET = "node/npm.zip";

    private static final Set<String> NPM_CMDS = new HashSet<>(Arrays.asList(
            "install", "i", "add", "uninstall", "remove", "rm", "update", "ls", "list", "init"));
    private static final Set<String> NPM_PKG_CMDS = new HashSet<>(Arrays.asList(
            "install", "i", "add", "uninstall", "remove", "rm", "update"));
    private static final Set<String> NPM_FLAGS = new HashSet<>(Arrays.asList(
            "--save-dev", "-D", "--save", "--no-save", "--save-exact", "-E",
            "-y", "--yes", "--depth=0", "--legacy-peer-deps"));
    // Nama paket registry npm (opsional @scope/ dan @versi/tag). Tanpa URL, path, atau flag.
    private static final Pattern PKG_SPEC = Pattern.compile(
            "^(@[a-z0-9][a-z0-9._-]*/)?[a-z0-9][a-z0-9._-]*(@[A-Za-z0-9._^~<>=*-]+)?$");

    private final NodeSession.Listener sessionListener = new NodeSession.Listener() {
        @Override
        public void onOutput(String text) {
            emit(text);
        }

        @Override
        public void onExit(int exitCode, boolean stopped, long durationMs) {
            JSObject ex = new JSObject();
            ex.put("exitCode", exitCode);
            ex.put("stopped", stopped);
            ex.put("durationMs", durationMs);
            notifyListeners("exit", ex);
        }
    };

    @Override
    public void load() {
        NodeSession.setListener(sessionListener);
    }

    private String nativeLibDir() {
        return getContext().getApplicationInfo().nativeLibraryDir;
    }

    private boolean runtimeAvailable() {
        return new File(nativeLibDir(), EXEC_NAME).exists()
                && new File(nativeLibDir(), LIB_NAME).exists();
    }

    private boolean npmAvailable() {
        try {
            InputStream in = getContext().getAssets().open(NPM_ASSET);
            in.close();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean busy() {
        return NodeSession.isRunning();
    }

    private void emit(String text) {
        JSObject o = new JSObject();
        o.put("text", text);
        notifyListeners("output", o);
    }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", runtimeAvailable());
        r.put("npm", npmAvailable());
        boolean running = busy();
        r.put("running", running);
        // UI yang dibuka lagi: kirim log yang tersimpan, plus hasil proses yang selesai selagi app ditutup.
        boolean away = !running && NodeSession.consumeAway();
        if (running || away || call.getBoolean("withLog", false)) r.put("log", NodeSession.snapshotLog());
        long[] last = NodeSession.lastExit();
        if (!running && last != null) {
            r.put("exitCode", (int) last[0]);
            r.put("stopped", last[1] == 1);
            r.put("durationMs", last[2]);
        }
        r.put("finished", away);
        call.resolve(r);
    }

    @PluginMethod
    public void run(PluginCall call) {
        String rel = call.getString("path", "");
        if (rel == null || rel.isEmpty()) {
            call.reject("Parameter 'path' wajib diisi");
            return;
        }
        if (busy()) {
            call.reject("Masih ada proses Node.js yang berjalan. Hentikan dulu.");
            return;
        }
        if (!runtimeAvailable()) {
            call.reject("Runtime Node.js tidak ada di APK ini (APK dibuild tanpa libnode.so).");
            return;
        }

        try {
            File root = WorkspaceManager.getActiveRoot(getContext()).getCanonicalFile();
            File script = new File(root, rel).getCanonicalFile();
            if (!script.getPath().startsWith(root.getPath() + File.separator)) {
                call.reject("Path di luar folder project ditolak.");
                return;
            }
            if (!script.isFile()) {
                call.reject("File tidak ditemukan: " + rel);
                return;
            }

            List<String> cmd = new ArrayList<>();
            cmd.add(new File(nativeLibDir(), EXEC_NAME).getAbsolutePath());
            File pre = ensurePreload();
            if (pre != null) {
                cmd.add("-r");
                cmd.add(pre.getAbsolutePath());
            }
            cmd.add(script.getAbsolutePath());
            launch(call, cmd, root, null);
        } catch (Exception e) {
            call.reject("Gagal menjalankan Node.js: " + e.getMessage());
        }
    }

    // Jalanin npm (JavaScript murni) lewat runtime Node yang sama. Hanya perintah
    // dan argumen yang diizinkan; script lifecycle dimatikan (Android tidak punya /bin/sh).
    @PluginMethod
    public void npm(PluginCall call) {
        JSArray arr = call.getArray("args");
        if (arr == null || arr.length() == 0) {
            call.reject("Parameter 'args' wajib diisi");
            return;
        }
        List<String> args = new ArrayList<>();
        try {
            for (int i = 0; i < arr.length(); i++) args.add(arr.getString(i));
        } catch (Exception e) {
            call.reject("Argumen npm tidak valid");
            return;
        }

        String sub = args.get(0);
        if (!NPM_CMDS.contains(sub)) {
            call.reject("Perintah npm tidak didukung: " + sub);
            return;
        }
        for (int i = 1; i < args.size(); i++) {
            String a = args.get(i);
            boolean ok = NPM_FLAGS.contains(a) || (NPM_PKG_CMDS.contains(sub) && PKG_SPEC.matcher(a).matches());
            if (!ok) {
                call.reject("Argumen npm tidak diizinkan: " + a);
                return;
            }
        }
        if ("init".equals(sub) && !args.contains("-y") && !args.contains("--yes")) args.add("-y");

        if (busy()) {
            call.reject("Masih ada proses yang berjalan. Hentikan dulu.");
            return;
        }
        if (!runtimeAvailable()) {
            call.reject("Runtime Node.js tidak ada di APK ini (APK dibuild tanpa libnode.so).");
            return;
        }
        if (!npmAvailable()) {
            call.reject("npm tidak ada di APK ini (APK dibuild tanpa npm.zip).");
            return;
        }

        try {
            File npmDir = ensureNpm();
            File root = WorkspaceManager.getActiveRoot(getContext()).getCanonicalFile();

            // Tanpa package.json, npm naik ke folder induk dan bisa memasang paket di tempat yang salah.
            File pj = new File(root, "package.json");
            if (!pj.exists() && !"init".equals(sub)) {
                try (FileWriter w = new FileWriter(pj)) {
                    w.write("{\n  \"name\": \"" + safeProjectName(root.getName()) + "\",\n  \"version\": \"1.0.0\",\n  \"private\": true\n}\n");
                }
                emit("[package.json belum ada, dibuat otomatis]\n");
            }

            File home = new File(getContext().getFilesDir(), "node-home");
            File cache = new File(getContext().getFilesDir(), "npm-cache");
            if (!cache.exists()) cache.mkdirs();

            Map<String, String> env = new HashMap<>();
            env.put("npm_config_cache", cache.getAbsolutePath());
            env.put("npm_config_userconfig", new File(home, ".npmrc").getAbsolutePath());
            env.put("npm_config_globalconfig", new File(home, ".npmrc-global").getAbsolutePath());
            env.put("npm_config_ignore_scripts", "true");
            env.put("npm_config_bin_links", "false");
            env.put("npm_config_fund", "false");
            env.put("npm_config_audit", "false");
            env.put("npm_config_update_notifier", "false");
            env.put("npm_config_progress", "false");
            env.put("npm_config_color", "false");

            List<String> cmd = new ArrayList<>();
            cmd.add(new File(nativeLibDir(), EXEC_NAME).getAbsolutePath());
            cmd.add(new File(npmDir, "bin/npm-cli.js").getAbsolutePath());
            cmd.addAll(args);
            launch(call, cmd, root, env);
        } catch (Exception e) {
            call.reject("Gagal menjalankan npm: " + e.getMessage());
        }
    }

    // Salin shim diagnostik (assets/nodeshim/preload.js) ke folder kerja Node.
    private File ensurePreload() {
        try (InputStream in = getContext().getAssets().open("nodeshim/preload.js")) {
            File home = new File(getContext().getFilesDir(), "node-home");
            if (!home.exists()) home.mkdirs();
            File out = new File(home, "ps-preload.js");
            try (FileOutputStream fos = new FileOutputStream(out)) {
                byte[] buf = new byte[4096];
                int n;
                while ((n = in.read(buf)) > 0) fos.write(buf, 0, n);
            }
            return out;
        } catch (Exception e) {
            return null;
        }
    }

    private String safeProjectName(String raw) {
        String n = raw == null ? "" : raw.toLowerCase().replaceAll("[^a-z0-9._-]", "-").replaceAll("^[._-]+", "");
        return n.isEmpty() ? "project" : n;
    }

    // Ekstrak npm dari assets sekali saja (dan ulang setiap APK diperbarui).
    private File ensureNpm() throws Exception {
        File dir = new File(getContext().getFilesDir(), "node-npm");
        File marker = new File(dir, ".ps-ok");
        String stamp = String.valueOf(getContext().getPackageManager()
                .getPackageInfo(getContext().getPackageName(), 0).lastUpdateTime);

        if (marker.exists()) {
            java.io.BufferedReader br = new java.io.BufferedReader(new java.io.FileReader(marker));
            String saved = br.readLine();
            br.close();
            if (stamp.equals(saved) && new File(dir, "bin/npm-cli.js").exists()) return dir;
        }

        emit("[Menyiapkan npm (sekali saja, beberapa detik)...]\n");
        deleteRecursive(dir);
        dir.mkdirs();
        String base = dir.getCanonicalPath() + File.separator;

        try (InputStream in = getContext().getAssets().open(NPM_ASSET);
             ZipInputStream zis = new ZipInputStream(new BufferedInputStream(in))) {
            byte[] buf = new byte[16384];
            ZipEntry e;
            while ((e = zis.getNextEntry()) != null) {
                File out = new File(dir, e.getName());
                if (!out.getCanonicalPath().startsWith(base)) {
                    throw new SecurityException("Entri zip tidak valid: " + e.getName());
                }
                if (e.isDirectory()) {
                    out.mkdirs();
                    continue;
                }
                File parent = out.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                try (FileOutputStream fos = new FileOutputStream(out)) {
                    int n;
                    while ((n = zis.read(buf)) > 0) fos.write(buf, 0, n);
                }
            }
        }
        try (FileWriter w = new FileWriter(marker)) {
            w.write(stamp + "\n");
        }
        return dir;
    }

    private void deleteRecursive(File f) {
        if (f == null || !f.exists()) return;
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        f.delete();
    }

    // Satu slot proses: Node script atau npm. Output live lewat "output", selesai lewat "exit".
    private void launch(PluginCall call, List<String> cmd, File cwd, Map<String, String> extraEnv) throws Exception {
        File home = new File(getContext().getFilesDir(), "node-home");
        File tmp = new File(getContext().getCacheDir(), "node-tmp");
        if (!home.exists()) home.mkdirs();
        if (!tmp.exists()) tmp.mkdirs();

        Map<String, String> env = new HashMap<>();
        env.put("LD_LIBRARY_PATH", nativeLibDir());
        // PS_PRELOAD_NODE: jadikan libnode.so global supaya addon native (.node) bisa menemukan simbol napi_*
        File psLibNode = new File(nativeLibDir(), "libnode.so");
        if (psLibNode.exists()) env.put("LD_PRELOAD", psLibNode.getAbsolutePath());
        env.put("HOME", home.getAbsolutePath());
        env.put("TMPDIR", tmp.getAbsolutePath());
        if (extraEnv != null) env.putAll(extraEnv);
        // Android 13+: izin notifikasi supaya notifikasi "Node.js berjalan" kelihatan.
        requestNotifPermissionIfNeeded();

        NodeSession.setListener(sessionListener);
        NodeSession.start(getContext(), cmd, cwd, env);

        JSObject r = new JSObject();
        r.put("started", true);
        call.resolve(r);
    }

    private void requestNotifPermissionIfNeeded() {
        try {
            if (Build.VERSION.SDK_INT >= 33 && getActivity() != null
                    && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(getActivity(),
                        new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4101);
            }
        } catch (Exception ignored) {}
    }

    // Buka dialog sistem "abaikan optimasi baterai" supaya OEM (Samsung, Xiaomi, dll) tidak membunuh service.
    @PluginMethod
    public void batterySettings(PluginCall call) {
        JSObject r = new JSObject();
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(android.content.Context.POWER_SERVICE);
            String pkg = getContext().getPackageName();
            boolean ignoring = pm != null && Build.VERSION.SDK_INT >= 23 && pm.isIgnoringBatteryOptimizations(pkg);
            r.put("ignoring", ignoring);
            if (!ignoring) {
                Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + pkg));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
            }
        } catch (Exception e) {
            r.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        JSObject r = new JSObject();
        r.put("stopped", NodeSession.stop());
        call.resolve(r);
    }

    // Activity ditutup: lepas listener saja. Proses Node sengaja TIDAK dibunuh,
    // dia dijaga NodeKeepAliveService dan bisa dihentikan dari tombol Stop di notifikasi.
    @Override
    protected void handleOnDestroy() {
        NodeSession.clearListener(sessionListener);
    }
}
