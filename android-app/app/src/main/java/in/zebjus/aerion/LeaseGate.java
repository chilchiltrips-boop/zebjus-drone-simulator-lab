package in.zebjus.aerion;

/** Native safety boundary, independent of WebView timers and JavaScript replies. */
public final class LeaseGate {
    public static final long ACK_TIMEOUT_MS = 300;
    public static final class Lease {
        public final String origin, deviceId, clientId;
        public final Object network;
        private long ack;
        private volatile int mode=1000;
        private boolean streaming=false;
        private volatile boolean hasRc=false;
        public boolean hasRc(){return hasRc;}
        Lease(String origin, String id, String client, Object network, long now) {
            this.origin=origin; deviceId=id; clientId=client; this.network=network; ack=now;
        }
        public boolean matches(String base, String id, String client) {
            return origin.equals(base) && deviceId.equals(id) && clientId.equals(client);
        }
        public String safeChannels() { return "1500,1500,1000,1500,1000,"+mode+",1000,1000,1500,1000"; }
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
        if (current!=null || pending!=null) throw new IllegalStateException("Release the previous control session first.");
        pending=new Grant(generation,base,id,client,network); return pending;
    }
    public synchronized boolean accept(Grant grant, long now) {
        if (pending!=grant || !foreground || grant.generation!=generation || current!=null) return false;
        pending=null; current=new Lease(grant.origin,grant.deviceId,grant.clientId,grant.network,now); return true;
    }
    public synchronized void cancel(Grant grant) { if (pending==grant) pending=null; }
    public synchronized Lease authorize(String base, String id, String client) {
        if (!foreground || current==null || !current.matches(base,id,client)) throw new IllegalStateException("Take control again before sending commands.");
        return current;
    }
    public synchronized boolean isCurrent(Lease lease) { return foreground && current==lease; }
    public synchronized void ack(Lease lease, long now) { if (current==lease && foreground) current.ack=now; }
    public synchronized void ack(Lease lease, long now, int mode) { if (current==lease && foreground) { current.ack=now; lease.mode=mode; lease.streaming=true; } }
    public synchronized void rcAck(Lease lease,long now,int[] channels) { if(current==lease && foreground){lease.ack=now;lease.hasRc=true;lease.mode=channels[5];lease.streaming=!LocalPolicy.safe(channels);} }
    public synchronized void release(String base, String id, String client) {
        if (current!=null && current.matches(base,id,client)) current=null;
    }
    public synchronized Lease fence(boolean pause) {
        generation++; pending=null; if (pause) foreground=false;
        Lease old=current; current=null; return old;
    }
    public synchronized Lease watchdog(long now) {
        return current!=null && now-current.ack>(current.streaming?ACK_TIMEOUT_MS:5000) ? fence(false) : null;
    }
}
