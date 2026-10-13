package xyz.ahmadhosting.pawnstudio;

import android.net.Uri;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Enumeration;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

// Manajer Library (v1.14.3): unduh zip dari GitHub, ekstrak HANYA file .inc
// ke <project>/pawno/include (lokasi yang sudah dibaca compiler).
@CapacitorPlugin(name = "LibraryManager")
public class LibraryPlugin extends Plugin {

    private static final ExecutorService EX = Executors.newSingleThreadExecutor();
    private static final long MAX_ZIP = 80L * 1024 * 1024;
    private static final long MAX_FILE = 8L * 1024 * 1024;
    private static final int MAX_FILES = 3000;
    private static final Pattern REPO = Pattern.compile("^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$");
    private static final Set<String> SKIP = new HashSet<>(Arrays.asList(
            "test", "tests", "example", "examples", "sample", "samples", "doc", "docs",
            "demo", "filterscripts", "gamemodes", ".github", "benchmarks"));

    private File includeDir() {
        return new File(WorkspaceManager.getActiveRoot(getContext()), "pawno/include");
    }

    private File manifestFile() {
        return new File(WorkspaceManager.getActiveRoot(getContext()), "pawno/.pawnstudio-libs.json");
    }

    private JSONObject readManifest() {
        try {
            File f = manifestFile();
            if (!f.exists()) return new JSONObject();
            byte[] b = new byte[(int) f.length()];
            try (java.io.FileInputStream in = new java.io.FileInputStream(f)) {
                int off = 0;
                while (off < b.length) {
                    int n = in.read(b, off, b.length - off);
                    if (n < 0) break;
                    off += n;
                }
            }
            return new JSONObject(new String(b, "UTF-8"));
        } catch (Throwable t) {
            return new JSONObject();
        }
    }

