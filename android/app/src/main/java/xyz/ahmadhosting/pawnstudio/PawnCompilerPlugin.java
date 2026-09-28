package xyz.ahmadhosting.pawnstudio;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

@CapacitorPlugin(name = "PawnCompiler")
public class PawnCompilerPlugin extends Plugin {

    private static final String TAG = "PawnCompiler";
    private static final String BIN_NAME = "libpawncc.so";

    private String nativeLibDir() {
        return getContext().getApplicationInfo().nativeLibraryDir;
    }

    private File includeDir() {
        File dir = new File(getContext().getFilesDir(), "pawno/include");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    // Root folder project user (SAMA PERSIS dengan NativeStoragePlugin &
    // FolderPickerPlugin) - dibaca dari WorkspaceManager, jadi compiler
    // SELALU mengarah ke folder yang lagi dibuka user di Explorer, apapun
    // itu (sandbox default atau folder asli yang dibuka lewat "Buka Folder
    // Project").
    private File projectRootDir() {
        return WorkspaceManager.getActiveRoot(getContext());
    }

    // Kumpulin semua folder include TAMBAHAN dari dalam project user sendiri
    // (di luar include bawaan PawnStudio), biar file kayak a_mysql.inc yang
    // di-upload user sendiri bisa ketemu sama compiler.
    private java.util.List<File> resolveProjectIncludeDirs(String relativeFilePath) {
        java.util.List<File> dirs = new java.util.ArrayList<>();
        File root = projectRootDir();

        // Root project sendiri - jaga-jaga kalau user taruh .inc custom
        // langsung sejajar di root tanpa folder include/ apapun.
        dirs.add(root);

        // Konvensi umum SA-MP: folder include di root project
        File conv1 = new File(root, "include");
        if (conv1.exists() && conv1.isDirectory()) dirs.add(conv1);

        File conv2 = new File(root, "pawno/include");
        if (conv2.exists() && conv2.isDirectory()) dirs.add(conv2);

        // Folder tempat file yang lagi di-compile itu sendiri berada
        if (relativeFilePath != null && relativeFilePath.contains("/")) {
            String parentRel = relativeFilePath.substring(0, relativeFilePath.lastIndexOf("/"));
            File ownDir = new File(root, parentRel);
            if (ownDir.exists() && ownDir.isDirectory()) dirs.add(ownDir);
        }

        return dirs;
    }

    private File compiledOutputDir() {
        // Ditaruh DI DALAM folder project yang lagi aktif (folder "compiled/"),
        // biar keliatan langsung di Explorer - mirip folder "dist"/"build" di
        // VSCode - bukan disembunyiin di storage privat app kayak sebelumnya.
        File dir = new File(projectRootDir(), "compiled");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private void ensureIncludesExtracted() throws Exception {
        File dir = includeDir();
        String[] assetFiles = getContext().getAssets().list("pawno/include");
        if (assetFiles == null) return;

        for (String name : assetFiles) {
            File outFile = new File(dir, name);
            if (outFile.exists()) continue;

            InputStream input = getContext().getAssets().open("pawno/include/" + name);
            FileOutputStream output = new FileOutputStream(outFile);
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            output.close();
            input.close();
        }
    }

    private String readStream(InputStream is) throws Exception {
        BufferedReader reader = new BufferedReader(new InputStreamReader(is));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = reader.readLine()) != null) {
            sb.append(line).append("\n");
        }
        reader.close();
        return sb.toString();
    }

    // ==================================================
    // Normalisasi backslash di #include (tanpa #pragma compat)
    // ==================================================
    private static final java.util.regex.Pattern INCLUDE_LINE =
            java.util.regex.Pattern.compile("^[ \\t]*#[ \\t]*(?:try)?include\\b[^\\r\\n]*",
                    java.util.regex.Pattern.MULTILINE);

