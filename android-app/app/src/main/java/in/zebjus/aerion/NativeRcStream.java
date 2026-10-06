package in.zebjus.aerion;

import java.net.DatagramPacket;
import java.net.DatagramSocket;
import java.net.InetSocketAddress;
import java.net.SocketTimeoutException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.function.LongSupplier;

/** 50 Hz latest-input publisher; HTTP and WebView reply delivery never pace RC. */
public final class NativeRcStream {
    public static final int FRAME_BYTES=48, ACK_BYTES=28;
    private final LeaseGate gate;
    private final LongSupplier clock;
    private volatile Profile profile;
    private volatile java.util.Map<String,Object> archived=new java.util.LinkedHashMap<>();
    private static final class Profile {
        final LeaseGate.Lease lease;
        final DatagramSocket socket;
        final long device,token;
        final boolean simulation;
        final long[] sentAt=new long[64];
        int sequence,lastAck;long framesSent,acksReceived,sendErrors,ackRejected;
        boolean ackSeen,closed;
        Profile(LeaseGate.Lease lease,DatagramSocket socket,long device,long token,boolean simulation){this.lease=lease;this.socket=socket;this.device=device;this.token=token;this.simulation=simulation;}
    }
    public NativeRcStream(LeaseGate gate,LongSupplier clock){this.gate=gate;this.clock=clock;}
    public synchronized void useHttp(LeaseGate.Lease lease){
        if(!gate.isCurrent(lease))throw new IllegalStateException("Control stopped.");
        if(profile!=null){close(profile,false);profile=null;}
    }
    public synchronized void configure(LeaseGate.Lease lease,DatagramSocket socket,InetSocketAddress target,long device,long token)throws Exception{
        configure(lease,socket,target,device,token,false);
    }
    public synchronized void configure(LeaseGate.Lease lease,DatagramSocket socket,InetSocketAddress target,long device,long token,boolean simulation)throws Exception{
        if(!gate.isCurrent(lease)||token==0){socket.close();throw new IllegalStateException("Control stopped.");}
        if(profile!=null)close(profile,false);
        socket.connect(target);socket.setSoTimeout(1);profile=new Profile(lease,socket,device,token,simulation);
    }
    public boolean offer(LeaseGate.Lease lease,int[] channels){
        Profile p=profile;return p!=null&&!p.closed&&p.lease==lease&&gate.input(lease,clock.getAsLong(),channels);
    }
    public void pause(LeaseGate.Lease lease){gate.pauseStream(lease,clock.getAsLong());}
    public static byte[] frame(long device,long token,int sequence,int[] channels){
        return frame(device,token,sequence,channels,false);
    }
    public static byte[] frame(long device,long token,int sequence,int[] channels,boolean simulation){
        if(channels.length!=10)throw new IllegalArgumentException("A complete RC frame is required.");
        ByteBuffer b=ByteBuffer.allocate(FRAME_BYTES).order(ByteOrder.LITTLE_ENDIAN);
        b.putInt(0x3143525a).put((byte)(simulation?2:1)).put((byte)(simulation?2:1)).putShort((short)0).putLong(device).putLong(token).putInt(sequence);
        for(int value:channels){if(value<1000||value>2000)throw new IllegalArgumentException("Invalid RC value.");b.putShort((short)value);}return b.array();
    }
    public void tick(){
        Profile p=profile;if(p==null)return;long now=clock.getAsLong();int[] channels=gate.input(p.lease,now);if(channels==null)return;
        synchronized(p){
            if(p.closed||!gate.isCurrent(p.lease))return;
            try{
                int sequence=++p.sequence;p.sentAt[sequence&63]=now;
                byte[] bytes=frame(p.device,p.token,sequence,channels,p.simulation);p.socket.send(new DatagramPacket(bytes,bytes.length));p.framesSent++;
                for(int i=0;i<8;i++){
                    byte[] ack=new byte[ACK_BYTES+1];DatagramPacket packet=new DatagramPacket(ack,ack.length);
                    try{p.socket.receive(packet);}catch(SocketTimeoutException timeout){break;}
                    p.ackRejected++;if(packet.getLength()!=ACK_BYTES)continue;
                    ByteBuffer b=ByteBuffer.wrap(ack).order(ByteOrder.LITTLE_ENDIAN);
                    if(b.getInt()!=0x3141525a||b.get()!=(p.simulation?2:1)||b.get()!=0)continue;int flags=b.get()&255;if(b.get()!=0||(flags&~7)!=0||((flags&4)!=0)!=p.simulation||p.simulation&&(flags&1)!=0)continue;
                    if(b.getLong()!=p.device||b.getLong()!=p.token)continue;int acknowledged=b.getInt();
                    if(acknowledged-p.sequence>0||p.ackSeen&&acknowledged-p.lastAck<=0||p.sequence-acknowledged>=64)continue;
                    long age=clock.getAsLong()-p.sentAt[acknowledged&63];if(age<0||age>250)continue;
                    p.lastAck=acknowledged;p.ackSeen=true;p.acksReceived++;p.ackRejected--;gate.udpAck(p.lease,clock.getAsLong(),(flags&1)!=0,(flags&2)!=0);
                }
            }catch(Exception ignored){p.sendErrors++;/* Next tick retries; watchdog bounds loss. */}
        }
    }
    private java.util.Map<String,Object> profileDiagnostics(Profile p){java.util.Map<String,Object> out=new java.util.LinkedHashMap<>();out.put("protocol",p.simulation?"ZRC2":"ZRC1");out.put("framesSent",p.framesSent);out.put("acksReceived",p.acksReceived);out.put("ackRejected",p.ackRejected);out.put("sendErrors",p.sendErrors);out.put("validatedControllerAck",p.ackSeen);return out;}
    public java.util.Map<String,Object> diagnostics(){Profile p=profile;java.util.Map<String,Object> out=new java.util.LinkedHashMap<>(gate.diagnostics(clock.getAsLong()));if(p!=null){synchronized(p){out.putAll(profileDiagnostics(p));}}else{out.put("protocol","HTTP");out.put("previousUdp",new java.util.LinkedHashMap<>(archived));}return out;}
    public synchronized void stop(LeaseGate.Lease lease){Profile p=profile;if(p!=null&&p.lease==lease){profile=null;close(p,true);}}
    private void close(Profile p,boolean sendSafe){
        synchronized(p){
            if(p.closed)return;archived=profileDiagnostics(p);p.closed=true;
            if(sendSafe){try{String[] values=p.lease.safeChannels().split(",");int[] c=new int[10];for(int i=0;i<10;i++)c[i]=Integer.parseInt(values[i]);
                for(int i=0;i<3;i++){byte[] safe=frame(p.device,p.token,++p.sequence,c,p.simulation);p.socket.send(new DatagramPacket(safe,safe.length));}
            }catch(Exception ignored){}}
            p.socket.close();
        }
    }
}
