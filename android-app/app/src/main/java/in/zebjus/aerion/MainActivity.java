package in.zebjus.aerion;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;
import android.net.Uri;
import android.net.wifi.WifiNetworkSpecifier;
import android.os.Build;
import android.os.Bundle;
import android.os.PatternMatcher;
import android.provider.Settings;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.ValueCallback;
import android.app.AlertDialog;
import android.window.OnBackInvokedDispatcher;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;

public final class MainActivity extends Activity {
    private static final String ASSET_HOST="appassets.androidplatform.net";
    private ValueCallback<Uri[]> filePicker;
    private String exportText;
    private static final int PICK_BACKUP=701,SAVE_EXPORT=702;
    private static final String HOME="https://"+ASSET_HOST+"/assets/flight/index.html";
    private final String token=UUID.randomUUID().toString();
    private final LeaseGate gate=new LeaseGate();
    private final NativeRcStream rcStream=new NativeRcStream(gate,MainActivity::now);
    private final ExecutorService workers=new ThreadPoolExecutor(4,4,20,TimeUnit.SECONDS,new LinkedBlockingQueue<>(24));
    // RC must not queue behind telemetry, Wi-Fi scans or settings requests.
    private final ThreadPoolExecutor flightWorker=new ThreadPoolExecutor(1,1,20,TimeUnit.SECONDS,new LinkedBlockingQueue<>(2));
    private final ExecutorService safety=Executors.newSingleThreadExecutor();
    private final ScheduledExecutorService watchdog=Executors.newSingleThreadScheduledExecutor();
    private final ConcurrentHashMap<String,Job> jobs=new ConcurrentHashMap<>();
    private volatile Network wifi;
    private volatile boolean destroyed;
    private boolean resumed;
    private WebView web;
    private ConnectivityManager connectivity;
    private volatile Network selectedKitWifi;
    private ConnectivityManager.NetworkCallback kitRequest;
    private String pendingWifiId="";
    private boolean joinAfterPermission;
    private LaunchPolicy.Target launch;
    private static final int WIFI_PERMISSION=41;

    private final ConnectivityManager.NetworkCallback wifiCallback=new ConnectivityManager.NetworkCallback(){
        @Override public void onAvailable(Network network){chooseWifi(network);}
        @Override public void onLost(Network network){if(network.equals(wifi)){wifi=null;emergency(gate.fence(false));emit("networkLost");}}
    };
    private static long now(){return System.nanoTime()/1_000_000L;}

