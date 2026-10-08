package in.zebjus.aerion;

/** Rank router Wi-Fi without selecting the AP being released or cellular data. */
public final class RouterNetworkPolicy {
    private RouterNetworkPolicy(){}
    public static String ssid(String value){
        if(value==null || "<unknown ssid>".equals(value))return "";
        return value.length()>1 && value.startsWith("\"") && value.endsWith("\"")?value.substring(1,value.length()-1):value;
    }
    public static int score(boolean wifi,boolean departing,boolean internet,boolean validated,boolean active,String actual,String expected){
        actual=ssid(actual);expected=ssid(expected);
        if(!wifi || departing || actual.startsWith("ZEBJUS_") || actual.startsWith("ZEBJUS-"))return -1;
        boolean match=!expected.isEmpty() && expected.equals(actual);
        if(!expected.isEmpty() && !actual.isEmpty() && !match)return -1;
        if(!internet && !match)return -1;
        return (match?8:0)+(validated?4:0)+(internet?2:0)+(active?1:0);
    }
}
