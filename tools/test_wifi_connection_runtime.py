#!/usr/bin/env python3
"""Run actual STA retry, AP startup, scan and recovery code against a radio double."""
from pathlib import Path
import re, subprocess, tempfile
root=Path(__file__).resolve().parents[1]
source=(root/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
def function(name):
    start=re.search(r'^(?:void|bool|int) '+name+r'\([^;\n]*\)\s*\{',source,re.M).start()
    end=source.index('{',start)+1;depth=1
    while depth:
        depth+=(source[end]=='{')-(source[end]=='}');end+=1
    return source[start:end]
prefix=r'''
#include <string>
#include <vector>
#include <map>
#include <cassert>
#include <cstdint>
#include <iostream>
struct String:std::string{using std::string::string;using std::string::operator=;String(const std::string&s):std::string(s){}String(int n):std::string(std::to_string(n)){}bool length()const{return size();}};
uint32_t clockMs=100;unsigned long millis(){return clockMs;}void delay(int ms){clockMs+=ms;}
constexpr int MAX_WIFI=5,WL_CONNECTED=3,WIFI_STA=1,WIFI_AP=2,WIFI_AP_STA=3,WIFI_AUTH_WPA2_PSK=3,WIFI_AUTH_OPEN=0,WIFI_SCAN_RUNNING=-1,WT_RUNNING=1,WT_SUCCESS=2,WT_IDLE=0,BENCH_NONE=0;
constexpr uint32_t CONNECT_TIMEOUT_MS=20000,WIFI_LOST_TO_SETUP_MS=20000,WIFI_RECOVERY_RETRY_MS=60000;
const char* BOARD_NAME="Aerion F1";const char* BOARD_ID="ZFC-A2";
String savedSSID[MAX_WIFI],savedPASS[MAX_WIFI],preferredSSID,wifiAttemptSSID,controlOwner="PHONE",controlRole="MOBILE",apName="zebjus_drone_1",apPassword="12345678",deviceId="ZFC-001122334455",kitName="zebjus_drone_1";
uint16_t wifiDisconnectReason=0,wifiAttemptReason=0;int wifiAttemptStatus=0,rcPreference=0,setupInput=0,wifiTestState=0,benchMode=0;
bool wifiFallbackAp=false,setupMode=false,mobileReserved=true,mdnsStarted=false,realArmed=false,hasLock=false,fcSetupActive=false,trainingActive=false,firmwareUploadActive=false,preferAp=false,forceAp=false;
uint32_t wifiFallbackAt=0,wifiLostAt=0,controlExpiresAt=100,restartAt=0;int AP_IP=0,AP_GATEWAY=0,AP_SUBNET=0,invalidations=0,reboots=0;
struct Address{String toString(){return "10.0.0.20";}};
struct Radio{
 std::vector<String> visible,attempts;std::vector<bool> plan;std::vector<int> modes;int state=0,stations=0,scanResult=0,complete=0;bool connecting=false,autoReconnect=false;
 void disconnect(bool,bool){connecting=false;state=0;wifiDisconnectReason=8;}void setAutoReconnect(bool v){autoReconnect=v;}void setSleep(bool){}void setMinSecurity(int){}
 void begin(const char*s,const char*){assert(!autoReconnect&&!connecting);attempts.emplace_back(s);bool ok=!plan.empty()&&plan.front();if(!plan.empty())plan.erase(plan.begin());connecting=!ok;state=ok?WL_CONNECTED:0;wifiDisconnectReason=ok?0:201;}
 int status(){return state;}int scanNetworks(bool async=false,bool=false){assert(!connecting&&!autoReconnect);return async?-1:scanResult;}void scanDelete(){}int scanComplete(){return complete;}
 String SSID(int i){return visible.at(i);}String SSID(){return attempts.back();}int RSSI(int i){return -60+i*10;}int channel(int){return 6;}int encryptionType(int){return WIFI_AUTH_WPA2_PSK;}void mode(int m){modes.push_back(m);}Address localIP(){return {};}int softAPgetStationNum(){return stations;}void softAPConfig(int,int,int){}bool softAP(const char*,const char*){return true;}
}WiFi;
struct SerialType{void println(){}void println(const String&){}void println(const char*){}void print(const char*){}template<typename...T>void printf(const char*,T...){}}Serial;
struct {void begin(){}}server;struct{void end(){}}MDNS;struct{void restart(){reboots++;}}ESP;
int savedIndex(const String&s){for(int i=0;i<MAX_WIFI;i++)if(savedSSID[i]==s&&!s.empty())return i;return -1;}
bool lockActive(){return hasLock;}bool lockMine(const String&){return false;}bool effectiveArmed(){return realArmed;}bool preferredApMode(){return preferAp;}void setPreferredApMode(bool v){preferAp=v;}
void setForceSetupFlag(bool v){forceAp=v;}void invalidateRcUdp(){invalidations++;}void serviceFcSetup(){}void serviceTraining(){}void updateApName(){}void startRcUdp(){}void startRcMonitor(){}
String jsonEscape(const String&s){return s;}int code=0;String reply;void sendMessage(int c,const char*s){code=c;reply=s;}void sendJson(int c,const String&s){code=c;reply=s;}
'''
# The scan handler uses only the clientId argument; other server methods are doubles.
prefix=prefix.replace('struct {void begin(){}}server;','struct {void begin(){}String arg(const char*){return "PHONE";}}server;')
checks=r'''
void reset(){WiFi=Radio();clockMs=100;wifiAttemptReason=wifiDisconnectReason=0;restartAt=wifiLostAt=0;setupMode=false;wifiFallbackAp=false;realArmed=hasLock=fcSetupActive=trainingActive=firmwareUploadActive=false;benchMode=0;preferAp=forceAp=false;reboots=0;wifiTestState=WT_IDLE;for(auto&s:savedSSID)s="";preferredSSID="";}
int main(){
 reset();savedSSID[0]=preferredSSID="Router";savedPASS[0]="secret";WiFi.visible={"Router"};WiFi.scanResult=1;WiFi.plan={false,true};assert(connectSavedWiFi());assert(WiFi.attempts.size()==2&&WiFi.autoReconnect&&wifiAttemptStatus==WL_CONNECTED);
 reset();savedSSID[0]=preferredSSID="Hidden";WiFi.scanResult=0;WiFi.plan={false,true};assert(connectSavedWiFi()&&WiFi.attempts.size()==2);
 reset();savedSSID[0]=preferredSSID="Router";WiFi.visible={"Other","Router"};WiFi.scanResult=2;WiFi.plan={false,false};assert(!connectSavedWiFi());assert(!WiFi.connecting&&!WiFi.autoReconnect&&wifiAttemptReason==201); // intentional disconnect must not overwrite recorded router reason
 reset();savedSSID[0]="Weak";savedSSID[1]="Strong";WiFi.visible={"Weak","Strong"};WiFi.scanResult=2;WiFi.plan={true};assert(connectSavedWiFi()&&WiFi.attempts.front()=="Strong");
 reset();assert(!connectSavedWiFi()&&WiFi.attempts.empty());wifiFallbackAp=true;startSetupMode();assert(setupMode&&!preferAp&&controlOwner.empty()&&controlRole.empty()&&!mobileReserved&&WiFi.modes.back()==WIFI_AP);
 clockMs=wifiFallbackAt+WIFI_RECOVERY_RETRY_MS;WiFi.stations=1;networkHealth();assert(!restartAt);WiFi.stations=0;hasLock=true;networkHealth();assert(!restartAt);hasLock=false;realArmed=true;networkHealth();assert(!restartAt);realArmed=false;fcSetupActive=true;networkHealth();assert(!restartAt);fcSetupActive=false;networkHealth();assert(!restartAt);clockMs+=WIFI_RECOVERY_RETRY_MS-1;networkHealth();assert(!restartAt);clockMs++;networkHealth();assert(restartAt==clockMs+250); // full idle interval after the last client/session activity
 reset();preferAp=true;startSetupMode();clockMs+=WIFI_RECOVERY_RETRY_MS;networkHealth();assert(preferAp&&!restartAt); // explicit AP selection remains persistent
 reset();startSetupMode();size_t modes=WiFi.modes.size();WiFi.complete=0;wifiScanApi();assert(code==202&&WiFi.modes.size()==modes+1&&WiFi.modes.back()==WIFI_AP_STA);wifiScanApi();assert(code==200&&WiFi.modes.size()==modes+1); // no AP radio restart at end of scan
 reset();wifiLostAt=clockMs;clockMs+=WIFI_LOST_TO_SETUP_MS+1;networkHealth();assert(forceAp&&reboots==1&&!preferAp);
 reset();WiFi.state=WL_CONNECTED;wifiLostAt=100;networkHealth();assert(wifiLostAt==0&&!reboots);WiFi.state=0;realArmed=true;clockMs=100000;networkHealth();assert(!reboots&&!restartAt);
 std::cout<<"PASS: production STA cancellation/retry/hidden profile/RSSI choice, preserved disconnect reason, nonpersistent AP fallback, idle-only router recovery, stable AP scan and armed guards\n";
}
'''
functions='\n'.join(function(n) for n in ['tryNetwork','connectSavedWiFi','startSetupMode','wifiScanApi','networkHealth'])
with tempfile.TemporaryDirectory(prefix='aerion-wifi-radio-') as directory:
    p=Path(directory);(p/'wifi.cpp').write_text(prefix+functions+checks)
    subprocess.run(['g++','-std=c++17',str(p/'wifi.cpp'),'-o',str(p/'wifi')],check=True);subprocess.run([str(p/'wifi')],check=True)
