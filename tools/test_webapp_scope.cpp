// Execute production ID registration, secure-session binding and training handlers.
#include <cassert>
#include <cstdint>
#include <map>
#include <string>
#include <algorithm>
#include <iostream>
#include "../FlightCore_Firmware/WebAppScope.h"
#include "../FlightCore_Firmware/FlightSetupPolicy.h"
#include "../FlightCore_Firmware/RcPriority.h"
class String:public std::string{public:using std::string::string;String(const std::string&s):std::string(s){}String(uint32_t n):std::string(std::to_string(n)){}bool startsWith(const char*s)const{return rfind(s,0)==0;}bool equalsIgnoreCase(const String&s)const{String a=*this,b=s;std::transform(a.begin(),a.end(),a.begin(),::tolower);std::transform(b.begin(),b.end(),b.begin(),::tolower);return a==b;}};
uint32_t now=100;uint32_t millis(){return now;}
struct Session{uint64_t id=0;String role;uint32_t expires=0;String client;uint32_t lastActivity=0;}sessions[6],*secureCurrent=nullptr;
Session* secureFind(uint64_t id){for(auto& s:sessions)if(s.id==id&&(int32_t)(s.expires-now)>0)return &s;return nullptr;}
using SecureSession=Session;
int secureMutex=0,stateMux=0;const int portMAX_DELAY=0;
void xSemaphoreTake(int,int){}void xSemaphoreGive(int){}void portENTER_CRITICAL(int*){}void portEXIT_CRITICAL(int*){}
WebAppScope::Registry webAppRegistry;
String deviceId="ZFC-001122334455",controlOwner="PHONE-ONE",controlRole="MOBILE";
uint32_t trainingWebAppId=0,trainingObserverAt=0;uint64_t trainingWebSession=0;
bool setupMode=false,trainingActive=false,trainingAppOwned=false,trainingFcPid=false;
uint32_t trainingExpires=0,controlExpiresAt=50000,trainingRunId=0,webRcLastMs=0,restartAt=0;
bool armed=false,fcSetupActive=false,configurationBusy=false,firmwareUploadActive=false,setupAfterNeutral=false,armLowSeen=true,FLIGHT_CONTROL_ENABLED=true;
const int BENCH_NONE=0;int benchMode=0,code=0,invalidations=0;uint8_t trainingInput=1,trainingTarget=0;String reply;
struct{std::map<std::string,String> fields;String arg(const char*k){return fields[k];}}server;
void sendJson(int c,const String&s){code=c;reply=s;}void sendMessage(int c,const char*s){code=c;reply=s;}
void resetVirtualTraining(){}void invalidateRcUdp(){invalidations++;}void resetArmGesture(){}void benchStop(){}void disarmFlight(const char*){armed=false;}
bool setupTokenValid(const String&s){return s.length()>=8&&s.length()<=96;}
bool requireControl(){if(server.arg("clientId")==controlOwner)return true;sendMessage(423,"Not owner");return false;}
#include "../FlightCore_Firmware/FlightWebApp.h"
#include "../FlightCore_Firmware/FlightTraining.h"
void reg(int i,const char* id){secureCurrent=&sessions[i];server.fields={{"webAppId",id}};webAppRegister(false);}
void select(const char* id,const char* token,const char* target="FLIGHT",const char* client="PHONE-ONE"){
 server.fields={{"webAppId",id},{"session",token},{"clientId",client},{"expectedDeviceId",deviceId},{"target",target},{"source","APP"}};trainingCommand("training_select");
}
int main(){
 sessions[0]={11,"WEB",50000};sessions[1]={12,"WEB",50000};sessions[2]={13,"COMPANION",50000};sessions[3]={14,"MOBILE",50000};
 reg(0,"123456");assert(code==200);reg(1,"123456");assert(code==200&&webAppRegistry.find(12,now)->id==123457);reg(2,"999999");assert(code==200);
 reg(3,"123455");assert(code==403);reg(0,"12345");assert(code==409);reg(0,"000000");assert(code==409);setupMode=true;reg(0,"123456");assert(code==403&&!secureMonitorAllowed(11));setupMode=false;
 select("123456","TRAIN-SESSION-ONE");assert(code==200&&trainingActive&&trainingWebSession==11&&trainingWebAppId==123456&&!armed);
 assert(secureMonitorAllowed(11)&&!secureMonitorAllowed(12)&&!secureMonitorAllowed(13)&&!secureMonitorAllowed(14));secureCurrent=&sessions[0];assert(scopedTrainingBrowser());secureCurrent=&sessions[1];assert(!scopedTrainingBrowser());
 auto run=trainingRunId;select("888888","TRAIN-BAD-ID");assert(code==409&&trainingRunId==run&&trainingWebSession==11);
 select("123457","TRAIN-OTHER-PHONE","FLIGHT","PHONE-TWO");assert(code==423&&trainingWebSession==11&&trainingRunId==run);
 now+=1000;trainingExpires=now+10000;secureMonitorSeen(11);serviceTraining();assert(trainingActive&&trainingRunId==run); // gap retains same run
 select("123457","TRAIN-SESSION-TWO","TRIPOD");assert(code==200&&trainingWebSession==12&&trainingTarget==1&&trainingRunId>run&&!armed&&!armLowSeen);
 assert(!secureMonitorAllowed(11)&&secureMonitorAllowed(12));now+=1000;secureMonitorSeen(12);assert(trainingWebAppLive());
 secureCurrent=&sessions[1];webAppRegister(true);assert(trainingObserverAt==0);serviceTraining();assert(!trainingActive&&!trainingWebSession&&!armed);
 reg(1,"123457");select("123457","TRAIN-SESSION-THREE");assert(trainingActive);now+=10000;trainingExpires=now+10000;serviceTraining();assert(!trainingActive&&!armed); // observer vanished
 now=0xfffffff0;WebAppScope::Registry r;assert(r.add(99,999999,now)==999999);assert(r.add(100,999999,now)==100000);assert(r.find(99,now+9999));assert(!r.find(99,now+10000));assert(r.add(101,999999,now+10000)==999999);
 now=20000;sessions[0].lastActivity=0;sessions[0].client="BROWSER-CLOSED";assert(secureBrowserRetired(sessions[0]));sessions[0].lastActivity=now;assert(!secureBrowserRetired(sessions[0]));sessions[0].lastActivity=0;sessions[0].client=controlOwner;assert(!secureBrowserRetired(sessions[0]));assert(!secureBrowserRetired(sessions[3]));
 using namespace RcPriority;assert(choose(false,0,true,true)==PPM);assert(choose(false,1,true,true)==PPM);assert(choose(false,1,false,true)==NETWORK);assert(choose(false,2,false,true)==NONE);assert(choose(false,0,false,false)==NONE);assert(choose(true,1,true,true)==NETWORK);assert(choose(true,2,true,true)==PPM);
 std::cout<<"PASS: production authenticated WebApp register/collision/binding, two browsers/phones, AP denial, same-run gap, switch neutral, stale observer expiry, wraparound; fresh PPM first in physical flight\n";
}
