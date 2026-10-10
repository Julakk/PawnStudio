package xyz.ahmadhosting.pawnstudio;

import android.util.Log;
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
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

// Jalanin file Node.js dan perintah npm di folder project aktif. Output dikirim
// live lewat event "output", dan event "exit" waktu proses selesai / dihentikan.
@CapacitorPlugin(name = "NodeRunner")
public class NodeRunnerPlugin extends Plugin {

    private static final String TAG = "NodeRunner";
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

    private final Object lock = new Object();
    private Process current = null;
    private volatile boolean stopRequested = false;

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
        synchronized (lock) {
            return current != null;
        }
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
        r.put("running", busy());
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

        ProcessBuilder pb = new ProcessBuilder(cmd);
        Map<String, String> env = pb.environment();
        env.put("LD_LIBRARY_PATH", nativeLibDir());
        env.put("HOME", home.getAbsolutePath());
        env.put("TMPDIR", tmp.getAbsolutePath());
        if (extraEnv != null) env.putAll(extraEnv);
        pb.directory(cwd);
        // stdout + stderr jadi satu pipa (hindari deadlock, sama seperti compiler PAWN)
        pb.redirectErrorStream(true);

        synchronized (lock) {
            if (current != null) throw new IllegalStateException("Masih ada proses yang berjalan.");
        }
        final Process p = pb.start();
        try { p.getOutputStream().close(); } catch (Exception ignored) {}
        synchronized (lock) {
            current = p;
        }
        stopRequested = false;
        final long t0 = System.currentTimeMillis();

        Thread t = new Thread(() -> {
            int code = -1;
            try {
                Reader reader = new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8);
                char[] buf = new char[2048];
                int n;
                while ((n = reader.read(buf)) != -1) {
                    emit(new String(buf, 0, n));
                }
                code = p.waitFor();
            } catch (Exception e) {
                Log.w(TAG, "baca output gagal: " + e.getMessage());
            } finally {
                synchronized (lock) {
                    if (current == p) current = null;
                }
                JSObject ex = new JSObject();
                ex.put("exitCode", code);
                ex.put("stopped", stopRequested);
                ex.put("durationMs", System.currentTimeMillis() - t0);
                notifyListeners("exit", ex);
            }
        }, "node-runner");
        t.setDaemon(true);
        t.start();

        JSObject r = new JSObject();
        r.put("started", true);
        call.resolve(r);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        final Process p;
        synchronized (lock) {
            p = current;
        }
        JSObject r = new JSObject();
        if (p == null) {
            r.put("stopped", false);
            call.resolve(r);
            return;
        }
        stopRequested = true;
        p.destroy();
        new Thread(() -> {
            try {
                if (!p.waitFor(1500, TimeUnit.MILLISECONDS)) p.destroyForcibly();
            } catch (InterruptedException ignored) {}
        }).start();
        r.put("stopped", true);
        call.resolve(r);
    }

    @Override
    protected void handleOnDestroy() {
        Process p;
        synchronized (lock) {
            p = current;
        }
        if (p != null) p.destroyForcibly();
    }
}
