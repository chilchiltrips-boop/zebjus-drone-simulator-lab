"""Execute the production HTTP RC handler for A1/A2 simulation and late frames."""
from pathlib import Path
import subprocess, tempfile

root = Path(__file__).resolve().parents[1]
source = (root/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
start = source.index('if(type=="rc_frame"){')
brace = source.index('{', start)
depth, end = 1, brace+1
while depth:
    depth += int(source[end]=='{')-int(source[end]=='}')
    end += 1
handler = source[brace+1:end-1]
prefix = r'''
#include <cassert>
#include <cstdint>
#include <string>
#include <map>
#include <sstream>
#include <iostream>
class String:public std::string{public:using std::string::string;String(const std::string&s):std::string(s){}String(uint32_t n):std::string(std::to_string(n)){};};
struct{std::map<std::string,String>fields;String arg(const char*n){return fields[n];}bool hasArg(const char*n){return fields.count(n);}}server;
bool ALLOW_WEB_RC=true,FLIGHT_CONTROL_ENABLED=false,trainingActive=false,trainingAppOwned=true,fcSetupActive=false,armed=false,flightReady=false;
int benchMode=0;const int BENCH_NONE=0;int stateMux=0;void portENTER_CRITICAL(int*){}void portEXIT_CRITICAL(int*){}
uint8_t trainingInput=1;uint32_t trainingRunId=42,trainingExpires=0,clockMs=100,webRcLastMs=0,webRcFrames=0;uint32_t millis(){return clockMs;}
uint16_t webRcCh[10]={};uint64_t rcUdpToken=0;bool rcUdpSequenceSeen=false;
String deviceId="ZFC-001122334455",lastDisarmReason="Training";int code=0;String reply;
void sendJson(int c,const String&s){code=c;reply=s;}void sendMessage(int c,const char*s){code=c;reply=s;}
String jsonEscape(const String&s){return s;}enum RcSourceKind{RC_NONE,RC_WEB_AP};RcSourceKind chooseRcSource(){return RC_WEB_AP;}const char* rcSourceName(RcSourceKind){return "WEB_AP";}
int parseRcCsv(const String&s,uint16_t out[10]){std::stringstream in(s);std::string v;int n=0;while(std::getline(in,v,',')&&n<10)out[n++]=std::stoi(v);return n;}
'''
checks = r'''
void frame(const char*run="42"){server.fields={{"channels","1600,1400,1700,1550,2000,1000,1000,1000,1500,1000"}};if(run)server.fields["simulationRunId"]=run;code=0;commandRc();}
int main(){
 frame();assert(code==409&&webRcFrames==0);frame(nullptr);assert(code==403&&webRcFrames==0); // bridge cannot control real outputs
 trainingActive=true;frame();assert(code==200&&webRcFrames==1&&webRcCh[2]==1700&&webRcCh[4]==2000&&!armed&&!flightReady&&trainingExpires==clockMs+5000);
 assert(reply.find("\"armed\":false")!=std::string::npos&&reply.find("\"virtualArmed\":true")!=std::string::npos&&reply.find("\"outputsBlocked\":true")!=std::string::npos);
 auto frames=webRcFrames;frame("41");assert(code==409&&webRcFrames==frames);trainingRunId++;frame();assert(code==409&&webRcFrames==frames); // late input cannot cross destinations
 trainingActive=false;FLIGHT_CONTROL_ENABLED=true;frame("43");assert(code==409&&webRcFrames==frames); // old simulator ARM cannot arm real flight
 trainingActive=true;frame("43");assert(code==200);rcUdpToken=123;frame("43");assert(code==423); // cannot mix acknowledged HTTP with an active UDP grant
 server.fields={{"channels","1500,1500,1000,1500,1000,1000,1000,1000,1500,1000"},{"simulationRunId","43"}};commandRc();assert(code==200&&rcUdpToken==0&&webRcCh[4]==1000&&!armed);
 fcSetupActive=true;frame("43");assert(code==423);fcSetupActive=false;benchMode=1;frame("43");assert(code==423);
 std::cout<<"PASS: production A1/A2 simulator HTTP RC, real/virtual ARM distinction, ACK metadata, RC lease renewal, old-run rejection, UDP exclusion and bench/setup inhibition\n";
}
'''
with tempfile.TemporaryDirectory() as directory:
    path = Path(directory)
    (path/'rc.cpp').write_text(prefix+'void commandRc(){'+handler+'}\n'+checks)
    subprocess.run(['g++','-std=c++17',str(path/'rc.cpp'),'-o',str(path/'rc')],check=True)
    subprocess.run([str(path/'rc')],check=True)
