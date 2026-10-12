package xyz.ahmadhosting.pawnstudio;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.PowerManager;
import android.os.StatFs;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

// Cek kompatibilitas HP: info perangkat, status izin, dan apakah compiler / Node.js benar-benar bisa dijalankan.
@CapacitorPlugin(name = "DeviceCheck")
public class DeviceCheckPlugin extends Plugin {

    // Probe menjalankan proses beberapa detik; pakai thread sendiri supaya plugin lain tidak tertahan.
    private static final ExecutorService EX = Executors.newSingleThreadExecutor();

    private String libDir() {
        return getContext().getApplicationInfo().nativeLibraryDir;
    }

    // Jalankan binary sebentar. null = gagal start (format salah, izin, dll). "" = jalan tanpa output.
    private String probe(String[] cmd, int timeoutSec) {
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.environment().put("LD_LIBRARY_PATH", libDir());
            pb.redirectErrorStream(true);
            Process p = pb.start();
            try { p.getOutputStream().close(); } catch (Exception ignored) {}
            String first = "";
            if (p.waitFor(timeoutSec, TimeUnit.SECONDS)) {
                BufferedReader r = new BufferedReader(new InputStreamReader(p.getInputStream(), StandardCharsets.UTF_8));
                String line = r.readLine();
                if (line != null) first = line.trim();
            } else {
                p.destroyForcibly();
            }
            return first;
        } catch (Throwable t) {
            return null;
        }
    }

    @PluginMethod
    public void info(PluginCall call) {
        EX.execute(() -> infoImpl(call));
    }

    private void infoImpl(PluginCall call) {
        try {
            Context c = getContext();
            JSObject r = new JSObject();
            r.put("manufacturer", Build.MANUFACTURER);
            r.put("brand", Build.BRAND);
            r.put("model", Build.MODEL);
            r.put("release", Build.VERSION.RELEASE);
            r.put("sdk", Build.VERSION.SDK_INT);

            JSArray abis = new JSArray();
            boolean arm64 = false;
            for (String a : Build.SUPPORTED_ABIS) {
                abis.put(a);
                if ("arm64-v8a".equals(a)) arm64 = true;
            }
            r.put("abis", abis);
            r.put("arm64", arm64);

            ActivityManager am = (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE);
            if (am != null) {
                ActivityManager.MemoryInfo mi = new ActivityManager.MemoryInfo();
                am.getMemoryInfo(mi);
                r.put("ramMb", mi.totalMem / (1024 * 1024));
            }
            try {
                StatFs sf = new StatFs(Environment.getDataDirectory().getPath());
                r.put("freeMb", sf.getAvailableBytes() / (1024 * 1024));
            } catch (Throwable ignored) {}

            boolean allFiles;
            if (Build.VERSION.SDK_INT >= 30) {
                allFiles = Environment.isExternalStorageManager();
            } else {
                allFiles = ContextCompat.checkSelfPermission(c, android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        == PackageManager.PERMISSION_GRANTED;
            }
            r.put("allFiles", allFiles);
            r.put("notif", NotificationManagerCompat.from(c).areNotificationsEnabled());
            PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
            r.put("battery", pm != null && pm.isIgnoringBatteryOptimizations(c.getPackageName()));

            File dir = new File(libDir());
            File pawncc = new File(dir, "libpawncc.so");
            File nodeExec = new File(dir, "libnodeexec.so");
            File nodeLib = new File(dir, "libnode.so");
            r.put("compilerLib", pawncc.exists());
            r.put("nodeLib", nodeExec.exists() && nodeLib.exists());
            if (pawncc.exists()) {
                r.put("compilerRuns", probe(new String[]{pawncc.getAbsolutePath()}, 4) != null);
            }
            if (nodeExec.exists() && nodeLib.exists()) {
                String v = probe(new String[]{nodeExec.getAbsolutePath(), "--version"}, 8);
                r.put("nodeRuns", v != null);
                if (v != null) r.put("nodeVersion", v);
            }
            call.resolve(r);
        } catch (Throwable t) {
            call.reject("Cek HP: " + t.getMessage());
        }
    }

    // Buka layar pengaturan sistem yang pas: allfiles, notif, battery, atau app (detail aplikasi).
    @PluginMethod
    public void openSettings(PluginCall call) {
        String what = call.getString("what", "app");
        Context c = getContext();
        String pkg = c.getPackageName();
        try {
            Intent i;
            if ("allfiles".equals(what) && Build.VERSION.SDK_INT >= 30) {
                i = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION, Uri.parse("package:" + pkg));
            } else if ("notif".equals(what)) {
                i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg);
            } else if ("battery".equals(what)) {
                i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + pkg));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                c.startActivity(i);
            } catch (Throwable t) {
                Intent f = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + pkg));
                f.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                c.startActivity(f);
            }
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Throwable t) {
            call.reject("Cek HP: " + t.getMessage());
        }
    }
}
