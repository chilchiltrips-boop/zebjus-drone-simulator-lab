package in.zebjus.aerion;

import java.net.URI;
import java.net.URL;
import java.net.URLDecoder;
import java.util.HashMap;
import java.util.Map;

/** The native bridge can reach only the controller API on local Wi-Fi addresses. */
public final class LocalPolicy {
    private LocalPolicy() {}
    public static URL api(String value, String method) throws Exception {
        if (value.length()>2048) throw new IllegalArgumentException("Kit address is too long.");
        URI uri=new URI(value);
        if (!"http".equals(uri.getScheme()) || uri.getUserInfo()!=null || uri.getFragment()!=null || !localHost(uri.getHost())) throw new IllegalArgumentException("Use the kit's local HTTP IP address or .local name.");
        String path=uri.getPath();
        boolean read=path.equals("/api/status") || path.equals("/api/telemetry");
        boolean write=path.equals("/api/control/acquire") || path.equals("/api/control/ping") || path.equals("/api/control/release") || path.equals("/api/command");
        if (!(read && method.equals("GET") || write && method.equals("POST"))) throw new IllegalArgumentException("This request is not a flight API operation.");
        return uri.toURL();
    }
    public static boolean localHost(String host) {
        if (host==null) return false;
        host=host.toLowerCase(java.util.Locale.ROOT);
        if (host.endsWith(".local") && host.matches("[a-z0-9-]+\\.local")) return true;
        if (host.startsWith("[")) host=host.substring(1,host.length()-1);
        if (host.contains(":")) return host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:");
        String[] parts=host.split("\\."); if (parts.length!=4) return false;
        int[] n=new int[4];
        try { for(int i=0;i<4;i++){if(!parts[i].matches("[0-9]{1,3}") || parts[i].length()>1 && parts[i].startsWith("0"))return false;n[i]=Integer.parseInt(parts[i]);if(n[i]>255)return false;} } catch(NumberFormatException e){return false;}
        return n[0]==10 || n[0]==192 && n[1]==168 || n[0]==172 && n[1]>=16 && n[1]<=31 || n[0]==169 && n[1]==254;
    }
    public static String origin(URL url) { return "http://"+url.getAuthority(); }
    public static Map<String,String> form(String body) throws Exception {
        if(body.length()>4096)throw new IllegalArgumentException("Request is too large.");
        Map<String,String> out=new HashMap<>();
        if(!body.isEmpty())for(String part:body.split("&")){String[] p=part.split("=",2);String k=URLDecoder.decode(p[0],"UTF-8");if(out.containsKey(k))throw new IllegalArgumentException("Duplicate request field.");out.put(k,URLDecoder.decode(p.length>1?p[1]:"","UTF-8"));}
        return out;
    }
    public static void identity(Map<String,String> form) {
        if(!form.getOrDefault("clientId","").matches("FLY-[A-Za-z0-9-]{8,80}") || !form.getOrDefault("expectedDeviceId","").matches("[A-Za-z0-9-]{6,80}"))throw new IllegalArgumentException("Verify the kit Device ID before taking control.");
    }
    public static int[] channels(Map<String,String> form) {
        if(!"rc_frame".equals(form.get("type")))throw new IllegalArgumentException("Only RC flight frames are supported here.");
        String[] values=form.getOrDefault("channels","").split(",",-1);if(values.length!=10)throw new IllegalArgumentException("A complete RC frame is required.");
        int[] ch=new int[10];for(int i=0;i<10;i++){ch[i]=Integer.parseInt(values[i]);if(ch[i]<1000 || ch[i]>2000)throw new IllegalArgumentException("Invalid RC channel value.");}return ch;
    }
    public static boolean safe(int[] c) { return c[0]==1500 && c[1]==1500 && c[2]==1000 && c[3]==1500 && c[4]==1000; }
}
