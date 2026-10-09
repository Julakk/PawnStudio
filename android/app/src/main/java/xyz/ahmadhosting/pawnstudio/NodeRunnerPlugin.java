package xyz.ahmadhosting.pawnstudio;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

// Jalanin file Node.js di folder project aktif. Output dikirim live lewat event
// "output", dan event "exit" waktu proses selesai / dihentikan.
@CapacitorPlugin(name = "NodeRunner")
public class NodeRunnerPlugin extends Plugin {

    private static final String TAG = "NodeRunner";
    private static final String EXEC_NAME = "libnodeexec.so";
    private static final String LIB_NAME = "libnode.so";

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

    @PluginMethod
    public void status(PluginCall call) {
        JSObject r = new JSObject();
        r.put("available", runtimeAvailable());
        synchronized (lock) {
            r.put("running", current != null);
        }
        call.resolve(r);
    }

    @PluginMethod
    public void run(PluginCall call) {
        String rel = call.getString("path", "");
        if (rel == null || rel.isEmpty()) {
            call.reject("Parameter 'path' wajib diisi");
            return;
        }
        synchronized (lock) {
            if (current != null) {
                call.reject("Masih ada proses Node.js yang berjalan. Hentikan dulu.");
                return;
            }
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

            File home = new File(getContext().getFilesDir(), "node-home");
            File tmp = new File(getContext().getCacheDir(), "node-tmp");
            if (!home.exists()) home.mkdirs();
            if (!tmp.exists()) tmp.mkdirs();

            List<String> cmd = new ArrayList<>();
            cmd.add(new File(nativeLibDir(), EXEC_NAME).getAbsolutePath());
            cmd.add(script.getAbsolutePath());

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.environment().put("LD_LIBRARY_PATH", nativeLibDir());
            pb.environment().put("HOME", home.getAbsolutePath());
            pb.environment().put("TMPDIR", tmp.getAbsolutePath());
            pb.directory(root);
            // stdout + stderr jadi satu pipa (hindari deadlock, sama seperti compiler PAWN)
            pb.redirectErrorStream(true);

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
                        JSObject o = new JSObject();
                        o.put("text", new String(buf, 0, n));
                        notifyListeners("output", o);
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
        } catch (Exception e) {
            call.reject("Gagal menjalankan Node.js: " + e.getMessage());
        }
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