    // Ganti "\" jadi "/" cuma di baris #include / #tryinclude. Panjang teks
    // TIDAK berubah (1 karakter diganti 1 karakter), dan backslash paling
    // akhir di baris (line continuation) dibiarkan.
    private String normalizeIncludeSeparators(String text) {
        if (text.indexOf('\\') < 0) return text;
        java.util.regex.Matcher m = INCLUDE_LINE.matcher(text);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String line = m.group();
            String fixed;
            if (line.endsWith("\\")) {
                fixed = line.substring(0, line.length() - 1).replace('\\', '/') + "\\";
            } else {
                fixed = line.replace('\\', '/');
            }
            m.appendReplacement(sb, java.util.regex.Matcher.quoteReplacement(fixed));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private byte[] readAllBytes(File f) throws Exception {
        java.io.FileInputStream in = new java.io.FileInputStream(f);
        try {
            java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream((int) Math.max(f.length(), 16));
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            return out.toByteArray();
        } finally {
            in.close();
        }
    }

    private void mirrorFile(File src, File dst) throws Exception {
        // Skip kalau salinan masih sinkron (panjang & waktu modifikasi sama)
        if (dst.exists() && dst.length() == src.length() && dst.lastModified() == src.lastModified()) return;

        // ISO-8859-1 = byte <-> char 1:1, jadi isi file (termasuk karakter
        // non-UTF8 di komentar) nggak rusak.
        String text = new String(readAllBytes(src), "ISO-8859-1");
        byte[] out = normalizeIncludeSeparators(text).getBytes("ISO-8859-1");

        FileOutputStream fos = new FileOutputStream(dst);
        try {
            fos.write(out);
        } finally {
            fos.close();
        }
        dst.setLastModified(src.lastModified());
    }

    private void deleteRecursive(File f) {
        File[] kids = f.listFiles();
        if (kids != null) for (File k : kids) deleteRecursive(k);
        f.delete();
    }

    private void mirrorDir(File src, File dst, boolean recursive) throws Exception {
        if (!dst.exists()) dst.mkdirs();

        java.util.Set<String> seen = new java.util.HashSet<>();
        File[] children = src.listFiles();
        if (children != null) {
            for (File c : children) {
                if (c.isDirectory()) {
                    if (recursive) {
                        seen.add(c.getName());
                        mirrorDir(c, new File(dst, c.getName()), true);
                    }
                } else {
                    String n = c.getName().toLowerCase();
                    if (n.endsWith(".inc") || n.endsWith(".pwn") || n.endsWith(".p")) {
                        seen.add(c.getName());
                        mirrorFile(c, new File(dst, c.getName()));
                    }
                }
            }
        }

        // Buang salinan basi (file yang udah dihapus/diganti nama di aslinya)
        File[] old = dst.listFiles();
        if (old != null) {
            for (File o : old) {
                if (!seen.contains(o.getName())) deleteRecursive(o);
            }
        }
    }

    // Bikin salinan ter-normalisasi (di cache) dari semua folder include
    // project, dan kembalikan folder salinan itu buat dipakai sebagai -i.
    // File asli di folder project user tidak pernah diubah.
    private java.util.List<File> buildIncludeMirror(String relativeFilePath) throws Exception {
        File root = projectRootDir();
        File mirrorRoot = new File(getContext().getCacheDir(), "pawn-include-mirror");
        if (!mirrorRoot.exists()) mirrorRoot.mkdirs();

        java.util.List<File> result = new java.util.ArrayList<>();
        java.util.Set<String> done = new java.util.HashSet<>();

        for (File dir : resolveProjectIncludeDirs(relativeFilePath)) {
            String key = dir.getAbsolutePath();
            if (!done.add(key)) continue;

            File target;
            if (dir.equals(root)) {
                // Root project: cuma file .inc/.pwn di root-nya (nggak rekursif)
                target = new File(mirrorRoot, "_root");
                mirrorDir(dir, target, false);
            } else {
                String rel = key.substring(root.getAbsolutePath().length());
                if (rel.startsWith("/")) rel = rel.substring(1);
                target = new File(mirrorRoot, rel);
                mirrorDir(dir, target, true);
            }
            result.add(target);
        }
        return result;
    }

    private String sanitizeFileName(String name) {
        String base = name.replaceAll("\\.pwn$", "").replaceAll("\\.inc$", "");
        base = base.replaceAll("[^a-zA-Z0-9_\\-]", "_");
        if (base.isEmpty()) base = "main";
        return base;
    }

    @PluginMethod
    public void compile(PluginCall call) {
        String sourceCode = call.getString("source");
        String rawFileName = call.getString("fileName", "main");
        String relativeFilePath = call.getString("path", "");

        if (sourceCode == null) {
            call.reject("Parameter 'source' wajib diisi");
            return;
        }

        try {
            ensureIncludesExtracted();

            String libDir = nativeLibDir();
            File binFile = new File(libDir, BIN_NAME);

            if (!binFile.exists()) {
                call.reject("Binary compiler tidak ditemukan di: " + binFile.getAbsolutePath());
                return;
            }

            String fileName = sanitizeFileName(rawFileName);

            // Source .pwn sementara boleh di cache (cuma dipakai pas compile)
            File workDir = new File(getContext().getCacheDir(), "pawn-compile");
            if (!workDir.exists()) workDir.mkdirs();
            File sourceFile = new File(workDir, fileName + ".pwn");
            FileWriter writer = new FileWriter(sourceFile);
            // Backslash di #include (gaya Windows, dipakai YSI dkk) TIDAK
            // dikenali compiler di Linux/Android kalau tanpa "#pragma compat 1",
            // tapi compat 1 sendiri bikin internal YSI rusak (AMX_GetGlobal,
            // ceildiv, dst). Solusi (sudah dites compile langsung di Linux
            // dengan compiler 3.10.10 + YSI 5.x): ganti "\" jadi "/" HANYA di
            // baris #include/#tryinclude, tanpa pragma apapun. File asli user
            // TIDAK diubah - yang dinormalisasi cuma salinan (mirror) di cache.
            writer.write(normalizeIncludeSeparators(sourceCode));
            writer.close();

            // Output .amx WAJIB ke folder permanen
            File outputAmx = new File(compiledOutputDir(), fileName + ".amx");

            java.util.List<String> cmdArgs = new java.util.ArrayList<>();
            cmdArgs.add(binFile.getAbsolutePath());
            cmdArgs.add(sourceFile.getAbsolutePath());
            cmdArgs.add("-o" + outputAmx.getAbsolutePath());
            cmdArgs.add("-i" + includeDir().getAbsolutePath());

            for (File extraIncludeDir : buildIncludeMirror(relativeFilePath)) {
                cmdArgs.add("-i" + extraIncludeDir.getAbsolutePath());
            }

            ProcessBuilder pb = new ProcessBuilder(cmdArgs);
            pb.environment().put("LD_LIBRARY_PATH", libDir);
            pb.directory(workDir);

            Process process = pb.start();
            String stdout = readStream(process.getInputStream());
            String stderr = readStream(process.getErrorStream());
            int exitCode = process.waitFor();

            JSObject result = new JSObject();
            result.put("exitCode", exitCode);
            result.put("stdout", stdout);
            result.put("stderr", stderr);
            result.put("debugCmd", String.join(" ", cmdArgs));
            result.put("success", exitCode == 0 && outputAmx.exists());

            if (outputAmx.exists()) {
                result.put("amxPath", outputAmx.getAbsolutePath());
                result.put("amxSize", outputAmx.length());
            }

            call.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Compile error", e);
            call.reject("Compile gagal: " + e.getMessage());
        }
    }
}
