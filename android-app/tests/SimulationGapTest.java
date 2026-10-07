package in.zebjus.aerion;
public final class SimulationGapTest {
 private static void check(boolean ok,String message){if(!ok)throw new AssertionError(message);}
 public static void main(String[] args){
  LeaseGate gate=new LeaseGate();gate.resume();Object wifi=new Object();String base="http://192.168.1.3",id="ZFC-001122334455",client="MOBILE-gap-test";
  LeaseGate.Grant g=gate.beginGrant(base,id,client,wifi);check(gate.accept(g,1000,1000,true),"verified simulation grant");LeaseGate.Lease lease=gate.authorize(base,id,client);
  int[] armed={1800,1200,1700,1600,2000,1500,1000,1000,1500,1000};gate.input(lease,1000,armed);gate.udpAck(lease,1000,false,true);
  for(long t=1020;t<=8000;t+=20){gate.input(lease,t,armed);check(gate.watchdog(t)==null,"temporary ACK gap retains same lease");int[] offered=gate.input(lease,t);check(offered!=null,"publisher keeps running");if(t>1300)check(offered[2]==1000&&offered[4]==1000&&offered[0]==1500,"gap only emits neutral virtual input");}
  gate.udpAck(lease,8000,false,true);check(gate.input(lease,8000)[4]==1000,"ACK recovery alone cannot restore virtual ARM");gate.input(lease,8000,new int[]{1500,1500,1000,1500,1000,1000,1000,1000,1500,1000});check(gate.isCurrent(lease),"same lease resumes on authentic ACK");check(gate.watchdog(8000)==null,"recovery survives");gate.fence(false);check(!gate.isCurrent(lease),"STOP fences retained session");
  LeaseGate.Grant real=gate.beginGrant(base,id,client,wifi);check(gate.accept(real,9000,1000,false),"real grant");LeaseGate.Lease flight=gate.authorize(base,id,client);gate.ack(flight,9000,1000);check(gate.watchdog(9901)==flight,"real ACK expiry unchanged");
  System.out.println("PASS: seven-second ACK gap retains same simulation lease, emits neutral, resumes; STOP and real-flight expiry remain enforced");
 }
}
