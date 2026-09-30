package xyz.ahmadhosting.pawnstudio;

import android.util.Log;
import com.getcapacitor.JSArray;
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

    // Batas waktu keras buat SELURUH proses mirror (nyalin+normalisasi folder
    // include). Ini jalan SEBELUM pre-scan, dan sebelumnya sama sekali gak
    // ada batas waktunya - kalau foldernya gede banget & storage-nya lambat,
    // ini bisa jadi penyebab macet tanpa keliatan apa-apa di Output sama
    // sekali (karena macetnya sebelum ada satu baris pun yang sempat ditulis).
    private long mirrorDeadline = 0;

    private void mirrorDir(File src, File dst, boolean recursive) throws Exception {
        if (System.currentTimeMillis() > mirrorDeadline) return; // waktu habis, stop di sini apa adanya

        if (!dst.exists()) dst.mkdirs();

        java.util.Set<String> seen = new java.util.HashSet<>();
        File[] children = src.listFiles();
        boolean cutShort = false;
        if (children != null) {
            for (File c : children) {
                if (System.currentTimeMillis() > mirrorDeadline) { cutShort = true; break; } // waktu habis, sisa file gak ke-mirror

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

        // Buang salinan basi (file yang udah dihapus/diganti nama di aslinya).
        // SKIP kalau kepotong waktu habis - "seen" jadi gak lengkap, bisa
        // salah hapus file yang sebenarnya masih valid tapi belum sempat
        // dicek ulang.
        if (!cutShort) {
            File[] old = dst.listFiles();
            if (old != null) {
                for (File o : old) {
                    if (!seen.contains(o.getName())) deleteRecursive(o);
                }
            }
        }
    }

    // Bikin salinan ter-normalisasi (di cache) dari semua folder include
    // project, dan kembalikan folder salinan itu buat dipakai sebagai -i.
    // File asli di folder project user tidak pernah diubah.
    private java.util.List<File> buildIncludeMirror(String relativeFilePath) throws Exception {
        mirrorDeadline = System.currentTimeMillis() + 25000; // maksimal 25 detik buat tahap ini

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

    // ==================================================
    // Auto-fix beda huruf besar/kecil (Windows -> Android)
    // ==================================================
    // Banyak gamemode ditulis/dikembangin di Windows, yang nggak peduli
    // huruf besar/kecil nama file/folder. Begitu di-compile di Android
    // (peka huruf besar/kecil), #include yang nulis "FAMILIES" padahal
    // foldernya "families" di disk jadi gagal. Daripada user harus benerin
    // manual satu-satu (bisa puluhan di gamemode besar), app nyari versi
    // yang cocok (case-insensitive) dan bikin salinan dengan nama PERSIS
    // seperti yang ditulis di #include, otomatis, lalu coba compile ulang.
    private File resolveCaseInsensitive(File root, String relPath) {
        String[] parts = relPath.split("/");
        File current = root;
        for (String part : parts) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) { current = current.getParentFile(); continue; }
            if (current == null || !current.isDirectory()) return null;

            File exact = new File(current, part);
            if (exact.exists()) { current = exact; continue; }

            File[] kids = current.listFiles();
            File match = null;
            if (kids != null) {
                for (File k : kids) {
                    if (k.getName().equalsIgnoreCase(part)) { match = k; break; }
                }
            }
            if (match == null) return null;
            current = match;
        }
        return (current != null && current.exists()) ? current : null;
    }

    // Salin SEMUA isi folder (rekursif), bukan cuma 1 file. Penting: kalau
    // yang mismatch itu sebuah FOLDER (misal "Trans" vs "trans"), begitu folder
    // versi-fix dibuat, dia jadi exact-match buat pengecekan berikutnya - jadi
    // file lain di folder asli yang belum kebawa GAK BAKAL ketemu lagi. Makanya
    // sekali ketemu folder mismatch, borong semua isinya sekali jalan.
    private void copyTreeAll(File src, File dst) throws Exception {
        if (src.isDirectory()) {
            if (!dst.exists()) dst.mkdirs();
            File[] kids = src.listFiles();
            if (kids != null) {
                for (File k : kids) copyTreeAll(k, new File(dst, k.getName()));
            }
        } else {
            if (src.length() > 4L * 1024 * 1024) return; // jaga-jaga file kegedean
            // Lewat mirrorFile() (bukan copy mentah) - PENTING: kalau file yang
            // ke-fix ini sendiri punya #include backslash di dalamnya, itu ikut
            // dinormalisasi juga. Kalau nggak, compiler bakal gagal lagi di
            // include DALAM file ini walau folder luarnya udah kebenerin.
            mirrorFile(src, dst);
        }
    }

    // Jalan dari root, segmen demi segmen. Begitu ketemu 1 segmen yang cuma
    // cocok case-insensitive (bukan exact), borong seluruh isinya (file
    // maupun folder) ke lokasi baru dengan huruf PERSIS seperti di #include,
    // lalu berhenti (gak perlu lanjut ke bawah - semua turunannya udah ikut).
    private boolean applyCaseFix(File root, String relPathAsWritten) {
        if (!root.isDirectory()) return false;
        if (new File(root, relPathAsWritten).exists()) return false; // udah persis ada

        String[] parts = relPathAsWritten.split("/");
        File currentReal = root;
        File currentTarget = root;

        for (String part : parts) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) {
                if (currentReal.getParentFile() == null) return false;
                currentReal = currentReal.getParentFile();
                currentTarget = currentTarget.getParentFile();
                if (currentTarget == null) return false;
                continue;
            }

            File exactReal = new File(currentReal, part);
            if (exactReal.exists()) {
                currentReal = exactReal;
                currentTarget = new File(currentTarget, part);
                continue;
            }

            File[] kids = currentReal.listFiles();
            File match = null;
            if (kids != null) {
                for (File k : kids) {
                    if (k.getName().equalsIgnoreCase(part)) { match = k; break; }
                }
            }
            if (match == null) return false; // beneran gak ada, bukan soal huruf

            try {
                copyTreeAll(match, new File(currentTarget, part));
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return false;
    }

    private static final java.util.regex.Pattern INCLUDE_TARGET =
            java.util.regex.Pattern.compile("^[ \\t]*#[ \\t]*(?:try)?include[ \\t]*[<\"]([^>\"\\r\\n]+)[>\"]",
                    java.util.regex.Pattern.MULTILINE);

    // Mirror folder buat file "punya sendiri" si Main.pwn (folder tempat dia
    // ada, contoh "gamemodes/") - dipakai sebagai basis nyari #include yang
    // pakai path relatif. Rumusnya SAMA PERSIS kayak yang dipakai
    // buildIncludeMirror, biar hasilnya konsisten dengan folder yang udah
    // di-mirror di awal compile().
    private File ownDirMirrorFor(String relativeFilePath) {
        if (relativeFilePath == null || !relativeFilePath.contains("/")) return null;
        String parentRel = relativeFilePath.substring(0, relativeFilePath.lastIndexOf("/"));
        File mirrorRoot = new File(getContext().getCacheDir(), "pawn-include-mirror");
        return new File(mirrorRoot, parentRel);
    }

    // ==================================================
    // Pre-scan: benerin SEMUA beda-huruf yang bisa ketemu lewat baca teks
    // biasa (bukan lewat compile-gagal-coba-lagi), SEBELUM compiler pernah
    // dijalanin sekalipun. Ini krusial buat performa: tanpa ini, tiap 1 kasus
    // beda huruf = 1x compile ULANG DARI NOL (bisa lama banget di HP kalau
    // kasusnya ada belasan). Dengan ini, hampir semua kasus kebenerin di 1x
    // baca cepat, dan compiler cuma perlu dijalanin 1-2x aja.
    //
    // Batasan: cuma nangkep #include/#tryinclude yang keliatan langsung di
    // teks (gak ngerti makro/#if kompleks) - itu sebabnya loop compile-ulang
    // (di bawah) TETAP ada sebagai jaring pengaman buat yang keluput.
    // Cache listFiles() per folder SELAMA 1x panggilan preScanAndFix. Tanpa
    // ini, tiap include yang gagal exact-match bakal listFiles() folder yang
    // SAMA berkali-kali (misal pawno/include dicek ulang buat tiap 1 dari
    // puluhan kasus beda huruf) - mahal banget kalau storage-nya lambat
    // (umum di Android, apalagi folder Android/data/...).
    private final java.util.Map<String, File[]> dirListingCache = new java.util.HashMap<>();

    private File[] listFilesCached(File dir) {
        String key = dir.getAbsolutePath();
        File[] cached = dirListingCache.get(key);
        if (cached != null) return cached;
        File[] fresh = dir.listFiles();
        dirListingCache.put(key, fresh == null ? new File[0] : fresh);
        return dirListingCache.get(key);
    }

    private int preScanAndFix(String mainSource, String relativeFilePath, java.util.List<File> allRoots,
                               java.util.Set<File> trustedNoRecurse) {
        int fixedCount = 0;
        int maxFilesToScan = 4000;
        int processed = 0;
        long deadline = System.currentTimeMillis() + 20000; // pengaman keras: max 20 detik

        dirListingCache.clear();

        java.util.Set<String> visited = new java.util.HashSet<>();
        java.util.ArrayDeque<String> queueContent = new java.util.ArrayDeque<>();
        java.util.ArrayDeque<File> queueOwnDir = new java.util.ArrayDeque<>();

        // ArrayDeque nggak nerima null, jadi kalau file-nya ada di root project
        // (gak ada subfolder, ownDirMirrorFor balikin null), pakai root mirror
        // itu sendiri sebagai gantinya (masih masuk akal, dan gak bikin exception).
        File ownDirForMain = ownDirMirrorFor(relativeFilePath);
        queueContent.add(mainSource);
        queueOwnDir.add(ownDirForMain != null ? ownDirForMain : new File(getContext().getCacheDir(), "pawn-include-mirror/_root"));

        while (!queueContent.isEmpty() && processed < maxFilesToScan) {
            if (System.currentTimeMillis() > deadline) break; // waktu habis, lanjut ke compile apa adanya

            String content = queueContent.poll();
            File ownDir = queueOwnDir.poll();
            processed++;

            java.util.regex.Matcher m = INCLUDE_TARGET.matcher(content);
            while (m.find()) {
                String raw = m.group(1).trim();
                String path = raw.replace('\\', '/');

                java.util.List<File> bases = new java.util.ArrayList<>();
                if (ownDir != null) bases.add(ownDir);
                bases.addAll(allRoots);

                File resolved = null;
                for (File base : bases) {
                    File direct = new File(base, path);
                    if (direct.isFile()) { resolved = direct; break; }
                }

                if (resolved == null) {
                    for (File base : bases) {
                        if (applyCaseFixCached(base, path)) {
                            resolved = new File(base, path);
                            fixedCount++;
                            break;
                        }
                    }
                }
                if (resolved == null && !path.toLowerCase().endsWith(".inc")) {
                    for (File base : bases) {
                        if (applyCaseFixCached(base, path + ".inc")) {
                            resolved = new File(base, path + ".inc");
                            fixedCount++;
                            break;
                        }
                    }
                }

                // Kalau tetap gak ketemu: biarin, itu beneran hilang - compiler
                // yang bakal laporin (lewat diagnosa) pas beneran dijalanin.
                if (resolved == null || !resolved.isFile()) continue;

                if (!visited.add(resolved.getAbsolutePath())) continue; // udah pernah discan

                // File yang resolvenya dari folder bawaan app sendiri (bundled
                // asset / extra) udah PASTI konsisten casing-nya (kita yang
                // taruh sendiri) - gak perlu ikut dibongkar isinya lagi buat
                // nyari include lain, ngirit banyak baca file.
                if (isUnderAny(resolved, trustedNoRecurse)) continue;

                String lower = resolved.getName().toLowerCase();
                if (lower.endsWith(".inc") || lower.endsWith(".pwn") || lower.endsWith(".p")) {
                    try {
                        String childContent = new String(readAllBytes(resolved), "ISO-8859-1");
                        queueContent.add(childContent);
                        queueOwnDir.add(resolved.getParentFile());
                    } catch (Exception e) {
                        // abaikan - kalau ada masalah baca, biar ketauan pas compile beneran
                    }
                }
            }
        }
        return fixedCount;
    }

    private boolean isUnderAny(File f, java.util.Set<File> dirs) {
        if (dirs == null) return false;
        String path = f.getAbsolutePath();
        for (File d : dirs) {
            if (path.startsWith(d.getAbsolutePath() + "/")) return true;
        }
        return false;
    }

    // Sama kayak applyCaseFix, tapi pake cache listFiles() biar folder yang
    // sama gak di-scan ulang dari nol tiap kali.
    private boolean applyCaseFixCached(File root, String relPathAsWritten) {
        if (!root.isDirectory()) return false;
        if (new File(root, relPathAsWritten).exists()) return false;

        String[] parts = relPathAsWritten.split("/");
        File currentReal = root;
        File currentTarget = root;

        for (String part : parts) {
            if (part.isEmpty() || part.equals(".")) continue;
            if (part.equals("..")) {
                if (currentReal.getParentFile() == null) return false;
                currentReal = currentReal.getParentFile();
                currentTarget = currentTarget.getParentFile();
                if (currentTarget == null) return false;
                continue;
            }

            File exactReal = new File(currentReal, part);
            if (exactReal.exists()) {
                currentReal = exactReal;
                currentTarget = new File(currentTarget, part);
                continue;
            }

            File[] kids = listFilesCached(currentReal);
            File match = null;
            for (File k : kids) {
                if (k.getName().equalsIgnoreCase(part)) { match = k; break; }
            }
            if (match == null) return false;

            try {
                copyTreeAll(match, new File(currentTarget, part));
                return true;
            } catch (Exception e) {
                return false;
            }
        }
        return false;
    }

    private static final java.util.regex.Pattern CANNOT_READ_PATTERN =
            java.util.regex.Pattern.compile(
                    "^(.*?)\\((\\d+)\\)\\s*:\\s*fatal error 100: cannot read from file: \"([^\"]+)\"",
                    java.util.regex.Pattern.MULTILINE);

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

            java.util.List<File> mirrorDirs = buildIncludeMirror(relativeFilePath);

            java.util.List<File> allRoots = new java.util.ArrayList<>();
            allRoots.addAll(mirrorDirs);
            allRoots.add(includeDir());
            allRoots.add(extraIncludeDir());

            java.util.List<String> cmdArgs = new java.util.ArrayList<>();
            cmdArgs.add(binFile.getAbsolutePath());
            cmdArgs.add(sourceFile.getAbsolutePath());
            cmdArgs.add("-o" + outputAmx.getAbsolutePath());
            cmdArgs.add("-i" + includeDir().getAbsolutePath());
            for (File extraIncludeDir : mirrorDirs) {
                cmdArgs.add("-i" + extraIncludeDir.getAbsolutePath());
            }
            // Paling akhir: include bawaan cadangan (kalah prioritas sama project)
            cmdArgs.add("-i" + extraIncludeDir().getAbsolutePath());

            String stdout = "", stderr = "";
            int exitCode = 1;
            java.util.List<String> autoFixed = new java.util.ArrayList<>();
            java.util.Set<String> triedAndFailed = new java.util.HashSet<>();

            // Benerin semua yang kelihatan lewat baca teks DULU (cepat, gak
            // perlu compile) - baru compiler dijalanin. Ini yang bikin nggak
            // perlu compile-ulang berkali-kali cuma buat nemu 1-1 kasus beda
            // huruf.
            java.util.Set<File> trustedDirs = new java.util.HashSet<>();
            trustedDirs.add(includeDir());
            trustedDirs.add(extraIncludeDir());
            int preFixed = preScanAndFix(sourceCode, relativeFilePath, allRoots, trustedDirs);
            if (preFixed > 0) autoFixed.add("(" + preFixed + " path dibenerin lewat pre-scan sebelum compile)");

            // Jaring pengaman: sisa kasus yang keluput dari pre-scan (misal
            // include di dalam #if yang gak dibaca regex) masih ditangani di
            // sini, tapi harusnya jarang/nggak pernah kepake lagi.
            final int MAX_AUTOFIX_ROUNDS = 15;

            for (int round = 0; round <= MAX_AUTOFIX_ROUNDS; round++) {
                ProcessBuilder pb = new ProcessBuilder(cmdArgs);
                pb.environment().put("LD_LIBRARY_PATH", libDir);
                pb.directory(workDir);
                // PENTING: gabung stderr ke stdout jadi SATU pipa. Sebelumnya
                // baca stdout sampai habis dulu baru stderr - kalau outputnya
                // banyak (gamemode besar = banyak warning), compiler bisa
                // ke-block nunggu stderr dibaca sementara kita ke-block
                // nunggu stdout selesai. DEADLOCK, bukan soal lambat/timeout.
                pb.redirectErrorStream(true);

                Process process = pb.start();
                stdout = readStream(process.getInputStream());
                stderr = "";
                exitCode = process.waitFor();

                if (exitCode == 0 && outputAmx.exists()) break;

                java.util.regex.Matcher cm = CANNOT_READ_PATTERN.matcher(stdout + "\n" + stderr);
                if (!cm.find()) break; // error compile beneran, bukan soal file hilang

                String reportingFilePath = cm.group(1).trim();
                String missingRaw = cm.group(3);
                String missing = missingRaw.replace('\\', '/');
                if (!triedAndFailed.add(missing)) break; // udah dicoba, masih gagal -> stop, cegah loop mandek

                // Basis pencarian: folder file yang LAGI DIPROSES compiler saat
                // itu (penting buat path pake "../../", relatif ke situ, BUKAN
                // relatif ke root -i) dicoba duluan, baru fallback ke semua root.
                java.util.List<File> searchBases = new java.util.ArrayList<>();
                File reportingFile = new File(reportingFilePath);
                if (reportingFile.isFile() && reportingFile.getParentFile() != null) {
                    searchBases.add(reportingFile.getParentFile());
                }
                searchBases.addAll(allRoots);

                boolean fixedAny = false;
                for (File base : searchBases) {
                    if (applyCaseFix(base, missing)) { fixedAny = true; break; }
                }
                // Nama file di #include kadang tanpa ekstensi (compiler nyoba
                // .inc dulu) - coba juga versi +".inc" kalau versi polos gagal.
                if (!fixedAny && !missing.toLowerCase().endsWith(".inc")) {
                    for (File base : searchBases) {
                        if (applyCaseFix(base, missing + ".inc")) { fixedAny = true; break; }
                    }
                }
                if (!fixedAny) break; // genuinely hilang, bukan soal case

                autoFixed.add(missingRaw);
            }

            JSObject result = new JSObject();
            result.put("exitCode", exitCode);
            result.put("stdout", stdout);
            result.put("stderr", stderr);
            result.put("debugCmd", String.join(" ", cmdArgs));
            result.put("success", exitCode == 0 && outputAmx.exists());

            if (!autoFixed.isEmpty()) {
                JSArray fixedArr = new JSArray();
                for (String f : autoFixed) fixedArr.put(f);
                result.put("autoFixed", fixedArr);
            }

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
