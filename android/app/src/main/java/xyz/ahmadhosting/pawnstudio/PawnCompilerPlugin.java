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

    // Include bawaan cadangan (memory, sscanf2, streamer, dst). Dipakai HANYA
    // kalau project user nggak punya versinya sendiri (prioritas -i paling bawah).
    private File extraIncludeDir() {
        File dir = new File(getContext().getFilesDir(), "pawno/extra");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private void ensureExtraIncludesExtracted() throws Exception {
        String[] assetFiles = getContext().getAssets().list("pawno/extra");
        if (assetFiles == null) return;
        File dir = extraIncludeDir();

        for (String name : assetFiles) {
            if (!name.toLowerCase().endsWith(".inc")) continue;
            File outFile = new File(dir, name);

            InputStream input = getContext().getAssets().open("pawno/extra/" + name);
            java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
            byte[] buffer = new byte[4096];
            int read;
            while ((read = input.read(buffer)) != -1) bos.write(buffer, 0, read);
            input.close();
            byte[] data = bos.toByteArray();

            // Timpa kalau belum ada / ukurannya beda (APK baru bawa versi baru)
            if (outFile.exists() && outFile.length() == data.length) continue;
            FileOutputStream output = new FileOutputStream(outFile);
            output.write(data);
            output.close();
        }
    }

    private void ensureIncludesExtracted() throws Exception {
        ensureExtraIncludesExtracted();
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
                    // SEBELUMNYA cuma nyalin file .inc/.pwn/.p - ternyata
                    // beberapa library (nex-ac dkk) #include file berekstensi
                    // lain (.lang, dll). Sekarang semua file disalin (kecuali
                    // yang gede banget, jaga-jaga folder include kecampur aset
                    // lain) - proses normalisasi (ISO-8859-1 round-trip) aman
                    // buat file apapun, nggak cuma teks.
                    if (c.length() <= 4L * 1024 * 1024) {
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

    // ==================================================
    // Diagnosa include hilang: kalau compiler bilang 'cannot read from file: "X"',
    // cari X di SELURUH project (tanpa peduli huruf besar/kecil) dan kasih
    // tau user file itu ada di mana, atau memang belum ada sama sekali.
    // ==================================================
    private void findByName(File dir, java.util.Set<String> wanted, java.util.List<String> out, int depth, int[] budget) {
        if (depth > 8 || budget[0] <= 0) return;
        File[] kids = dir.listFiles();
        if (kids == null) return;
        for (File k : kids) {
            if (budget[0]-- <= 0) return;
            if (k.isDirectory()) {
                if (k.getName().equals("compiled")) continue;
                findByName(k, wanted, out, depth + 1, budget);
            } else if (wanted.contains(k.getName().toLowerCase())) {
                out.add(k.getAbsolutePath());
            }
        }
    }

    // Scan SEMUA #include di file yang lagi dicompile, dan list yang belum
    // ada di folder include manapun. Biar user tau semua library yang kurang
    // dalam sekali compile, bukan ketemu satu-satu tiap kali gagal.
    // Catatan: ini scan level atas saja (include di dalam library nggak diikuti),
    // dan nggak ngerti #if/#endif, jadi hasilnya "kemungkinan".
    private java.util.List<String> scanMissingIncludes(String source, String relativeFilePath) {
        java.util.List<String> missing = new java.util.ArrayList<>();
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("^[ \\t]*#[ \\t]*include[ \\t]*[<\"]([^>\"\\r\\n]+)[>\"]", java.util.regex.Pattern.MULTILINE)
                .matcher(source);

        java.util.List<File> dirs = new java.util.ArrayList<>();
        dirs.add(includeDir());
        dirs.add(extraIncludeDir());
        dirs.addAll(resolveProjectIncludeDirs(relativeFilePath));

        java.util.Set<String> seen = new java.util.HashSet<>();
        String[] exts = new String[]{"", ".inc", ".p", ".pwn"};
        while (m.find()) {
            String name = m.group(1).trim().replace('\\', '/');
            if (!seen.add(name)) continue;
            boolean ok = false;
            for (File d : dirs) {
                for (String ext : exts) {
                    if (new File(d, name + ext).isFile()) { ok = true; break; }
                }
                if (ok) break;
            }
            if (!ok) missing.add(name);
        }
        return missing;
    }

    private String buildMissingIncludeHint(String output, String source, String relativeFilePath) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("cannot read from file: \"([^\"]+)\"").matcher(output);
        if (!m.find()) return null;

        String missing = m.group(1).replace('\\', '/');
        String base = missing.substring(missing.lastIndexOf('/') + 1);
        java.util.Set<String> wanted = new java.util.HashSet<>();
        String lower = base.toLowerCase();
        wanted.add(lower);
        if (!lower.endsWith(".inc")) wanted.add(lower + ".inc");
        if (!lower.endsWith(".p")) wanted.add(lower + ".p");

        java.util.List<String> found = new java.util.ArrayList<>();
        findByName(projectRootDir(), wanted, found, 0, new int[]{60000});

        StringBuilder sb = new StringBuilder();
        sb.append("[Diagnosa] include \"").append(missing).append("\" tidak ketemu.\n");
        if (found.isEmpty()) {
            sb.append("File bernama \"").append(base).append("\" (.inc) TIDAK ADA di seluruh folder project.\n");
            sb.append("Artinya library ini belum ada - taruh file-nya di pawno/include/.");
        } else {
            sb.append("File yang namanya mirip ada di:\n");
            for (int i = 0; i < found.size() && i < 5; i++) sb.append("  ").append(found.get(i)).append("\n");
            sb.append("Cek: beda huruf besar/kecil sama yang ditulis di #include (Android peka huruf besar/kecil),\n");
            sb.append("atau file-nya ada di folder yang bukan pawno/include.");
        }

        java.util.List<String> allMissing = scanMissingIncludes(source, relativeFilePath);
        if (allMissing.size() > 1) {
            sb.append("\n\nSemua include di file ini yang belum ketemu (kemungkinan, cek satu-satu):\n");
            for (String n : allMissing) sb.append("  - ").append(n).append("\n");
        }
        return sb.toString();
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
            // Paling akhir: include bawaan cadangan (kalah prioritas sama project)
            cmdArgs.add("-i" + extraIncludeDir().getAbsolutePath());

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

            if (exitCode != 0) {
                String hint = buildMissingIncludeHint(stdout + "\n" + stderr, sourceCode, relativeFilePath);
                if (hint != null) result.put("hint", hint);
            }

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
