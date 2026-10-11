package xyz.ahmadhosting.pawnstudio;

import android.content.Context;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.PullResult;
import org.eclipse.jgit.api.ResetCommand;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.StoredConfig;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.PushResult;
import org.eclipse.jgit.transport.RemoteRefUpdate;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

// Git di PawnStudio. Tahap 1: status, cabang, riwayat (baca saja).
// Tahap 2a: simpan identitas, inisialisasi repo, commit file terpilih (semuanya lokal, tanpa jaringan).
// Tahap 2b: atur remote, push, pull (HTTPS + token GitHub).
@CapacitorPlugin(name = "GitNative")
public class GitPlugin extends Plugin {
    private static final int MAX_FILES = 500;
    private static final String PREFS = "pawnstudio_git";
    private static final String TOKEN_FILE = "git-token";

    @Override
    public void load() {
        // Android tidak punya HOME; JGit membacanya untuk mencari ~/.gitconfig.
        try {
            System.setProperty("user.home", getContext().getFilesDir().getAbsolutePath());
        } catch (Throwable ignored) {
        }
    }

    // Folder repo = workspace aktif (atau subfolder di dalamnya). Menolak path di luar workspace.
    private File repoDir(PluginCall call) throws Exception {
        File root = WorkspaceManager.getActiveRoot(getContext());
        String rel = call.getString("path", "");
        File dir = (rel == null || rel.isEmpty()) ? root : new File(root, rel);
        String rc = root.getCanonicalPath();
        String dc = dir.getCanonicalPath();
        if (!dc.equals(rc) && !dc.startsWith(rc + File.separator)) {
            throw new SecurityException("Path di luar workspace");
        }
        return dir;
    }

    private static void put(Map<String, String> map, Set<String> paths, String state) {
        if (paths == null) return;
        for (String p : paths) map.put(p, state);
    }

    // Sembunyikan kredensial kalau URL remote berbentuk https://user:token@host/...
    private static String stripCredentials(String url) {
        return url.replaceAll("//[^/@]+@", "//");
    }

    // ---- identitas & token ----
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // Token disimpan di noBackupFilesDir supaya TIDAK ikut backup Android. Tidak dienkripsi tambahan.
    private File tokenFile() {
        return new File(getContext().getNoBackupFilesDir(), TOKEN_FILE);
    }

    private boolean hasToken() {
        File f = tokenFile();
        return f.exists() && f.length() > 0;
    }

    private JSObject identityJson() {
        SharedPreferences p = prefs();
        JSObject o = new JSObject();
        o.put("name", p.getString("name", ""));
        o.put("email", p.getString("email", ""));
        o.put("username", p.getString("username", ""));
        o.put("hasToken", hasToken());
        return o;
    }

