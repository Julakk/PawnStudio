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

    private File compiledOutputDir() {
        // Penyimpanan PERMANEN, gak kena auto-clear sistem seperti cacheDir.
        // Lokasi: Android/data/xyz.ahmadhosting.pawnstudio/files/compiled/
        File dir = new File(getContext().getExternalFilesDir(null), "compiled");
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
            writer.write(sourceCode);
            writer.close();

            // Output .amx WAJIB ke folder permanen
            File outputAmx = new File(compiledOutputDir(), fileName + ".amx");

            ProcessBuilder pb = new ProcessBuilder(
                    binFile.getAbsolutePath(),
                    sourceFile.getAbsolutePath(),
                    "-o" + outputAmx.getAbsolutePath(),
                    "-i" + includeDir().getAbsolutePath()
            );
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
