package in.zebjus.aerion;
import java.net.*;
import java.nio.*;
import java.util.concurrent.atomic.AtomicLong;

/** Exercises the actual native binary transport on loopback, without Android. */
public final class NativeRcStreamTest {
 private static void check(boolean value,String message){if(!value)throw new AssertionError(message);}
 private static final long DEVICE=0x001122334455L,TOKEN=0xfedcba9876543210L;
 private static void sendAck(DatagramSocket socket,SocketAddress target,long device,long token,int sequence)throws Exception{
  ByteBuffer ack=ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);ack.putInt(0x3141525a).put((byte)1).put((byte)0).put((byte)3).put((byte)0).putLong(device).putLong(token).putInt(sequence);
  socket.send(new DatagramPacket(ack.array(),28,target));
 }
 public static void main(String[] args)throws Exception{
  AtomicLong now=new AtomicLong(1000);LeaseGate gate=new LeaseGate();gate.resume();
  LeaseGate.Grant grant=gate.beginGrant("http://192.168.4.1","ZFC-001122334455","FLY-transport",new Object());
  check(gate.accept(grant,now.get(),1000),"grant");LeaseGate.Lease lease=gate.authorize(grant.origin,grant.deviceId,grant.clientId);
  DatagramSocket controller=new DatagramSocket(0,InetAddress.getLoopbackAddress());controller.setSoTimeout(1000);
  NativeRcStream stream=new NativeRcStream(gate,now::get);stream.configure(lease,new DatagramSocket(),new InetSocketAddress(InetAddress.getLoopbackAddress(),controller.getLocalPort()),DEVICE,TOKEN);
  int[] channels={1500,1500,1430,1500,2000,1000,1000,1000,1500,1000};byte[] buffer=new byte[64];
  for(int i=0;i<40;i++){
   now.addAndGet(20);
   // Simulate a 160 ms WebView pause: native must continue at 50 Hz.
   if(i<10||i>=18)check(stream.offer(lease,channels),"fresh input");
   stream.tick();DatagramPacket packet=new DatagramPacket(buffer,buffer.length);controller.receive(packet);
   check(packet.getLength()==48,"frame size");ByteBuffer frame=ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN);
   check(frame.getInt()==0x3143525a&&frame.get(4)==1&&frame.getLong(8)==DEVICE&&frame.getLong(16)==TOKEN,"scoped packet");
   check((frame.getShort(32)&65535)==1430&&(frame.getShort(36)&65535)==2000,"throttle and ARM survive short pause");
   // Drop 210 ms of ACKs; received flight frames must remain live.
   if(i<12||i>=23){ByteBuffer ack=ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);ack.putInt(0x3141525a).put((byte)1).put((byte)0).put((byte)3).put((byte)0).putLong(DEVICE).putLong(TOKEN).putInt(frame.getInt(24));controller.send(new DatagramPacket(ack.array(),28,packet.getSocketAddress()));}
   check(gate.watchdog(now.get())==null,"short input/ACK gap must not revoke control");
  }
  check(lease.controllerArmed(),"actual controller ACK");
  // Drain the last valid ACK, then inject replies outside the grant/sequence.
  now.addAndGet(20);stream.offer(lease,channels);stream.tick();DatagramPacket latest=new DatagramPacket(buffer,buffer.length);controller.receive(latest);
  long ackAge=gate.ackAge(lease,now.get());
  for(int bad=0;bad<4;bad++){
   int sequence=ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN).getInt(24);
   sendAck(controller,latest.getSocketAddress(),bad==1?DEVICE+1:DEVICE,bad==0?TOKEN+1:TOKEN,bad==2?1:bad==3?sequence+10:sequence);
   now.addAndGet(20);stream.offer(lease,channels);stream.tick();latest=new DatagramPacket(buffer,buffer.length);controller.receive(latest);
   check(gate.ackAge(lease,now.get())==ackAge+20*(bad+1),"wrong token/device, replay and unsent ACK cannot keep lease alive");
  }
  now.addAndGet(301);stream.tick();controller.setSoTimeout(20);
  try{controller.receive(new DatagramPacket(buffer,buffer.length));throw new AssertionError("stale ARM replayed");}catch(SocketTimeoutException expected){}
  check(gate.watchdog(now.get())==lease,"WebView input loss must fence at 300 ms");check(!stream.offer(lease,channels),"old input cannot restore fenced session");
  stream.stop(lease);controller.setSoTimeout(500);
  for(int i=0;i<3;i++){DatagramPacket safe=new DatagramPacket(buffer,buffer.length);controller.receive(safe);ByteBuffer frame=ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN);check((frame.getShort(32)&65535)==1000&&(frame.getShort(36)&65535)==1000,"captured stop must be safe");}
  controller.close();
  LeaseGate.Grant cfg=gate.beginGrant(grant.origin,grant.deviceId,"FLY-newtoken",new Object());check(gate.accept(cfg,2000,1000),"new grant");LeaseGate.Lease next=gate.authorize(cfg.origin,cfg.deviceId,cfg.clientId);gate.input(next,2000,channels);gate.ack(next,2250);check(gate.watchdog(2301)==next,"HTTP heartbeat cannot keep stale native input alive");
  LeaseGate.Grant idle=gate.beginGrant(grant.origin,grant.deviceId,"FLY-idlereservation",new Object());check(gate.accept(idle,3000,1000),"idle configuration grant");LeaseGate.Lease idleLease=gate.authorize(idle.origin,idle.deviceId,idle.clientId);check(gate.input(idleLease,4900,channels),"manual start after long settings reservation");check(gate.ackAge(idleLease,4900)==0,"first input starts bounded ACK window");gate.input(idleLease,5800,channels);check(gate.ackAge(idleLease,5800)==900,"later input cannot renew missing ACK");check(gate.watchdog(5801)==idleLease,"no genuine ACK must still expire");
  System.out.println("PASS: actual native UDP frames, 50 Hz independent publication, 160 ms input / 210 ms ACK loss, scoped/replay ACK rejection, 300 ms stale-input fence, late-input rejection and safe stop burst");
 }
}
