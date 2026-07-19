package com.vcore.pawncode;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.view.Gravity;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import java.io.*;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private WebView webView;
    private ValueCallback<Uri[]> fileChooserCallback;

    private static final int FILE_CHOOSER_REQUEST = 1;
    private static final int PICK_FILE_REQUEST = 4;
    private static final int FOLDER_PICKER_REQUEST = 2;
    private static final int PROJECT_FOLDER_REQUEST = 3;
    private static final int INCLUDE_PATH_REQUEST = 5;
    private static final int STORAGE_PERMISSION_REQUEST = 100;

    private String workdir;

    /**
     * Pastikan folder VCORE ada dan bisa ditulis.
     * Dipanggil di onCreate(), saveFile(), dan compile()
     * sehingga tidak ada timing issue.
     */
    private File ensureWorkdir() {
        // Selalu pakai /storage/emulated/0/VCORE — tidak ada fallback
        File dir = new File("/storage/emulated/0/VCORE");
        if (!dir.exists()) dir.mkdirs();
        workdir = dir.getAbsolutePath();
        return dir;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Tetapkan workdir DULU sebelum apapun
        workdir = "/storage/emulated/0/VCORE";

        // 2. Buat folder sekarang (bukan saat user tekan Save)
        ensureWorkdir();

        // 3. Baru setup WebView
        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.addJavascriptInterface(new VCoreBridge(), "Android");
        webView.setWebViewClient(new WebViewClient());

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {
                if (fileChooserCallback != null) {
                    fileChooserCallback.onReceiveValue(null);
                }
                fileChooserCallback = filePathCallback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                if (fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) {
                    intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
                }
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception e) {
                    fileChooserCallback = null;
                    return false;
                }
                return true;
            }
        });

        String decryptedUrl = decryptAndLoad();
        if (decryptedUrl != null) {
            webView.loadUrl(decryptedUrl);
        } else {
            // Fallback dev mode: vscode.dat belum ada (belum di-encrypt), pakai vscode.html mentah
            webView.loadUrl("file:///android_asset/vscode.html");
        }
        requestStoragePermission();
        startEditorService("Welcome");
    }

    private String decryptAndLoad() {
        try {
            byte[] key = {
                (byte)0x56, (byte)0x43, (byte)0x4F, (byte)0x52, (byte)0x45, (byte)0x5F, (byte)0x50, (byte)0x41,
                (byte)0x57, (byte)0x4E, (byte)0x5F, (byte)0x43, (byte)0x4F, (byte)0x44, (byte)0x45, (byte)0x5F,
                (byte)0x32, (byte)0x30, (byte)0x32, (byte)0x35, (byte)0x5F, (byte)0x53, (byte)0x45, (byte)0x43,
                (byte)0x55, (byte)0x52, (byte)0x45, (byte)0x5F, (byte)0x4B, (byte)0x45, (byte)0x59, (byte)0x21,
                (byte)0x7E, (byte)0x3A, (byte)0x9F, (byte)0xB2, (byte)0x4D, (byte)0xE1, (byte)0x08, (byte)0x6C,
                (byte)0xA3, (byte)0x55, (byte)0xF7, (byte)0x29, (byte)0x8B, (byte)0xD4, (byte)0x61, (byte)0x0E,
                (byte)0x93, (byte)0x47, (byte)0xBC, (byte)0x5A, (byte)0x1F, (byte)0x84, (byte)0xC7, (byte)0x3D,
                (byte)0x72, (byte)0xE9, (byte)0x16, (byte)0xAB, (byte)0x5C, (byte)0xF3, (byte)0x2E, (byte)0x97,
                (byte)0x41, (byte)0xBE, (byte)0x63, (byte)0x0A, (byte)0xD8, (byte)0x74, (byte)0x1C, (byte)0xA9,
                (byte)0x5F, (byte)0x32, (byte)0xE7, (byte)0x8D, (byte)0x46, (byte)0xB1, (byte)0x2C, (byte)0x79,
                (byte)0x04, (byte)0xCE, (byte)0x53, (byte)0x9A, (byte)0x67, (byte)0xF2, (byte)0x1B, (byte)0x88,
                (byte)0x3E, (byte)0xD5, (byte)0x7A, (byte)0x21, (byte)0xBC, (byte)0x4F, (byte)0x96, (byte)0xE3,
                (byte)0x58, (byte)0x0D, (byte)0xA4, (byte)0x71, (byte)0xC8, (byte)0x35, (byte)0xFA, (byte)0x19,
                (byte)0x86, (byte)0x4C, (byte)0xD1, (byte)0x6E, (byte)0x23, (byte)0xB0, (byte)0x7D, (byte)0x42,
                (byte)0xEF, (byte)0x14, (byte)0x89, (byte)0x36, (byte)0xCB, (byte)0x50, (byte)0xF5, (byte)0x2A,
                (byte)0x97, (byte)0x44, (byte)0xD9, (byte)0x6C, (byte)0x11, (byte)0xAE, (byte)0x73, (byte)0x28,
                (byte)0xC5, (byte)0x3A, (byte)0x8F, (byte)0x52, (byte)0xE7, (byte)0x04, (byte)0xB9, (byte)0x66,
                (byte)0x1B, (byte)0xD8, (byte)0x45, (byte)0xF2, (byte)0x27, (byte)0x94, (byte)0x69, (byte)0xDE,
                (byte)0x33, (byte)0xA0, (byte)0x5D, (byte)0xCA, (byte)0x17, (byte)0x84, (byte)0x51, (byte)0xEE,
                (byte)0x3B, (byte)0xA8, (byte)0x75, (byte)0xC2, (byte)0x0F, (byte)0x7C, (byte)0x49, (byte)0xB6,
                (byte)0x63, (byte)0xD0, (byte)0x1D, (byte)0x8A, (byte)0x57, (byte)0xE4, (byte)0x31, (byte)0x9E,
                (byte)0x6B, (byte)0xF8, (byte)0x25, (byte)0x92, (byte)0x5F, (byte)0xCC, (byte)0x19, (byte)0x86,
                (byte)0x53, (byte)0xC0, (byte)0x0D, (byte)0x7A, (byte)0x47, (byte)0xB4, (byte)0x81, (byte)0xEE,
                (byte)0x3B, (byte)0xA8, (byte)0x75, (byte)0x42, (byte)0x0F, (byte)0xDC, (byte)0xA9, (byte)0x76,
                (byte)0x43, (byte)0x10, (byte)0xED, (byte)0xBA, (byte)0x87, (byte)0x54, (byte)0x21, (byte)0xFE,
                (byte)0xCB, (byte)0x98, (byte)0x65, (byte)0x32, (byte)0xFF, (byte)0xCC, (byte)0x99, (byte)0x66,
                (byte)0x33, (byte)0x00, (byte)0xDD, (byte)0xAA, (byte)0x77, (byte)0x44, (byte)0x11, (byte)0xEE,
                (byte)0xBB, (byte)0x88, (byte)0x55, (byte)0x22, (byte)0xFF, (byte)0xCC, (byte)0x99, (byte)0x66,
                (byte)0x33, (byte)0x00, (byte)0xDD, (byte)0xAA, (byte)0x77, (byte)0x44, (byte)0x11, (byte)0xEE,
                (byte)0xBB, (byte)0x88, (byte)0x55, (byte)0x22, (byte)0xEF, (byte)0xBE, (byte)0xAD, (byte)0xDE,
                (byte)0x0D, (byte)0xF0, (byte)0xAD, (byte)0xBA, (byte)0xEF, (byte)0xBE, (byte)0xAD, (byte)0xDE,
                (byte)0x0D, (byte)0xF0, (byte)0xED, (byte)0xFE, (byte)0xEF, (byte)0xBE, (byte)0xAD, (byte)0xDE,
            };

            java.io.InputStream is = getAssets().open("vscode.dat");
            java.io.ByteArrayOutputStream rawBos = new java.io.ByteArrayOutputStream();
            byte[] buf = new byte[8192]; int n;
            while ((n = is.read(buf)) != -1) rawBos.write(buf, 0, n);
            is.close();
            byte[] encrypted = rawBos.toByteArray();

            // XOR decrypt (256-byte key, sama dengan encrypt_html.py)
            byte[] compressed = new byte[encrypted.length];
            for (int i = 0; i < encrypted.length; i++) {
                compressed[i] = (byte)(encrypted[i] ^ key[i % key.length]);
            }

            // GUNZIP decompress (encrypt_html.py melakukan gzip.compress sebelum XOR)
            java.util.zip.GZIPInputStream gzis = new java.util.zip.GZIPInputStream(
                    new java.io.ByteArrayInputStream(compressed));
            java.io.ByteArrayOutputStream decompressedBos = new java.io.ByteArrayOutputStream();
            byte[] gbuf = new byte[8192]; int gn;
            while ((gn = gzis.read(gbuf)) != -1) decompressedBos.write(gbuf, 0, gn);
            gzis.close();
            byte[] decrypted = decompressedBos.toByteArray();

            File outFile = new File(getCacheDir(), "vscode_d.html");
            java.io.FileOutputStream fos = new java.io.FileOutputStream(outFile);
            fos.write(decrypted);
            fos.close();

            return "file://" + outFile.getAbsolutePath();
        } catch (Exception e) {
            // vscode.dat tidak ada / gagal decrypt (mode dev tanpa build script) → fallback ke vscode.html mentah
            android.util.Log.e("VCORE", "decryptAndLoad failed: " + e.getMessage());
            return null;
        }
    }

    private void requestStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            if (!Environment.isExternalStorageManager()) {
                try {
                    Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                    intent.setData(Uri.parse("package:" + getPackageName()));
                    startActivity(intent);
                } catch (Exception e) {
                    try {
                        Intent intent = new Intent(android.provider.Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        startActivity(intent);
                    } catch (Exception e2) { }
                }
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                    != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(this,
                        new String[]{
                                Manifest.permission.READ_EXTERNAL_STORAGE,
                                Manifest.permission.WRITE_EXTERNAL_STORAGE
                        }, STORAGE_PERMISSION_REQUEST);
            }
        }
    }

    private void startEditorService(String filename) {
        try {
            Intent intent = new Intent(this, EditorService.class);
            intent.putExtra("filename", filename);
            startService(intent);
        } catch (Exception e) { }
    }

    public class VCoreBridge {

        @JavascriptInterface
        public String getWorkdir() {
            // Selalu return path yang sudah dipastikan ada
            ensureWorkdir();
            return workdir;
        }

        @JavascriptInterface
        public void showToast(String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show());
        }

        // WebView Android nggak support Fullscreen API browser standar
        // (document.documentElement.requestFullscreen()) kecuali WebChromeClient
        // ngimplementasiin onShowCustomView, yang nggak ada di sini. Makanya
        // fullscreen dikontrol langsung lewat system UI flags (immersive sticky),
        // dipanggil dari JS toggleFullScreen().
        @JavascriptInterface
        public void setFullscreen(boolean enabled) {
            runOnUiThread(() -> {
                android.view.Window window = getWindow();
                android.view.View decorView = window.getDecorView();
                if (enabled) {
                    decorView.setSystemUiVisibility(
                        android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                        | android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    );
                } else {
                    decorView.setSystemUiVisibility(
                        android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    );
                }
            });
        }

        @JavascriptInterface
        public void updateEditorNotification(String filename) {
            startEditorService(filename != null && !filename.isEmpty() ? filename : "Welcome");
        }

        @JavascriptInterface
        public void compile(String compilerName, String argsJson, String workdirPath) {
            // Pastikan workdir ada sebelum compile
            ensureWorkdir();
            new Thread(() -> runCompiler(compilerName, argsJson, workdirPath)).start();
        }

        @JavascriptInterface
        public void saveFile(String path, String content) {
            ensureWorkdir();
            new Thread(() -> {
                try {
                    File f = resolvePath(path);
                    File parent = f.getParentFile();
                    if (parent != null && !parent.exists()) parent.mkdirs();
                    FileOutputStream fos = new FileOutputStream(f);
                    fos.write(content.getBytes("UTF-8"));
                    fos.close();
                    final String abs = f.getAbsolutePath();
                    runOnUiThread(() -> webView.evaluateJavascript(
                            "if(typeof window.__lastSavePath !== 'undefined') window.__lastSavePath='" + jsEscape(abs) + "';", null));
                } catch (Exception e) {
                    final String msg = e.getMessage();
                    runOnUiThread(() -> webView.evaluateJavascript(
                            "if(typeof terminalOutput==='function') terminalOutput('[ERROR] Save gagal: " + jsEscape(msg != null ? msg : "unknown") + "');", null));
                }
            }).start();
        }

        /**
         * Synchronous batch save: tulis semua file sekaligus di satu thread,
         * lalu panggil callback JS saat semua write selesai.
         * Dipakai oleh runCode() untuk memastikan tidak ada race condition
         * antara write dan compile.
         */
        @JavascriptInterface
        public void saveAllAndCompile(String filesJson, String compilerName, String argsJson, String workdirPath) {
            ensureWorkdir();
            new Thread(() -> {
                // 1. Parse dan tulis semua file secara synchronous di thread yang sama
                try {
                    org.json.JSONArray arr = new org.json.JSONArray(filesJson);
                    for (int i = 0; i < arr.length(); i++) {
                        org.json.JSONObject obj = arr.getJSONObject(i);
                        String path    = obj.getString("path");
                        String content = obj.getString("content");
                        try {
                            File f = resolvePath(path);
                            File parent = f.getParentFile();
                            if (parent != null && !parent.exists()) parent.mkdirs();
                            FileOutputStream fos = new FileOutputStream(f);
                            fos.write(content.getBytes("UTF-8"));
                            fos.close();
                        } catch (Exception writeErr) {
                            final String msg = writeErr.getMessage();
                            runOnUiThread(() -> webView.evaluateJavascript(
                                "if(typeof terminalOutput==='function') terminalOutput('[ERROR] Save: " + jsEscape(msg != null ? msg : "unknown") + "');", null));
                        }
                    }
                } catch (Exception parseErr) {
                    final String msg = parseErr.getMessage();
                    runOnUiThread(() -> webView.evaluateJavascript(
                        "if(typeof terminalOutput==='function') terminalOutput('[ERROR] saveAllAndCompile parse: " + jsEscape(msg != null ? msg : "unknown") + "');", null));
                    sendTaskFinished(1);
                    return;
                }

                // 2. Semua write selesai → langsung compile di thread yang sama
                runCompiler(compilerName, argsJson, workdirPath);
            }).start();
        }

        @JavascriptInterface
        public void deleteFile(String path) {
            ensureWorkdir();
            new Thread(() -> {
                try {
                    File f = resolvePath(path);
                    if (f.exists()) {
                        boolean deleted = f.delete();
                        if (!deleted) {
                            final String msg = "[ERROR] Gagal hapus: " + f.getAbsolutePath();
                            runOnUiThread(() -> webView.evaluateJavascript(
                                "if(typeof terminalOutput==='function') terminalOutput('" + jsEscape(msg) + "');", null));
                        }
                    }
                } catch (Exception e) {
                    final String msg = e.getMessage();
                    runOnUiThread(() -> webView.evaluateJavascript(
                        "if(typeof terminalOutput==='function') terminalOutput('[ERROR] Delete: " + jsEscape(msg != null ? msg : "unknown") + "');", null));
                }
            }).start();
        }

        @JavascriptInterface
        public void pickFile() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(intent, "Pilih File"), PICK_FILE_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "File picker tidak tersedia", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public void pickFolder() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    startActivityForResult(intent, FOLDER_PICKER_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Gagal buka folder picker: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void pickIncludePath() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                    startActivityForResult(intent, INCLUDE_PATH_REQUEST);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Gagal buka folder picker include: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void pickProjectFolder() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                try {
                    startActivityForResult(intent, PROJECT_FOLDER_REQUEST);
                } catch (Exception e) { }
            });
        }
    }

    private File resolvePath(String path) {
        if (path == null || path.isEmpty()) return new File(workdir);
        // Jika sudah absolute path, langsung pakai
        if (path.startsWith("/")) return new File(path);
        // Jika path relatif mengandung workdir di depan (dobel prefix), strip dulu
        String wd = workdir.endsWith("/") ? workdir : workdir + "/";
        if (path.startsWith(wd)) return new File(path);
        // Normal: join workdir + relative path
        return new File(workdir, path);
    }

    private static final java.util.Set<String> SKIP_EXT = new java.util.HashSet<>(java.util.Arrays.asList(
            "amx","so","dll","exe","bin","dat","db","sqlite",
            "png","jpg","jpeg","gif","bmp","ico","webp",
            "mp3","wav","ogg","mp4","avi","zip","rar","7z","tar","gz"));

    private void enumerateFiles(androidx.documentfile.provider.DocumentFile dir, String relPath,
                                 StringBuilder json, boolean[] first) {
        for (androidx.documentfile.provider.DocumentFile child : dir.listFiles()) {
            String name = child.getName();
            if (name == null) continue;
            String childRel = relPath.isEmpty() ? name : relPath + "/" + name;
            if (child.isDirectory()) {
                enumerateFiles(child, childRel, json, first);
            } else {
                String ext = name.contains(".") ? name.substring(name.lastIndexOf('.') + 1).toLowerCase() : "";
                if (SKIP_EXT.contains(ext)) continue;
                if (child.length() > 2 * 1024 * 1024) continue;
                try {
                    InputStream is = getContentResolver().openInputStream(child.getUri());
                    ByteArrayOutputStream buf = new ByteArrayOutputStream();
                    byte[] data = new byte[4096];
                    int n;
                    while ((n = is.read(data)) != -1) buf.write(data, 0, n);
                    is.close();
                    String text = buf.toString("UTF-8");

                    if (!first[0]) json.append(",");
                    first[0] = false;
                    json.append("{\"path\":\"").append(jsonEscape(childRel))
                            .append("\",\"content\":\"").append(jsonEscape(text)).append("\"}");
                } catch (Exception e) { }
            }
        }
    }

    private String jsonEscape(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }

    private String jsEscapeForSingleQuoteJson(String json) {
        return json.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
    }

    private String jsEscape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'")
                .replace("\n", "\\n").replace("\r", "");
    }

    /**
     * Native pawn compiler (pawncc) cuma ngerti ASCII 7-bit. Kalau ada karakter non-ASCII
     * (misal titik-titik Unicode Braille di ASCII art banner) nyelip di komentar, native lib
     * bisa crash (segfault) pas parsing. ASCII art di komentar gak ngaruh ke logic program,
     * jadi aman disanitize khusus buat SALINAN SANDBOX yang dibaca compiler - file project
     * asli yang di-edit user TIDAK disentuh sama sekali.
     *
     * State machine sederhana: lacak kita lagi di code / // comment / block comment /
     * string / char literal, dan cuma ganti karakter non-ASCII (>127) kalau lagi di
     * dalam comment. Newline tetap dipertahankan biar nomor baris error compiler tetap akurat.
     */
    private String sanitizeNonAsciiInComments(String src) {
        if (src == null || src.isEmpty()) return src;
        StringBuilder out = new StringBuilder(src.length());
        final int CODE = 0, LINE_COMMENT = 1, BLOCK_COMMENT = 2, STRING_LIT = 3, CHAR_LIT = 4;
        int state = CODE;
        int len = src.length();
        for (int i = 0; i < len; i++) {
            char c = src.charAt(i);
            char next = (i + 1 < len) ? src.charAt(i + 1) : '\0';

            switch (state) {
                case CODE:
                    if (c == '/' && next == '/') { state = LINE_COMMENT; out.append(c); break; }
                    if (c == '/' && next == '*') { state = BLOCK_COMMENT; out.append(c); break; }
                    if (c == '"') { state = STRING_LIT; out.append(c); break; }
                    if (c == '\'') { state = CHAR_LIT; out.append(c); break; }
                    out.append(c);
                    break;
                case LINE_COMMENT:
                    if (c == '\n') { state = CODE; out.append(c); break; }
                    out.append(c > 127 ? '.' : c);
                    break;
                case BLOCK_COMMENT:
                    if (c == '*' && next == '/') { state = CODE; out.append(c); break; }
                    out.append(c > 127 ? '.' : c);
                    break;
                case STRING_LIT:
                    if (c == '\\' && i + 1 < len) { out.append(c); out.append(next); i++; break; }
                    if (c == '"') { state = CODE; out.append(c); break; }
                    out.append(c);
                    break;
                case CHAR_LIT:
                    if (c == '\\' && i + 1 < len) { out.append(c); out.append(next); i++; break; }
                    if (c == '\'') { state = CODE; out.append(c); break; }
                    out.append(c);
                    break;
            }
        }
        return out.toString();
    }

    private static final java.util.Set<String> PAWN_SOURCE_EXT = new java.util.HashSet<>(java.util.Arrays.asList(
            "pwn", "inc", "p", "pawn"));

    /**
     * Copy file dari src ke dst, buat parent folder kalau belum ada.
     * Untuk file source Pawn, ASCII art / karakter non-ASCII di komentar disanitize
     * dulu (lihat sanitizeNonAsciiInComments) biar native compiler gak crash - hanya
     * berlaku di salinan sandbox ini, file asli tidak diubah.
     */
    private void copyFile(File src, File dst) throws Exception {
        File parent = dst.getParentFile();
        if (parent != null && !parent.exists()) parent.mkdirs();

        String name = src.getName();
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";

        if (PAWN_SOURCE_EXT.contains(ext)) {
            java.io.FileInputStream fis = new java.io.FileInputStream(src);
            java.io.ByteArrayOutputStream buf = new java.io.ByteArrayOutputStream();
            byte[] tmp = new byte[8192]; int n;
            while ((n = fis.read(tmp)) != -1) buf.write(tmp, 0, n);
            fis.close();
            String content = buf.toString("UTF-8");
            String sanitized = sanitizeNonAsciiInComments(content);
            java.io.FileOutputStream fos = new java.io.FileOutputStream(dst);
            fos.write(sanitized.getBytes("UTF-8"));
            fos.close();
            return;
        }

        java.io.FileInputStream fis = new java.io.FileInputStream(src);
        java.io.FileOutputStream fos = new java.io.FileOutputStream(dst);
        byte[] buf = new byte[8192]; int n;
        while ((n = fis.read(buf)) != -1) fos.write(buf, 0, n);
        fis.close(); fos.close();
    }

    /**
     * Copy seluruh folder rekursif dari src ke dst.
     */
    // Folder yang gak perlu ikut kecopy ke sandbox compile (besar/gak relevan buat compiler)
    private static final java.util.Set<String> COPY_SKIP_DIRS = new java.util.HashSet<>(java.util.Arrays.asList(
            ".git", ".gradle", ".idea", "build", "node_modules", ".vscode"));

    private void copyDir(File src, File dst) throws Exception {
        if (!dst.exists()) dst.mkdirs();
        for (File f : src.listFiles() != null ? src.listFiles() : new File[0]) {
            if (f.isDirectory()) {
                if (COPY_SKIP_DIRS.contains(f.getName())) continue;
                copyDir(f, new File(dst, f.getName()));
            } else {
                String name = f.getName();
                int dot = name.lastIndexOf('.');
                String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
                if (SKIP_EXT.contains(ext)) continue;
                copyFile(f, new File(dst, f.getName()));
            }
        }
    }

    private void runCompiler(String compilerName, String argsJson, String workdirPath) {
        // Parse args dengan JSONArray - aman untuk path dengan spasi dan karakter khusus
        List<String> resolvedArgs = new ArrayList<>();
        final String wdir;
        try {
            org.json.JSONArray arr = new org.json.JSONArray(argsJson);
            String _wdir = (workdirPath == null || workdirPath.isEmpty()) ? workdir : workdirPath;
            wdir = _wdir.replaceAll("/+$", "");
            // -D flag: set working directory compiler ke workdir
            resolvedArgs.add("-D" + wdir);
            for (int i = 0; i < arr.length(); i++) {
                String a = arr.getString(i);
                if (a.startsWith("-")) {
                    // Flag dengan path value: -i, -o, -D
                    if (a.length() > 2 && (a.charAt(1) == 'i' || a.charAt(1) == 'o' || a.charAt(1) == 'D')) {
                        char flag = a.charAt(1);
                        String val = a.substring(2);
                        if (!val.startsWith("/")) val = wdir + "/" + val;
                        resolvedArgs.add("-" + flag + val);
                    } else {
                        resolvedArgs.add(a);
                    }
                } else {
                    // File argument - resolve ke absolute jika belum
                    if (!a.startsWith("/")) a = wdir + "/" + a;
                    resolvedArgs.add(a);
                }
            }
        } catch (Exception e) {
            sendOutput("[ERROR] Gagal parsing argumen: " + e.getMessage());
            sendTaskFinished(1);
            return;
        }

        sendOutput("[VCORE] Compiling with " + compilerName + "...");

        // Copy file .pwn dan include ke sandbox app agar native library bisa baca
        File sandboxDir = new File(getCacheDir(), "VCORE");
        if (!sandboxDir.exists()) sandboxDir.mkdirs();

        // Resolve path file .pwn dari resolvedArgs (arg pertama yang tidak dimulai -)
        String srcPwnPath = null;
        String srcAmxPath = null;
        List<String> sandboxArgs = new ArrayList<>();

        for (String a : resolvedArgs) {
            if (a.startsWith("-D")) {
                // Ganti workdir ke sandbox
                sandboxArgs.add("-D" + sandboxDir.getAbsolutePath());
            } else if (a.startsWith("-o")) {
                // Output .amx di sandbox dulu
                srcAmxPath = a.substring(2); // path asli untuk copy balik
                String amxName = new File(srcAmxPath).getName();
                String amxRelative = srcAmxPath.replace(wdir, "").replaceAll("^/+", "");
                File sandboxAmx = new File(sandboxDir, amxRelative);
                sandboxArgs.add("-o" + sandboxAmx.getAbsolutePath());
            } else if (a.startsWith("-i")) {
                // Include path - copy include folder ke sandbox
                String incPath = a.substring(2);
                File incSrc = new File(incPath);
                if (incSrc.exists()) {
                    File incDst = new File(sandboxDir, "include_ext");
                    try { copyDir(incSrc, incDst); } catch (Exception ex) {}
                    sandboxArgs.add("-i" + incDst.getAbsolutePath());
                } else {
                    sandboxArgs.add(a);
                }
            } else if (!a.startsWith("-")) {
                // File .pwn - copy ke sandbox
                srcPwnPath = a;
                String pwnRelative = a.replace(wdir, "").replaceAll("^/+", "");
                File sandboxPwn = new File(sandboxDir, pwnRelative);
                try {
                    // Copy seluruh VCORE folder ke sandbox agar semua #include relatif resolve
                    File vcoreRoot = new File(wdir);
                    if (vcoreRoot.exists()) {
                        copyDir(vcoreRoot, sandboxDir);
                    } else {
                        sendOutput("[ERROR] VCORE folder tidak ada: " + wdir);
                    }
                } catch (Exception ex) {
                    sendOutput("[ERROR] Copy gagal: " + ex.getMessage());
                }
                sandboxArgs.add(sandboxPwn.getAbsolutePath());
            } else {
                sandboxArgs.add(a);
            }
        }

        // Tambah include sandbox agar #include dalam project resolve
        sandboxArgs.add("-i" + sandboxDir.getAbsolutePath());

        sendOutput("[VCORE] Args: " + sandboxArgs.toString());

        try {
            System.loadLibrary(compilerName);
        } catch (UnsatisfiedLinkError e) {
            sendOutput("[ERROR] Native compiler library tidak tersedia: " + e.getMessage());
            sendTaskFinished(1);
            return;
        }

        int exitCode;
        String output, errors;
        try {
            com.rvdjv.pawnmc.PawnCompiler compiler = new com.rvdjv.pawnmc.PawnCompiler(getApplication());
            exitCode = compiler.compile(sandboxArgs.toArray(new String[0]));
            output = compiler.getOutput();
            errors = compiler.getErrors();
        } catch (Exception e) {
            sendOutput("[ERROR] " + e.getMessage());
            sendTaskFinished(1);
            return;
        }

        if (output != null && !output.isEmpty()) {
            for (String line : output.split("\n")) sendOutput(line);
        }
        if (errors != null && !errors.isEmpty()) {
            for (String line : errors.split("\n")) sendOutput(line);
        }

        // Copy .amx hasil compile balik ke lokasi asli
        // Cek keberadaan file, bukan cuma exitCode, karena exitCode native lib
        // bisa non-zero meski compile sukses (hanya warning, tidak ada error)
        boolean amxCopied = false;
        if (srcAmxPath != null) {
            try {
                String amxRelative = srcAmxPath.replace(wdir, "").replaceAll("^/+", "");
                File sandboxAmx = new File(sandboxDir, amxRelative);
                if (sandboxAmx.exists()) {
                    copyFile(sandboxAmx, new File(srcAmxPath));
                    sendOutput("[VCORE] AMX output: " + srcAmxPath);
                    amxCopied = true;
                }
            } catch (Exception ex) {
                sendOutput("[WARN] Copy AMX gagal: " + ex.getMessage());
            }
        }

        // Jika .amx berhasil dibuat dan disalin, anggap compile sukses
        // terlepas dari exitCode internal native lib
        int finalExitCode = amxCopied ? 0 : exitCode;

        sendTaskFinished(finalExitCode);
    }

    private List<String> splitJsonArray(String s) {
        List<String> result = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inString = false;
        boolean escape = false;
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (escape) { cur.append(c); escape = false; continue; }
            if (c == '\\') { escape = true; continue; }
            if (c == '"') { inString = !inString; continue; }
            if (c == ',' && !inString) {
                result.add(cur.toString().trim());
                cur.setLength(0);
                continue;
            }
            cur.append(c);
        }
        if (cur.length() > 0 || result.size() > 0) result.add(cur.toString().trim());
        return result;
    }

    private void sendOutput(String line) {
        final String l = line;
        runOnUiThread(() -> webView.evaluateJavascript(
                "if(typeof terminalOutput==='function') terminalOutput('" + jsEscape(l) + "');",
                null));
    }

    private void sendTaskFinished(int exitCode) {
        runOnUiThread(() -> webView.evaluateJavascript(
                "if(typeof taskFinished==='function') taskFinished(" + exitCode + ");",
                null));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                Uri[] results = null;
                if (resultCode == Activity.RESULT_OK && data != null) {
                    if (data.getClipData() != null) {
                        int count = data.getClipData().getItemCount();
                        results = new Uri[count];
                        for (int i = 0; i < count; i++) {
                            results[i] = data.getClipData().getItemAt(i).getUri();
                            try { getContentResolver().takePersistableUriPermission(results[i], Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e) { }
                        }
                    } else if (data.getData() != null) {
                        results = new Uri[]{data.getData()};
                        try { getContentResolver().takePersistableUriPermission(results[0], Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (Exception e) { }
                    }
                }
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
                if (results != null && results.length > 0) {
                    for (Uri uri : results) {
                        new Thread(() -> {
                            try {
                                String filename = null;
                                android.database.Cursor cursor = getContentResolver().query(
                                        uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null);
                                if (cursor != null && cursor.moveToFirst()) { filename = cursor.getString(0); cursor.close(); }
                                if (filename == null) filename = uri.getLastPathSegment();
                                InputStream is = getContentResolver().openInputStream(uri);
                                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                                byte[] buf = new byte[8192]; int n;
                                while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                                is.close();
                                // Kirim path relatif dari workdir agar currentFile punya struktur folder
                                final String fname = resolveRelativeName(filename, uri);
                                final String fcontentB64 = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
                                runOnUiThread(() -> webView.evaluateJavascript(
                                    "if(typeof onFileOpenedFromAndroid==='function') onFileOpenedFromAndroid('" + jsEscape(fname) + "','" + fcontentB64 + "',true);", null));
                            } catch (Exception e) { }
                        }).start();
                    }
                }
            }
            return;
        }

        if (requestCode == PICK_FILE_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri uri = data.getData();
                try { getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { }
                new Thread(() -> {
                    try {
                        String filename = null;
                        android.database.Cursor cursor = getContentResolver().query(
                                uri, new String[]{android.provider.OpenableColumns.DISPLAY_NAME}, null, null, null);
                        if (cursor != null && cursor.moveToFirst()) { filename = cursor.getString(0); cursor.close(); }
                        if (filename == null) filename = uri.getLastPathSegment();
                        InputStream is = getContentResolver().openInputStream(uri);
                        ByteArrayOutputStream bos = new ByteArrayOutputStream();
                        byte[] buf = new byte[8192]; int n;
                        while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                        is.close();
                        final String fname = resolveRelativeName(filename, uri);
                        final String fcontentB64 = android.util.Base64.encodeToString(bos.toByteArray(), android.util.Base64.NO_WRAP);
                        runOnUiThread(() -> webView.evaluateJavascript(
                                "if(typeof onFileOpenedFromAndroid==='function') onFileOpenedFromAndroid('" + jsEscape(fname) + "','" + fcontentB64 + "',true);", null));
                    } catch (Exception e) {
                        runOnUiThread(() -> Toast.makeText(MainActivity.this, "Gagal buka file: " + e.getMessage(), Toast.LENGTH_SHORT).show());
                    }
                }).start();
            }
            return;
        }

        if (requestCode == PROJECT_FOLDER_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                try { getContentResolver().takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { }
                String rootPath = uriToPath(treeUri);
                if (rootPath == null) rootPath = "project";
                final String finalRootPath = rootPath;
                new Thread(() -> {
                    androidx.documentfile.provider.DocumentFile rootDoc =
                            androidx.documentfile.provider.DocumentFile.fromTreeUri(this, treeUri);
                    StringBuilder json = new StringBuilder("[");
                    boolean[] first = {true};
                    if (rootDoc != null) enumerateFiles(rootDoc, "", json, first);
                    json.append("]");
                    final String filesJson = json.toString();
                    runOnUiThread(() -> webView.evaluateJavascript(
                            "if(typeof onProjectFolderLoaded==='function') onProjectFolderLoaded('"
                                    + jsEscape(finalRootPath) + "', '" + jsEscapeForSingleQuoteJson(filesJson) + "');", null));
                }).start();
            }
            return;
        }

        if (requestCode == FOLDER_PICKER_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                try { getContentResolver().takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { }
                String path = uriToPath(treeUri);
                final String finalPath = (path != null) ? path : treeUri.toString();
                webView.evaluateJavascript("if(typeof onFolderPicked==='function') onFolderPicked('" + jsEscape(finalPath) + "');", null);
            }
            return;
        }

        if (requestCode == INCLUDE_PATH_REQUEST) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri treeUri = data.getData();
                try { getContentResolver().takePersistableUriPermission(treeUri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION); } catch (Exception e) { }
                String path = uriToPath(treeUri);
                final String finalPath = (path != null) ? path : treeUri.toString();
                webView.evaluateJavascript("if(typeof onIncludePathPicked==='function') onIncludePathPicked('" + jsEscape(finalPath) + "');", null);
            }
            return;
        }
    }

    /**
     * Resolve nama file ke path relatif dari workdir.
     * Misal: file di /storage/emulated/0/VCORE/gamemodes/test.pwn
     * → return "gamemodes/test.pwn"
     * Kalau file di luar workdir → return nama file saja
     */
    private String resolveRelativeName(String filename, Uri uri) {
        if (filename == null) return "untitled.pwn";
        try {
            // Coba dapat path absolute dari URI
            String absPath = null;
            // Coba via document ID
            if (android.provider.DocumentsContract.isDocumentUri(this, uri)) {
                String docId = android.provider.DocumentsContract.getDocumentId(uri);
                if (docId != null && docId.startsWith("primary:")) {
                    absPath = Environment.getExternalStorageDirectory().getAbsolutePath()
                            + "/" + docId.substring("primary:".length());
                }
            }
            // Coba via data path langsung
            if (absPath == null && uri.getPath() != null) {
                String p = uri.getPath();
                if (p.contains("/primary:")) {
                    absPath = Environment.getExternalStorageDirectory().getAbsolutePath()
                            + "/" + p.substring(p.indexOf("/primary:") + "/primary:".length());
                } else if (p.startsWith("/storage/") || p.startsWith("/sdcard/")) {
                    absPath = p;
                }
            }
            if (absPath != null) {
                String wd = workdir.endsWith("/") ? workdir : workdir + "/";
                if (absPath.startsWith(wd)) {
                    return absPath.substring(wd.length()); // path relatif dari workdir
                }
            }
        } catch (Exception e) { }
        // Fallback: nama file saja
        return filename;
    }

    private String uriToPath(Uri treeUri) {
        try {
            String docId = DocumentsContract.getTreeDocumentId(treeUri);
            if (docId.startsWith("primary:")) {
                String relative = docId.substring("primary:".length());
                return Environment.getExternalStorageDirectory().getAbsolutePath() + "/" + relative;
            }
            if (docId.contains(":")) {
                String[] parts = docId.split(":", 2);
                if (parts[0].equalsIgnoreCase("primary") ||
                    parts[0].toLowerCase().contains("sdcard") ||
                    parts[0].toLowerCase().contains("external")) {
                    return Environment.getExternalStorageDirectory().getAbsolutePath() + "/" + parts[1];
                }
            }
            String uriStr = treeUri.toString();
            if (uriStr.contains("primary%3A")) {
                String decoded = java.net.URLDecoder.decode(uriStr, "UTF-8");
                int idx = decoded.indexOf("primary:");
                if (idx >= 0) {
                    return Environment.getExternalStorageDirectory().getAbsolutePath() + "/" + decoded.substring(idx + "primary:".length());
                }
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }
}
