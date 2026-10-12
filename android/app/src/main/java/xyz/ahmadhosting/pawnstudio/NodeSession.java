package xyz.ahmadhosting.pawnstudio;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

import androidx.core.content.ContextCompat;

import java.io.InputStreamReader;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

// Satu-satunya pemegang proses Node/npm. Hidup di level proses aplikasi (static),
// jadi tidak ikut mati waktu Activity ditutup. Output disimpan di buffer supaya
// UI yang dibuka lagi bisa menampilkan ulang log.
public final class NodeSession {

    public interface Listener {
        void onOutput(String text);
        void onExit(int exitCode, boolean stopped, long durationMs);
    }

    private static final String TAG = "NodeSession";
    private static final int MAX_LOG = 64 * 1024;

    private static final Object lock = new Object();
    private static Process current = null;
    private static volatile boolean stopRequested = false;
    private static Listener listener = null;
    private static final StringBuilder log = new StringBuilder();

    // Hasil proses terakhir. exitWhileAway = selesai saat tidak ada UI yang mendengarkan.
    private static boolean hasLast = false;
    private static boolean exitWhileAway = false;
    private static int lastExitCode = 0;
    private static boolean lastStopped = false;
    private static long lastDuration = 0;

    private NodeSession() {}

    public static boolean isRunning() {
        synchronized (lock) {
            return current != null;
        }
    }

    public static void setListener(Listener l) {
        synchronized (lock) {
            listener = l;
        }
    }

    public static void clearListener(Listener l) {
        synchronized (lock) {
            if (listener == l) listener = null;
        }
    }

    public static String snapshotLog() {
        synchronized (lock) {
            return log.toString();
        }
    }

    // {kode, stopped(0/1), durasi ms} dari proses terakhir, atau null kalau belum pernah ada.
    public static long[] lastExit() {
        synchronized (lock) {
            if (!hasLast) return null;
            return new long[]{lastExitCode, lastStopped ? 1 : 0, lastDuration};
        }
    }

    // true kalau ada proses yang selesai selagi UI tidak ada. Dipanggil sekali.
    public static boolean consumeAway() {
        synchronized (lock) {
            boolean v = exitWhileAway;
            exitWhileAway = false;
            return v;
        }
    }

    public static void start(Context ctx, List<String> cmd, java.io.File cwd, Map<String, String> env) throws Exception {
        final Context app = ctx.getApplicationContext();

        ProcessBuilder pb = new ProcessBuilder(cmd);
        pb.environment().putAll(env);
        pb.directory(cwd);
        // stdout + stderr jadi satu pipa (hindari deadlock, sama seperti compiler PAWN)
        pb.redirectErrorStream(true);

        synchronized (lock) {
            if (current != null) throw new IllegalStateException("Masih ada proses yang berjalan.");
            log.setLength(0);
            exitWhileAway = false;
            hasLast = false;
        }

        final Process p = pb.start();
        try { p.getOutputStream().close(); } catch (Exception ignored) {}
        synchronized (lock) {
            current = p;
        }
        stopRequested = false;
        final long t0 = System.currentTimeMillis();

        // Foreground service menjaga proses tetap hidup di latar belakang.
        try {
            ContextCompat.startForegroundService(app, new Intent(app, NodeKeepAliveService.class));
        } catch (Exception e) {
            Log.w(TAG, "service gagal start: " + e.getMessage());
        }

        Thread t = new Thread(() -> {
            int code = -1;
            try {
                Reader reader = new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8);
                char[] buf = new char[2048];
                int n;
                while ((n = reader.read(buf)) != -1) {
                    append(new String(buf, 0, n));
                }
                code = p.waitFor();
            } catch (Exception e) {
                Log.w(TAG, "baca output gagal: " + e.getMessage());
            } finally {
                long dur = System.currentTimeMillis() - t0;
                Listener l;
                boolean stopped = stopRequested;
                synchronized (lock) {
                    if (current == p) current = null;
                    l = listener;
                    hasLast = true;
                    lastExitCode = code;
                    lastStopped = stopped;
                    lastDuration = dur;
                    if (l == null) exitWhileAway = true;
                }
                try {
                    app.stopService(new Intent(app, NodeKeepAliveService.class));
                } catch (Exception ignored) {}
                if (l != null) l.onExit(code, stopped, dur);
            }
        }, "node-runner");
        t.setDaemon(true);
        t.start();
    }

    private static void append(String text) {
        Listener l;
        synchronized (lock) {
            log.append(text);
            if (log.length() > MAX_LOG) log.delete(0, log.length() - MAX_LOG);
            l = listener;
        }
        if (l != null) l.onOutput(text);
    }

    // true kalau ada proses yang dihentikan.
    public static boolean stop() {
        final Process p;
        synchronized (lock) {
            p = current;
        }
        if (p == null) return false;
        stopRequested = true;
        p.destroy();
        new Thread(() -> {
            try {
                if (!p.waitFor(1500, TimeUnit.MILLISECONDS)) p.destroyForcibly();
            } catch (InterruptedException ignored) {}
        }).start();
        return true;
    }
}
