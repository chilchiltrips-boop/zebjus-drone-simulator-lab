package in.zebjus.aerion;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;
import java.net.*;
import java.nio.*;
import java.util.concurrent.*;

/** Executes the production grant policy behind the browser's simulated radio. */
public final class NativeGateHarness {
    private static final class RadioScope {volatile long token;volatile LeaseGate.Lease lease;}
    public static void main(String[] args)throws Exception{
        LeaseGate gate=new LeaseGate();gate.resume();Object wifi=new Object();Map<String,LeaseGate.Grant> pending=new HashMap<>();
        NativeRcStream stream=new NativeRcStream(gate,()->System.nanoTime()/1000000L);
        DatagramSocket controller=new DatagramSocket(0,InetAddress.getLoopbackAddress());
        final long device=0x001122334455L;final RadioScope scope=new RadioScope();
        Thread radio=new Thread(()->{byte[] bytes=new byte[64];while(!controller.isClosed())try{
            DatagramPacket packet=new DatagramPacket(bytes,bytes.length);controller.receive(packet);ByteBuffer frame=ByteBuffer.wrap(bytes).order(ByteOrder.LITTLE_ENDIAN);
            LeaseGate.Lease lease=scope.lease;if(packet.getLength()!=48||frame.getInt()!=0x3143525a||frame.get(4)!=2||frame.get(5)!=2||frame.getLong(8)!=device||frame.getLong(16)!=scope.token||!gate.isCurrent(lease))continue;
            StringBuilder channels=new StringBuilder();for(int i=0;i<10;i++){if(i>0)channels.append(',');channels.append(frame.getShort(28+2*i)&65535);}
            System.out.println("RC\t"+lease.clientId+"\t"+Long.toUnsignedString(scope.token,16)+"\t"+channels);
            ByteBuffer ack=ByteBuffer.allocate(28).order(ByteOrder.LITTLE_ENDIAN);ack.putInt(0x3141525a).put((byte)2).put((byte)0).put((byte)6).put((byte)0).putLong(device).putLong(scope.token).putInt(frame.getInt(24));controller.send(new DatagramPacket(ack.array(),28,packet.getSocketAddress()));
        }catch(Exception error){if(!controller.isClosed())error.printStackTrace();}});radio.setDaemon(true);radio.start();
        ScheduledExecutorService publisher=Executors.newSingleThreadScheduledExecutor();publisher.scheduleAtFixedRate(stream::tick,0,20,TimeUnit.MILLISECONDS);
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=input.readLine())!=null){String[] f=line.split("\t",-1);long now=System.nanoTime()/1000000L;
            try{
                switch(f[1]){
                    case "begin":pending.put(f[2],gate.beginGrant(f[3],f[4],f[5],wifi));break;
                    case "accept":if(!gate.accept(pending.remove(f[2]),now,1000,f.length>6&&"SIM".equals(f[6])))throw new IllegalStateException("Grant cancelled");break;
                    case "authorize":gate.authorize(f[3],f[4],f[5]);break;
                    case "rc":{LeaseGate.Lease lease=gate.authorize(f[3],f[4],f[5]);int[] channels=LocalPolicy.channels(LocalPolicy.form("type=rc_frame&channels="+f[6]));gate.rcAck(lease,now,channels);break;}
                    case "udp":{LeaseGate.Lease lease=gate.authorize(f[3],f[4],f[5]);scope.token=Long.parseUnsignedLong(f[6],16);scope.lease=lease;stream.configure(lease,new DatagramSocket(),new InetSocketAddress(InetAddress.getLoopbackAddress(),controller.getLocalPort()),device,scope.token,true);break;}
                    case "offer":{LeaseGate.Lease lease=gate.authorize(f[3],f[4],f[5]);if(!stream.offer(lease,LocalPolicy.channels(LocalPolicy.form("type=rc_frame&channels="+f[6]))))throw new IllegalStateException("UDP input rejected");break;}
                    case "ping":gate.ack(gate.authorize(f[3],f[4],f[5]),now);break;
                    case "pause":stream.pause(gate.authorize(f[3],f[4],f[5]));break;
                    case "release":{LeaseGate.Lease lease=gate.authorize(f[3],f[4],f[5]);stream.stop(lease);gate.release(f[3],f[4],f[5]);break;}
                    default:throw new IllegalArgumentException("Unknown gate operation");
                }
                System.out.println(f[0]+"\tOK");
            }catch(Exception error){System.out.println(f[0]+"\t"+error.getMessage());}
        }
        publisher.shutdownNow();controller.close();
    }
}
