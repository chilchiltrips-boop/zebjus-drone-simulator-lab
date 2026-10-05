package in.zebjus.aerion;

/** Native safety boundary, independent of WebView timers and JavaScript replies. */
public final class LeaseGate {
    public static final long ACK_TIMEOUT_MS = 300;
    public static final long MAX_ACK_TIMEOUT_MS = 900;
    public static final long INPUT_TIMEOUT_MS = 300;
    public static final class Lease {
        public final String origin, deviceId, clientId;
        public final Object network;
        private final long generation;
        private long ack;
        private final long ackTimeout;
        private long inputAt;
        private int[] input;
        private volatile boolean controllerAck, controllerArmed, controllerReady;
        private volatile int mode=1000;
        private boolean streaming=false;
        private volatile boolean hasRc=false;
        public boolean hasRc(){return hasRc;}
        Lease(String origin, String id, String client, Object network, long now, long timeout, long generation) {
            this.origin=origin; deviceId=id; clientId=client; this.network=network; ack=now; ackTimeout=timeout;this.generation=generation;
        }
        public boolean matches(String base, String id, String client) {
            return origin.equals(base) && deviceId.equals(id) && clientId.equals(client);
        }
        public String safeChannels() { return "1500,1500,1000,1500,1000,"+mode+",1000,1000,1500,1000"; }
        public boolean hasControllerAck(){return controllerAck;}
        public boolean controllerArmed(){return controllerArmed;}
        public boolean controllerReady(){return controllerReady;}
    }
    public static final class Grant {
        final long generation;
        public final String origin, deviceId, clientId;
        public final Object network;
        Grant(long generation, String base, String id, String client, Object network) {
            this.generation=generation; origin=base; deviceId=id; clientId=client; this.network=network;
        }
    }
    private long generation;
    private boolean foreground;
    private Lease current;
    private Grant pending;

    public synchronized void resume() { foreground=true; }
    public synchronized boolean isForeground() { return foreground; }
    public synchronized boolean isPending(Grant grant) { return foreground && pending==grant && grant.generation==generation; }
    public synchronized Grant beginGrant(String base, String id, String client, Object network) {
        if (!foreground || network==null) throw new IllegalStateException("Open the app and join the kit Wi-Fi.");
        if (pending!=null) throw new IllegalStateException("Release the previous control session first.");
        if(current!=null){
            // A destination change invalidates the controller's UDP token.
            // Renew only this paused reservation; never replace a live stream.
            if(!current.matches(base,id,client)||current.network!=network||current.streaming||current.input!=null)throw new IllegalStateException("Stop the current transmitter before renewing control.");
            generation++;current=null;
        }
        pending=new Grant(generation,base,id,client,network); return pending;
    }
    public synchronized boolean accept(Grant grant, long now) {
        return accept(grant,now,0);
    }
    public synchronized boolean accept(Grant grant, long now, long controllerTimeout) {
        if (pending!=grant || !foreground || grant.generation!=generation || current!=null) return false;
        long timeout=controllerTimeout>0 ? Math.max(200,Math.min(MAX_ACK_TIMEOUT_MS,controllerTimeout-100)) : ACK_TIMEOUT_MS;
        pending=null; current=new Lease(grant.origin,grant.deviceId,grant.clientId,grant.network,now,timeout,grant.generation); return true;
    }
    public synchronized Lease cancel(Grant grant) {
        if(pending==grant)pending=null;
        return current!=null&&current.generation==grant.generation&&current.matches(grant.origin,grant.deviceId,grant.clientId)&&current.network==grant.network ? fence(false) : null;
    }
    public synchronized Lease authorize(String base, String id, String client) {
        if (!foreground || current==null || !current.matches(base,id,client)) throw new IllegalStateException("Take control again before sending commands.");
        return current;
    }
    public synchronized boolean isCurrent(Lease lease) { return foreground && current==lease; }
    // Configuration pings must never disguise a stalled RC stream.
    public synchronized void ack(Lease lease, long now) { if (current==lease && foreground && !lease.streaming) current.ack=now; }
    public synchronized void ack(Lease lease, long now, int mode) { if (current==lease && foreground) { current.ack=now; lease.mode=mode; lease.streaming=true; } }
    public synchronized void rcAck(Lease lease,long now,int[] channels) { if(current==lease && foreground){lease.ack=now;lease.hasRc=true;lease.mode=channels[5];lease.streaming=!LocalPolicy.safe(channels);} }
    public synchronized boolean input(Lease lease,long now,int[] channels) {
        if(!isCurrent(lease))return false;
        // A settings reservation may have been idle for seconds. Start one
        // bounded ACK window when its transmitter is explicitly enabled.
        if(!lease.streaming){lease.ack=now;lease.controllerAck=false;}
        lease.input=channels.clone();lease.inputAt=now;lease.hasRc=true;lease.mode=channels[5];lease.streaming=true;return true;
    }
    public synchronized int[] input(Lease lease,long now) {
        return isCurrent(lease)&&lease.input!=null&&now-lease.inputAt<=INPUT_TIMEOUT_MS ? lease.input.clone() : null;
    }
    public synchronized void udpAck(Lease lease,long now,boolean armed,boolean ready) {
        if(isCurrent(lease)){lease.ack=now;lease.controllerAck=true;lease.controllerArmed=armed;lease.controllerReady=ready;}
    }
    public synchronized long ackAge(Lease lease,long now){return Math.max(0,now-lease.ack);}
    public synchronized void pauseStream(Lease lease,long now) {
        if(isCurrent(lease)){lease.input=null;lease.inputAt=0;lease.streaming=false;lease.ack=now;}
    }
    public synchronized Lease release(String base, String id, String client) {
        if(current!=null&&current.matches(base,id,client)){Lease old=current;current=null;return old;}return null;
    }
    public synchronized Lease fence(boolean pause) {
        generation++; pending=null; if (pause) foreground=false;
        Lease old=current; current=null; return old;
    }
    public synchronized Lease watchdog(long now) {
        return current!=null && (current.input!=null&&now-current.inputAt>INPUT_TIMEOUT_MS || now-current.ack>(current.streaming?current.ackTimeout:5000)) ? fence(false) : null;
    }
}
