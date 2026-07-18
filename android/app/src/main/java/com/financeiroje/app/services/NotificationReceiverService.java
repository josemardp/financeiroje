package com.financeiroje.app.services;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import android.content.SharedPreferences;
import android.app.Notification;
import android.os.Bundle;

import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;

public class NotificationReceiverService extends NotificationListenerService {

    private static final String TAG = "NotificationReceiver";
    private static final Set<String> ALLOWED_PACKAGES = new HashSet<>();

    static {
        ALLOWED_PACKAGES.add("com.nu.production");      // Nubank
        ALLOWED_PACKAGES.add("com.itau");               // Itaú
        ALLOWED_PACKAGES.add("br.com.intermedium");     // Inter
        ALLOWED_PACKAGES.add("br.com.c6bank.app");      // C6 Bank
        ALLOWED_PACKAGES.add("br.com.gpx.caixa");       // Caixa Federal
        ALLOWED_PACKAGES.add("com.picpay");             // PicPay
        ALLOWED_PACKAGES.add("br.com.mercadolivre");    // Mercado Pago
    }

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        String packageName = sbn.getPackageName();
        if (!ALLOWED_PACKAGES.contains(packageName)) return;

        Notification notification = sbn.getNotification();
        if (notification == null) return;
        Bundle extras = notification.extras;
        if (extras == null) return;

        CharSequence titleCS = extras.getCharSequence(Notification.EXTRA_TITLE);
        CharSequence textCS = extras.getCharSequence(Notification.EXTRA_TEXT);

        final String title = titleCS != null ? titleCS.toString() : "";
        final String text = textCS != null ? textCS.toString() : "";
        final long postTime = sbn.getPostTime();

        final String notificationHash = calculateHash(postTime + "|" + packageName + "|" + text);

        Log.d(TAG, "Notificação bancária recebida de pacote permitido: " + packageName);

        new Thread(new Runnable() {
            @Override
            public void run() {
                sendToSupabase(packageName, title, text, notificationHash, postTime);
            }
        }).start();
    }

    private String calculateHash(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            Log.e(TAG, "Error calculating hash", e);
            return "";
        }
    }

    private void sendToSupabase(String packageName, String title, String text, String hash, long time) {
        try {
            SharedPreferences sharedPrefs = getSharedPreferences("CapacitorStorage", MODE_PRIVATE);
            String accessToken = sharedPrefs.getString("supabase.auth.token", null);
            String supabaseUrl = sharedPrefs.getString("supabase.url", null);

            if (accessToken == null) {
                Log.w(TAG, "Token JWT de acesso não encontrado no CapacitorStorage.");
                return;
            }
            if (supabaseUrl == null) {
                Log.w(TAG, "URL do Supabase não encontrada no CapacitorStorage.");
                return;
            }

            URL url = new URL(supabaseUrl + "/functions/v1/ingest-notification");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + accessToken);
            conn.setDoOutput(true);

            JSONObject payload = new JSONObject();
            payload.put("packageName", packageName);
            payload.put("title", title);
            payload.put("text", text);
            payload.put("hash", hash);
            payload.put("postTime", time);

            byte[] out = payload.toString().getBytes(StandardCharsets.UTF_8);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(out);
            }

            int responseCode = conn.getResponseCode();
            Log.d(TAG, "Supabase Ingestion Response Code: " + responseCode);
            conn.disconnect();
        } catch (Exception e) {
            Log.e(TAG, "Error sending notification event to Supabase", e);
        }
    }
}
