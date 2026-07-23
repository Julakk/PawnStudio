package xyz.ahmadhosting.pawnstudio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PawnCompilerPlugin.class);
        registerPlugin(FolderPickerPlugin.class);
        registerPlugin(NativeStoragePlugin.class);
        registerPlugin(BulkImportPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
