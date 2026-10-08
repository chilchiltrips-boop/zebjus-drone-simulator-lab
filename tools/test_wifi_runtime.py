#!/usr/bin/env python3
"""Execute production Wi-Fi storage/test/restart against host NVS and radio doubles."""
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
#include <map>
#include <cassert>
#include <cstring>
#include <cstdint>
#include <iostream>
#define ZEBJUS_DEFAULT_WIFI_SSID "Seed-Router"
#define ZEBJUS_DEFAULT_WIFI_PASS "seed-secret"
struct String:std::string{using std::string::string;using std::string::operator=;String(const std::string& s):std::string(s){}String(int n):std::string(std::to_string(n)){}void trim(){auto a=find_first_not_of(" \t\r\n"),b=find_last_not_of(" \t\r\n");*this=a==npos?"":substr(a,b-a+1);}};
struct Preferences{std::map<std::string,std::map<std::string,String>> data;std::string ns;bool fail=false;
 bool begin(const char* n,bool){ns=n;return !fail;}void end(){}String getString(const char* k,const char* f){return data[ns].count(k)?data[ns][k]:String(f);}bool getBool(const char* k,bool f){return getString(k,f?"1":"0")=="1";}unsigned char getUChar(const char* k,unsigned char f){return std::stoi(getString(k,std::to_string(f).c_str()));}
 void putString(const char* k,const String& v){if(!fail)data[ns][k]=v;}void putBool(const char* k,bool v){putString(k,v?"1":"0");}void putUChar(const char* k,int v){putString(k,std::to_string(v));}void clear(){data[ns].clear();}void remove(const char* k){data[ns].erase(k);}}prefs;
