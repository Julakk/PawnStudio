package xyz.ahmadhosting.pawnstudio;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;

import java.io.File;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

// Git (tahap 1: BACA SAJA). Status, cabang, dan riwayat repo di workspace aktif.
// Tidak ada operasi yang mengubah repo atau file di plugin ini.
@CapacitorPlugin(name = "GitNative")
public class GitPlugin extends Plugin {
    private static final int MAX_FILES = 500;

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
}
