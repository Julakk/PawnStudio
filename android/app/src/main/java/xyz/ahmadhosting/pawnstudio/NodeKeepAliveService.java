package xyz.ahmadhosting.pawnstudio;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

// Foreground service: menjaga proses Node tetap jalan waktu app di latar belakang
// atau ditutup dari recent apps. Notifikasi punya tombol Stop.
public class NodeKeepAliveService extends Service {

    private static final String CHANNEL_ID = "node_runner";
    private static final int NOTIF_ID = 4101;
    private static final String ACTION_STOP = "xyz.ahmadhosting.pawnstudio.NODE_STOP";

    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "PawnStudio:NodeRunner");
            wakeLock.setReferenceCounted(false);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            NodeSession.stop();
            return START_NOT_STICKY;
        }
        startAsForeground();
        if (wakeLock != null && !wakeLock.isHeld()) wakeLock.acquire();
        // Kalau proses sudah mati sebelum service sempat naik, langsung berhenti.
        if (!NodeSession.isRunning()) {
            stopSelf();
            return START_NOT_STICKY;
        }
        // Proses Node ikut mati kalau service dimatikan sistem, jadi jangan restart kosong.
        return START_NOT_STICKY;
    }

    private void startAsForeground() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm != null) {
            NotificationChannel ch = new NotificationChannel(
                    CHANNEL_ID, "Node.js berjalan", NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("Menjaga proses Node.js tetap hidup di latar belakang");
            nm.createNotificationChannel(ch);
        }

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);

        Intent open = new Intent(this, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openPi = PendingIntent.getActivity(this, 0, open, piFlags);

        Intent stop = new Intent(this, NodeKeepAliveService.class).setAction(ACTION_STOP);
        PendingIntent stopPi = PendingIntent.getService(this, 1, stop, piFlags);

        Notification.Builder b = Build.VERSION.SDK_INT >= 26
                ? new Notification.Builder(this, CHANNEL_ID)
                : new Notification.Builder(this);
        b.setContentTitle("PawnStudio: Node.js berjalan")
                .setContentText("Proses tetap hidup di latar belakang")
                .setSmallIcon(getApplicationInfo().icon)
                .setOngoing(true)
                .setContentIntent(openPi)
                .addAction(new Notification.Action.Builder(0, "Stop", stopPi).build());
        Notification n = b.build();

        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(NOTIF_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(NOTIF_ID, n);
        }
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
