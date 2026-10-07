// Execute the real controller training command and lease policy on a host clock.
#include <cassert>
#include <cstdint>
#include <string>
#include <map>
#include <iostream>
#include <algorithm>
#include "../FlightCore_Firmware/FlightSetupPolicy.h"
class String:public std::string{public:using std::string::string;String(const std::string&s):std::string(s){}String(uint32_t n):std::string(std::to_string(n)){}bool startsWith(const char*s)const{return rfind(s,0)==0;}bool equalsIgnoreCase(const String&s)const{String a=*this,b=s;std::transform(a.begin(),a.end(),a.begin(),::tolower);std::transform(b.begin(),b.end(),b.begin(),::tolower);return a==b;}};
String deviceId="ZFC-001122334455",controlOwner="PHONE-CLIENT",controlRole="MOBILE";
uint32_t clockMs=10,controlExpiresAt=5010,trainingExpires=0,trainingRunId=0,webRcLastMs=0,restartAt=0;uint32_t millis(){return clockMs;}
bool trainingActive=false,trainingAppOwned=false,setupAfterNeutral=false,armLowSeen=true,armed=false,fcSetupActive=false,configurationBusy=false,firmwareUploadActive=false;uint8_t trainingTarget=0,trainingInput=1;bool FLIGHT_CONTROL_ENABLED=true;const int BENCH_NONE=0;int benchMode=0,code=0,udpInvalidations=0,physicalPulse=1000;String reply;
struct{std::map<std::string,String>fields;String arg(const char*n){return fields[n];}}server;
void invalidateRcUdp(){udpInvalidations++;}void resetArmGesture(){}void benchStop(){benchMode=0;}void disarmFlight(const char*){armed=false;physicalPulse=1000;}void sendJson(int c,const String&s){code=c;reply=s;}void sendMessage(int c,const char*s){code=c;reply=s;}bool requireControl(){if(server.arg("clientId")==controlOwner&&FlightSetupPolicy::live(millis(),controlExpiresAt))return true;sendMessage(423,"No grant");return false;}
bool setupTokenValid(const String&t){return t.length()>=8&&t.length()<=96;}
bool setupMode=false,trainingFcPid=false;void resetVirtualTraining(){}
uint32_t trainingWebAppId=123456;bool canBindTrainingWebApp(const String& id){return id=="123456";}bool bindTrainingWebApp(const String& id){trainingWebAppId=123456;return canBindTrainingWebApp(id);}bool trainingWebAppLive(){return true;}void clearTrainingWebApp(){trainingWebAppId=0;}
#include "../FlightCore_Firmware/FlightTraining.h"
void command(const char*type,const char*token="TRAIN-SESSION-0001",const char*target="FLIGHT",const char*owner="PHONE-CLIENT",const char*confirm="PROPS_REMOVED",const char*id="ZFC-001122334455"){server.fields={{"webAppId","123456"},{"session",token},{"target",target},{"clientId",owner},{"source","APP"},{"confirm",confirm},{"expectedDeviceId",id}};code=0;assert(trainingCommand(type));}
int main(){
 command("training_select","TRAIN-NO-PROPS","FLIGHT","PHONE-CLIENT","");assert(code==200&&trainingActive&&physicalPulse==1000);command("training_end","TRAIN-NO-PROPS");command("training_select","TRAIN-WRONG-SESSION","FLIGHT","PHONE-CLIENT","","WRONG-KIT");assert(code==409&&!trainingActive);
 controlRole="WEB";command("training_select");assert(code==403&&!trainingActive);controlRole="MOBILE";armed=true;command("training_select");assert(code==423&&!trainingActive);armed=false;
 command("training_select","TRAIN-SESSION-INITIAL");assert(code==200&&trainingActive&&trainingTarget==2&&trainingAppOwned&&physicalPulse==1000&&setupAfterNeutral);uint32_t run=trainingRunId;assert(reply.find("TRAIN-SESSION")==std::string::npos&&reply.find("PHONE-CLIENT")==std::string::npos);command("training_ping","TRAIN-SESSION-INITIAL","FLIGHT","LAPTOP");assert(code==409&&trainingRunId==run);command("training_end","TRAIN-OTHER-SESSION","FLIGHT","LAPTOP");assert(trainingActive&&trainingRunId==run);
 command("training_select","TRAIN-SESSION-0002","TRIPOD");assert(code==200&&trainingActive&&trainingTarget==1&&trainingRunId>run);run=trainingRunId;command("training_end");assert(trainingActive&&trainingRunId==run);command("training_ping");assert(code==409);command("training_ping","TRAIN-SESSION-0002");assert(code==200);
 command("training_select","TRAIN-SESSION-0003","REAL","PHONE-CLIENT","");assert(code==200&&!trainingActive&&trainingTarget==0&&!armed&&!armLowSeen&&setupAfterNeutral&&webRcLastMs==0);command("training_select","TRAIN-SESSION-0002");assert(code==409&&!trainingActive);
 // An expired cleanup nonce cannot stop or invalidate a fresh real-flight grant.
 run=trainingRunId;int grants=udpInvalidations;armed=true;physicalPulse=1300;command("training_end","TRAIN-SESSION-0002");assert(armed&&physicalPulse==1300&&trainingRunId==run&&udpInvalidations==grants);armed=false;physicalPulse=1000;
 command("training_end","TRAIN-DELAYED-SESSION");command("training_select","TRAIN-DELAYED-SESSION");assert(code==409&&!trainingActive);
 command("training_select","TRAIN-SESSION-0004");controlOwner="OTHER-PHONE";serviceTraining();assert(!trainingActive&&trainingTarget==0&&physicalPulse==1000);controlOwner="PHONE-CLIENT";command("training_select","TRAIN-SESSION-0005");clockMs=trainingExpires;serviceTraining();assert(!trainingActive&&physicalPulse==1000);controlExpiresAt=clockMs+5000;
 // Desktop legacy training lease survives the phone's RC grant and remains private.
 controlOwner="LAPTOP";controlRole="WEB";command("training_begin","TRAIN-WEB-SESSION","FLIGHT","LAPTOP");assert(code==200&&trainingActive&&!trainingAppOwned);controlOwner="PHONE-CLIENT";controlRole="MOBILE";serviceTraining();assert(trainingActive);command("training_select","TRAIN-SESSION-0006","TRIPOD");assert(code==200&&trainingActive&&trainingAppOwned&&trainingTarget==1);command("training_end","TRAIN-WEB-SESSION","FLIGHT","LAPTOP");assert(trainingActive);controlExpiresAt=clockMs;serviceTraining();assert(!trainingActive&&physicalPulse==1000);assert(udpInvalidations>4);
 FLIGHT_CONTROL_ENABLED=false;controlOwner="PHONE-CLIENT";controlRole="MOBILE";controlExpiresAt=clockMs+5000;command("training_select","TRAIN-A1-NO-IMU","FLIGHT","PHONE-CLIENT","");assert(code==200&&trainingActive&&physicalPulse==1000);clockMs=trainingExpires;serviceTraining();assert(!trainingActive&&physicalPulse==1000);
 std::cout<<"PASS: real training commands; exact identity, no-props A1/A2 simulator inhibition/MOBILE grant, exclusive targets, public metadata/private nonce, old/late cancellation, safe Real transition, lease/owner loss and desktop-to-app takeover\n";
}
