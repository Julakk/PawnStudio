package xyz.ahmadhosting.pawnstudio;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        WorkspaceManager.beginLaunch(this);
        registerPlugin(PawnCompilerPlugin.class);
        registerPlugin(FolderPickerPlugin.class);
        registerPlugin(NativeStoragePlugin.class);
        registerPlugin(GitPlugin.class);
        registerPlugin(BulkImportPlugin.class);
        registerPlugin(NodeRunnerPlugin.class);
        registerPlugin(DeviceCheckPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
