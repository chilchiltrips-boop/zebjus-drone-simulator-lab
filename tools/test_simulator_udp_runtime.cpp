// Execute the production firmware UDP task against a deterministic radio.
#include <cassert>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <deque>
#include <iostream>
#include <string>
#include <vector>
#include "../FlightCore_Firmware/RcUdpProtocol.h"
class String:public std::string{public:using std::string::string;String(const std::string&s):std::string(s){}String(int n):std::string(std::to_string(n)){};};
struct WiFiUDP{
 std::deque<std::vector<uint8_t>> input;std::vector<std::vector<uint8_t>> replies;
 int parsePacket(){return input.empty()?0:input.front().size();}
 int read(uint8_t*out,size_t n){auto packet=input.front();input.pop_front();size_t count=std::min(n,packet.size());std::memcpy(out,packet.data(),count);return count;}
 int remoteIP(){return 1;}int remotePort(){return 1234;}void beginPacket(int,int){}void write(const uint8_t*p,size_t n){replies.emplace_back(p,p+n);}void endPacket(){}bool begin(int){return true;}void stop(){}
};
using TaskHandle_t=void*;int stateMux=0;void portENTER_CRITICAL(int*){}void portEXIT_CRITICAL(int*){}
uint32_t clockMs=100,controlExpiresAt=1000,trainingExpires=0,webRcLastMs=0,webRcFrames=0;
uint32_t millis(){return clockMs;}constexpr uint32_t LOCK_TIMEOUT_MS=15000;
bool FLIGHT_CONTROL_ENABLED=false,ALLOW_WEB_RC=true,trainingActive=true,trainingAppOwned=true,fcSetupActive=false,configurationBusy=false,firmwareUploadActive=false,armed=false,flightReady=false;
int trainingInput=1,benchMode=0;constexpr int BENCH_NONE=0;uint16_t webRcCh[10]={};
struct{uint64_t getEfuseMac(){return 0x001122334455ULL;}}ESP;
constexpr int pdPASS=1;int xTaskCreate(void(*)(void*),const char*,int,void*,int,void**){return pdPASS;}int pdMS_TO_TICKS(int ms){return ms;}
struct IterationDone{};void vTaskDelay(int){throw IterationDone{};}
// Crypto is covered by cross-language tests; this boundary double isolates task policy.
bool secureRcOpen(const uint8_t* packet,size_t n,uint8_t plain[48],uint64_t& sid){if(n!=88||memcmp(packet,"ZSC3",4)||packet[87]!=0xaa)return false;memcpy(plain,packet+24,48);sid=42;return true;}
bool secureRcAck(uint64_t,const uint8_t plain[28],uint8_t out[68]){memset(out,0,68);memcpy(out,"ZSC3",4);memcpy(out+24,plain,28);return true;}
#include "../FlightCore_Firmware/FlightRcTransport.h"
void send(bool simulation,uint64_t token,uint32_t sequence,uint64_t device=0x001122334455ULL){
 uint8_t bytes[48]={};RcUdpProtocol::put(bytes,0x3143525a,4);bytes[4]=bytes[5]=simulation?2:1;RcUdpProtocol::put(bytes+8,device,8);RcUdpProtocol::put(bytes+16,token,8);RcUdpProtocol::put(bytes+24,sequence,4);
 uint16_t channels[10]={1800,1200,1700,1600,2000,1000,1000,1000,1500,1000};for(int i=0;i<10;i++)RcUdpProtocol::put(bytes+28+2*i,channels[i],2);
 uint8_t packet[88]={};memcpy(packet,"ZSC3",4);memcpy(packet+24,bytes,48);packet[87]=0xaa;rcUdp.input.emplace_back(packet,packet+88);try{rcUdpTask(nullptr);}catch(IterationDone&){}
}
void rejected(bool simulation=true,uint64_t token=123,uint32_t sequence=2,uint64_t device=0x001122334455ULL){auto frames=webRcFrames;auto replies=rcUdp.replies.size();send(simulation,token,sequence,device);assert(webRcFrames==frames&&rcUdp.replies.size()==replies);}
int main(){
 rcUdpToken=123;rcUdpSimulation=true;rcUdp.input.emplace_back(48,0);try{rcUdpTask(nullptr);}catch(IterationDone&){}assert(webRcFrames==0&&rcUdp.replies.empty());send(true,123,1);
 assert(webRcFrames==1&&webRcCh[0]==1800&&webRcCh[1]==1200&&webRcCh[2]==1700&&webRcCh[4]==2000&&!armed);
 assert(webRcLastMs==clockMs&&controlExpiresAt==clockMs+15000&&trainingExpires==clockMs+10000);
 assert(rcUdp.replies.back()[28]==2&&rcUdp.replies.back()[30]==6); // virtual ARM is distinct from physical ARM
 rejected(false);rejected(true,124);rejected(true,123,1);rejected(true,123,2,0x11);
 trainingInput=2;rejected();trainingInput=1;trainingAppOwned=false;rejected();trainingAppOwned=true;
 for(bool* flag:{&fcSetupActive,&configurationBusy,&firmwareUploadActive}){*flag=true;rejected();*flag=false;}
 benchMode=1;rejected();benchMode=0;clockMs=controlExpiresAt;rejected();clockMs=200;
 trainingActive=false;rejected(); // expired inhibition cannot turn a simulation packet into real flight
 invalidateRcUdp();assert(rcUdpToken==0&&!rcUdpSimulation&&!rcUdpSequenceSeen);rejected();
 FLIGHT_CONTROL_ENABLED=true;controlExpiresAt=1000;rcUdpToken=456;
 rejected(true,456);send(false,456,2);assert(webRcFrames==2&&rcUdp.replies.back()[28]==1&&rcUdp.replies.back()[30]==0);
 trainingActive=true;rejected(false,456,3); // no real packet while simulation blocks outputs
 std::cout<<"PASS: production ZRC2 firmware task, live roll/pitch/throttle/virtual ARM, 50 Hz lease renewal, physical disarm ACK, wrong token/device/replay/kind rejection, training expiry/Real transition, setup/bench/config/upload inhibition\n";
}