constexpr int MAX_WIFI=5,WT_RUNNING=1,WT_SUCCESS=2,WT_FAILED=3,WL_CONNECTED=3,WIFI_AP=2,CONNECT_TIMEOUT_MS=12000;
String savedSSID[MAX_WIFI],savedPASS[MAX_WIFI],preferredSSID,kitName="Aerion",testName="Aerion",testSSID="Test-Router",testPASS="test-password",testMessage,testRedirect;
unsigned long clockMs=100,wifiTestStarted=0,restartAt=0;unsigned long millis(){return clockMs;}
int wifiTestState=WT_RUNNING,reboots=0,safeStops=0;bool setupMode=true,mdnsStarted=false,autoNameRequired=false,FLIGHT_CONTROL_ENABLED=true,probeAvailable=true,nameConflict=false,preferAp=true,forceAp=true;
struct Address{String toString(){return "10.0.0.20";}};struct Wifi{int state=WL_CONNECTED;bool dropped=false;int status(){return state;}Address localIP(){return {};}void disconnect(bool,bool){dropped=true;}void mode(int){}}WiFi;
struct Mdns{int queryService(const char*,const char*){return nameConflict?1:0;}void end(){}}MDNS;struct SerialType{void println(const String&){}void println(const char*){}}Serial;struct Server{std::map<std::string,String> fields;String arg(const char* k){return fields[k];}void handleClient(){}}server;struct Esp{void restart(){reboots++;}}ESP;
bool startProbeMdns(){mdnsStarted=probeAvailable;return probeAvailable;}bool queryResultIsName(int,const String&,bool){return nameConflict;}String chooseFreeAutoNameFromCurrentQuery(int){return "zebjus_drone_2";}String shortId(){return "334455";}String defaultKitName(){return "FlightCore A2-334455";}void saveKitName(const String& n){kitName=n;}void setPreferredApMode(bool v){preferAp=v;}void setForceSetupFlag(bool v){forceAp=v;}String optionalWebappUrl(){return "";}
void servicePairing(){}void serviceSecureOta(){}void delay(int){}void serviceUserLed(){}void pollGps(){}void updateControlRates(){}void serviceBattery(){}void expireLock(){}void serviceTraining(){}void checkRecoveryButton(){}void networkHealth(){}void motorsSafe(){safeStops++;}bool saveWiFi(String,String,bool=true);
'''
prefix+=r'''
int code=0,udpStops=0;String reply;bool realArmed=false,grant=true,hasLock=true,trainingActive=false,fcSetupActive=false;int benchMode=0;const int BENCH_NONE=0;
bool effectiveArmed(){return realArmed;}bool lockActive(){return hasLock;}bool requireControl(){if(!grant){code=423;return false;}return true;}
String normalizeDisplayName(const String& s){return s;}String jsonEscape(const String& s){return s;}void sendMessage(int c,const String& s){code=c;reply=s;}void sendJson(int c,const String& s){code=c;reply=s;}void invalidateRcUdp(){udpStops++;}uint32_t webRcLastMs=0;void disarmFlight(const char*){realArmed=false;}
'''
checks=r'''
void clearRam(){for(int i=0;i<MAX_WIFI;i++){savedSSID[i]="";savedPASS[i]="";}preferredSSID="";}
void resetTest(){wifiTestState=WT_RUNNING;clockMs=100;wifiTestStarted=0;restartAt=0;reboots=safeStops=0;probeAvailable=true;nameConflict=false;WiFi.state=WL_CONNECTED;WiFi.dropped=false;prefs.fail=false;testName="Aerion";testPASS="test-password";}
int main(){
 prefs.data["zjsys"]["wifi_seeded"]="1";loadSavedWiFi();assert(preferredSSID==DEFAULT_WIFI_SSID);clearRam();loadSavedWiFi();assert(savedPASS[savedIndex(DEFAULT_WIFI_SSID)]==DEFAULT_WIFI_PASS);
 clearSavedWiFi();clearRam();loadSavedWiFi();assert(savedIndex(DEFAULT_WIFI_SSID)<0);
 prefs.data.clear();prefs.data["zjwifi"]["s0"]="Existing";prefs.data["zjwifi"]["p0"]="existing-secret";clearRam();loadSavedWiFi();assert(savedIndex("Existing")==0&&savedIndex(DEFAULT_WIFI_SSID)<0);
 assert(saveWiFi("School","secret",true));clearRam();loadSavedWiFi();assert(preferredSSID=="School"&&savedPASS[savedIndex("School")]=="secret");prefs.fail=true;assert(!saveWiFi("Not-Stored","secret",true));assert(savedIndex("Not-Stored")<0);prefs.fail=false;
 resetTest();loop();assert(wifiTestState==WT_SUCCESS&&savedIndex(testSSID)>=0&&restartAt==7600&&!preferAp&&!forceAp&&testPASS.empty());clockMs=7599;loop();assert(reboots==0);clockMs=7600;loop();assert(reboots==1&&safeStops==1);
 resetTest();probeAvailable=false;testName="";loop();assert(wifiTestState==WT_SUCCESS&&kitName=="FlightCore A2-334455"&&restartAt==7600&&!WiFi.dropped);
 resetTest();nameConflict=true;loop();assert(wifiTestState==WT_SUCCESS&&kitName=="zebjus_drone_2");
 resetTest();prefs.fail=true;loop();assert(wifiTestState==WT_FAILED&&restartAt==0&&WiFi.dropped&&!testPASS.empty());
 resetTest();WiFi.state=0;clockMs=CONNECT_TIMEOUT_MS+1;loop();assert(wifiTestState==WT_FAILED&&restartAt==0&&WiFi.dropped&&!testPASS.empty());
 resetTest();server.fields={{"ssid","Saved-Router"},{"password","correct-password"},{"name","My Flight Controller"}};setWifiApi();assert(code==200&&reply.find("\"profileSaved\":true")!=std::string::npos&&reply.find("\"connectionVerified\":false")!=std::string::npos);assert(preferredSSID=="Saved-Router"&&savedPASS[savedIndex("Saved-Router")]=="correct-password"&&restartAt==clockMs+2500&&kitName=="My Flight Controller"&&!WiFi.dropped&&!preferAp&&!forceAp);int stops=udpStops;clockMs=restartAt-1;loop();assert(reboots==0);clockMs++;loop();assert(reboots==1);
 resetTest();prefs.fail=true;setWifiApi();assert(code==500&&restartAt==0&&udpStops==stops&&!WiFi.dropped);prefs.fail=false;realArmed=true;setWifiApi();assert(code==423&&restartAt==0);realArmed=false;grant=false;setWifiApi();assert(code==423&&restartAt==0);grant=true;
 resetTest();startWifiTestApi();assert(code==200&&reply.find("\"profileSaved\":true")!=std::string::npos&&restartAt==clockMs+2500&&!WiFi.dropped);
 std::cout<<"PASS: production NVS persistence/migration/Forget, failed save/password, mDNS fallback/conflict and actual loop restart with safe outputs\n";
}
'''
defaults='\n'.join(re.findall(r'^(?:static )?const char\s*\*\s*DEFAULT_WIFI_(?:SSID|PASS)\s*=.*?;',source,re.M))
functions='\n'.join(function(n) for n in ['savedIndex','saveWiFi','loadSavedWiFi','clearSavedWiFi','setWifiApi','startWifiTestApi','processWifiTest','loop'])
with tempfile.TemporaryDirectory() as directory:
    p=Path(directory);(p/'wifi.cpp').write_text(prefix+defaults+'\n'+functions+checks)
    subprocess.run(['g++','-std=c++17',str(p/'wifi.cpp'),'-o',str(p/'wifi')],check=True);subprocess.run([str(p/'wifi')],check=True)
