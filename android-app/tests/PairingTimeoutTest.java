package in.zebjus.aerion;
public final class PairingTimeoutTest {
 public static void main(String[] args){
  if(LocalPolicy.requestTimeout("/api/security/hello",false,15000)!=15000 || LocalPolicy.requestTimeout("/api/security/proof",false,20000)!=15000)throw new AssertionError("Pairing handshake is prematurely clipped");
  if(LocalPolicy.requestTimeout("/api/status",false,15000)!=8000 || LocalPolicy.requestTimeout("/api/command",true,15000)!=1500 || LocalPolicy.requestTimeout("/api/security/invite",false,15000)!=8000 || LocalPolicy.requestTimeout("/api/security/hello",false,50)!=150)throw new AssertionError("Non-pairing bounds changed");
  System.out.println("PASS: only pairing hello/proof permit 15 seconds; other HTTP/RC timeout bounds retained");
 }
}
