package xyz.ahmadhosting.pawnstudio;

import android.annotation.TargetApi;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkInfo;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.URLEncoder;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.net.ssl.SSLException;

/**
 * GeminiPlugin - koneksi dasar PawnStudio ke Gemini API (BYOK).
 *
 * JS: window.Capacitor.Plugins.GeminiNative
 * Method : setApiKey, getKeyStatus, clearApiKey, testConnection, listModels, generate, cancel
 * Event  : geminiChunk {requestId,index,text}
 *          geminiDone  {requestId,model,finishReason,usage,chars,ms}
 *          geminiError {requestId,code,message,httpStatus,retryable}
 *
 * API key disimpan terenkripsi (Android Keystore AES-GCM), tidak pernah dikirim balik ke JS,
 * dan hanya dikirim ke Google lewat header x-goog-api-key.
 */
@CapacitorPlugin(name = "GeminiNative")
public class GeminiPlugin extends Plugin {

    private static final String BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
    private static final String KEY_ALIAS = "pawnstudio_gemini_key_v1";
    private static final String PREFS_NAME = "pawnstudio_gemini_secure";
    private static final String PREF_IV = "iv";
    private static final String PREF_CT = "ct";
    private static final byte[] AAD = "pawnstudio.gemini.v1".getBytes(StandardCharsets.UTF_8);

    private static final int CONNECT_TIMEOUT_MS = 15000;
    private static final int SIMPLE_READ_TIMEOUT_MS = 20000;
    private static final int STREAM_READ_TIMEOUT_MS = 90000;
    private static final long MAX_TOTAL_NANOS = 5L * 60L * 1000000000L;
    private static final int MAX_RETRIES = 2;
    private static final int MAX_ACTIVE = 4;
    private static final int MAX_BODY_BYTES = 4 * 1024 * 1024;
    private static final int MAX_ERROR_BYTES = 16 * 1024;
    private static final int MAX_JSON_BYTES = 4 * 1024 * 1024;
    private static final int MAX_LIST_PAGES = 5;