    @Override public void onCreate(Bundle state){
        super.onCreate(state);
        readLaunch(getIntent());
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web=new WebView(this);web.setBackgroundColor(Color.rgb(8,9,11));setContentView(web);
        WebSettings settings=web.getSettings();settings.setJavaScriptEnabled(true);settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        WebView.setWebContentsDebuggingEnabled(false);
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(filePicker!=null)filePicker.onReceiveValue(null);filePicker=callback;pauseControl();
                Intent pick=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(pick,PICK_BACKUP);return true;
            }
        });web.addJavascriptInterface(new NativeBridge(),"NativeAerion");
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap icon){emergency(gate.fence(false));}
            @Override public void onPageFinished(WebView view,String url){deliverLaunch();}
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest request){return asset(request.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
                Uri uri=request.getUrl();
                if(uri.toString().equals(HOME))return false;
                // Flight navigation remains inside this app. Kit configuration
                // is available separately in the laptop WebApp.
                return true;
            }
        });
        connectivity=(ConnectivityManager)getSystemService(CONNECTIVITY_SERVICE);
        connectivity.registerNetworkCallback(new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).build(),wifiCallback);
        for(Network network:connectivity.getAllNetworks()){
            NetworkCapabilities capabilities=connectivity.getNetworkCapabilities(network);
            if(capabilities!=null && capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)){wifi=network;break;}
        }
        watchdog.scheduleAtFixedRate(()->{LeaseGate.Lease old=gate.watchdog(now());if(old!=null){emergency(old);wifiMessage("stopped",old.clientId);}},75,75,TimeUnit.MILLISECONDS);
        watchdog.scheduleAtFixedRate(rcStream::tick,0,20,TimeUnit.MILLISECONDS);
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{pauseControl();finish();});
        web.loadUrl(HOME);immersive();
    }
    private boolean preferRouterWifi=false;
    private void chooseWifi(Network network){
        if(selectedKitWifi!=null && !selectedKitWifi.equals(network))return;
        if(destroyed || network.equals(wifi))return;
        if(selectedKitWifi==null && wifi!=null)return;
        emergency(gate.fence(false));wifi=network;emit("networkLost");if(gate.isForeground())emit("resume");
    }
    private void immersive(){getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY|View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);}
    private void emit(String method){runOnUiThread(()->{if(!destroyed && web!=null)web.evaluateJavascript("window.AerionAndroid&&window.AerionAndroid."+method+"&&window.AerionAndroid."+method+"()",null);});}
    private void pauseControl(){emergency(gate.fence(true));emit("pause");}
    @Override protected void onResume(){super.onResume();resumed=true;if(web!=null){web.onResume();web.resumeTimers();}gate.resume();emit("resume");immersive();if(joinAfterPermission){joinAfterPermission=false;joinKitWifi(pendingWifiId);}}
    @Override protected void onPause(){resumed=false;pauseControl();if(web!=null){web.onPause();web.pauseTimers();}super.onPause();}
    @Override public void onWindowFocusChanged(boolean focus){super.onWindowFocusChanged(focus);if(focus && resumed){gate.resume();emit("resume");immersive();}else if(!focus && resumed)pauseControl();}
    @Override public void onBackPressed(){pauseControl();finish();}
    @Override protected void onDestroy(){
        pauseControl();destroyed=true;
        try{connectivity.unregisterNetworkCallback(wifiCallback);}catch(RuntimeException ignored){}
        if(kitRequest!=null)try{connectivity.unregisterNetworkCallback(kitRequest);}catch(RuntimeException ignored){}
        for(Job job:jobs.values())job.cancel();workers.shutdownNow();flightWorker.shutdownNow();watchdog.shutdownNow();safety.shutdown();
        if(web!=null){web.removeJavascriptInterface("NativeAerion");web.destroy();web=null;}super.onDestroy();
    }
    private void readLaunch(Intent intent){
        if(intent==null || intent.getData()==null)return;
        try{launch=LaunchPolicy.parse(intent.getData().toString());}catch(Exception ignored){launch=null;}
    }
    private void deliverLaunch(){
        if(launch==null || web==null)return;
        LaunchPolicy.Target target=launch;launch=null;
        web.evaluateJavascript("window.AerionAndroid&&window.AerionAndroid.openKit&&window.AerionAndroid.openKit("+JSONObject.quote(target.deviceId)+","+JSONObject.quote(target.origin)+")",null);
    }
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);pauseControl();setIntent(intent);readLaunch(intent);if(resumed && web.hasWindowFocus())gate.resume();deliverLaunch();}
    private void wifiMessage(String method,String message){runOnUiThread(()->{if(!destroyed && web!=null)web.evaluateJavascript("window.AerionAndroid&&window.AerionAndroid."+method+"&&window.AerionAndroid."+method+"("+JSONObject.quote(message)+")",null);});}
    private void useRouterWifi(){
        pauseControl();preferRouterWifi=true;
        if(kitRequest!=null)try{connectivity.unregisterNetworkCallback(kitRequest);}catch(RuntimeException ignored){}
        kitRequest=null;selectedKitWifi=null;wifi=null;
        Network preferred=connectivity.getActiveNetwork();NetworkCapabilities cap=preferred==null?null:connectivity.getNetworkCapabilities(preferred);
        if(cap!=null&&cap.hasTransport(NetworkCapabilities.TRANSPORT_WIFI))wifi=preferred;
        if(wifi==null)for(Network n:connectivity.getAllNetworks()){NetworkCapabilities c=connectivity.getNetworkCapabilities(n);if(c!=null&&c.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)&&c.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)){wifi=n;break;}}
        if(resumed&&web.hasWindowFocus())gate.resume();emit("routerReady");
        if(wifi==null)wifiMessage("wifiError","Join the kit's saved router Wi-Fi in Phone Wi-Fi settings, then return here.");
    }
    private void joinKitWifi(String id){
        preferRouterWifi=false;
        if(!resumed || destroyed)return;
        try{LaunchPolicy.apSsid(id);}catch(Exception e){wifiMessage("wifiError",e.getMessage());return;}
        if(Build.VERSION.SDK_INT<29){wifiMessage("wifiError","In-app Wi-Fi connection needs Android 10+. Use Phone Wi-Fi settings, then return here.");return;}
        pendingWifiId=id;
        String permission=Build.VERSION.SDK_INT>=33?Manifest.permission.NEARBY_WIFI_DEVICES:Manifest.permission.ACCESS_FINE_LOCATION;
        if(checkSelfPermission(permission)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{permission},WIFI_PERMISSION);return;}
        pauseControl();
        if(kitRequest!=null)try{connectivity.unregisterNetworkCallback(kitRequest);}catch(RuntimeException ignored){}
        selectedKitWifi=null;
        try{
            WifiNetworkSpecifier.Builder spec=new WifiNetworkSpecifier.Builder().setWpa2Passphrase("12345678");
            String ssid=LaunchPolicy.apSsid(id);
            if(ssid.isEmpty())spec.setSsidPattern(new PatternMatcher("ZEBJUS-FC-",PatternMatcher.PATTERN_PREFIX));else spec.setSsid(ssid);
            NetworkRequest request=new NetworkRequest.Builder().addTransportType(NetworkCapabilities.TRANSPORT_WIFI).removeCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET).setNetworkSpecifier(spec.build()).build();
            ConnectivityManager.NetworkCallback callback=new ConnectivityManager.NetworkCallback(){
                @Override public void onAvailable(Network network){runOnUiThread(()->{
                    if(destroyed || kitRequest!=this)return;
                    selectedKitWifi=network;chooseWifi(network);
                    if(resumed && web.hasWindowFocus()){gate.resume();emit("resume");}
                    emit("wifiReady");
                });}
                @Override public void onUnavailable(){runOnUiThread(()->{if(kitRequest!=this)return;kitRequest=null;selectedKitWifi=null;if(resumed && web.hasWindowFocus()){gate.resume();emit("resume");}wifiMessage("wifiError","Wi-Fi connection was cancelled or the kit was not found. Power on the kit and retry.");});}
                @Override public void onLost(Network network){runOnUiThread(()->{if(kitRequest!=this || !network.equals(selectedKitWifi))return;selectedKitWifi=null;if(network.equals(wifi))wifi=null;emergency(gate.fence(false));emit("networkLost");wifiMessage("wifiError","Kit Wi-Fi disconnected. Connect again.");});}
            };
            kitRequest=callback;wifiMessage("wifiProgress","Choose this kit in Android's Wi-Fi dialog. AP password: 12345678.");
            connectivity.requestNetwork(request,callback,45000);
        }catch(Exception e){kitRequest=null;selectedKitWifi=null;if(resumed && web.hasWindowFocus()){gate.resume();emit("resume");}wifiMessage("wifiError","Could not request kit Wi-Fi. Allow the Wi-Fi permission and retry, or use Phone Wi-Fi settings.");}
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request!=WIFI_PERMISSION)return;
        if(results.length>0 && results[0]==PackageManager.PERMISSION_GRANTED){if(resumed)joinKitWifi(pendingWifiId);else joinAfterPermission=true;}
        else wifiMessage("wifiError","Wi-Fi permission was denied. Allow Nearby devices (Android 13+) or Location (Android 10–12) to connect inside the app.");
    }
    private WebResourceResponse asset(Uri uri){
        try{
            if(!"https".equals(uri.getScheme()) || !ASSET_HOST.equals(uri.getHost()))return empty(403);
            String path=uri.getPath();String mime;
            if("/assets/flight/index.html".equals(path))mime="text/html";
            else if("/assets/android-transport.js".equals(path))mime="text/javascript";
            else return empty(404);
            byte[] bytes;
            try(InputStream in=getAssets().open(path.substring("/assets/".length()))){bytes=read(in,150000);}
            if(mime.equals("text/html"))bytes=new String(bytes,StandardCharsets.UTF_8).replace("<script src=\"../android-transport.js\"></script>","<script>window.__aerionToken="+JSONObject.quote(token)+";</script><script src=\"../android-transport.js\"></script>").getBytes(StandardCharsets.UTF_8);
            Map<String,String> headers=new java.util.HashMap<>();headers.put("Cache-Control","no-store");headers.put("Content-Security-Policy","default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; img-src 'self' data:; frame-src 'none'; object-src 'none'; base-uri 'none'");
            return new WebResourceResponse(mime,"UTF-8",200,"OK",headers,new ByteArrayInputStream(bytes));
        }catch(Exception e){return empty(404);}
    }
    private static WebResourceResponse empty(int code){return new WebResourceResponse("text/plain","UTF-8",code,code==403?"Forbidden":"Not Found",Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));}
    private static byte[] read(InputStream input,int max)throws Exception{
        ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] buffer=new byte[4096];int n;
        while((n=input.read(buffer))!=-1){if(out.size()+n>max)throw new IllegalStateException("Response too large.");out.write(buffer,0,n);}return out.toByteArray();
    }
    private void reply(String id,int code,String body){runOnUiThread(()->{if(!destroyed)web.evaluateJavascript("window.AerionAndroid.deliver("+JSONObject.quote(id)+","+code+","+JSONObject.quote(body)+")",null);});}
    private void failure(String id,String message){reply(id,0,message);}
    private static String enc(String value)throws Exception{return URLEncoder.encode(value,"UTF-8");}
    private void emergency(LeaseGate.Lease lease){
        if(lease==null)return;
        rcStream.stop(lease);
        try{safety.execute(()->{
            try{
                String form="clientId="+enc(lease.clientId)+"&expectedDeviceId="+enc(lease.deviceId);
                if(lease.hasRc())try{http((Network)lease.network,new URL(lease.origin+"/api/command"),"POST",form+"&type=rc_frame&channels="+lease.safeChannels(),600,null);}catch(Exception ignored){}
                try{http((Network)lease.network,new URL(lease.origin+"/api/control/release"),"POST",form,600,null);}catch(Exception ignored){}
            }catch(Exception ignored){}
        });}catch(RuntimeException ignored){}
    }
    private void releaseGrant(LeaseGate.Grant grant){
        try{safety.execute(()->{try{http((Network)grant.network,new URL(grant.origin+"/api/control/release"),"POST","clientId="+enc(grant.clientId)+"&expectedDeviceId="+enc(grant.deviceId),600,null);}catch(Exception ignored){}});}catch(RuntimeException ignored){}
    }
    private void configureRcStream(LeaseGate.Grant grant,String body){
        DatagramSocket socket=null;
        try{
            JSONObject info=new JSONObject(body);int port=info.optInt("rcUdpPort",0);String nonce=info.optString("rcUdpToken","");
            if(port!=4210||!nonce.matches("[0-9a-fA-F]{16}"))return;
            if(!grant.deviceId.matches("ZFC-[0-9a-fA-F]{12}"))return;
            LeaseGate.Lease lease=gate.authorize(grant.origin,grant.deviceId,grant.clientId);
            socket=new DatagramSocket();((Network)grant.network).bindSocket(socket);
            URL url=new URL(grant.origin);
            InetSocketAddress target=new InetSocketAddress(((Network)grant.network).getAllByName(url.getHost())[0],port);
            rcStream.configure(lease,socket,target,Long.parseUnsignedLong(grant.deviceId.substring(4),16),Long.parseUnsignedLong(nonce,16));
        }catch(Exception ignored){if(socket!=null)socket.close();/* Legacy HTTP fallback retains watchdog checks. */}
    }
    private static final class Result{final int code;final String body;Result(int code,String body){this.code=code;this.body=body;}}
    private Result http(Network network,URL url,String method,String body,int timeout,Job job)throws Exception{
        if(network==null)throw new IllegalStateException("Join the kit Wi-Fi in phone settings.");
        HttpURLConnection connection=(HttpURLConnection)network.openConnection(url);
        if(job!=null){job.connection=connection;if(job.cancelled){connection.disconnect();throw new IllegalStateException("Request cancelled.");}}
        long deadline=now()+timeout;
        try{
            connection.setConnectTimeout(timeout);connection.setReadTimeout(timeout);connection.setInstanceFollowRedirects(false);connection.setUseCaches(false);connection.setRequestMethod(method);
            connection.setRequestProperty("Accept","application/json");
            if(method.equals("POST")){
                connection.setDoOutput(true);byte[] bytes=body.getBytes(StandardCharsets.UTF_8);connection.setFixedLengthStreamingMode(bytes.length);connection.setRequestProperty("Content-Type","application/x-www-form-urlencoded");
                if(job!=null && !job.allowed())throw new IllegalStateException("Control stopped.");
                try(OutputStream stream=connection.getOutputStream()){stream.write(bytes);}
            }
            int code=connection.getResponseCode();InputStream stream=code<400?connection.getInputStream():connection.getErrorStream();
            if(stream==null)return new Result(code,"{}");
            ByteArrayOutputStream out=new ByteArrayOutputStream();byte[] bytes=new byte[4096];
            try(InputStream in=stream){while(true){long left=deadline-now();if(left<=0)throw new java.net.SocketTimeoutException();connection.setReadTimeout((int)Math.max(1,left));int n=in.read(bytes);if(n<0)break;if(out.size()+n>65536)throw new IllegalStateException("Kit response is too large.");out.write(bytes,0,n);}}
            return new Result(code,new String(out.toByteArray(),StandardCharsets.UTF_8));
        }finally{connection.disconnect();}
    }
    private final class Job implements Runnable{
        final String id,method,body;final URL url;final Network network;final int timeout;
        final LeaseGate.Grant grant;final LeaseGate.Lease lease;final Map<String,String> fields;
        final boolean safeFrame,readCommand;
        volatile boolean cancelled;volatile HttpURLConnection connection;
        Job(String id,URL url,String method,String body,int timeout,Network network)throws Exception{
            this.id=id;this.url=url;this.method=method;this.body=body;this.timeout=timeout;this.network=network;
            fields=LocalPolicy.form(body);String path=url.getPath();LeaseGate.Grant g=null;LeaseGate.Lease l=null;boolean safe=false,readonly=false;
            if(method.equals("POST")){
                LocalPolicy.identity(fields);
                String base=LocalPolicy.origin(url),device=fields.get("expectedDeviceId"),client=fields.get("clientId");
                if(path.equals("/api/control/acquire"))g=gate.beginGrant(base,device,client,network);
                else if(path.equals("/api/command")){
                    readonly=LocalPolicy.readCommand(fields);
                    if("rc_frame".equals(fields.get("type"))){safe=LocalPolicy.safe(LocalPolicy.channels(fields));if(!safe)l=gate.authorize(base,device,client);else if(gate.isForeground()){try{l=gate.authorize(base,device,client);}catch(IllegalStateException ignored){}}}
                    else if(!readonly){if(!LocalPolicy.configCommand(fields))throw new IllegalArgumentException("Unsupported controller setting.");l=gate.authorize(base,device,client);}
                }
                else if(path.equals("/api/wifi/use")||path.equals("/api/wifi/set")||path.equals("/api/setup/test"))l=gate.authorize(base,device,client);
                else if(path.equals("/api/control/ping"))l=gate.authorize(base,device,client);
            }
            grant=g;lease=l;safeFrame=safe;readCommand=readonly;
        }
        boolean allowed(){return !cancelled && (method.equals("GET") || readCommand || safeFrame || url.getPath().equals("/api/control/release") || grant!=null && gate.isPending(grant) || lease!=null && gate.isCurrent(lease));}
        void cancel(){cancelled=true;if(grant!=null)emergency(gate.cancel(grant));flightWorker.remove(this);((ThreadPoolExecutor)workers).remove(this);if(connection!=null)connection.disconnect();}
        @Override public void run(){
            try{
                if(!allowed())throw new IllegalStateException("Control stopped.");
                Result result=http(network,url,method,body,timeout,this);
                boolean ok=result.code>=200 && result.code<300 && new JSONObject(result.body).optBoolean("ok",true);
                if(grant!=null){if(ok && !cancelled && gate.accept(grant,now(),new JSONObject(result.body).optLong("rcTimeoutMs",0))){configureRcStream(grant,result.body);}else{gate.cancel(grant);if(ok)releaseGrant(grant);if(ok)throw new IllegalStateException("Control request cancelled. Take control again.");}}
                if(ok && lease!=null){if("rc_frame".equals(fields.get("type")))gate.rcAck(lease,now(),LocalPolicy.channels(fields));else gate.ack(lease,now());}
                if(ok && url.getPath().equals("/api/control/release"))rcStream.stop(gate.release(LocalPolicy.origin(url),fields.get("expectedDeviceId"),fields.get("clientId")));
                if(!cancelled)reply(id,result.code,result.body);
            }catch(Exception e){
                if(grant!=null){gate.cancel(grant);releaseGrant(grant);}
                if(!cancelled)failure(id,e instanceof IllegalArgumentException || e instanceof IllegalStateException ? e.getMessage() : "Kit not reachable. Join its Wi-Fi and check the address.");
            }finally{jobs.remove(id,this);}
        }
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        if(request==PICK_BACKUP && filePicker!=null){ValueCallback<Uri[]> callback=filePicker;filePicker=null;callback.onReceiveValue(result==RESULT_OK&&data!=null&&data.getData()!=null?new Uri[]{data.getData()}:null);}
        if(request==SAVE_EXPORT){String value=exportText;exportText=null;if(result==RESULT_OK&&data!=null&&data.getData()!=null&&value!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData())){if(out!=null)out.write(value.getBytes(StandardCharsets.UTF_8));}catch(Exception e){emit("exportFailed");}}}
    }
    private final class NativeBridge{
        @JavascriptInterface public void request(String key,String id,String address,String method,String form,int requestedTimeout){
            if(!token.equals(key) || destroyed || id==null || !id.matches("[A-Za-z0-9-]{1,96}"))return;
            Job job=null;
            try{URL url=LocalPolicy.api(address,method);if(url.getPath().equals("/api/control/acquire"))form=form.replaceAll("(?:^|&)clientRole=[^&]*","")+"&clientRole=MOBILE";boolean rc="rc_frame".equals(LocalPolicy.form(form).get("type"));job=new Job(id,url,method,form,Math.max(150,Math.min(rc?1500:8000,requestedTimeout)),wifi);
                if(rc&&job.lease!=null&&rcStream.offer(job.lease,LocalPolicy.channels(job.fields))){
                    JSONObject result=new JSONObject().put("ok",true).put("rcQueued",true).put("rcAckAgeMs",gate.ackAge(job.lease,now())).put("deviceId",job.lease.deviceId);
                    if(job.lease.hasControllerAck())result.put("armed",job.lease.controllerArmed()).put("flightReady",job.lease.controllerReady());
                    reply(id,200,result.toString());return;
                }
                if(jobs.putIfAbsent(id,job)!=null)throw new IllegalArgumentException("Duplicate request.");(rc?flightWorker:workers).execute(job);}
            catch(Exception e){if(job!=null){job.cancel();jobs.remove(id,job);}failure(id,e.getMessage()==null?"Join your kit Wi-Fi and retry.":e.getMessage());}
        }
        @JavascriptInterface public void cancel(String key,String id){if(token.equals(key)){Job job=jobs.get(id);if(job!=null)job.cancel();}}
        @JavascriptInterface public void pauseStream(String key,String base,String device,String client){
            if(!token.equals(key)||destroyed)return;
            try{LeaseGate.Lease lease=gate.authorize(base,device,client);rcStream.pause(lease);}catch(Exception ignored){}
        }
        @JavascriptInterface public void saveFile(String key,String name,String body,String mime){
            if(!token.equals(key)||destroyed||body==null||body.length()>1500000||name==null||!name.matches("[A-Za-z0-9_.-]{1,100}")||!("application/json".equals(mime)||"text/csv".equals(mime)))return;
            runOnUiThread(()->{pauseControl();exportText=body;Intent save=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(mime).putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(save,SAVE_EXPORT);});
        }
        @JavascriptInterface public void openWifi(String key){if(token.equals(key))runOnUiThread(()->{pauseControl();startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS));});}
        @JavascriptInterface public void useRouterWifi(String key){if(token.equals(key))runOnUiThread(()->MainActivity.this.useRouterWifi());}
        @JavascriptInterface public void joinWifi(String key,String deviceId){if(token.equals(key))runOnUiThread(()->joinKitWifi(deviceId));}
    }
}
