package in.zebjus.aerion;
public final class SecureTransportHarness {
 public static void main(String[] args)throws Exception{
  String a="00".repeat(32),b="11".repeat(32),c="22".repeat(32),d="33".repeat(32);SecureTransport s=new SecureTransport("1122334455667788","ZFC-001122334455","FLY-secure-test",a,b,c,d);
  if(args[0].equals("rc")){int[] ch={1750,1500,1000,1500,1000,1000,1000,1000,1500,1000};System.out.println(SecureTransport.hex(s.sealRc(NativeRcStream.frame(0x001122334455L,0x123456789abcdef0L,1,ch,true))));System.out.println(SecureTransport.hex(s.sealRc(NativeRcStream.frame(0x001122334455L,0x123456789abcdef0L,2,ch,true))));}
  if(args[0].equals("ack")){byte[] encrypted=SecureTransport.hex(args[1]);byte[] tampered=encrypted.clone();tampered[tampered.length-1]^=1;try{s.openAck(tampered,tampered.length);throw new AssertionError("Tampered ACK accepted");}catch(javax.crypto.AEADBadTagException expected){}System.out.println(SecureTransport.hex(s.openAck(encrypted,encrypted.length)));try{s.openAck(encrypted,encrypted.length);throw new AssertionError("ACK replay accepted");}catch(IllegalArgumentException expected){System.out.println("REPLAY_DENIED");}}
  if(args[0].equals("http")){long n=s.nextHttp();System.out.println(s.sealHttp(n,"path=%2Fapi%2Fstatus&secret=fixture-password"));}
 }
}