    private static final Pattern KEY_PATTERN = Pattern.compile("^[A-Za-z0-9_.\\-]{20,256}$");
    private static final Pattern ID_PATTERN = Pattern.compile("^[A-Za-z0-9_\\-]{1,64}$");
    private static final Pattern MODEL_PATTERN = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._\\-]{0,99}$");
    private static final Pattern KEY_LIKE_1 = Pattern.compile("AIza[0-9A-Za-z_\\-]{20,}");
    private static final Pattern KEY_LIKE_2 = Pattern.compile("AQ\\.[0-9A-Za-z_.\\-]{20,}");

    private final ConcurrentHashMap<String, ActiveRequest> active = new ConcurrentHashMap<>();

    private final ExecutorService executor = Executors.newCachedThreadPool(new ThreadFactory() {
        private final AtomicInteger n = new AtomicInteger(0);
        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, "gemini-worker-" + n.incrementAndGet());
            t.setDaemon(true);
            return t;
        }
    });

    // ===================== Tipe pendukung =====================

    private static final class ActiveRequest {
        final String id;
        final long startNanos = System.nanoTime();
        final AtomicBoolean finished = new AtomicBoolean(false);
        volatile boolean cancelled = false;
        volatile boolean gotData = false;
        volatile HttpURLConnection conn = null;
        int chunkIndex = 0;
        long chars = 0;
        ActiveRequest(String id) { this.id = id; }
    }

    private static final class GeminiException extends Exception {
        final String code;
        final int http;
        final boolean retryable;
        final long retryAfterMs;
        GeminiException(String code, String message, int http, boolean retryable, long retryAfterMs) {
            super(message);
            this.code = code;
            this.http = http;
            this.retryable = retryable;
            this.retryAfterMs = retryAfterMs;
        }
    }

    // ===================== Helper JSON =====================

    private static JSONObject jo(Object... kv) {
        JSONObject o = new JSONObject();
        try {
            for (int i = 0; i + 1 < kv.length; i += 2) o.put(String.valueOf(kv[i]), kv[i + 1]);
        } catch (JSONException ignored) { }
        return o;
    }

    private static JSObject obj(Object... kv) {
        try {
            return new JSObject(jo(kv).toString());
        } catch (JSONException e) {
            return new JSObject();
        }
    }

    private void emit(String event, JSObject data) {
        try { notifyListeners(event, data); } catch (Throwable ignored) { }
    }

    private static void rejectCall(PluginCall call, GeminiException e) {
        call.reject(e.getMessage(), e.code);
    }

    // ===================== Penyimpanan API key (Keystore AES-GCM) =====================

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    @TargetApi(23)
    private SecretKey getOrCreateSecretKey() throws Exception {
        if (Build.VERSION.SDK_INT < 23) {
            throw new GeminiException("KEYSTORE_ERROR", "Penyimpanan aman butuh Android 6.0 ke atas.", 0, false, 0);
        }
        KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
        ks.load(null);
        KeyStore.Entry e = ks.containsAlias(KEY_ALIAS) ? ks.getEntry(KEY_ALIAS, null) : null;
        if (e instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) e).getSecretKey();
        }
        KeyGenerator kg = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        kg.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256)
                .build());
        return kg.generateKey();
    }

    private void deleteKeystoreAlias() {
        try {
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (ks.containsAlias(KEY_ALIAS)) ks.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) { }
    }

    @TargetApi(23)
    private void encryptAndStore(String key) throws Exception {
        SecretKey sk = getOrCreateSecretKey();
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, sk);
        c.updateAAD(AAD);
        byte[] pt = key.getBytes(StandardCharsets.UTF_8);
        byte[] ct = c.doFinal(pt);
        Arrays.fill(pt, (byte) 0);
        byte[] iv = c.getIV();
        boolean ok = prefs().edit()
                .putString(PREF_IV, Base64.encodeToString(iv, Base64.NO_WRAP))
                .putString(PREF_CT, Base64.encodeToString(ct, Base64.NO_WRAP))
                .commit();
        if (!ok) throw new IOException("prefs");
    }

    private void saveKey(String key) throws Exception {
        try {
            encryptAndStore(key);
        } catch (GeminiException g) {
            throw g;
        } catch (Exception first) {
            // Key Keystore lama mungkin tidak valid lagi: buat ulang sekali.
            deleteKeystoreAlias();
            encryptAndStore(key);
        }
    }

    /** Mengembalikan API key plaintext HANYA untuk dipakai native; null jika tidak ada/gagal. */
    @TargetApi(23)
    private String loadKey() {
        try {
            if (Build.VERSION.SDK_INT < 23) return null;
            SharedPreferences p = prefs();
            String iv = p.getString(PREF_IV, null);
            String ct = p.getString(PREF_CT, null);
            if (iv == null || ct == null) return null;
            KeyStore ks = KeyStore.getInstance("AndroidKeyStore");
            ks.load(null);
            if (!ks.containsAlias(KEY_ALIAS)) return null;
            KeyStore.Entry e = ks.getEntry(KEY_ALIAS, null);
            if (!(e instanceof KeyStore.SecretKeyEntry)) return null;
            SecretKey sk = ((KeyStore.SecretKeyEntry) e).getSecretKey();
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, sk, new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
            c.updateAAD(AAD);
            byte[] pt = c.doFinal(Base64.decode(ct, Base64.NO_WRAP));
            String key = new String(pt, StandardCharsets.UTF_8);
            Arrays.fill(pt, (byte) 0);
            return key;
        } catch (Throwable t) {
            return null;
        }
    }

    private static String mask(String key) {
        if (key == null) return "";
        if (key.length() < 12) return "\u2022\u2022\u2022\u2022";
        return key.substring(0, 4) + "\u2026" + key.substring(key.length() - 4);
    }

    private static JSObject statusObject(String key) {
        return obj("hasKey", key != null, "masked", key == null ? "" : mask(key));
    }

    @PluginMethod
    public void setApiKey(PluginCall call) {
        String raw = call.getString("key");
        String key = raw == null ? "" : raw.replaceAll("\\s+", "");
        if (!KEY_PATTERN.matcher(key).matches()) {
            call.reject("Format API key tidak valid.", "API_KEY_INVALID");
            return;
        }
        try {
            saveKey(key);
        } catch (GeminiException g) {
            rejectCall(call, g);
            return;
        } catch (Throwable t) {
            call.reject("Gagal menyimpan API key secara aman di perangkat ini.", "KEYSTORE_ERROR");
            return;
        }
        String back = loadKey();
        if (!key.equals(back)) {
            prefs().edit().clear().commit();
            call.reject("Penyimpanan aman gagal diverifikasi. API key tidak disimpan.", "KEYSTORE_ERROR");
            return;
        }
        call.resolve(statusObject(back));
    }

    @PluginMethod
    public void getKeyStatus(PluginCall call) {
        call.resolve(statusObject(loadKey()));
    }

    @PluginMethod
    public void clearApiKey(PluginCall call) {
        prefs().edit().clear().commit();
        deleteKeystoreAlias();
        call.resolve(statusObject(null));
    }

    // ===================== HTTP dasar =====================

    private HttpURLConnection open(String method, String urlStr, String key, int readMs, boolean sse) throws IOException {
        HttpURLConnection c = (HttpURLConnection) new URL(urlStr).openConnection();
        c.setRequestMethod(method);
        c.setConnectTimeout(CONNECT_TIMEOUT_MS);
        c.setReadTimeout(readMs);
        c.setInstanceFollowRedirects(false);
        c.setUseCaches(false);
        c.setRequestProperty("x-goog-api-key", key);
        c.setRequestProperty("Accept-Encoding", "identity");
        c.setRequestProperty("Accept", sse ? "text/event-stream" : "application/json");
        c.setRequestProperty("User-Agent", "PawnStudio-Gemini/1.0");
        return c;
    }

    private static String readAll(InputStream in, int maxBytes) throws IOException {
        if (in == null) return "";
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) != -1) {
                if (bos.size() + n > maxBytes) {
                    bos.write(buf, 0, maxBytes - bos.size());
                    break;
                }
                bos.write(buf, 0, n);
            }
            return new String(bos.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            try { in.close(); } catch (IOException ignored) { }
        }
    }

    private static String readErrorBody(HttpURLConnection c) {
        try { return readAll(c.getErrorStream(), MAX_ERROR_BYTES); } catch (IOException e) { return ""; }
    }

    private static long retryAfterMs(HttpURLConnection c) {
        try {
            String h = c.getHeaderField("Retry-After");
            if (h == null) return 0;
            long s = Long.parseLong(h.trim());
            return Math.max(0, Math.min(s, 60)) * 1000L;
        } catch (Exception e) {
            return 0;
        }
    }

    private JSONObject httpGetJson(String url, String key) throws GeminiException {
        HttpURLConnection c = null;
        try {
            c = open("GET", url, key, SIMPLE_READ_TIMEOUT_MS, false);
            int status = c.getResponseCode();
            if (status >= 200 && status < 300) {
                return new JSONObject(readAll(c.getInputStream(), MAX_JSON_BYTES));
            }
            throw mapHttp(status, readErrorBody(c), key, retryAfterMs(c));
        } catch (GeminiException e) {
            throw e;
        } catch (IOException e) {
            throw mapIo(e);
        } catch (JSONException e) {
            throw new GeminiException("UNKNOWN_ERROR", "Respons Gemini tidak bisa dibaca.", 0, false, 0);
        } finally {
            if (c != null) { try { c.disconnect(); } catch (Throwable ignored) { } }
        }
    }

    // ===================== Pemetaan error =====================

    private static String sanitize(String s, String key) {
        if (s == null) return "";
        String out = s;
        if (key != null && key.length() >= 8) out = out.replace(key, "[REDACTED]");
        out = KEY_LIKE_1.matcher(out).replaceAll("[REDACTED]");
        out = KEY_LIKE_2.matcher(out).replaceAll("[REDACTED]");
        out = out.replaceAll("[\\r\\n]+", " ").trim();
        if (out.length() > 300) out = out.substring(0, 300) + "\u2026";
        return out;
    }

    private static GeminiException cancelledEx() {
        return new GeminiException("CANCELLED", "Dibatalkan.", 0, false, 0);
    }

    private static GeminiException mapIo(IOException e) {
        if (e instanceof SocketTimeoutException) {
            return new GeminiException("TIMEOUT", "Waktu permintaan habis. Coba lagi.", 0, false, 0);
        }
        if (e instanceof UnknownHostException || e instanceof ConnectException || e instanceof NoRouteToHostException) {
            return new GeminiException("NETWORK_ERROR", "Tidak dapat terhubung ke server Gemini. Periksa koneksi internet.", 0, false, 0);
        }
        if (e instanceof SSLException) {
            return new GeminiException("NETWORK_ERROR", "Koneksi aman (TLS) gagal. Periksa jaringan dan jam perangkat.", 0, false, 0);
        }
        return new GeminiException("NETWORK_ERROR", "Koneksi terputus (" + e.getClass().getSimpleName() + ").", 0, false, 0);
    }

    private static GeminiException mapHttp(int status, String body, String key, long retryAfterMs) {
        String apiMsg = "";
        String reason = "";
        try {
            String t = body == null ? "" : body.trim();
            JSONObject root = null;
            if (t.startsWith("[")) {
                root = new JSONArray(t).optJSONObject(0);
            } else if (t.startsWith("{")) {
                root = new JSONObject(t);
            }
            JSONObject err = root == null ? null : root.optJSONObject("error");
            if (err != null) {
                apiMsg = err.optString("message", "");
                JSONArray details = err.optJSONArray("details");
                if (details != null) {
                    for (int i = 0; i < details.length(); i++) {
                        JSONObject d = details.optJSONObject(i);
                        if (d != null && d.has("reason")) reason = d.optString("reason", "");
                    }
                }
            }
        } catch (Exception ignored) { }

        String low = apiMsg.toLowerCase(Locale.ROOT);
        boolean keyBad = reason.startsWith("API_KEY_")
                || low.contains("api key not valid")
                || low.contains("api key expired")
                || low.contains("api_key_invalid");

        if (keyBad || status == 401) {
            return new GeminiException("API_KEY_INVALID", "API key tidak valid atau sudah kedaluwarsa. Periksa di Pengaturan.", status, false, 0);
        }
        switch (status) {
            case 403:
                return new GeminiException("PERMISSION_DENIED", "Akses ditolak (403). Periksa pembatasan API key, izin Generative Language API, atau wilayah.", status, false, 0);
            case 404:
                return new GeminiException("MODEL_NOT_FOUND", "Model tidak ditemukan atau tidak didukung. Muat ulang daftar model.", status, false, 0);
            case 408:
                return new GeminiException("TIMEOUT", "Server menutup koneksi karena waktu habis.", status, true, retryAfterMs);
            case 429:
                return new GeminiException("RATE_LIMIT", "Kuota atau batas permintaan terlampaui. Tunggu sebentar atau cek kuota di Google AI Studio.", status, true, retryAfterMs);
            case 500:
            case 502:
            case 503:
            case 504:
                return new GeminiException("SERVER_ERROR", "Server Gemini sedang bermasalah atau sibuk (HTTP " + status + ").", status, true, retryAfterMs);
            case 400: {
                String m = sanitize(apiMsg, key);
                return new GeminiException("BAD_REQUEST", m.isEmpty() ? "Permintaan ditolak (400)." : "Permintaan ditolak: " + m, status, false, 0);
            }
            default: {
                String m = sanitize(apiMsg, key);
                return new GeminiException("UNKNOWN_ERROR", "HTTP " + status + (m.isEmpty() ? "" : ": " + m), status, false, 0);
            }
        }
    }

    // ===================== Cek jaringan =====================

    @SuppressWarnings("deprecation")
    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            if (Build.VERSION.SDK_INT >= 23) {
                Network n = cm.getActiveNetwork();
                if (n == null) return false;
                NetworkCapabilities nc = cm.getNetworkCapabilities(n);
                return nc != null && nc.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
            }
            NetworkInfo ni = cm.getActiveNetworkInfo();
            return ni != null && ni.isConnected();
        } catch (Throwable t) {
            return true; // izin ACCESS_NETWORK_STATE hilang atau error lain: anggap online
        }
    }

    private static String normalizeModel(String m) {
        if (m == null) return null;
        String s = m.trim();
        if (s.startsWith("models/")) s = s.substring(7);
        return MODEL_PATTERN.matcher(s).matches() ? s : null;
    }

    // ===================== testConnection & listModels =====================

    @PluginMethod
    public void testConnection(PluginCall call) {
        final String key = loadKey();
        if (key == null) { call.reject("API key belum diatur.", "API_KEY_MISSING"); return; }
        String modelIn = call.getString("model");
        final String model = (modelIn == null || modelIn.trim().isEmpty()) ? null : normalizeModel(modelIn);
        if (modelIn != null && !modelIn.trim().isEmpty() && model == null) {
            call.reject("Nama model tidak valid.", "BAD_REQUEST");
            return;
        }
        if (!isOnline()) { call.reject("Tidak ada koneksi internet.", "NETWORK_ERROR"); return; }
        executor.execute(() -> {
            long t0 = System.nanoTime();
            try {
                String url = model == null ? BASE_URL + "/models?pageSize=1" : BASE_URL + "/models/" + model;
                httpGetJson(url, key);
                call.resolve(obj("ok", true, "latencyMs", (System.nanoTime() - t0) / 1000000L));
            } catch (GeminiException e) {
                rejectCall(call, e);
            } catch (Throwable t) {
                call.reject("Terjadi kesalahan tak terduga (" + t.getClass().getSimpleName() + ").", "UNKNOWN_ERROR");
            }
        });
    }

    @PluginMethod
    public void listModels(PluginCall call) {
        final String key = loadKey();
        if (key == null) { call.reject("API key belum diatur.", "API_KEY_MISSING"); return; }
        if (!isOnline()) { call.reject("Tidak ada koneksi internet.", "NETWORK_ERROR"); return; }
        executor.execute(() -> {
            try {
                JSONArray out = new JSONArray();
                String pageToken = "";
                for (int page = 0; page < MAX_LIST_PAGES; page++) {
                    String url = BASE_URL + "/models?pageSize=1000";
                    if (!pageToken.isEmpty()) url += "&pageToken=" + URLEncoder.encode(pageToken, "UTF-8");
                    JSONObject resp = httpGetJson(url, key);
                    JSONArray ms = resp.optJSONArray("models");
                    if (ms != null) {
                        for (int i = 0; i < ms.length(); i++) {
                            JSONObject m = ms.optJSONObject(i);
                            if (m == null || !supportsGenerate(m)) continue;
                            String name = m.optString("name", "");
                            String id = name.startsWith("models/") ? name.substring(7) : name;
                            if (id.isEmpty()) continue;
                            String desc = m.optString("description", "");
                            if (desc.length() > 200) desc = desc.substring(0, 200) + "\u2026";
                            out.put(jo("id", id,
                                    "displayName", m.optString("displayName", id),
                                    "description", desc,
                                    "inputTokenLimit", m.optInt("inputTokenLimit", 0),
                                    "outputTokenLimit", m.optInt("outputTokenLimit", 0)));
                        }
                    }
                    pageToken = resp.optString("nextPageToken", "");
                    if (pageToken.isEmpty()) break;
                }
                call.resolve(obj("models", out, "count", out.length()));
            } catch (GeminiException e) {
                rejectCall(call, e);
            } catch (Throwable t) {
                call.reject("Terjadi kesalahan tak terduga (" + t.getClass().getSimpleName() + ").", "UNKNOWN_ERROR");
            }
        });
    }

    private static boolean supportsGenerate(JSONObject m) {
        JSONArray a = m.optJSONArray("supportedGenerationMethods");
        if (a == null) return true;
        for (int i = 0; i < a.length(); i++) {
            if ("generateContent".equals(a.optString(i))) return true;
        }
        return false;
    }

    // ===================== generate (streaming) & cancel =====================

    @PluginMethod
    public void generate(PluginCall call) {
        String id = call.getString("requestId");
        if (id == null || !ID_PATTERN.matcher(id).matches()) {
            call.reject("requestId tidak valid (huruf/angka/_/-, maks 64).", "BAD_REQUEST");
            return;
        }
        String model = normalizeModel(call.getString("model"));
        if (model == null) { call.reject("Nama model tidak valid.", "BAD_REQUEST"); return; }

        JSONArray contents = call.getArray("contents");
        if (contents == null || contents.length() == 0) {
            String prompt = call.getString("prompt");
            if (prompt == null || prompt.trim().isEmpty()) {
                call.reject("Isi 'contents' atau 'prompt'.", "BAD_REQUEST");
                return;
            }
            contents = new JSONArray().put(jo("role", "user", "parts", new JSONArray().put(jo("text", prompt))));
        }

        JSONObject body = jo("contents", contents);
        String system = call.getString("system");
        if (system != null && !system.trim().isEmpty()) {
            try { body.put("systemInstruction", jo("parts", new JSONArray().put(jo("text", system)))); }
            catch (JSONException ignored) { }
        }
        JSONObject gc = new JSONObject();
        try {
            Double temp = call.getDouble("temperature");
            if (temp != null) gc.put("temperature", Math.max(0.0, Math.min(2.0, temp)));
            Double topP = call.getDouble("topP");
            if (topP != null) gc.put("topP", Math.max(0.0, Math.min(1.0, topP)));
            Integer mot = call.getInt("maxOutputTokens");
            if (mot != null && mot > 0) gc.put("maxOutputTokens", Math.min(mot, 65536));
            if (gc.length() > 0) body.put("generationConfig", gc);
        } catch (JSONException ignored) { }

        final byte[] bytes = body.toString().getBytes(StandardCharsets.UTF_8);
        if (bytes.length > MAX_BODY_BYTES) {
            call.reject("Permintaan terlalu besar (maks 4 MB).", "BAD_REQUEST");
            return;
        }

        final String key = loadKey();
        if (key == null) { call.reject("API key belum diatur.", "API_KEY_MISSING"); return; }
        if (!isOnline()) { call.reject("Tidak ada koneksi internet.", "NETWORK_ERROR"); return; }
        if (active.size() >= MAX_ACTIVE) { call.reject("Terlalu banyak permintaan berjalan.", "BUSY"); return; }

        final ActiveRequest r = new ActiveRequest(id);
        if (active.putIfAbsent(id, r) != null) {
            call.reject("requestId sudah dipakai.", "BAD_REQUEST");
            return;
        }
        final String modelFinal = model;
        call.resolve(obj("requestId", id, "started", true));
        executor.execute(() -> runGenerate(r, key, modelFinal, bytes));
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("requestId");
        if (id == null) { call.reject("requestId wajib diisi.", "BAD_REQUEST"); return; }
        ActiveRequest r = active.get(id);
        if (r == null) {
            call.resolve(obj("requestId", id, "cancelled", false));
            return;
        }
        cancelRequest(r);
        call.resolve(obj("requestId", id, "cancelled", true));
    }

    private void cancelRequest(ActiveRequest r) {
        r.cancelled = true;
        final HttpURLConnection c = r.conn;
        if (c != null) {
            try {
                executor.execute(() -> { try { c.disconnect(); } catch (Throwable ignored) { } });
            } catch (Throwable ignored) { }
        }
    }

    private void runGenerate(ActiveRequest r, String key, String model, byte[] body) {
        try {
            int attempt = 0;
            while (true) {
                if (r.cancelled) throw cancelledEx();
                try {
                    streamOnce(r, key, model, body);
                    return;
                } catch (GeminiException e) {
                    if (r.cancelled) throw cancelledEx();
                    if (e.retryable && !r.gotData && attempt < MAX_RETRIES) {
                        attempt++;
                        long wait = e.retryAfterMs > 0 ? e.retryAfterMs : 1500L * attempt;
                        sleepCancellable(r, Math.min(wait, 10000L));
                        continue;
                    }
                    throw e;
                }
            }
        } catch (GeminiException e) {
            emitError(r, e);
        } catch (Throwable t) {
            emitError(r, new GeminiException("UNKNOWN_ERROR",
                    "Terjadi kesalahan tak terduga (" + t.getClass().getSimpleName() + ").", 0, false, 0));
        } finally {
            active.remove(r.id);
        }
    }

    private static void sleepCancellable(ActiveRequest r, long ms) throws GeminiException {
        long end = System.nanoTime() + ms * 1000000L;
        while (System.nanoTime() < end) {
            if (r.cancelled) throw cancelledEx();
            try { Thread.sleep(100); } catch (InterruptedException e) { throw cancelledEx(); }
        }
    }

    private void streamOnce(ActiveRequest r, String key, String model, byte[] body) throws GeminiException {
        HttpURLConnection c = null;
        try {
            c = open("POST", BASE_URL + "/models/" + model + ":streamGenerateContent?alt=sse",
                    key, STREAM_READ_TIMEOUT_MS, true);
            r.conn = c;
            if (r.cancelled) throw cancelledEx();
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setDoOutput(true);
            c.setFixedLengthStreamingMode(body.length);
            try (OutputStream os = c.getOutputStream()) {
                os.write(body);
                os.flush();
            }
            int status = c.getResponseCode();
            if (status < 200 || status >= 300) {
                throw mapHttp(status, readErrorBody(c), key, retryAfterMs(c));
            }
            parseStream(r, c, key, model);
        } catch (GeminiException e) {
            throw e;
        } catch (IOException e) {
            throw r.cancelled ? cancelledEx() : mapIo(e);
        } finally {
            r.conn = null;
            if (c != null) { try { c.disconnect(); } catch (Throwable ignored) { } }
        }
    }

    private void parseStream(ActiveRequest r, HttpURLConnection c, String key, String model)
            throws IOException, GeminiException {
        String finishReason = null;
        String blockReason = null;
        JSONObject usage = null;

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(c.getInputStream(), StandardCharsets.UTF_8), 8192)) {
            String line;
            while ((line = br.readLine()) != null) {
                if (r.cancelled) throw cancelledEx();
                if (System.nanoTime() - r.startNanos > MAX_TOTAL_NANOS) {
                    throw new GeminiException("TIMEOUT", "Respons terlalu lama (lebih dari 5 menit).", 0, false, 0);
                }
                if (!line.startsWith("data:")) continue;
                String data = line.substring(5).trim();
                if (data.isEmpty() || "[DONE]".equals(data)) continue;

                JSONObject o;
                try { o = new JSONObject(data); } catch (JSONException e) { continue; }

                JSONObject errObj = o.optJSONObject("error");
                if (errObj != null) throw mapHttp(errObj.optInt("code", 500), data, key, 0);

                JSONObject pf = o.optJSONObject("promptFeedback");
                if (pf != null && pf.has("blockReason")) blockReason = pf.optString("blockReason", "BLOCKED");
                JSONObject um = o.optJSONObject("usageMetadata");
                if (um != null) usage = um;

                JSONArray cands = o.optJSONArray("candidates");
                if (cands == null || cands.length() == 0) continue;
                JSONObject cand = cands.optJSONObject(0);
                if (cand == null) continue;
                if (cand.has("finishReason") && !cand.isNull("finishReason")) {
                    finishReason = cand.optString("finishReason", "");
                }
                JSONObject content = cand.optJSONObject("content");
                JSONArray parts = content == null ? null : content.optJSONArray("parts");
                if (parts == null) continue;
                for (int i = 0; i < parts.length(); i++) {
                    JSONObject p = parts.optJSONObject(i);
                    if (p == null || p.optBoolean("thought", false)) continue;
                    String t = p.optString("text", "");
                    if (t.isEmpty()) continue;
                    r.gotData = true;
                    r.chars += t.length();
                    emit("geminiChunk", obj("requestId", r.id, "index", r.chunkIndex++, "text", t));
                }
            }
        }

        if (!r.gotData) {
            if (blockReason != null) {
                throw new GeminiException("SAFETY_BLOCKED",
                        "Permintaan diblokir oleh filter keamanan Gemini (" + sanitize(blockReason, key) + ").",
                        200, false, 0);
            }
            if (finishReason == null) {
                throw new GeminiException("UNKNOWN_ERROR", "Gemini mengirim respons kosong.", 200, false, 0);
            }
        }
        JSONObject u = jo(
                "promptTokens", usage == null ? 0 : usage.optInt("promptTokenCount", 0),
                "outputTokens", usage == null ? 0 : usage.optInt("candidatesTokenCount", 0),
                "totalTokens", usage == null ? 0 : usage.optInt("totalTokenCount", 0));
        emitDone(r, model, finishReason == null ? "" : finishReason, u);
    }

    // ===================== Event terminal (tepat satu per request) =====================

    private void emitDone(ActiveRequest r, String model, String finishReason, JSONObject usage) {
        if (!r.finished.compareAndSet(false, true)) return;
        emit("geminiDone", obj(
                "requestId", r.id,
                "model", model,
                "finishReason", finishReason,
                "usage", usage,
                "chars", r.chars,
                "ms", (System.nanoTime() - r.startNanos) / 1000000L));
    }

    private void emitError(ActiveRequest r, GeminiException e) {
        if (!r.finished.compareAndSet(false, true)) return;
        emit("geminiError", obj(
                "requestId", r.id,
                "code", e.code,
                "message", e.getMessage(),
                "httpStatus", e.http,
                "retryable", e.retryable));
    }

    // ===================== Lifecycle =====================

    @Override
    protected void handleOnDestroy() {
        try {
            for (ActiveRequest r : active.values()) {
                r.cancelled = true;
                HttpURLConnection c = r.conn;
                if (c != null) { try { c.disconnect(); } catch (Throwable ignored) { } }
            }
            executor.shutdownNow();
        } catch (Throwable ignored) { }
        super.handleOnDestroy();
    }
}
