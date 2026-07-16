package xyz.ahmadhosting.pawnstudio;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.documentfile.provider.DocumentFile;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

@CapacitorPlugin(name = "FolderPicker")
public class FolderPickerPlugin extends Plugin {

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        startActivityForResult(call, intent, "folderPickerResult");
    }

    @ActivityCallback
    private void folderPickerResult(PluginCall call, androidx.activity.result.ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Pemilihan folder dibatalkan");
            return;
        }

        try {
            Uri treeUri = result.getData().getData();
            getContext().getContentResolver().takePersistableUriPermission(
                    treeUri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION
            );

            DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
            JSArray filesArray = new JSArray();
            walkDocumentTree(root, "", filesArray);

            JSObject ret = new JSObject();
            ret.put("files", filesArray);
            ret.put("folderName", root.getName());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Gagal membaca folder: " + e.getMessage());
        }
    }

    private void walkDocumentTree(DocumentFile dir, String relPath, JSArray filesArray) {
        if (dir == null || dir.listFiles() == null) return;

        for (DocumentFile child : dir.listFiles()) {
            if (child.getName() == null) continue;
            String childRelPath = relPath.isEmpty() ? child.getName() : relPath + "/" + child.getName();

            if (child.isDirectory()) {
                walkDocumentTree(child, childRelPath, filesArray);
            } else {
                String content = readDocumentFileAsString(child.getUri());
                JSObject fileObj = new JSObject();
                fileObj.put("path", childRelPath);
                fileObj.put("content", content);
                filesArray.put(fileObj);
            }
        }
    }

    private String readDocumentFileAsString(Uri uri) {
        try {
            InputStream is = getContext().getContentResolver().openInputStream(uri);
            BufferedReader reader = new BufferedReader(new InputStreamReader(is));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
            reader.close();
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }
}