    @PluginMethod
    public void getIdentity(PluginCall call) {
        try {
            call.resolve(identityJson());
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    @PluginMethod
    public void setIdentity(PluginCall call) {
        try {
            SharedPreferences.Editor e = prefs().edit();
            String name = call.getString("name");
            String email = call.getString("email");
            String username = call.getString("username");
            if (name != null) e.putString("name", name.trim());
            if (email != null) e.putString("email", email.trim());
            if (username != null) e.putString("username", username.trim());
            e.apply();

            String token = call.getString("token");
            Boolean clear = call.getBoolean("clearToken", false);
            File tf = tokenFile();
            if (Boolean.TRUE.equals(clear)) {
                if (tf.exists()) tf.delete();
            } else if (token != null && !token.trim().isEmpty()) {
                try (FileOutputStream out = new FileOutputStream(tf)) {
                    out.write(token.trim().getBytes("UTF-8"));
                }
                tf.setReadable(false, false);
                tf.setReadable(true, true);
            }
            call.resolve(identityJson());
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    // ---- baca ----
    @PluginMethod
    public void status(PluginCall call) {
        try {
            File dir = repoDir(call);
            JSObject ret = new JSObject();
            ret.put("root", dir.getAbsolutePath());
            if (!new File(dir, ".git").exists()) {
                ret.put("isRepo", false);
                call.resolve(ret);
                return;
            }
            try (Git git = Git.open(dir)) {
                Repository repo = git.getRepository();
                Status st = git.status().call();
                TreeMap<String, String> map = new TreeMap<>();
                put(map, st.getUntracked(), "?");
                put(map, st.getAdded(), "A");
                put(map, st.getChanged(), "M");
                put(map, st.getModified(), "M");
                put(map, st.getRemoved(), "D");
                put(map, st.getMissing(), "D");
                put(map, st.getConflicting(), "U");

                JSArray files = new JSArray();
                int n = 0;
                for (Map.Entry<String, String> e : map.entrySet()) {
                    if (n++ >= MAX_FILES) {
                        ret.put("truncated", true);
                        break;
                    }
                    JSObject f = new JSObject();
                    f.put("path", e.getKey());
                    f.put("state", e.getValue());
                    files.put(f);
                }
                String url = repo.getConfig().getString("remote", "origin", "url");
                ret.put("isRepo", true);
                ret.put("branch", repo.getBranch());
                ret.put("clean", st.isClean());
                ret.put("total", map.size());
                ret.put("files", files);
                ret.put("remote", url == null ? "" : stripCredentials(url));
                call.resolve(ret);
            }
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    @PluginMethod
    public void log(PluginCall call) {
        try {
            File dir = repoDir(call);
            int max = Math.min(Math.max(call.getInt("max", 30), 1), 100);
            JSArray commits = new JSArray();
            if (new File(dir, ".git").exists()) {
                try (Git git = Git.open(dir)) {
                    if (git.getRepository().resolve("HEAD") != null) {
                        for (RevCommit c : git.log().setMaxCount(max).call()) {
                            JSObject o = new JSObject();
                            o.put("id", c.getName().substring(0, 7));
                            o.put("message", c.getShortMessage());
                            o.put("author", c.getAuthorIdent().getName());
                            o.put("time", c.getCommitTime());
                            commits.put(o);
                        }
                    }
                }
            }
            JSObject ret = new JSObject();
            ret.put("commits", commits);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    // ---- tulis (lokal) ----
    @PluginMethod
    public void init(PluginCall call) {
        try {
            File dir = repoDir(call);
            if (new File(dir, ".git").exists()) {
                call.reject("Git: folder ini sudah repository");
                return;
            }
            try (Git git = Git.init().setDirectory(dir).setInitialBranch("main").call()) {
                // Penyimpanan bersama Android tidak menyimpan bit executable; hindari "perubahan" palsu.
                StoredConfig cfg = git.getRepository().getConfig();
                cfg.setBoolean("core", null, "filemode", false);
                cfg.save();
            }
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    // Commit HANYA file yang dipilih (paths). File yang sudah hilang di disk ikut dicatat sebagai terhapus.
    @PluginMethod
    public void commit(PluginCall call) {
        try {
            File dir = repoDir(call);
            String message = call.getString("message", "");
            if (message == null || message.trim().isEmpty()) {
                call.reject("Git: pesan commit tidak boleh kosong");
                return;
            }
            SharedPreferences p = prefs();
            String name = p.getString("name", "");
            String email = p.getString("email", "");
            if (name.isEmpty() || email.isEmpty()) {
                call.reject("Git: isi nama dan email dulu (tombol Akun)");
                return;
            }
            JSArray arr = call.getArray("paths");
            List<String> paths = arr == null ? null : arr.<String>toList();
            if (paths == null || paths.isEmpty()) {
                call.reject("Git: pilih minimal satu file");
                return;
            }
            if (!new File(dir, ".git").exists()) {
                call.reject("Git: folder ini belum repository");
                return;
            }
            try (Git git = Git.open(dir)) {
                for (String path : paths) {
                    if (path == null || path.isEmpty() || path.startsWith("/") || path.contains("..")
                            || path.equals(".git") || path.startsWith(".git/")) {
                        call.reject("Git: path tidak valid: " + path);
                        return;
                    }
                    if (new File(dir, path).exists()) git.add().addFilepattern(path).call();
                    else git.rm().addFilepattern(path).call();
                }
                Status st = git.status().call();
                if (st.getAdded().isEmpty() && st.getChanged().isEmpty() && st.getRemoved().isEmpty()) {
                    call.reject("Git: tidak ada perubahan yang bisa di-commit pada file terpilih");
                    return;
                }
                RevCommit c = git.commit().setMessage(message.trim())
                        .setAuthor(name, email).setCommitter(name, email).call();
                JSObject ret = new JSObject();
                ret.put("id", c.getName().substring(0, 7));
                ret.put("message", c.getShortMessage());
                call.resolve(ret);
            }
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    // ---- jaringan (tahap 2b): remote, push, pull. HTTPS + token. ----
    private CredentialsProvider creds() throws Exception {
        File tf = tokenFile();
        if (!tf.exists() || tf.length() == 0) {
            throw new IllegalStateException("Token GitHub belum diisi (tombol Akun)");
        }
        String token = new String(Files.readAllBytes(tf.toPath()), "UTF-8").trim();
        String user = prefs().getString("username", "");
        return new UsernamePasswordCredentialsProvider(user.isEmpty() ? "x-access-token" : user, token);
    }

    private static String friendly(Throwable t) {
        String m = String.valueOf(t.getMessage());
        String l = m.toLowerCase();
        if (l.contains("not found in upstream") || l.contains("couldn't find remote ref")) {
            return "Cabang ini belum ada di remote. Lakukan Push dulu. (" + m + ")";
        }
        if (l.contains("not authorized") || l.contains("401") || l.contains("403") || l.contains("authentication")) {
            return "Token ditolak atau tidak punya izin untuk repo ini. Cek token di Akun. (" + m + ")";
        }
        if (l.contains("unknownhost") || l.contains("unable to resolve") || l.contains("timed out")) {
            return "Tidak bisa terhubung ke server. Cek koneksi internet. (" + m + ")";
        }
        if (l.contains("not found") || l.contains("404")) {
            return "Repository di remote tidak ditemukan atau token tidak punya akses. (" + m + ")";
        }
        return m;
    }

    private static String cleanUrl(String url) {
        String u = url == null ? "" : url.trim();
        if (!u.startsWith("https://")) throw new IllegalArgumentException("URL remote harus diawali https://");
        if (u.matches(".*\\s.*")) throw new IllegalArgumentException("URL remote tidak boleh mengandung spasi");
        if (u.matches("^https://[^/@]+@.*")) {
            throw new IllegalArgumentException("Jangan taruh token di URL. Isi token lewat tombol Akun");
        }
        return u;
    }

    // Hubungkan cabang aktif ke origin supaya pull tahu cabang mana yang diambil.
    private static void configureTracking(Repository repo, StoredConfig cfg) throws Exception {
        String full = repo.getFullBranch();
        if (full != null && full.startsWith("refs/heads/")) {
            String b = full.substring("refs/heads/".length());
            cfg.setString("branch", b, "remote", "origin");
            cfg.setString("branch", b, "merge", full);
        }
    }

    private static String originUrl(Repository repo) {
        String url = repo.getConfig().getString("remote", "origin", "url");
        return url == null ? "" : url;
    }

    @PluginMethod
    public void setRemote(PluginCall call) {
        try {
            File dir = repoDir(call);
            String url = cleanUrl(call.getString("url", ""));
            if (!new File(dir, ".git").exists()) {
                call.reject("Git: folder ini belum repository");
                return;
            }
            try (Git git = Git.open(dir)) {
                Repository repo = git.getRepository();
                StoredConfig cfg = repo.getConfig();
                cfg.setString("remote", "origin", "url", url);
                cfg.setString("remote", "origin", "fetch", "+refs/heads/*:refs/remotes/origin/*");
                configureTracking(repo, cfg);
                cfg.save();
            }
            JSObject ret = new JSObject();
            ret.put("remote", url);
            call.resolve(ret);
        } catch (Throwable t) {
            call.reject("Git: " + t.getMessage());
        }
    }

    @PluginMethod
    public void push(PluginCall call) {
        try {
            File dir = repoDir(call);
            if (!new File(dir, ".git").exists()) {
                call.reject("Git: folder ini belum repository");
                return;
            }
            try (Git git = Git.open(dir)) {
                Repository repo = git.getRepository();
                if (repo.resolve("HEAD") == null) {
                    call.reject("Git: belum ada commit untuk di-push");
                    return;
                }
                if (originUrl(repo).isEmpty()) {
                    call.reject("Git: atur remote dulu");
                    return;
                }
                CredentialsProvider cp = creds();
                int sent = 0, upToDate = 0;
                StringBuilder bad = new StringBuilder();
                for (PushResult r : git.push().setRemote("origin").setCredentialsProvider(cp).call()) {
                    for (RemoteRefUpdate u : r.getRemoteUpdates()) {
                        RemoteRefUpdate.Status s = u.getStatus();
                        if (s == RemoteRefUpdate.Status.OK) {
                            sent++;
                        } else if (s == RemoteRefUpdate.Status.UP_TO_DATE) {
                            upToDate++;
                        } else if (s == RemoteRefUpdate.Status.REJECTED_NONFASTFORWARD
                                || s == RemoteRefUpdate.Status.REJECTED_REMOTE_CHANGED) {
                            bad.append("Ditolak: remote punya commit yang belum ada di sini. Pull dulu. ");
                        } else {
                            bad.append(u.getRemoteName()).append(": ").append(s);
                            if (u.getMessage() != null) bad.append(" (").append(u.getMessage()).append(")");
                            bad.append(' ');
                        }
                    }
                }
                if (bad.length() > 0) {
                    call.reject("Git: " + bad.toString().trim());
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("sent", sent);
                ret.put("upToDate", upToDate);
                call.resolve(ret);
            }
        } catch (Throwable t) {
            call.reject("Git: " + friendly(t));
        }
    }

    // Pull hanya jalan kalau file yang dilacak bersih. Kalau penggabungan gagal, dikembalikan ke commit semula.
    @PluginMethod
    public void pull(PluginCall call) {
        try {
            File dir = repoDir(call);
            if (!new File(dir, ".git").exists()) {
                call.reject("Git: folder ini belum repository");
                return;
            }
            try (Git git = Git.open(dir)) {
                Repository repo = git.getRepository();
                if (originUrl(repo).isEmpty()) {
                    call.reject("Git: atur remote dulu");
                    return;
                }
                ObjectId before = repo.resolve("HEAD");
                if (before == null) {
                    call.reject("Git: belum ada commit lokal. Commit dulu sebelum Pull");
                    return;
                }
                Status st = git.status().call();
                if (!(st.getAdded().isEmpty() && st.getChanged().isEmpty() && st.getRemoved().isEmpty()
                        && st.getModified().isEmpty() && st.getMissing().isEmpty() && st.getConflicting().isEmpty())) {
                    call.reject("Git: ada perubahan yang belum di-commit. Commit dulu sebelum Pull");
                    return;
                }
                // Repo publik bisa di-pull tanpa token; repo privat akan ditolak server dengan pesan jelas.
                CredentialsProvider cp = hasToken() ? creds() : null;
                StoredConfig cfg = repo.getConfig();
                SharedPreferences p = prefs();
                String name = p.getString("name", "");
                String email = p.getString("email", "");
                if (!name.isEmpty()) cfg.setString("user", null, "name", name);
                if (!email.isEmpty()) cfg.setString("user", null, "email", email);
                configureTracking(repo, cfg);
                cfg.save();

                PullResult pr = git.pull().setCredentialsProvider(cp).call();
                if (!pr.isSuccessful()) {
                    git.reset().setMode(ResetCommand.ResetType.HARD).setRef(before.getName()).call();
                    call.reject("Git: Pull gagal digabung atau berkonflik, jadi dibatalkan dan file dikembalikan. "
                            + "Selesaikan penggabungan di komputer atau Termux");
                    return;
                }
                JSObject ret = new JSObject();
                ret.put("status", pr.getMergeResult() == null ? "" : String.valueOf(pr.getMergeResult().getMergeStatus()));
                call.resolve(ret);
            }
        } catch (Throwable t) {
            call.reject("Git: " + friendly(t));
        }
    }
}
