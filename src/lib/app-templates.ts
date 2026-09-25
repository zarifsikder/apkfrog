import { mkdir, writeFile, readFile, access } from 'fs/promises'
import path from 'path'

/**
 * Shared app-generation templates used by the GitHub Actions build pipeline
 * (gradle-project.ts). Pure template/data helpers — no local toolchain.
 */

const ASSETS_DIR = path.join(process.cwd(), 'db', 'assets')

async function exists(p: string): Promise<boolean> {
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export const xmlEsc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function decodeDataUrl(dataUrl: string): Buffer | null {
  try {
    if (!dataUrl.startsWith('data:')) return null
    const b64 = dataUrl.split(',')[1]
    if (!b64) return null
    return Buffer.from(b64, 'base64')
  } catch {
    return null
  }
}

export interface BuildConfig {
  icon?: string
  splash?: string
  statusBarColor?: string
  hideTitleBar?: boolean
  exitConfirmation?: boolean
  fullscreen?: boolean
  cameraAccess?: boolean
  microphone?: boolean
  darkModeSupport?: boolean
  pullToRefresh?: boolean
  customCss?: string
  sharePhrase?: string
  shareLink?: string
  webhookUrl?: string
  pushNotifications?: boolean
  [k: string]: unknown
}

export async function defaultIconBuffer(): Promise<Buffer> {
  const cached = path.join(ASSETS_DIR, 'default-icon.png')
  if (await exists(cached)) return readFile(cached)
  // ApkForge brand mark — minimal "A" letterform + forge spark (pure vector,
  // no font dependency so it renders identically everywhere)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b82f6"/><stop offset="1" stop-color="#6d28d9"/></linearGradient></defs><rect width="192" height="192" rx="44" fill="url(#g)"/><path d="M56 132 L96 52 L136 132" stroke="#ffffff" stroke-width="14" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M72 104 H120" stroke="#ffffff" stroke-width="14" stroke-linecap="round"/><path d="M138 40 l4.5 10.5 L153 55 l-10.5 4.5 L138 70 l-4.5 -10.5 L123 55 l10.5 -4.5 Z" fill="#ffffff" opacity="0.95"/></svg>`
  const sharp = (await import('sharp')).default
  const buf = await sharp(Buffer.from(svg)).png().toBuffer()
  await mkdir(ASSETS_DIR, { recursive: true })
  await writeFile(cached, buf)
  return buf
}

export function themeXml(dark: boolean, fullscreen: boolean, splashRef: string, statusBar: string): string {
  const parent = dark ? '@android:style/Theme.Material.NoActionBar' : '@android:style/Theme.Material.Light.NoActionBar'
  const full = fullscreen ? '\n    <item name="android:windowFullscreen">true</item>' : ''
  const resolvedVariant = dark ? (fullscreen ? 'Theme.ApkForge.Dark.FullScreen' : 'Theme.ApkForge.Dark') : fullscreen ? 'Theme.ApkForge.FullScreen' : 'Theme.ApkForge'
  return `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <style name="Theme.ApkForge" parent="${parent}">
    <item name="android:windowBackground">${splashRef}</item>
    <item name="android:statusBarColor">${statusBar}</item>${full}
  </style>
  <style name="Theme.ApkForge.FullScreen" parent="Theme.ApkForge">
    <item name="android:windowFullscreen">true</item>
  </style>
  <style name="Theme.ApkForge.Dark" parent="@android:style/Theme.Material.NoActionBar">
    <item name="android:windowBackground">${splashRef}</item>
    <item name="android:statusBarColor">${statusBar}</item>${full}
  </style>
  <style name="Theme.ApkForge.Dark.FullScreen" parent="Theme.ApkForge.Dark">
    <item name="android:windowFullscreen">true</item>
  </style>
  <style name="Theme.ApkForge.Main" parent="${resolvedVariant}" />
</resources>
`
}

export function mainActivityJava(pkg: string, startUrl: string, cfg: BuildConfig, bgColor: string, pushServerUrl: string | null = null): string {
  const exitConfirm = cfg.exitConfirmation === false ? 'false' : 'true'
  const pushInit = pushServerUrl
    ? `        PushClient.init(this, webView, "${pushServerUrl}", "${pkg}");\n`
    : ''
  const pushLifecycle = pushServerUrl
    ? `
    @Override
    protected void onResume() {
        super.onResume();
        PushClient.setForeground(true);
    }

    @Override
    protected void onPause() {
        super.onPause();
        PushClient.setForeground(false);
    }

    @Override
    protected void onDestroy() {
        PushClient.onActivityDestroyed();
        super.onDestroy();
    }
`
    : ''
  return `package ${pkg};

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private WebView webView;
    private long lastBackPress = 0L;
    private boolean exitConfirm = ${exitConfirm};

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("${bgColor}"));
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("file://")) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true;
            }
        });
        webView.setWebChromeClient(new WebChromeClient());
        setContentView(webView);
${pushInit}        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl("${startUrl}");
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (exitConfirm) {
            long now = System.currentTimeMillis();
            if (now - lastBackPress > 2000L) {
                lastBackPress = now;
                Toast.makeText(this, "Press back again to exit", Toast.LENGTH_SHORT).show();
                return;
            }
        }
        super.onBackPressed();
    }
}
${pushLifecycle}`
}

/**
 * Generated push-notification client embedded in every WebView APK (when push
 * is enabled for the build). Pure Android framework code — no dependencies.
 *
 * - Registers a per-install deviceId with the ApkForge server
 * - Polls for new push notifications while the app is open (every 60s)
 * - AlarmManager background check every 15 min (via PushReceiver)
 * - Shows Android system notifications (with BigPicture for images)
 * - Injects Custom HTML banners into the WebView while the app is in foreground
 */
export function pushClientJava(pkg: string, serverUrl: string): string {
  return `package ${pkg};

import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.drawable.BitmapDrawable;
import android.graphics.drawable.Drawable;
import android.os.Build;
import android.text.Html;
import android.webkit.WebView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

public class PushClient {
    private static final ScheduledExecutorService EXEC = Executors.newSingleThreadScheduledExecutor();
    private static volatile Activity activity;
    private static volatile WebView webView;
    private static volatile boolean foreground = false;
    private static Context appContext;
    private static String serverUrl;
    private static String pkgName;
    private static String deviceId;

    public static void init(Activity act, WebView wv, String server, String pkg) {
        try {
            activity = act;
            webView = wv;
            serverUrl = server.endsWith("/") ? server.substring(0, server.length() - 1) : server;
            pkgName = pkg;
            appContext = act.getApplicationContext();
            SharedPreferences p = appContext.getSharedPreferences("af_push", Context.MODE_PRIVATE);
            deviceId = p.getString("device_id", null);
            if (deviceId == null || deviceId.length() < 8) {
                deviceId = UUID.randomUUID().toString();
                p.edit().putString("device_id", deviceId).apply();
            }
            p.edit().putString("server_url", serverUrl).apply();
            ensureNotificationPermission(act);
            foreground = true;
            EXEC.execute(new Runnable() { public void run() { register(); } });
            EXEC.execute(new Runnable() { public void run() { doPoll(); } });
            EXEC.scheduleWithFixedDelay(new Runnable() { public void run() { doPoll(); } }, 60L, 60L, TimeUnit.SECONDS);
            scheduleAlarm(appContext);
        } catch (Exception ignored) {
        }
    }

    public static void setForeground(boolean fg) {
        foreground = fg;
    }

    public static void onActivityDestroyed() {
        activity = null;
        webView = null;
        foreground = false;
    }

    /** Called by PushReceiver for alarm / boot wakeups. */
    public static void backgroundPoll(Context ctx, final Runnable done) {
        try {
            if (appContext == null) appContext = ctx.getApplicationContext();
            if (deviceId == null || serverUrl == null || pkgName == null) {
                SharedPreferences p = appContext.getSharedPreferences("af_push", Context.MODE_PRIVATE);
                deviceId = p.getString("device_id", null);
                serverUrl = p.getString("server_url", null);
                pkgName = appContext.getPackageName();
            }
            if (serverUrl == null || deviceId == null) {
                if (done != null) done.run();
                return;
            }
            EXEC.execute(new Runnable() {
                public void run() {
                    try {
                        doPoll();
                    } finally {
                        if (done != null) done.run();
                    }
                }
            });
        } catch (Exception e) {
            if (done != null) done.run();
        }
    }

    public static void scheduleAlarm(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent i = new Intent(ctx, PushReceiver.class);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 2001, i,
                    PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
            am.cancel(pi);
            am.setInexactRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 900000L, 900000L, pi);
        } catch (Exception ignored) {
        }
    }

    private static void ensureNotificationPermission(Activity act) {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (act.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                    act.requestPermissions(new String[] { "android.permission.POST_NOTIFICATIONS" }, 4213);
                }
            } catch (Exception ignored) {
            }
        }
    }

    private static void register() {
        try {
            JSONObject body = new JSONObject();
            body.put("packageName", pkgName);
            body.put("deviceId", deviceId);
            body.put("model", Build.MODEL == null ? "" : Build.MODEL);
            byte[] out = body.toString().getBytes("UTF-8");
            HttpURLConnection c = (HttpURLConnection) new URL(serverUrl + "/api/push/device").openConnection();
            c.setRequestMethod("POST");
            c.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            c.setDoOutput(true);
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            c.setFixedLengthStreamingMode(out.length);
            c.getOutputStream().write(out);
            c.getOutputStream().close();
            c.getResponseCode();
        } catch (Exception ignored) {
        }
    }

    private static void doPoll() {
        try {
            String url = serverUrl + "/api/push/poll?packageName=" + URLEncoder.encode(pkgName, "UTF-8")
                    + "&deviceId=" + URLEncoder.encode(deviceId, "UTF-8");
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            if (c.getResponseCode() != 200) return;
            InputStream in = c.getInputStream();
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            in.close();
            JSONArray arr = new JSONArray(bos.toString("UTF-8"));
            for (int i = 0; i < arr.length(); i++) {
                try {
                    JSONObject no = arr.getJSONObject(i);
                    String id = no.optString("id");
                    String title = no.optString("title", pkgName);
                    String desc = no.optString("description", "");
                    String img = no.optString("imageUrl", "");
                    String html = no.optString("html", "");
                    if (id == null || id.length() == 0) continue;
                    if (foreground && activity != null && webView != null) {
                        String body = html.trim().length() > 0 ? html : richHtml(title, desc, img);
                        showOverlay(body);
                    }
                    notifySystem(id, title, desc, img);
                } catch (Exception ignored2) {
                }
            }
        } catch (Exception ignored) {
        }
    }

    private static void notifySystem(String id, String title, String desc, String img) {
        try {
            Context ctx = appContext;
            if (ctx == null) return;
            if (Build.VERSION.SDK_INT >= 33
                    && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) {
                return;
            }
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            String channelId = "af_push";
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel ch = new NotificationChannel(channelId, "Push Notifications",
                        NotificationManager.IMPORTANCE_DEFAULT);
                nm.createNotificationChannel(ch);
            }
            Notification.Builder b = Build.VERSION.SDK_INT >= 26
                    ? new Notification.Builder(ctx, channelId)
                    : new Notification.Builder(ctx);
            b.setSmallIcon(android.R.drawable.ic_dialog_info);
            b.setContentTitle(title);
            if (desc != null && desc.length() > 0) {
                b.setContentText(desc.length() > 180 ? desc.substring(0, 177) + "..." : desc);
            }
            b.setAutoCancel(true);
            try {
                Drawable d = ctx.getPackageManager().getApplicationIcon(pkgName);
                if (d instanceof BitmapDrawable) b.setLargeIcon(((BitmapDrawable) d).getBitmap());
            } catch (Exception ignored2) {
            }
            if (img != null && img.length() > 4) {
                Bitmap bmp = downloadBitmap(img);
                if (bmp != null) {
                    Notification.BigPictureStyle st = new Notification.BigPictureStyle();
                    st.bigPicture(bmp);
                    st.setBigContentTitle(title);
                    b.setStyle(st);
                }
            }
            try {
                Intent launch = ctx.getPackageManager().getLaunchIntentForPackage(pkgName);
                if (launch == null) launch = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
                if (launch != null) {
                    PendingIntent pi = PendingIntent.getActivity(ctx, id.hashCode(), launch,
                            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                    b.setContentIntent(pi);
                }
            } catch (Exception ignored3) {
            }
            nm.notify(id.hashCode(), b.build());
        } catch (Exception ignored) {
        }
    }

    private static String richHtml(String title, String desc, String img) {
        try {
            StringBuilder sb = new StringBuilder();
            sb.append("<div style=\"padding:14px 16px;font-family:sans-serif\">");
            if (img != null && img.length() > 4) {
                sb.append("<img src=\"").append(Html.escapeHtml(img)).append("\"")
                  .append(" style=\"width:100%;border-radius:10px;margin-bottom:10px;display:block\" />");
            }
            sb.append("<div style=\"font-size:16px;font-weight:bold;color:#0f172a\">")
              .append(Html.escapeHtml(title == null ? "" : title)).append("</div>");
            if (desc != null && desc.length() > 0) {
                sb.append("<div style=\"font-size:13px;color:#475569;margin-top:4px;line-height:1.45\">")
                  .append(Html.escapeHtml(desc)).append("</div>");
            }
            sb.append("</div>");
            return sb.toString();
        } catch (Exception e) {
            return "<div style=\"padding:14px;font-family:sans-serif\">" + (title == null ? "" : title) + "</div>";
        }
    }

    private static void showOverlay(final String html) {
        final Activity act = activity;
        final WebView wv = webView;
        if (act == null || wv == null) return;
        act.runOnUiThread(new Runnable() {
            public void run() {
                try {
                    String js = "(function(h){try{"
                            + "var prev=document.getElementById('af-push-overlay');if(prev)prev.remove();"
                            + "var wrap=document.createElement('div');wrap.id='af-push-overlay';"
                            + "wrap.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483647;font-family:sans-serif;';"
                            + "var card=document.createElement('div');"
                            + "card.style.cssText='margin:10px;background:#ffffff;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.25);overflow:hidden;';"
                            + "var sc=document.createElement('div');"
                            + "sc.style.cssText='max-height:65vh;overflow-y:auto;-webkit-overflow-scrolling:touch;';sc.innerHTML=h;"
                            + "card.appendChild(sc);"
                            + "var close=document.createElement('div');"
                            + "close.style.cssText='text-align:center;padding:10px;font-weight:bold;color:#334155;"
                            + "border-top:1px solid #e2e8f0;background:#f8fafc;font-size:12px;letter-spacing:1px;';"
                            + "close.textContent='CLOSE';close.onclick=function(){wrap.remove();};card.appendChild(close);"
                            + "document.body.appendChild(wrap);" + "}catch(e){}})"
                            + "(" + JSONObject.quote(html) + ");";
                    wv.evaluateJavascript(js, null);
                } catch (Exception ignored) {
                }
            }
        });
    }

    private static Bitmap downloadBitmap(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(15000);
            int len = c.getContentLength();
            if (len > 8 * 1024 * 1024) return null;
            InputStream in = c.getInputStream();
            Bitmap bmp = BitmapFactory.decodeStream(in);
            in.close();
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }
}
`
}

/** Alarm/boot receiver — wakes the app for background push checks. */
export function pushReceiverJava(pkg: string): string {
  return `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class PushReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        String action = (intent == null || intent.getAction() == null) ? "" : intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) {
            PushClient.scheduleAlarm(context.getApplicationContext());
            return;
        }
        final PendingResult pr = goAsync();
        PushClient.backgroundPoll(context.getApplicationContext(), new Runnable() {
            public void run() {
                if (pr != null) pr.finish();
            }
        });
    }
}
`
}
