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
  LeaseGate.Grant httpGrant=gate.beginGrant(grant.origin,grant.deviceId,"FLY-httptraining",new Object());check(gate.accept(httpGrant,6000,1000),"simulator HTTP grant");LeaseGate.Lease httpLease=gate.authorize(httpGrant.origin,httpGrant.deviceId,httpGrant.clientId);
  DatagramSocket oldController=new DatagramSocket(0,InetAddress.getLoopbackAddress());stream.configure(httpLease,new DatagramSocket(),new InetSocketAddress(InetAddress.getLoopbackAddress(),oldController.getLocalPort()),DEVICE,TOKEN);
  stream.useHttp(httpLease);check(!stream.offer(httpLease,channels),"HTTP selection must discard the previous UDP profile");
  for(long t=6200;t<=7200;t+=200){gate.rcAck(httpLease,t,channels);check(gate.watchdog(t+150)==null,"accepted HTTP RC keeps native grant live without UDP");}
  check(gate.watchdog(8101)==httpLease,"unacknowledged HTTP stream still expires");oldController.close();
  // ZRC2 uses the actual 50 Hz transport while HTTP replies are held elsewhere.
  now.set(9000);LeaseGate.Grant simGrant=gate.beginGrant(grant.origin,grant.deviceId,"FLY-udp-simulation",new Object());check(gate.accept(simGrant,now.get(),1000),"ZRC2 grant");LeaseGate.Lease simLease=gate.authorize(simGrant.origin,simGrant.deviceId,simGrant.clientId);
  DatagramSocket simController=new DatagramSocket(0,InetAddress.getLoopbackAddress());simController.setSoTimeout(1000);
  stream.configure(simLease,new DatagramSocket(),new InetSocketAddress(InetAddress.getLoopbackAddress(),simController.getLocalPort()),DEVICE,TOKEN+1,true);
  for(int i=0;i<150;i++){
   now.addAndGet(20);channels[0]=i%2==0?1800:1200;channels[1]=i%3==0?1700:1300;
   check(stream.offer(simLease,channels),"fresh simulator input");stream.tick();DatagramPacket packet=new DatagramPacket(buffer,buffer.length);simController.receive(packet);
   ByteBuffer frame=ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN);check(frame.get(4)==2&&frame.get(5)==2&&frame.getLong(16)==TOKEN+1,"simulation frame is distinct from real flight");check((frame.getShort(28)&65535)==channels[0]&&(frame.getShort(30)&65535)==channels[1],"roll and pitch update every frame");
   ByteBuffer ack=ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);ack.putInt(0x3141525a).put((byte)2).put((byte)0).put((byte)6).put((byte)0).putLong(DEVICE).putLong(TOKEN+1).putInt(frame.getInt(24));simController.send(new DatagramPacket(ack.array(),28,packet.getSocketAddress()));
   check(gate.watchdog(now.get())==null,"simulation keeps its normal native ACK deadline without HTTP");
  }
  check(simLease.hasControllerAck()&&!simLease.controllerArmed()&&simLease.controllerReady(),"simulation ACK confirms readiness with physical outputs disarmed");
  now.addAndGet(20);stream.offer(simLease,channels);stream.tick();DatagramPacket lastSim=new DatagramPacket(buffer,buffer.length);simController.receive(lastSim);long simAckAge=gate.ackAge(simLease,now.get());
  for(int bad=0;bad<3;bad++){
   int sequence=ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN).getInt(24);ByteBuffer ack=ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);ack.putInt(0x3141525a).put((byte)(bad==0?1:2)).put((byte)0).put((byte)(bad==1?2:bad==2?7:6)).put((byte)0).putLong(DEVICE).putLong(TOKEN+1).putInt(sequence);simController.send(new DatagramPacket(ack.array(),28,lastSim.getSocketAddress()));
   now.addAndGet(20);stream.offer(simLease,channels);stream.tick();lastSim=new DatagramPacket(buffer,buffer.length);simController.receive(lastSim);check(gate.ackAge(simLease,now.get())==simAckAge+20*(bad+1),"wrong protocol/kind or physical ARM cannot acknowledge simulation");
  }
  stream.stop(simLease);for(int i=0;i<3;i++){DatagramPacket safe=new DatagramPacket(buffer,buffer.length);simController.receive(safe);check(buffer[4]==2&&buffer[5]==2&&(ByteBuffer.wrap(buffer).order(ByteOrder.LITTLE_ENDIAN).getShort(36)&65535)==1000,"simulation safe-stop remains a simulation packet");}simController.close();
  System.out.println("PASS: actual native UDP frames, independent 50 Hz publication, scoped/replay ACK rejection, stale-input fence, safe stop burst, ZRC2 real-time input, protocol/physical-ARM ACK rejection, HTTP compatibility and acknowledged watchdog");
 }
}
