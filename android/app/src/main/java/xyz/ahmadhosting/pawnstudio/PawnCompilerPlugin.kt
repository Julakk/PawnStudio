package xyz.ahmadhosting.pawnstudio

import android.util.Log
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import java.io.File
import java.io.FileOutputStream

@CapacitorPlugin(name = "PawnCompiler")
class PawnCompilerPlugin : Plugin() {

    private val TAG = "PawnCompiler"

    private val BIN_NAME = "pawncc-arm64-v8a"
    private val LIB_NAME = "libpawnc-arm64-v8a.so"

    private fun binDir(): File {
        val dir = File(context.filesDir, "pawncc-bin")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    private fun ensureBinariesExtracted() {
        val dir = binDir()
        val binFile = File(dir, BIN_NAME)
        val libFile = File(dir, LIB_NAME)

        if (!binFile.exists()) {
            copyAsset("pawncc/$BIN_NAME", binFile)
            binFile.setExecutable(true, false)
        }
        if (!libFile.exists()) {
            copyAsset("pawncc/$LIB_NAME", libFile)
            libFile.setExecutable(true, false)
        }
    }

    private fun copyAsset(assetPath: String, outFile: File) {
        context.assets.open(assetPath).use { input ->
            FileOutputStream(outFile).use { output ->
                input.copyTo(output)
            }
        }
    }

    @PluginMethod
    fun compile(call: PluginCall) {
        val sourceCode = call.getString("source")
        if (sourceCode == null) {
            call.reject("Parameter 'source' wajib diisi")
            return
        }

        try {
            ensureBinariesExtracted()
            val dir = binDir()
            val binFile = File(dir, BIN_NAME)

            val workDir = File(context.cacheDir, "pawn-compile")
            if (!workDir.exists()) workDir.mkdirs()
            val sourceFile = File(workDir, "main.pwn")
            sourceFile.writeText(sourceCode)

            val outputAmx = File(workDir, "main.amx")

            val processBuilder = ProcessBuilder(
                binFile.absolutePath,
                sourceFile.absolutePath,
                "-o${outputAmx.absolutePath}"
            )
            processBuilder.environment()["LD_LIBRARY_PATH"] = dir.absolutePath
            processBuilder.redirectErrorStream(false)
            processBuilder.directory(workDir)

            val process = processBuilder.start()
            val stdout = process.inputStream.bufferedReader().readText()
            val stderr = process.errorStream.bufferedReader().readText()
            val exitCode = process.waitFor()

            val result = JSObject()
            result.put("exitCode", exitCode)
            result.put("stdout", stdout)
            result.put("stderr", stderr)
            result.put("success", exitCode == 0 && outputAmx.exists())

            if (outputAmx.exists()) {
                result.put("amxPath", outputAmx.absolutePath)
                result.put("amxSize", outputAmx.length())
            }

            call.resolve(result)
        } catch (e: Exception) {
            Log.e(TAG, "Compile error", e)
            call.reject("Compile gagal: ${e.message}")
        }
    }
}
