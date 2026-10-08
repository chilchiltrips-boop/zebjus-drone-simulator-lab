package in.zebjus.aerion;

import java.net.URI;
import java.net.URL;
import java.util.Map;

/** A launch link supplies an address and identity only; it never grants control. */
public final class LaunchPolicy {
    private LaunchPolicy() {}
    public static final class Target {
        public final String deviceId, origin;
        Target(String id,String base){deviceId=id;origin=base;}
    }
    public static Target parse(String value)throws Exception {
        if(value==null || value.length()>2048)throw new IllegalArgumentException("Invalid app link.");
        URI uri=new URI(value);
        if(!"aerion".equals(uri.getScheme()) || !"connect".equals(uri.getHost()) || uri.getUserInfo()!=null || uri.getPort()!=-1 || uri.getFragment()!=null || !(uri.getPath().isEmpty() || uri.getPath().equals("/")))throw new IllegalArgumentException("Invalid app link.");
        Map<String,String> fields=LocalPolicy.form(uri.getRawQuery()==null?"":uri.getRawQuery());
        for(String key:fields.keySet())if(!key.equals("kitId") && !key.equals("kitIp"))throw new IllegalArgumentException("Unsupported app link field.");
        String id=fields.getOrDefault("kitId","");
        if(!id.matches("ZFC-[A-Fa-f0-9]{12}"))throw new IllegalArgumentException("Verify the kit Device ID.");
        String host=fields.getOrDefault("kitIp","192.168.4.1");
        if(!LocalPolicy.localHost(host))throw new IllegalArgumentException("Use a local kit address.");
        URL api=LocalPolicy.api("http://"+host+"/api/status","GET");
        return new Target(id.toUpperCase(java.util.Locale.ROOT),LocalPolicy.origin(api));
    }
    public static String apSsid(String name) {
        if(name==null || name.trim().isEmpty())return "";
        name=name.trim();
        if(name.getBytes(java.nio.charset.StandardCharsets.UTF_8).length>32 || name.matches(".*[\\x00-\\x1F\\x7F].*"))throw new IllegalArgumentException("Enter the Kit Name shown in the controller Wi-Fi list (up to 32 bytes).");
        return name;
    }
}
