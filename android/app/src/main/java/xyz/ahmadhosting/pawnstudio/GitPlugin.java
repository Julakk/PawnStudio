package xyz.ahmadhosting.pawnstudio;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.PullResult;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.api.errors.NoHeadException;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.lib.StoredConfig;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.transport.PushResult;
import org.eclipse.jgit.transport.RefSpec;
import org.eclipse.jgit.transport.RemoteRefUpdate;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;
import java.util.TreeMap;

@CapacitorPlugin(name = "Git")
public class GitPlugin extends Plugin {

    private static final String TAG = "GitPlugin";
    private static final String PREFS = "pawnstudio_git";

    private File root() {
        return WorkspaceManager.getActiveRoot(getContext());
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void prepareEnv() {
        try {
            System.setProperty("user.home", getContext().getFilesDir().getAbsolutePath());
        } catch (Throwable ignore) { }
    }

    private void tuneConfig(Repository repo) {
        try {
            StoredConfig cfg = repo.getConfig();
            cfg.setBoolean("core", null, "filemode", false);
            cfg.setBoolean("core", null, "symlinks", false);
            cfg.save();
        } catch (Exception ignore) { }
    }

    private Git openRepo() throws Exception {
        prepareEnv();
        File r = root();
        if (!new File(r, ".git").exists()) {
            throw new IllegalStateException("Folder ini belum jadi repo Git. Tekan Init dulu.");
        }
        Git git = Git.open(r);
        tuneConfig(git.getRepository());
        return git;
    }

    private UsernamePasswordCredentialsProvider creds() {
        SharedPreferences sp = prefs();
        String u = sp.getString("user", "");
        String t = sp.getString("token", "");
        if (t.isEmpty()) {
            throw new IllegalStateException("Token GitHub belum disimpan.");
        }
        return new UsernamePasswordCredentialsProvider(u.isEmpty() ? "token" : u, t);
    }

    private void fail(PluginCall call, Throwable e) {
        Log.e(TAG, "Git error", e);
        String m = e.getMessage();
        if (m == null || m.isEmpty()) m = e.getClass().getSimpleName();
        call.reject(m);
    }

    @PluginMethod
    public void status(PluginCall call) {
        try {
            prepareEnv();
            File r = root();
            JSObject res = new JSObject();
            res.put("rootName", r.getName());
            res.put("hasToken", !prefs().getString("token", "").isEmpty());
            boolean isRepo = new File(r, ".git").exists();
            res.put("isRepo", isRepo);
            if (!isRepo) {
                call.resolve(res);
                return;
            }
            try (Git git = openRepo()) {
                Repository repo = git.getRepository();
                String branch = repo.getBranch();
                res.put("branch", branch == null ? "" : branch);
                String remote = repo.getConfig().getString("remote", "origin", "url");
                res.put("remote", remote == null ? "" : remote);

                Status st = git.status().call();
                TreeMap<String, String> changes = new TreeMap<>();
                for (String p : st.getUntracked()) changes.put(p, "?");
                for (String p : st.getAdded()) changes.put(p, "A");
                for (String p : st.getChanged()) changes.put(p, "M");
                for (String p : st.getModified()) changes.put(p, "M");
                for (String p : st.getMissing()) changes.put(p, "D");
                for (String p : st.getRemoved()) changes.put(p, "D");
                for (String p : st.getConflicting()) changes.put(p, "U");

                JSArray arr = new JSArray();
                int count = 0;
                for (Map.Entry<String, String> e : changes.entrySet()) {
                    if (count++ >= 200) break;
                    JSObject o = new JSObject();
                    o.put("path", e.getKey());
                    o.put("state", e.getValue());
                    arr.put(o);
                }
                res.put("changes", arr);
                res.put("changeCount", changes.size());
            }
            call.resolve(res);
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void init(PluginCall call) {
        try {
            prepareEnv();
            File r = root();
            if (new File(r, ".git").exists()) {
                call.reject("Folder ini sudah jadi repo Git.");
                return;
            }
            try (Git git = Git.init().setDirectory(r).setInitialBranch("main").call()) {
                tuneConfig(git.getRepository());
            }
            call.resolve();
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void setRemote(PluginCall call) {
        String url = call.getString("url", "").trim();
        if (!url.startsWith("https://")) {
            call.reject("URL remote harus diawali https://");
            return;
        }
        try (Git git = openRepo()) {
            Repository repo = git.getRepository();
            StoredConfig cfg = repo.getConfig();
            cfg.setString("remote", "origin", "url", url);
            cfg.setString("remote", "origin", "fetch", "+refs/heads/*:refs/remotes/origin/*");
            String branch = repo.getBranch();
            if (branch != null && !branch.isEmpty()) {
                cfg.setString("branch", branch, "remote", "origin");
                cfg.setString("branch", branch, "merge", "refs/heads/" + branch);
            }
            cfg.save();
            call.resolve();
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void saveCredentials(PluginCall call) {
        String user = call.getString("user", "").trim();
        String token = call.getString("token", "").trim();
        if (token.isEmpty()) {
            call.reject("Token kosong.");
            return;
        }
        prefs().edit().putString("user", user).putString("token", token).apply();
        call.resolve();
    }

    @PluginMethod
    public void clearCredentials(PluginCall call) {
        prefs().edit().remove("user").remove("token").apply();
        call.resolve();
    }

    @PluginMethod
    public void commit(PluginCall call) {
        String msg = call.getString("message", "").trim();
        String name = call.getString("name", "").trim();
        String email = call.getString("email", "").trim();
        if (msg.isEmpty()) {
            call.reject("Pesan commit kosong.");
            return;
        }
        if (name.isEmpty() || email.isEmpty()) {
            call.reject("Isi nama dan email author dulu.");
            return;
        }
        try (Git git = openRepo()) {
            git.add().addFilepattern(".").call();
            git.add().setUpdate(true).addFilepattern(".").call();
            Status st = git.status().call();
            if (st.getAdded().isEmpty() && st.getChanged().isEmpty() && st.getRemoved().isEmpty()) {
                call.reject("Tidak ada perubahan untuk di-commit.");
                return;
            }
            RevCommit c = git.commit().setMessage(msg).setAuthor(name, email).setCommitter(name, email).call();
            JSObject res = new JSObject();
            res.put("hash", c.getName().substring(0, 7));
            call.resolve(res);
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void push(PluginCall call) {
        try (Git git = openRepo()) {
            String branch = git.getRepository().getBranch();
            if (branch == null || branch.length() == 40) {
                call.reject("Repo dalam kondisi detached HEAD, push dibatalkan.");
                return;
            }
            Iterable<PushResult> results = git.push()
                    .setRemote("origin")
                    .setRefSpecs(new RefSpec("refs/heads/" + branch + ":refs/heads/" + branch))
                    .setCredentialsProvider(creds())
                    .call();
            boolean allUpToDate = true;
            StringBuilder problems = new StringBuilder();
            for (PushResult pr : results) {
                for (RemoteRefUpdate u : pr.getRemoteUpdates()) {
                    RemoteRefUpdate.Status s = u.getStatus();
                    if (s == RemoteRefUpdate.Status.OK) {
                        allUpToDate = false;
                    } else if (s != RemoteRefUpdate.Status.UP_TO_DATE) {
                        String hint = (s == RemoteRefUpdate.Status.REJECTED_NONFASTFORWARD)
                                ? "remote punya commit baru, Pull dulu"
                                : String.valueOf(s);
                        problems.append(u.getRemoteName()).append(": ").append(hint);
                        if (u.getMessage() != null) problems.append(" (").append(u.getMessage()).append(")");
                        problems.append("\n");
                    }
                }
            }
            if (problems.length() > 0) {
                call.reject("Push ditolak: " + problems.toString().trim());
                return;
            }
            JSObject res = new JSObject();
            res.put("upToDate", allUpToDate);
            call.resolve(res);
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void pull(PluginCall call) {
        try (Git git = openRepo()) {
            PullResult pr = git.pull().setRemote("origin").setCredentialsProvider(creds()).call();
            if (!pr.isSuccessful()) {
                String detail = pr.getMergeResult() != null
                        ? String.valueOf(pr.getMergeResult().getMergeStatus())
                        : "fetch/merge gagal";
                call.reject("Pull belum berhasil (" + detail + "). Kalau ada konflik, selesaikan lewat Termux.");
                return;
            }
            JSObject res = new JSObject();
            if (pr.getMergeResult() != null) {
                res.put("status", String.valueOf(pr.getMergeResult().getMergeStatus()));
            }
            call.resolve(res);
        } catch (Throwable e) {
            fail(call, e);
        }
    }

    @PluginMethod
    public void log(PluginCall call) {
        int limit = call.getInt("limit", 8);
        try (Git git = openRepo()) {
            JSArray arr = new JSArray();
            try {
                SimpleDateFormat fmt = new SimpleDateFormat("dd MMM HH:mm", new Locale("id", "ID"));
                for (RevCommit c : git.log().setMaxCount(limit).call()) {
                    JSObject o = new JSObject();
                    o.put("hash", c.getName().substring(0, 7));
                    o.put("message", c.getShortMessage());
                    o.put("author", c.getAuthorIdent().getName());
                    o.put("when", fmt.format(new Date(c.getCommitTime() * 1000L)));
                    arr.put(o);
                }
            } catch (NoHeadException ignore) {
                // belum ada commit
            }
            JSObject res = new JSObject();
            res.put("commits", arr);
            call.resolve(res);
        } catch (Throwable e) {
            fail(call, e);
        }
    }
}
