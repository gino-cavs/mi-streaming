package io.github.klasito7.funvs;

import android.app.Activity;
import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.graphics.drawable.Icon;
import android.util.Rational;
import android.webkit.JavascriptInterface;
import java.util.ArrayList;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/** FUNVS: abre la página de siempre (klasito7.github.io/mi-streaming) a pantalla completa.
 *  Todo lo demás vive en la web, así que la app casi nunca necesita actualizarse. */
public class MainActivity extends Activity {
  static final String HOME = "https://klasito7.github.io/mi-streaming/";
  static final String HOST = "klasito7.github.io";
  WebView web; FrameLayout root; View custom; WebChromeClient.CustomViewCallback customCb;
  boolean tv;
  // 🪟 ventana flotante de verdad (PiP de Android, con sus controles): solo el video, encima de todo
  static final String PIP_TOGGLE = "io.github.klasito7.funvs.PIP_TOGGLE";
  volatile boolean playing = false;
  BroadcastReceiver pipRcv;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    UiModeManager um = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
    tv = um != null && um.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION
        || getPackageManager().hasSystemFeature("amazon.hardware.fire_tv");
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    root = new FrameLayout(this); root.setBackgroundColor(Color.rgb(23, 25, 32));
    web = new WebView(this); root.addView(web); setContentView(root);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true); s.setDomStorageEnabled(true); s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);       // que el canal arranque solo
    s.setLoadWithOverviewMode(true); s.setUseWideViewPort(true);
    s.setSupportMultipleWindows(false); s.setJavaScriptCanOpenWindowsAutomatically(true);
    if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
    s.setUserAgentString(s.getUserAgentString() + " FUNVSApp/2" + (tv ? " FUNVSTV" : ""));
    CookieManager.getInstance().setAcceptCookie(true);
    if (Build.VERSION.SDK_INT >= 21) CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);   // Twitch / YouTube
    web.setBackgroundColor(Color.rgb(23, 25, 32));
    web.setWebViewClient(new WebViewClient() {
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        if (Build.VERSION.SDK_INT >= 21 && !r.isForMainFrame()) return false;
        return outside(r.getUrl());
      }
      @SuppressWarnings("deprecation") @Override public boolean shouldOverrideUrlLoading(WebView v, String url) { return outside(Uri.parse(url)); }
    });
    web.setWebChromeClient(new WebChromeClient() {
      @Override public void onShowCustomView(View v, CustomViewCallback cb) {   // pantalla completa de los videos
        if (custom != null) { cb.onCustomViewHidden(); return; }
        custom = v; customCb = cb; root.addView(v, new FrameLayout.LayoutParams(-1, -1)); web.setVisibility(View.GONE); immersive();
      }
      @Override public void onHideCustomView() { leaveCustom(); }
    });
    web.addJavascriptInterface(new Bridge(), "FUNVSNative");
    if (Build.VERSION.SDK_INT >= 26) {
      pipRcv = new BroadcastReceiver() { @Override public void onReceive(Context c, Intent i) {
        web.evaluateJavascript("(window.FUNVSApp&&FUNVSApp.pipToggle)?FUNVSApp.pipToggle():false", new ValueCallback<String>() {
          @Override public void onReceiveValue(String r) { playing = "true".equals(r); updatePip(); } }); } };
      IntentFilter f = new IntentFilter(PIP_TOGGLE);
      if (Build.VERSION.SDK_INT >= 33) registerReceiver(pipRcv, f, Context.RECEIVER_NOT_EXPORTED); else registerReceiver(pipRcv, f);
    }
    web.setFocusable(true); web.setFocusableInTouchMode(true); web.requestFocus();
    if (b != null) web.restoreState(b); else web.loadUrl(HOME);
    immersive();
  }

  /** Los links a otros sitios (DGO, Disney+, noticias…) se abren afuera, no reemplazan a FUNVS. */
  boolean outside(Uri u) {
    if (u == null) return false;
    String sch = u.getScheme() == null ? "" : u.getScheme();
    if ((sch.equals("http") || sch.equals("https")) && HOST.equalsIgnoreCase(u.getHost())) return false;
    try { startActivity(new Intent(Intent.ACTION_VIEW, u)); }
    catch (Exception e) { Toast.makeText(this, tv ? "No hay app para abrir este link en la tele" : "No se pudo abrir el link", Toast.LENGTH_SHORT).show(); }
    return true;
  }

  void leaveCustom() {
    if (custom == null) return;
    root.removeView(custom); custom = null; web.setVisibility(View.VISIBLE);
    if (customCb != null) customCb.onCustomViewHidden(); customCb = null; web.requestFocus(); immersive();
  }

  void immersive() {
    if (Build.VERSION.SDK_INT >= 19) getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
  }
  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

  /** Atrás: primero le pregunta a FUNVS (cerrar ventana, salir de TV, cerrar el reproductor); si no hay nada, sale. */
  @Override public void onBackPressed() {
    if (custom != null) { leaveCustom(); return; }
    if (Build.VERSION.SDK_INT < 19) { super.onBackPressed(); return; }
    web.evaluateJavascript("(window.FUNVSApp&&FUNVSApp.back)?FUNVSApp.back():false", new ValueCallback<String>() {
      @Override public void onReceiveValue(String r) {
        if ("true".equals(r)) return;
        if (web.canGoBack()) web.goBack(); else MainActivity.super.onBackPressed();
      }
    });
  }

  /** Botón ☰ del control: le paso a FUNVS cuánto tiempo se mantuvo apretado (toque = volver, doble = recargar, mantener = Ajustes). */
  long menuDown = 0;
  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (e.getKeyCode() == KeyEvent.KEYCODE_MENU && Build.VERSION.SDK_INT >= 19) {
      if (e.getAction() == KeyEvent.ACTION_DOWN && e.getRepeatCount() == 0) menuDown = e.getEventTime();
      if (e.getAction() == KeyEvent.ACTION_UP) {
        long ms = menuDown > 0 ? e.getEventTime() - menuDown : 0; menuDown = 0;
        web.evaluateJavascript("window.FUNVSApp&&FUNVSApp.menu&&FUNVSApp.menu(" + ms + ")", null);
      }
      return true;
    }
    return super.dispatchKeyEvent(e);
  }

  /** Lo que la página puede pedirle a la app. */
  class Bridge {
    @JavascriptInterface public boolean hasPip() { return canPip(); }
    @JavascriptInterface public void pip() { runOnUiThread(new Runnable() { @Override public void run() { enterPip(); } }); }
    @JavascriptInterface public void playing(boolean p) { playing = p; runOnUiThread(new Runnable() { @Override public void run() { updatePip(); } }); }
  }
  boolean canPip() { return !tv && Build.VERSION.SDK_INT >= 26 && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE); }
  PictureInPictureParams pipParams() {
    PictureInPictureParams.Builder b = new PictureInPictureParams.Builder().setAspectRatio(new Rational(16, 9));
    ArrayList<RemoteAction> acts = new ArrayList<>();
    int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
    PendingIntent pi = PendingIntent.getBroadcast(this, 1, new Intent(PIP_TOGGLE).setPackage(getPackageName()), fl);
    acts.add(new RemoteAction(Icon.createWithResource(this, playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play), playing ? "Pausa" : "Play", playing ? "Pausa" : "Play", pi));
    b.setActions(acts);
    if (Build.VERSION.SDK_INT >= 31) b.setAutoEnterEnabled(playing).setSeamlessResizeEnabled(true);
    return b.build();
  }
  void updatePip() { if (canPip()) try { setPictureInPictureParams(pipParams()); } catch (Exception e) {} }
  void enterPip() {
    if (!canPip()) return;
    if (custom != null) leaveCustom();
    web.evaluateJavascript("window.FUNVSApp&&FUNVSApp.pipMode&&FUNVSApp.pipMode(true)", null);
    try { enterPictureInPictureMode(pipParams()); } catch (Exception e) { web.evaluateJavascript("window.FUNVSApp&&FUNVSApp.pipMode&&FUNVSApp.pipMode(false)", null); }
  }
  /** Si apretás Inicio mientras mirás algo, queda flotando (en Android 12+ lo hace solo el sistema). */
  @Override protected void onUserLeaveHint() { super.onUserLeaveHint(); if (playing && canPip() && Build.VERSION.SDK_INT < 31) enterPip(); }
  @Override public void onPictureInPictureModeChanged(boolean in, Configuration c) {
    super.onPictureInPictureModeChanged(in, c);
    web.evaluateJavascript("window.FUNVSApp&&FUNVSApp.pipMode&&FUNVSApp.pipMode(" + in + ")", null);
    if (!in) immersive();
  }
  boolean inPip() { return Build.VERSION.SDK_INT >= 24 && isInPictureInPictureMode(); }

  @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
  @Override protected void onPause() { super.onPause(); if (!inPip()) web.onPause(); }   // flotando, el video sigue
  @Override protected void onResume() { super.onResume(); web.onResume(); immersive(); }
  @Override protected void onDestroy() { if (pipRcv != null) try { unregisterReceiver(pipRcv); } catch (Exception e) {} web.destroy(); super.onDestroy(); }
}
