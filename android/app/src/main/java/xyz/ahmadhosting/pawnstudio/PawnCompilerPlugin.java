package xyz.ahmadhosting.pawnstudio;

import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.FileWriter;
import java.io.BufferedReader;
import java.io.InputStreamReader;

@CapacitorPlugin(name = "PawnCompiler")
public class PawnCompilerPlugin extends Plugin {

    private static final String TAG = "PawnCompiler";
    private static final String BIN_NAME = "pawncc-arm64-v8a";
    private static final String LIB_NAME = "libpawnc-arm64-v8a.so";

    private File binDir() {
        File dir = new File(getContext().getFilesDir(), "pawncc-bin");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private void copyAsset(String assetPath, File outFile) throws Exception {
        InputStream input = getContext().getAssets().open(assetPath);
        FileOutputStream output = new FileOutputStream(outFile);
        byte[] buffer = new byte[4096];
        int read;
        while ((read = input.read(buffer)) != -1) {
            output.write(buffer, 0, read);
        }
        output.close();
        input.close();
    }

    private void ensureBinariesExtracted() throws Exception {
        File dir = binDir();
        File binFile = new File(dir, BIN_NAME);
        File libFile = new File(dir, LIB_NAME);

        if (!binFile.exists()) {
            copyAsset("pawncc/" + BIN_NAME, binFile);
            binFile.setExecutable(true, false);
        }
        if (!libFile.exists()) {
            copyAsset("pawncc/" + LIB_NAME, libFile);
            libFile.setExecutable(true, false);
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

    @PluginMethod
    public void compile(PluginCall call) {
        String sourceCode = call.getString("source");
        if (sourceCode == null) {
            call.reject("Parameter 'source' wajib diisi");
            return;
        }

        try {
            ensureBinariesExtracted();
            File dir = binDir();
            File binFile = new File(dir, BIN_NAME);

            File workDir = new File(getContext().getCacheDir(), "pawn-compile");
            if (!workDir.exists()) workDir.mkdirs();

            File sourceFile = new File(workDir, "main.pwn");
            FileWriter writer = new FileWriter(sourceFile);
            writer.write(sourceCode);
            writer.close();

            File outputAmx = new File(workDir, "main.amx");

            ProcessBuilder pb = new ProcessBuilder(
                    binFile.getAbsolutePath(),
                    sourceFile.getAbsolutePath(),
                    "-o" + outputAmx.getAbsolutePath()
            );
            pb.environment().put("LD_LIBRARY_PATH", dir.getAbsolutePath());
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
