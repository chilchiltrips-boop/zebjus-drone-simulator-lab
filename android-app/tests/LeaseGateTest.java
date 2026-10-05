package in.zebjus.aerion;

import java.util.Map;

public final class LeaseGateTest {
    private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
    private static void refused(Runnable task){try{task.run();throw new AssertionError("Expected rejection");}catch(IllegalStateException expected){}}
    public static void main(String[] args)throws Exception{
        LeaseGate gate=new LeaseGate();Object wifi=new Object();String base="http://192.168.4.1",id="ZFC-001122334455";
        refused(()->gate.beginGrant(base,id,"FLY-oldsession",wifi));gate.resume();
        LeaseGate.Grant old=gate.beginGrant(base,id,"FLY-oldsession",wifi);check(gate.isPending(old),"pending grant");
        gate.fence(true);check(!gate.isPending(old),"pause must fence old grant");check(!gate.accept(old,1000),"late grant after pause must be rejected");
        gate.resume();LeaseGate.Grant current=gate.beginGrant(base,id,"FLY-newsession",wifi);check(!gate.accept(old,1001),"old response cannot overwrite pending grant");check(gate.accept(current,1000),"fresh grant");
        LeaseGate.Lease lease=gate.authorize(base,id,"FLY-newsession");refused(()->gate.authorize(base,id,"FLY-oldsession"));
        gate.release(base,id,"FLY-oldsession");check(gate.isCurrent(lease),"old cleanup cannot release new lease");
        gate.ack(lease,1000,1500);check(lease.safeChannels().equals("1500,1500,1000,1500,1000,1500,1000,1000,1500,1000"),"safe stop retains Rate mode");
        check(gate.watchdog(1300)==null,"inclusive ACK deadline");check(gate.watchdog(1301)==lease,"native timeout must revoke lease");
        refused(()->gate.authorize(base,id,"FLY-newsession"));gate.ack(lease,2000);check(!gate.isCurrent(lease),"stale ACK must not revive session");
        LeaseGate.Grant next=gate.beginGrant(base,id,"FLY-thirdsession",wifi);gate.cancel(next);check(!gate.accept(next,2200),"cancelled grant");
        LeaseGate.Grant lateCancel=gate.beginGrant(base,id,"FLY-cancelaccepted",wifi);check(gate.accept(lateCancel,2300,1000),"accepted grant before cancellation");LeaseGate.Lease cancelled=gate.authorize(base,id,"FLY-cancelaccepted");check(gate.cancel(lateCancel)==cancelled&&!gate.isCurrent(cancelled),"timeout cancellation must fence an already accepted grant");
        LeaseGate.Grant replacement=gate.beginGrant(base,id,"FLY-replacement",wifi);check(gate.accept(replacement,2400,1000),"replacement grant");LeaseGate.Lease replacementLease=gate.authorize(base,id,"FLY-replacement");check(gate.cancel(lateCancel)==null&&gate.isCurrent(replacementLease),"late cancellation cannot fence another client");gate.release(base,id,"FLY-replacement");
        LeaseGate.Grant reserved=gate.beginGrant(base,id,"FLY-reserved",wifi);check(gate.accept(reserved,3000),"configuration reservation");LeaseGate.Lease cfg=gate.authorize(base,id,"FLY-reserved");check(!cfg.hasRc(),"configuration reservation must not inject a safety RC frame");check(gate.watchdog(5000)==null,"configuration must outlive RC ACK interval");gate.ack(cfg,6000);check(gate.watchdog(11000)==null,"configuration heartbeat");check(gate.watchdog(11001)==cfg,"stale configuration reservation expires");
        LocalPolicy.api(base+"/api/wifi/saved","GET");LocalPolicy.api(base+"/api/setup/test","POST");check(LocalPolicy.readCommand(LocalPolicy.form("type=snapshot_get")),"read-only backup");check(LocalPolicy.configCommand(LocalPolicy.form("type=settings_restore")),"guarded restore");check(LocalPolicy.configCommand(LocalPolicy.form("type=rc_source_set")),"explicit runtime handover");check(LocalPolicy.configCommand(LocalPolicy.form("type=training_select")),"explicit app destination requires configuration grant");check(LocalPolicy.readCommand(LocalPolicy.form("type=training_status")),"public training status");check(LocalPolicy.readCommand(LocalPolicy.form("type=training_end")),"nonce-guarded training cleanup");check(!LocalPolicy.configCommand(LocalPolicy.form("type=gpio_write")),"unrelated native command rejected");
        for(String host:new String[]{"192.168.4.1","10.0.0.20","172.16.0.1","169.254.1.2","zebjus-drone-1.local","[fd00::1]"})check(LocalPolicy.localHost(host),host);
        for(String host:new String[]{"8.8.8.8","example.com","localhost","127.0.0.1","192.168.999.1","172.32.0.1","010.0.0.1"})check(!LocalPolicy.localHost(host),host);
        LocalPolicy.api(base+"/api/status?clientId=FLY-test","GET");
        for(String url:new String[]{"https://192.168.4.1/api/status","http://8.8.8.8/api/status","http://user@192.168.4.1/api/status","http://192.168.4.1/setup","http://192.168.4.1/api/command"}){
            try{LocalPolicy.api(url,"GET");throw new AssertionError(url);}catch(IllegalArgumentException expected){}
        }
        Map<String,String> form=LocalPolicy.form("clientId=FLY-sessionabc&expectedDeviceId="+id+"&type=rc_frame&channels=1500,1500,1000,1500,1000,1000,1000,1000,1500,1000");LocalPolicy.identity(form);check(LocalPolicy.safe(LocalPolicy.channels(form)),"captured safe frame");
        form.put("channels","1500,1500,1200,1500,2000,1000,1000,1000,1500,1000");check(!LocalPolicy.safe(LocalPolicy.channels(form)),"armed frame is not cleanup");
        LaunchPolicy.Target launch=LaunchPolicy.parse("aerion://connect?kitId=ZFC-001122aabbcc&kitIp=192.168.4.1");
        check(launch.deviceId.equals("ZFC-001122AABBCC") && launch.origin.equals(base),"valid kit handoff");
        check(LaunchPolicy.apSsid(launch.deviceId).equals("ZEBJUS-FC-001122AABBCC"),"exact SSID from kit identity");
        check(LaunchPolicy.apSsid("").isEmpty(),"first-pair Wi-Fi picker");
        for(String uri:new String[]{"aerion://connect?kitId=ZFC-001122334455&kitIp=8.8.8.8","aerion://connect?kitId=ZFC-001122334455&arm=1","aerion://connect?kitId=ZFC-001122334455&kitId=ZFC-FFEEDDCCBBAA","aerion://other?kitId=ZFC-001122334455","aerion://connect/control?kitId=ZFC-001122334455","https://192.168.4.1/"}){
            try{LaunchPolicy.parse(uri);throw new AssertionError(uri);}catch(IllegalArgumentException expected){}
        }
        System.out.println("PASS: native lifecycle, pending grants, stale replies, lease scope, ACK watchdog and local API policy");
    }
}