    private void writeManifest(JSONObject m) throws IOException {
        File f = manifestFile();
        File dir = f.getParentFile();
        if (dir != null && !dir.exists()) dir.mkdirs();
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(m.toString().getBytes("UTF-8"));
        }
    }

    // ---------- HTTP ----------
    private static HttpURLConnection open(String url, String accept) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(60000);
        c.setInstanceFollowRedirects(true);
        c.setRequestProperty("User-Agent", "PawnStudio");
        c.setRequestProperty("Accept", accept);
        return c;
    }

    private static void checkCode(HttpURLConnection c, String url) throws IOException {
        int code = c.getResponseCode();
        if (code == 404) throw new FileNotFoundException("Repo/rilis tidak ditemukan: " + url);
        if (code == 403 || code == 429) throw new IOException("Batas permintaan GitHub tercapai, coba lagi beberapa menit lagi");
        if (code >= 400) throw new IOException("HTTP " + code + " dari GitHub");
    }

    private static String httpText(String url, String accept) throws IOException {
        HttpURLConnection c = open(url, accept);
        try {
            checkCode(c, url);
            try (InputStream in = c.getInputStream()) {
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    bos.write(buf, 0, n);
                    if (bos.size() > 2 * 1024 * 1024) throw new IOException("Respons terlalu besar");
                }
                return bos.toString("UTF-8");
            }
        } finally {
            c.disconnect();
        }
    }

    // Hasil: {ref, label}. mode "release" = rilis terbaru (kalau tidak ada, pakai HEAD).
    private static String[] resolve(String repo, String mode) throws IOException {
        if ("release".equals(mode)) {
            try {
                String body = httpText("https://api.github.com/repos/" + repo + "/releases/latest", "application/vnd.github+json");
                String tag = new JSONObject(body).optString("tag_name", "");
                if (!tag.isEmpty()) return new String[]{tag, tag};
            } catch (FileNotFoundException e) {
                // repo tanpa rilis -> lanjut ke HEAD
            } catch (org.json.JSONException e) {
                // abaikan, lanjut ke HEAD
            }
        }
        String sha = httpText("https://api.github.com/repos/" + repo + "/commits/HEAD", "application/vnd.github.sha").trim();
        if (sha.length() < 7) throw new IOException("Respons GitHub tidak dikenal");
        return new String[]{sha, sha.substring(0, 7)};
    }

    private static boolean validRepo(String repo) {
        return repo != null && REPO.matcher(repo).matches() && !repo.contains("..");
    }

    // ---------- Plugin methods ----------
    @PluginMethod
    public void list(PluginCall call) {
        try {
            JSObject ret = new JSObject();
            ret.put("libs", new JSObject(readManifest().toString()));
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Gagal membaca daftar library: " + t.getMessage());
        }
    }

    @PluginMethod
    public void latest(PluginCall call) {
        final String repo = call.getString("repo");
        final String mode = call.getString("mode", "release");
        if (!validRepo(repo)) {
            call.reject("Nama repo tidak valid (format: owner/repo)");
            return;
        }
        EX.execute(() -> {
            try {
                String[] r = resolve(repo, mode);
                JSObject ret = new JSObject();
                ret.put("ref", r[0]);
                ret.put("tag", r[1]);
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : t.toString());
            }
        });
    }

    @PluginMethod
    public void install(PluginCall call) {
        final String repo = call.getString("repo");
        final String mode = call.getString("mode", "release");
        final String id = call.getString("id", repo);
        if (!validRepo(repo)) {
            call.reject("Nama repo tidak valid (format: owner/repo)");
            return;
        }
        EX.execute(() -> {
            File tmp = null;
            try {
                String[] r = resolve(repo, mode);
                String url = "https://api.github.com/repos/" + repo + "/zipball/" + Uri.encode(r[0]);

                tmp = File.createTempFile("lib", ".zip", getContext().getCacheDir());
                HttpURLConnection c = open(url, "application/vnd.github+json");
                try {
                    checkCode(c, url);
                    try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(tmp)) {
                        byte[] buf = new byte[16384];
                        long total = 0;
                        int n;
                        while ((n = in.read(buf)) != -1) {
                            total += n;
                            if (total > MAX_ZIP) throw new IOException("Zip lebih dari 80 MB, dibatalkan");
                            out.write(buf, 0, n);
                        }
                    }
                } finally {
                    c.disconnect();
                }

                List<String> written = new ArrayList<>();
                String base = extract(tmp, written);
                if (written.isEmpty()) {
                    throw new IOException("Tidak ada file .inc di repo ini");
                }

                JSONObject m = readManifest();
                JSONObject e = new JSONObject();
                e.put("repo", repo);
                e.put("tag", r[1]);
                e.put("ref", r[0]);
                e.put("date", System.currentTimeMillis());
                JSONArray files = new JSONArray();
                for (String w : written) files.put(w);
                e.put("files", files);
                m.put(id, e);
                writeManifest(m);

                JSObject ret = new JSObject();
                ret.put("tag", r[1]);
                ret.put("count", written.size());
                ret.put("base", base);
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : t.toString());
            } finally {
                if (tmp != null) tmp.delete();
            }
        });
    }

    // Ekstrak .inc dari zip. Kembalikan base path yang dipotong (untuk info).
    private String extract(File zip, List<String> written) throws IOException {
        File dest = includeDir();
        if (!dest.exists() && !dest.mkdirs()) throw new IOException("Tidak bisa membuat folder pawno/include");
        String destCanon = dest.getCanonicalPath();

        ZipFile zf = new ZipFile(zip);
        try {
            List<String[]> items = new ArrayList<>(); // {nameDiZip, relTanpaFolderAtas}
            Enumeration<? extends ZipEntry> en = zf.entries();
            while (en.hasMoreElements()) {
                ZipEntry e = en.nextElement();
                if (e.isDirectory()) continue;
                String name = e.getName().replace('\\', '/');
                int s = name.indexOf('/');
                if (s < 0) continue;
                String rel = name.substring(s + 1);
                if (!rel.toLowerCase(Locale.ROOT).endsWith(".inc")) continue;
                String[] seg = rel.split("/");
                boolean bad = false;
                for (int i = 0; i < seg.length; i++) {
                    String g = seg[i].toLowerCase(Locale.ROOT);
                    if (g.isEmpty() || g.equals("..") || g.equals(".")) bad = true;
                    if (i < seg.length - 1 && SKIP.contains(g)) bad = true;
                }
                if (bad) continue;
                items.add(new String[]{e.getName(), rel});
                if (items.size() > MAX_FILES) throw new IOException("Terlalu banyak file .inc (>" + MAX_FILES + ")");
            }
            if (items.isEmpty()) return "";

            // Kalau ada folder bernama include/includes, pakai itu sebagai akar.
            int bestIdx = -1;
            String bestPrefix = null;
            for (String[] it : items) {
                String[] seg = it[1].split("/");
                for (int i = 0; i < seg.length - 1; i++) {
                    String g = seg[i].toLowerCase(Locale.ROOT);
                    if (g.equals("include") || g.equals("includes")) {
                        if (bestIdx < 0 || i < bestIdx) {
                            bestIdx = i;
                            StringBuilder sb = new StringBuilder();
                            for (int k = 0; k <= i; k++) sb.append(seg[k]).append('/');
                            bestPrefix = sb.toString();
                        }
                        break;
                    }
                }
            }
            String base;
            if (bestPrefix != null) {
                List<String[]> kept = new ArrayList<>();
                for (String[] it : items) if (it[1].startsWith(bestPrefix)) kept.add(it);
                items = kept;
                base = bestPrefix;
            } else {
                // Tidak ada folder include: pakai ancestor bersama semua file .inc.
                String[] common = null;
                for (String[] it : items) {
                    String[] seg = it[1].split("/");
                    String[] dir = Arrays.copyOf(seg, seg.length - 1);
                    if (common == null) {
                        common = dir;
                    } else {
                        int n = 0;
                        while (n < common.length && n < dir.length && common[n].equals(dir[n])) n++;
                        common = Arrays.copyOf(common, n);
                    }
                }
                StringBuilder sb = new StringBuilder();
                if (common != null) for (String c : common) sb.append(c).append('/');
                base = sb.toString();
            }

            for (String[] it : items) {
                String out = it[1].substring(base.length());
                if (out.isEmpty()) continue;
                File target = new File(dest, out);
                String canon = target.getCanonicalPath();
                if (!canon.startsWith(destCanon + File.separator)) continue; // anti zip-slip
                File parent = target.getParentFile();
                if (parent != null && !parent.exists() && !parent.mkdirs()) {
                    throw new IOException("Tidak bisa membuat folder " + parent.getName());
                }
                ZipEntry ze = zf.getEntry(it[0]);
                if (ze == null) continue;
                try (InputStream in = zf.getInputStream(ze); FileOutputStream fo = new FileOutputStream(target)) {
                    byte[] buf = new byte[16384];
                    long total = 0;
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        total += n;
                        if (total > MAX_FILE) throw new IOException("File .inc terlalu besar: " + out);
                        fo.write(buf, 0, n);
                    }
                }
                written.add(out);
            }
            return base;
        } finally {
            try { zf.close(); } catch (IOException ignore) { }
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        final String id = call.getString("id");
        if (id == null || id.isEmpty()) {
            call.reject("id kosong");
            return;
        }
        EX.execute(() -> {
            try {
                JSONObject m = readManifest();
                JSONObject e = m.optJSONObject(id);
                if (e == null) {
                    call.reject("Library tidak tercatat");
                    return;
                }
                File dest = includeDir();
                String destCanon = dest.getCanonicalPath();
                JSONArray files = e.optJSONArray("files");
                int removed = 0;
                if (files != null) {
                    for (int i = 0; i < files.length(); i++) {
                        File f = new File(dest, files.getString(i));
                        if (!f.getCanonicalPath().startsWith(destCanon + File.separator)) continue;
                        if (f.delete()) removed++;
                        File p = f.getParentFile();
                        while (p != null && !p.getCanonicalPath().equals(destCanon)) {
                            String[] left = p.list();
                            if (left != null && left.length == 0 && p.delete()) p = p.getParentFile();
                            else break;
                        }
                    }
                }
                m.remove(id);
                writeManifest(m);
                JSObject ret = new JSObject();
                ret.put("removed", removed);
                call.resolve(ret);
            } catch (Throwable t) {
                call.reject(t.getMessage() != null ? t.getMessage() : t.toString());
            }
        });
    }
}
