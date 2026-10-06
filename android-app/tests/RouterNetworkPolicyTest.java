package in.zebjus.aerion;

public final class RouterNetworkPolicyTest {
    private static void check(boolean value){if(!value)throw new AssertionError("Router Wi-Fi selection failed");}
    public static void main(String[] args){
        check(RouterNetworkPolicy.score(true,true,true,true,true,"","School")<0); // stale AP callback
        check(RouterNetworkPolicy.score(false,false,true,true,true,"","School")<0); // cellular
        check(RouterNetworkPolicy.score(true,false,true,false,true,"ZEBJUS-FC-001122","School")<0);
        check(RouterNetworkPolicy.score(true,false,true,true,true,"Other","School")<0);
        check(RouterNetworkPolicy.score(true,false,false,false,false,"\"School\"","School")>=0); // offline LAN
        check(RouterNetworkPolicy.score(true,false,true,false,false,"<unknown ssid>","School")>=0); // redacted SSID
        check(RouterNetworkPolicy.score(true,false,false,false,true,"","")<0);
        check(RouterNetworkPolicy.score(true,false,true,true,true,"School","School")>RouterNetworkPolicy.score(true,false,true,false,false,"","School"));
        System.out.println("PASS: router network selection excludes old AP, cellular and wrong SSID; accepts offline router and redacted SSID callbacks");
    }
}
