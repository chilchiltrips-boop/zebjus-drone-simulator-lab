package in.zebjus.aerion;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

/** Executes the production grant policy behind the browser's simulated radio. */
public final class NativeGateHarness {
    public static void main(String[] args)throws Exception{
        LeaseGate gate=new LeaseGate();gate.resume();Object wifi=new Object();Map<String,LeaseGate.Grant> pending=new HashMap<>();
        BufferedReader input=new BufferedReader(new InputStreamReader(System.in));String line;
        while((line=input.readLine())!=null){String[] f=line.split("\t",-1);long now=System.nanoTime()/1000000L;
            try{
                switch(f[1]){
                    case "begin":pending.put(f[2],gate.beginGrant(f[3],f[4],f[5],wifi));break;
                    case "accept":if(!gate.accept(pending.remove(f[2]),now,1000))throw new IllegalStateException("Grant cancelled");break;
                    case "authorize":gate.authorize(f[3],f[4],f[5]);break;
                    case "rc":{LeaseGate.Lease lease=gate.authorize(f[3],f[4],f[5]);int[] channels=LocalPolicy.channels(LocalPolicy.form("type=rc_frame&channels="+f[6]));gate.rcAck(lease,now,channels);break;}
                    case "ping":gate.ack(gate.authorize(f[3],f[4],f[5]),now);break;
                    case "pause":gate.pauseStream(gate.authorize(f[3],f[4],f[5]),now);break;
                    case "release":gate.release(f[3],f[4],f[5]);break;
                    default:throw new IllegalArgumentException("Unknown gate operation");
                }
                System.out.println(f[0]+"\tOK");
            }catch(Exception error){System.out.println(f[0]+"\t"+error.getMessage());}
        }
    }
}
