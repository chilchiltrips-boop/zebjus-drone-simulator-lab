package in.zebjus.aerion;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicLong;
import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/** Authenticated transport keys are independent for each direction and each channel. */
public final class SecureTransport {
 public final String sid,device,client;private final byte[] httpOut,httpIn,rcOut,ackIn;
 private final AtomicLong httpCounter=new AtomicLong(),rcCounter=new AtomicLong();
 private long responseHigh,responseBits,ackHigh,ackBits;
 public SecureTransport(String sid,String device,String client,String out,String in,String rc,String ack){
  if(!sid.matches("[a-f0-9]{16}")||!device.matches("ZFC-[A-Fa-f0-9]{12}"))throw new IllegalArgumentException("Invalid paired identity");
  this.sid=sid;this.device=device;this.client=client;httpOut=key(out);httpIn=key(in);rcOut=key(rc);ackIn=key(ack);
 }
 public static byte[] hex(String s){if(s.length()%2!=0||!s.matches("[A-Fa-f0-9]*"))throw new IllegalArgumentException("Invalid encrypted data");byte[] a=new byte[s.length()/2];for(int i=0;i<a.length;i++)a[i]=(byte)Integer.parseInt(s.substring(i*2,i*2+2),16);return a;}
 private static byte[] key(String s){byte[] a=hex(s);if(a.length!=32)throw new IllegalArgumentException("Invalid session key");return a;}
 public static String hex(byte[] a){StringBuilder b=new StringBuilder(a.length*2);for(byte n:a)b.append(String.format(java.util.Locale.ROOT,"%02x",n&255));return b.toString();}
 public static byte[] crypt(boolean encrypt,byte[] key,long n,byte[] aad,byte[] data)throws Exception{
  if(n<=0)throw new IllegalArgumentException("Secure counter expired");byte[] iv=ByteBuffer.allocate(12).putInt(0).putLong(n).array();
  Cipher c=Cipher.getInstance("AES/GCM/NoPadding");c.init(encrypt?Cipher.ENCRYPT_MODE:Cipher.DECRYPT_MODE,new SecretKeySpec(key,"AES"),new GCMParameterSpec(128,iv));c.updateAAD(aad);return c.doFinal(data);
 }
 public long nextHttp(){return httpCounter.incrementAndGet();}
 public String sealHttp(long n,String plain)throws Exception{return hex(crypt(true,httpOut,n,("ZFC3|"+sid+"|"+n+"|HTTP_C2S").getBytes(StandardCharsets.UTF_8),plain.getBytes(StandardCharsets.UTF_8)));}
 private boolean allowed(long n,long high,long bits){return n>0&&(n>high||high-n<64&&(bits&(1L<<(high-n)))==0);}
 public synchronized String openHttp(String session,long n,String cipher)throws Exception{
  if(!sid.equals(session)||!allowed(n,responseHigh,responseBits))throw new IllegalArgumentException("Secure response replay / identity mismatch");
  byte[] plain=crypt(false,httpIn,n,("ZFC3|"+sid+"|"+n+"|HTTP_S2C").getBytes(StandardCharsets.UTF_8),hex(cipher));
  if(n>responseHigh){long d=n-responseHigh;responseBits=d>=64?1:(responseBits<<d)|1;responseHigh=n;}else responseBits|=1L<<(responseHigh-n);
  return new String(plain,StandardCharsets.UTF_8);
 }
 public byte[] sealRc(byte[] plain)throws Exception{
  long n=rcCounter.incrementAndGet();byte[] header=ByteBuffer.allocate(24).order(ByteOrder.LITTLE_ENDIAN).putInt(0x3343535a).putLong(Long.parseUnsignedLong(sid,16)).putLong(n).putShort((short)plain.length).put((byte)1).put((byte)0).array();
  byte[] encrypted=crypt(true,rcOut,n,header,plain);return ByteBuffer.allocate(24+encrypted.length).put(header).put(encrypted).array();
 }
 public synchronized byte[] openAck(byte[] packet,int len)throws Exception{
  if(len!=68)throw new IllegalArgumentException("Wrong ACK length");ByteBuffer b=ByteBuffer.wrap(packet).order(ByteOrder.LITTLE_ENDIAN);
  if(b.getInt()!=0x3343535a||b.getLong()!=Long.parseUnsignedLong(sid,16))throw new IllegalArgumentException("Wrong paired ACK");long n=b.getLong();
  if(b.getShort()!=28||b.get()!=2||b.get()!=0||!allowed(n,ackHigh,ackBits))throw new IllegalArgumentException("ACK replay");
  byte[] plain=crypt(false,ackIn,n,java.util.Arrays.copyOf(packet,24),java.util.Arrays.copyOfRange(packet,24,len));
  if(n>ackHigh){long d=n-ackHigh;ackBits=d>=64?1:(ackBits<<d)|1;ackHigh=n;}else ackBits|=1L<<(ackHigh-n);return plain;
 }
}
