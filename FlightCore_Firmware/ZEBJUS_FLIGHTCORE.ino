/*
  ZEBJUS FlightCore V18.3.40 - LOCAL Wi-Fi / mDNS + I2C PYTHON LAB

  Connection model copied from the proven ZEBJUS Python Lab approach:
    - Saved Wi-Fi -> direct STA connection on boot.
    - No cloud/server is required to find or control the kit on the same LAN.
    - Kit is reached by Kit Name through mDNS: http://<kit-name>.local
    - Webapp caches the last good DHCP IP, then falls back to mDNS.
    - /api/status always exposes permanent Device ID so a cached IP can never
      silently connect to the wrong physical kit.
    - Captive AP is used only for first-time setup / recovery.

  First use:
    1. Power kit. If no valid saved Wi-Fi exists it starts a setup AP.
    2. Join ZEBJUS-SETUP-xxxxxx. Captive portal should open automatically.
    3. Choose Kit Name + Wi-Fi + password and press SAVE & TEST.
    4. Password is saved only after a real STA connection succeeds.
    5. On restart, kit joins that Wi-Fi and advertises <kit-name>.local.
    6. In Drone Lab enter the same Kit Name once. Future reconnect uses cached IP
       first and mDNS as fallback.

  Multi-user rule:
    - One browser may hold the real-kit control lock at a time.
    - Everyone else stays view-only and can still use the simulator.
    - Browser sends lock heartbeat; lock auto-releases after 10 seconds.

  Recovery:
    - Hold BOOT about 5 seconds, then release -> force setup AP once.
    - Hold BOOT about 10 seconds -> factory reset Kit Name + saved Wi-Fi.

  Required libraries:
    - Supported vendor Arduino core 3.3.x
    - No WebSockets / cloud library required for same-Wi-Fi access.
*/

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <Update.h>
#include <Wire.h>
#include "ZEBJUS_FLIGHTCORE_TYPES.h"

// ---------------- General ----------------
static const char* FW_VERSION="18.3.40";
static const char* FW_BUILD_DATE=__DATE__;
static const char* FW_BUILD_TIME=__TIME__;

// ZEBJUS board identity. The silicon family stays an internal implementation detail;
// browser/API users see only stable ZEBJUS FlightCore profile names.
#if defined(CONFIG_IDF_TARGET_ESP32C3)
static const char* BOARD_ID="ZFC-A1";
static const char* BOARD_NAME="ZEBJUS FlightCore A1 / ESP32-C3";
static const int RECOVERY_BUTTON_PIN=9;
static const int PPM_RECEIVER_PIN=18;
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=false; // A1 stays bridge-only until its motor-pin map is confirmed.
static const int MOTOR_PINS[4]={-1,-1,-1,-1};
#elif defined(CONFIG_IDF_TARGET_ESP32C6)
static const char* BOARD_ID="ZFC-A2";
static const char* BOARD_NAME="ZEBJUS FlightCore A2 / XIAO ESP32-C6";
static const int RECOVERY_BUTTON_PIN=9;
static const int PPM_RECEIVER_PIN=16; // XIAO D6; keep I2C on board SDA/SCL.
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=true;
static const int MOTOR_PINS[4]={D1,D2,D3,D0}; // M1,M2,M3,M4 exactly as the proven FC sketches.
#else
static const char* BOARD_ID="ZFC-DEV";
static const char* BOARD_NAME="ZEBJUS FlightCore Developer";
static const int RECOVERY_BUTTON_PIN=9;
static const int PPM_RECEIVER_PIN=18;
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=false;
static const int MOTOR_PINS[4]={-1,-1,-1,-1};
#endif
static const char* AP_PASSWORD="12345678";

// Factory default Wi-Fi profile. It is seeded only once after first flash / factory reset.
// Students can later change or forget it from the webapp/AP setup page.
static const char* DEFAULT_WIFI_SSID="";
static const char* DEFAULT_WIFI_PASS="";
static const byte DNS_PORT=53;
static const uint32_t CONNECT_TIMEOUT_MS=12000;
static const uint32_t LOCK_TIMEOUT_MS=10000;
static const uint32_t WIFI_LOST_TO_SETUP_MS=20000;
static const uint32_t FORCE_AP_HOLD_MS=5000;
static const uint32_t FACTORY_RESET_HOLD_MS=10000;
static const bool ALLOW_WEB_RC=true; // Accepted only when the browser owns the control lock; flight loop still applies arm/failsafe gates.

// Physical transmitter / PPM receiver mirror.
// The board profile above owns the receiver pin so future FlightCore boards can route it differently.
static const bool ENABLE_PPM_RECEIVER=true;
static const uint32_t PPM_SYNC_US=3000;
static const uint32_t PPM_MIN_US=750;
static const uint32_t PPM_MAX_US=2250;
static const uint32_t PPM_STALE_US=300000;
static const uint32_t WEB_RC_STALE_MS=300;
static const uint32_t FLIGHT_LOOP_US=4000;

// Optional: after successful AP setup, show/open your hosted webapp automatically.
// Example: "https://lab.zebjus.com". Leave blank until the final URL is known.
static const char* WEBAPP_URL="";

IPAddress AP_IP(192,168,4,1),AP_GATEWAY(192,168,4,1),AP_SUBNET(255,255,255,0);
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

// ---------------- Identity / Wi-Fi ----------------
String deviceId,kitName,apName;
bool autoNameRequired=false;
static const int MAX_WIFI=4;
String savedSSID[MAX_WIFI],savedPASS[MAX_WIFI],preferredSSID;
bool setupMode=false,mdnsStarted=false,armed=false;
unsigned long wifiLostAt=0,restartAt=0;

// ---------------- Control lock ----------------
String controlOwner="";
unsigned long controlExpiresAt=0;

// Explicit forward declarations keep this sketch independent of Arduino's auto-prototype ordering.
bool i2cWriteReg(uint8_t address,uint8_t reg,uint8_t value);
bool i2cReadReg(uint8_t address,uint8_t reg,uint8_t& value);
bool i2cReadBlock(uint8_t address,uint8_t reg,uint8_t* dst,size_t len);
bool readAnyImu(ImuSample& out);

// ---------------- Physical PPM receiver ----------------
volatile uint16_t ppmCh[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
volatile uint8_t ppmIndex=0;
volatile uint32_t ppmLastEdgeUs=0,ppmLastFrameUs=0,ppmFrames=0;

// ---------------- Rate/Angle flight core (A2 / XIAO ESP32-C6) ----------------
uint16_t webRcCh[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
unsigned long webRcLastMs=0;
RcSourceKind activeRcSource=RC_NONE,lastRcSource=RC_NONE;
FlightModeKind flightMode=FLIGHT_ANGLE,lastFlightMode=FLIGHT_ANGLE;
bool flightReady=false,armLowSeen=false;
uint32_t flightLoopTimerUs=0,flightLoopCount=0,imuFaultCount=0;
float rateRoll=0,ratePitch=0,rateYaw=0,gyroBiasRoll=0,gyroBiasPitch=0,gyroBiasYaw=0;
float accX=0,accY=0,accZ=0,accAngleRoll=0,accAnglePitch=0,kalmanRoll=0,kalmanPitch=0,flightYaw=0,kalmanRollUnc=4,kalmanPitchUnc=4;
float motorInput[4]={1000,1000,1000,1000};
float prevRateErrRoll=0,prevRateErrPitch=0,prevRateErrYaw=0,iRateRoll=0,iRatePitch=0,iRateYaw=0;
float prevAngleErrRoll=0,prevAngleErrPitch=0,iAngleRoll=0,iAnglePitch=0;
unsigned long lastFlightSampleMs=0,lastSourceChangeMs=0;

// ---------------- Wi-Fi test state ----------------
enum WifiTestState{WT_IDLE,WT_RUNNING,WT_SUCCESS,WT_FAILED};
WifiTestState wifiTestState=WT_IDLE;
String testName,testSSID,testPASS,testMessage,testRedirect;
unsigned long wifiTestStarted=0,wifiTestRestartAt=0;

// ---------------- Recovery button ----------------
unsigned long recoveryPressedAt=0;
bool factoryResetTriggered=false;

// ---------------- Firmware update state ----------------
bool firmwareUploadActive=false,firmwareUploadSuccess=false;
String firmwareUploadError="",firmwareUploadName="";
size_t firmwareUploadBytes=0;

// ============================================================
// Helpers
// ============================================================
String getDeviceId(){
  uint64_t mac=ESP.getEfuseMac();char b[32];
  snprintf(b,sizeof(b),"ZFC-%012llX",(unsigned long long)(mac&0xFFFFFFFFFFFFULL));
  return String(b);
}
String shortId(){return deviceId.substring(deviceId.length()-6);}
String jsonEscape(String s){s.replace("\\","\\\\");s.replace("\"","\\\"");s.replace("\r","");s.replace("\n","\\n");return s;}
String htmlEscape(String s){s.replace("&","&amp;");s.replace("<","&lt;");s.replace(">","&gt;");s.replace("\"","&quot;");s.replace("'","&#39;");return s;}
String urlEncode(const String& s){const char* hex="0123456789ABCDEF";String out="";for(size_t i=0;i<s.length();i++){uint8_t c=(uint8_t)s[i];if(isalnum(c)||c=='-'||c=='_'||c=='.'||c=='~')out+=(char)c;else{out+='%';out+=hex[c>>4];out+=hex[c&15];}}return out;}
String normalizeDisplayName(String s){
  s.trim();String out="";bool sep=false;
  for(size_t i=0;i<s.length()&&out.length()<28;i++){
    char c=s[i];
    if(isalnum((unsigned char)c)){out+=c;sep=false;}
    else if(c==' '||c=='-'||c=='_'){if(!sep&&out.length()){out+=c==' '?' ':c;sep=true;}}
  }
  while(out.endsWith(" ")||out.endsWith("-")||out.endsWith("_"))out.remove(out.length()-1);
  return out;
}
String hostFromName(String s){
  s=normalizeDisplayName(s);s.toLowerCase();String h="";bool dash=false;
  for(size_t i=0;i<s.length()&&h.length()<32;i++){
    char c=s[i];
    if(isalnum((unsigned char)c)){h+=c;dash=false;}
    else if(c==' '||c=='-'||c=='_'){if(!dash&&h.length()){h+='-';dash=true;}}
  }
  while(h.endsWith("-"))h.remove(h.length()-1);
  return h;
}
void updateApName(){String n=hostFromName(kitName);apName=n.length()?"ZEBJUS-"+n:"ZEBJUS-SETUP-"+shortId();if(apName.length()>31)apName=apName.substring(0,31);}
String optionalWebappUrl(){
  String base=String(WEBAPP_URL);base.trim();if(!base.length())return "";
  if(base.endsWith("/"))base.remove(base.length()-1);
  return base+"?kitId="+urlEncode(deviceId)+"&kitName="+urlEncode(kitName)+"&autoconnect=1";
}
void cors(){
  server.sendHeader("Access-Control-Allow-Origin","*");
  server.sendHeader("Access-Control-Allow-Methods","GET,POST,OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers","Content-Type, X-Zebjus-Control");
  server.sendHeader("Access-Control-Max-Age","600");
}
void sendJson(int code,const String& body){cors();server.sendHeader("Cache-Control","no-store");server.send(code,"application/json",body);}
void sendMessage(int code,const String& message){sendJson(code,"{\"ok\":"+String(code>=200&&code<300?"true":"false")+",\"message\":\""+jsonEscape(message)+"\"}");}
bool argBool(const char* name,bool fallback=false){if(!server.hasArg(name))return fallback;String v=server.arg(name);v.toLowerCase();return v=="1"||v=="true"||v=="yes"||v=="on";}

// ============================================================
// NVS: Kit Name + multiple Wi-Fi profiles
// ============================================================
bool isLegacyAutoName(const String& name){return hostFromName(name)==hostFromName("F450-"+shortId());}
void loadKitName(){
  prefs.begin("zjdrone",true);kitName=normalizeDisplayName(prefs.getString("name",""));prefs.end();
  autoNameRequired=!kitName.length()||isLegacyAutoName(kitName);
  if(autoNameRequired)kitName="";
  updateApName();
}
void saveKitName(const String& name){
  kitName=normalizeDisplayName(name);autoNameRequired=!kitName.length();
  prefs.begin("zjdrone",false);if(kitName.length())prefs.putString("name",kitName);else prefs.remove("name");prefs.end();updateApName();
}
void clearKitName(){prefs.begin("zjdrone",false);prefs.remove("name");prefs.end();kitName="";autoNameRequired=true;updateApName();}
void loadSavedWiFi(){
  prefs.begin("zjwifi",true);preferredSSID=prefs.getString("preferred","");
  bool any=false;
  for(int i=0;i<MAX_WIFI;i++){String sk="s"+String(i),pk="p"+String(i);savedSSID[i]=prefs.getString(sk.c_str(),"");savedPASS[i]=prefs.getString(pk.c_str(),"");if(savedSSID[i].length())any=true;}
  prefs.end();

  // Seed the requested home/school Wi-Fi once. A normal "Forget All Wi-Fi" will not add it back.
  // A full factory reset clears the seed marker, so firmware defaults are restored.
  prefs.begin("zjsys",false);bool seeded=prefs.getBool("wifi_seeded",false);
  if(!seeded){
    if(!any&&strlen(DEFAULT_WIFI_SSID)){
      prefs.end();
      prefs.begin("zjwifi",false);prefs.putString("s0",DEFAULT_WIFI_SSID);prefs.putString("p0",DEFAULT_WIFI_PASS);prefs.putString("preferred",DEFAULT_WIFI_SSID);prefs.end();
      savedSSID[0]=DEFAULT_WIFI_SSID;savedPASS[0]=DEFAULT_WIFI_PASS;preferredSSID=DEFAULT_WIFI_SSID;any=true;
      prefs.begin("zjsys",false);
      Serial.println("Default Wi-Fi profile installed: "+String(DEFAULT_WIFI_SSID));
    }
    prefs.putBool("wifi_seeded",true);
  }
  prefs.end();
}
int savedIndex(const String& ssid){for(int i=0;i<MAX_WIFI;i++)if(savedSSID[i]==ssid)return i;return -1;}
void saveWiFi(String ssid,String password,bool preferred=true){
  ssid.trim();if(!ssid.length())return;prefs.begin("zjwifi",false);
  int idx=savedIndex(ssid);
  if(idx<0){for(int i=0;i<MAX_WIFI;i++)if(!savedSSID[i].length()){idx=i;break;}}
  if(idx<0){idx=prefs.getUChar("next",0)%MAX_WIFI;prefs.putUChar("next",(idx+1)%MAX_WIFI);}
  String sk="s"+String(idx),pk="p"+String(idx);prefs.putString(sk.c_str(),ssid);prefs.putString(pk.c_str(),password);savedSSID[idx]=ssid;savedPASS[idx]=password;
  if(preferred){preferredSSID=ssid;prefs.putString("preferred",ssid);}prefs.end();
}
void clearSavedWiFi(){prefs.begin("zjwifi",false);prefs.clear();prefs.end();preferredSSID="";for(int i=0;i<MAX_WIFI;i++){savedSSID[i]="";savedPASS[i]="";}}
void forgetSavedWiFi(const String& ssid){
  int idx=savedIndex(ssid);if(idx<0)return;prefs.begin("zjwifi",false);String sk="s"+String(idx),pk="p"+String(idx);prefs.remove(sk.c_str());prefs.remove(pk.c_str());savedSSID[idx]="";savedPASS[idx]="";if(preferredSSID==ssid){preferredSSID="";prefs.remove("preferred");}prefs.end();
}
void setPreferredWiFi(const String& ssid){int idx=savedIndex(ssid);if(idx<0)return;preferredSSID=ssid;prefs.begin("zjwifi",false);prefs.putString("preferred",ssid);prefs.end();}
void setForceSetupFlag(bool on){prefs.begin("zjsys",false);if(on)prefs.putBool("forceap",true);else prefs.remove("forceap");prefs.end();}
bool consumeForceSetupFlag(){prefs.begin("zjsys",false);bool on=prefs.getBool("forceap",false);if(on)prefs.remove("forceap");prefs.end();return on;}
void factoryResetAll(){clearSavedWiFi();clearKitName();prefs.begin("zjsys",false);prefs.clear();prefs.end();}

// ============================================================
// Wi-Fi + mDNS
// ============================================================
bool tryNetwork(int index){
  if(index<0||index>=MAX_WIFI||!savedSSID[index].length())return false;
  Serial.println("Trying Wi-Fi: "+savedSSID[index]);WiFi.disconnect(false,false);delay(100);WiFi.begin(savedSSID[index].c_str(),savedPASS[index].c_str());
  unsigned long t=millis();while(WiFi.status()!=WL_CONNECTED&&millis()-t<CONNECT_TIMEOUT_MS){delay(200);Serial.print(".");}Serial.println();
  if(WiFi.status()!=WL_CONNECTED)return false;
  Serial.println("WiFi Connected");Serial.println("SSID : "+WiFi.SSID());Serial.println("IP   : "+WiFi.localIP().toString());return true;
}
bool connectSavedWiFi(){
  bool any=false;for(int i=0;i<MAX_WIFI;i++)if(savedSSID[i].length())any=true;if(!any){Serial.println("No saved Wi-Fi");return false;}
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.setSleep(false);
  int preferred=savedIndex(preferredSSID);if(preferred>=0&&tryNetwork(preferred))return true;
  Serial.println("Scanning saved Wi-Fi profiles...");int n=WiFi.scanNetworks();if(n<=0){WiFi.scanDelete();return false;}
  bool tried[MAX_WIFI]={false};if(preferred>=0)tried[preferred]=true;
  for(int attempt=0;attempt<MAX_WIFI;attempt++){
    int best=-1,bestRssi=-1000;for(int i=0;i<n;i++){int s=savedIndex(WiFi.SSID(i));if(s>=0&&!tried[s]&&WiFi.RSSI(i)>bestRssi){best=s;bestRssi=WiFi.RSSI(i);}}
    if(best<0)break;tried[best]=true;if(tryNetwork(best)){WiFi.scanDelete();return true;}
  }
  WiFi.scanDelete();return false;
}
bool queryResultIsName(int i,const String& candidate,bool ignoreSelf){
  String other=normalizeDisplayName(MDNS.txt(i,"name"));if(!other.length())other=normalizeDisplayName(MDNS.instanceName(i));
  if(hostFromName(other)!=hostFromName(candidate))return false;if(!ignoreSelf)return true;
  String otherId=MDNS.txt(i,"id");if(otherId.length()&&otherId.equalsIgnoreCase(deviceId))return false;
  IPAddress ip=MDNS.address(i);if(ip==WiFi.localIP())return false;return true;
}
bool startProbeMdns(){if(mdnsStarted){MDNS.end();mdnsStarted=false;delay(70);}String probe="zj-probe-"+shortId();probe.toLowerCase();mdnsStarted=MDNS.begin(probe.c_str());return mdnsStarted;}
bool nameExistsOnNetwork(const String& candidate){if(!mdnsStarted&&!startProbeMdns())return false;delay(180);int count=MDNS.queryService("zebjus-drone","tcp");for(int i=0;i<count;i++)if(queryResultIsName(i,candidate,true))return true;return false;}
String chooseFreeAutoNameFromCurrentQuery(int resultCount){
  for(int num=1;num<=999;num++){
    String candidate="zebjus_drone_"+String(num);bool used=false;
    for(int i=0;i<resultCount;i++)if(queryResultIsName(i,candidate,false)){used=true;break;}
    if(!used)return candidate;
  }
  return "zebjus_drone_"+shortId();
}
void startKitMdns(){
  if(mdnsStarted){MDNS.end();mdnsStarted=false;delay(70);}String host=hostFromName(kitName);if(!host.length())host="f450-"+shortId();host.toLowerCase();
  if(!MDNS.begin(host.c_str())){Serial.println("mDNS start failed");return;}mdnsStarted=true;MDNS.setInstanceName(kitName);MDNS.addService("zebjus-drone","tcp",80);MDNS.addServiceTxt("zebjus-drone","tcp","name",kitName);MDNS.addServiceTxt("zebjus-drone","tcp","id",deviceId);MDNS.addServiceTxt("zebjus-drone","tcp","ver",FW_VERSION);
  Serial.println("Kit Name : "+kitName);Serial.println("Local    : http://"+host+".local");
}
void ensureUniqueKitName(){
  if(!startProbeMdns()){
    if(!kitName.length())saveKitName("zebjus_drone_"+shortId());
    startKitMdns();return;
  }
  delay(150+(ESP.getEfuseMac()%450));
  int count=MDNS.queryService("zebjus-drone","tcp");
  bool conflict=false;
  if(kitName.length())for(int i=0;i<count;i++)if(queryResultIsName(i,kitName,false)){conflict=true;break;}
  if(!kitName.length()||autoNameRequired||conflict){
    String old=kitName;saveKitName(chooseFreeAutoNameFromCurrentQuery(count));autoNameRequired=false;
    if(old.length())Serial.println("Legacy/name conflict -> automatic Kit Name: "+kitName);
    else Serial.println("Automatic Kit Name: "+kitName);
  }
  startKitMdns();
  delay(450);
  int verifyCount=MDNS.queryService("zebjus-drone","tcp");bool duplicate=false;
  for(int i=0;i<verifyCount;i++)if(queryResultIsName(i,kitName,true)){duplicate=true;break;}
  if(duplicate){String replacement=chooseFreeAutoNameFromCurrentQuery(verifyCount);Serial.println("Simultaneous name conflict -> "+replacement);saveKitName(replacement);startKitMdns();}
}

// ============================================================
// Control lock
// ============================================================
void expireLock(){if(controlOwner.length()&&(long)(millis()-controlExpiresAt)>=0){Serial.println("Control lock expired");controlOwner="";controlExpiresAt=0;}}
bool lockMine(const String& id){expireLock();return id.length()&&controlOwner==id;}
bool lockActive(){expireLock();return controlOwner.length();}
bool controlAuthorized(){String id=server.arg("clientId");if(lockMine(id)){controlExpiresAt=millis()+LOCK_TIMEOUT_MS;return true;}return false;}
bool requireControl(){if(controlAuthorized())return true;sendMessage(lockActive()?423:409,lockActive()?"Kit is controlled by another browser. View-only mode is active.":"Take Control before changing real hardware.");return false;}

// ============================================================
// Physical PPM receiver
// ============================================================
void IRAM_ATTR ppmIsr(){
  uint32_t now=micros(),dt=now-ppmLastEdgeUs;ppmLastEdgeUs=now;
  if(dt>PPM_SYNC_US){if(ppmIndex>=4){ppmLastFrameUs=now;ppmFrames++;}ppmIndex=0;return;}
  if(dt>=PPM_MIN_US&&dt<=PPM_MAX_US&&ppmIndex<10)ppmCh[ppmIndex++]=(uint16_t)dt;
}
bool receiverFresh(){if(!ENABLE_PPM_RECEIVER||!ppmLastFrameUs)return false;return (uint32_t)(micros()-ppmLastFrameUs)<PPM_STALE_US;}
uint32_t receiverAgeMs(){if(!ppmLastFrameUs)return 0xFFFFFFFFUL;return (uint32_t)(micros()-ppmLastFrameUs)/1000UL;}
String receiverHealth(){if(!ENABLE_PPM_RECEIVER||!ppmFrames)return "NOT_FOUND";return receiverFresh()?"OK":"STALE";}
void copyReceiver(uint16_t out[10]){noInterrupts();for(int i=0;i<10;i++)out[i]=ppmCh[i];interrupts();}
// Interim authoritative arm guard: final flight-core state OR fresh physical receiver CH5.
// The final Rate/Angle flight core must update `armed` directly.
bool effectiveArmed(){
  if(FLIGHT_CONTROL_ENABLED)return armed;
  if(armed)return true;
  if(receiverFresh()){uint16_t rc[10];copyReceiver(rc);return rc[4]>1500;}
  return false;
}

// IMU globals are defined in the sensor section below; declare them here because
// the flight-control functions appear before that section in the sketch body.
extern ImuSample lastImu;extern bool lastImuValid;extern ImuKind detectedImu;extern uint8_t detectedImuAddress;

// ============================================================
// A2 real Rate / Angle flight loop
// ============================================================
const char* rcSourceName(RcSourceKind s){return s==RC_PPM?"PPM":s==RC_WEB_AP?"WEB_AP":s==RC_WEB_STA?"WEB_STA":"NONE";}
const char* flightModeName(FlightModeKind m){return m==FLIGHT_RATE?"RATE":"ANGLE";}
bool webRcFresh(){return webRcLastMs&&(uint32_t)(millis()-webRcLastMs)<WEB_RC_STALE_MS;}
RcSourceKind chooseRcSource(){if(receiverFresh())return RC_PPM;if(webRcFresh())return setupMode?RC_WEB_AP:RC_WEB_STA;return RC_NONE;}
void copyActiveRc(uint16_t out[10],RcSourceKind src){if(src==RC_PPM){copyReceiver(out);return;}if(src==RC_WEB_AP||src==RC_WEB_STA){for(int i=0;i<10;i++)out[i]=webRcCh[i];return;}for(int i=0;i<10;i++)out[i]=(i==2||i==4||i==5||i==6||i==7||i==9)?1000:1500;}
void resetFlightPid(){prevRateErrRoll=prevRateErrPitch=prevRateErrYaw=0;iRateRoll=iRatePitch=iRateYaw=0;prevAngleErrRoll=prevAngleErrPitch=0;iAngleRoll=iAnglePitch=0;}
float pidStep(float error,float kp,float ki,float kd,float& prevErr,float& iTerm){const float dt=.004f;float p=kp*error;iTerm+=ki*(error+prevErr)*dt*.5f;iTerm=constrain(iTerm,-400.0f,400.0f);float d=kd*(error-prevErr)/dt;prevErr=error;return constrain(p+iTerm+d,-400.0f,400.0f);}
void kalmanStep(float& state,float& uncertainty,float rate,float measurement){const float dt=.004f;state+=dt*rate;uncertainty+=dt*dt*16.0f;float gain=uncertainty/(uncertainty+9.0f);state+=gain*(measurement-state);uncertainty=(1.0f-gain)*uncertainty;}
void writeMotorOutputs(float m1,float m2,float m3,float m4){motorInput[0]=m1;motorInput[1]=m2;motorInput[2]=m3;motorInput[3]=m4;if(!FLIGHT_CONTROL_ENABLED)return;for(int i=0;i<4;i++)if(MOTOR_PINS[i]>=0)ledcWrite(MOTOR_PINS[i],(uint32_t)constrain((int)motorInput[i],1000,1999));}
void motorsSafe(){writeMotorOutputs(1000,1000,1000,1000);}
bool configureMpu6050Flight(){if(detectedImu!=IMU_MPU6050||!detectedImuAddress)return false;return i2cWriteReg(detectedImuAddress,0x6B,0x00)&&i2cWriteReg(detectedImuAddress,0x1A,0x05)&&i2cWriteReg(detectedImuAddress,0x1C,0x10)&&i2cWriteReg(detectedImuAddress,0x1B,0x08)&&i2cWriteReg(detectedImuAddress,0x19,0x03);}
bool readMpuFlight(float& rr,float& rp,float& ry,float& ax,float& ay,float& az){uint8_t b[14];if(!i2cReadBlock(detectedImuAddress,0x3B,b,sizeof(b)))return false;auto be16=[&](int i)->int16_t{return (int16_t)(((uint16_t)b[i]<<8)|b[i+1]);};int16_t rax=be16(0),ray=be16(2),raz=be16(4),rgx=be16(8),rgy=be16(10),rgz=be16(12);ax=(float)rax/4096.0f-0.10f;ay=(float)ray/4096.0f+0.03f;az=(float)raz/4096.0f+0.12f;rr=(float)rgx/65.5f;rp=(float)rgy/65.5f;ry=(float)rgz/65.5f;lastImu.kind=IMU_MPU6050;lastImu.address=detectedImuAddress;lastImu.whoAmI=detectedImuAddress;lastImu.rawAx=rax;lastImu.rawAy=ray;lastImu.rawAz=raz;lastImu.rawGx=rgx;lastImu.rawGy=rgy;lastImu.rawGz=rgz;lastImu.ax=ax;lastImu.ay=ay;lastImu.az=az;lastImu.gx=rr;lastImu.gy=rp;lastImu.gz=ry;lastImu.sampledAt=millis();lastImuValid=true;return true;}
void disarmFlight(const char* reason){if(armed&&reason&&strlen(reason))Serial.println(String("DISARM • ")+reason);armed=false;motorsSafe();resetFlightPid();}
void setupFlightCore(){
  if(!FLIGHT_CONTROL_ENABLED){flightReady=false;return;}
  for(int i=0;i<4;i++){if(MOTOR_PINS[i]>=0){ledcAttach(MOTOR_PINS[i],250,12);ledcWrite(MOTOR_PINS[i],1000);}}
  Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,400000);delay(40);
  if(detectedImu!=IMU_MPU6050||!detectedImuAddress){flightReady=false;Serial.println("FlightCore: MPU6050 not detected • ESC outputs held at minimum");return;}
  // Match the proven MPU6050 FC configuration: DLPF=0x05, ±8g, ±500 dps.
  if(!configureMpu6050Flight()){flightReady=false;Serial.println("FlightCore: MPU6050 configuration failed");return;}
  Serial.println("FlightCore: keep the frame LEVEL and STILL • calibrating gyro (2000 samples)");
  gyroBiasRoll=gyroBiasPitch=gyroBiasYaw=0;int good=0;for(int i=0;i<2000;i++){float rr,rp,ry,ax,ay,az;if(readMpuFlight(rr,rp,ry,ax,ay,az)){gyroBiasRoll+=rr;gyroBiasPitch+=rp;gyroBiasYaw+=ry;good++;}delay(1);}
  if(good<1800){flightReady=false;motorsSafe();Serial.println("FlightCore: gyro calibration failed • sensor reads unstable");return;}
  gyroBiasRoll/=good;gyroBiasPitch/=good;gyroBiasYaw/=good;float rr,rp,ry;if(readMpuFlight(rr,rp,ry,accX,accY,accZ)){accAngleRoll=atan2f(accY,sqrtf(accX*accX+accZ*accZ))*57.2957795f;accAnglePitch=-atan2f(accX,sqrtf(accY*accY+accZ*accZ))*57.2957795f;kalmanRoll=accAngleRoll;kalmanPitch=accAnglePitch;}
  armLowSeen=false;flightMode=FLIGHT_ANGLE;lastFlightMode=flightMode;activeRcSource=lastRcSource=RC_NONE;flightLoopTimerUs=micros();flightReady=true;
  Serial.printf("FlightCore READY • gyro bias R %.3f P %.3f Y %.3f dps • motors D1/D2/D3/D0 • 250 Hz\n",gyroBiasRoll,gyroBiasPitch,gyroBiasYaw);
}
void runFlightLoop(){
  if(!FLIGHT_CONTROL_ENABLED||!flightReady)return;uint32_t now=micros();if((uint32_t)(now-flightLoopTimerUs)<FLIGHT_LOOP_US)return;flightLoopTimerUs+=FLIGHT_LOOP_US;if((uint32_t)(now-flightLoopTimerUs)>FLIGHT_LOOP_US*4)flightLoopTimerUs=now;
  uint16_t rc[10];activeRcSource=chooseRcSource();copyActiveRc(rc,activeRcSource);
  if(activeRcSource!=lastRcSource){if(armed)disarmFlight("RC source changed");armLowSeen=false;lastRcSource=activeRcSource;lastSourceChangeMs=millis();Serial.println(String("RC source: ")+rcSourceName(activeRcSource));}
  FlightModeKind requested=rc[5]>=1500?FLIGHT_RATE:FLIGHT_ANGLE;if(requested!=flightMode){if(armed)disarmFlight("mode changed");flightMode=requested;resetFlightPid();}
  if(activeRcSource==RC_NONE){armLowSeen=false;disarmFlight("RC timeout");return;}
  if(rc[4]<1500){if(armed)disarmFlight("CH5 low");armLowSeen=true;}else if(!armed&&armLowSeen&&rc[2]<=1050){armed=true;resetFlightPid();Serial.println(String("ARMED • ")+flightModeName(flightMode)+" • "+rcSourceName(activeRcSource));}
  float rr,rp,ry;if(!readMpuFlight(rr,rp,ry,accX,accY,accZ)){imuFaultCount++;if(imuFaultCount>=3){disarmFlight("IMU read failure");flightReady=false;}return;}imuFaultCount=0;rateRoll=rr-gyroBiasRoll;ratePitch=rp-gyroBiasPitch;rateYaw=ry-gyroBiasYaw;flightYaw+=rateYaw*.004f;if(flightYaw>180)flightYaw-=360;if(flightYaw<-180)flightYaw+=360;lastFlightSampleMs=millis();
  accAngleRoll=atan2f(accY,sqrtf(accX*accX+accZ*accZ))*57.2957795f;accAnglePitch=-atan2f(accX,sqrtf(accY*accY+accZ*accZ))*57.2957795f;kalmanStep(kalmanRoll,kalmanRollUnc,rateRoll,accAngleRoll);kalmanStep(kalmanPitch,kalmanPitchUnc,ratePitch,accAnglePitch);
  if(!armed||rc[2]<1050){motorsSafe();resetFlightPid();return;}
  float desiredRateRoll=0,desiredRatePitch=0,desiredRateYaw=.15f*((float)rc[3]-1500.0f);float inputRoll=0,inputPitch=0,inputYaw=0;
  if(flightMode==FLIGHT_RATE){desiredRateRoll=.15f*((float)rc[0]-1500.0f);desiredRatePitch=.15f*((float)rc[1]-1500.0f);inputRoll=pidStep(desiredRateRoll-rateRoll,1.4f,18.0f,.035f,prevRateErrRoll,iRateRoll);inputPitch=pidStep(desiredRatePitch-ratePitch,1.4f,18.0f,.035f,prevRateErrPitch,iRatePitch);inputYaw=pidStep(desiredRateYaw-rateYaw,3.0f,20.0f,0.0f,prevRateErrYaw,iRateYaw);}
  else{float desiredAngleRoll=.10f*((float)rc[0]-1500.0f),desiredAnglePitch=.10f*((float)rc[1]-1500.0f);desiredRateRoll=pidStep(desiredAngleRoll-kalmanRoll,3.0f,0.0f,0.0f,prevAngleErrRoll,iAngleRoll);desiredRatePitch=pidStep(desiredAnglePitch-kalmanPitch,3.0f,0.0f,0.0f,prevAngleErrPitch,iAnglePitch);inputRoll=pidStep(desiredRateRoll-rateRoll,.9f,15.0f,.03f,prevRateErrRoll,iRateRoll);inputPitch=pidStep(desiredRatePitch-ratePitch,.9f,15.0f,.03f,prevRateErrPitch,iRatePitch);inputYaw=pidStep(desiredRateYaw-rateYaw,3.0f,15.0f,0.0f,prevRateErrYaw,iRateYaw);}
  float throttle=min((float)rc[2],1800.0f),m1=1.024f*(throttle+inputRoll-inputPitch+inputYaw),m2=1.024f*(throttle-inputRoll-inputPitch-inputYaw),m3=1.024f*(throttle-inputRoll+inputPitch+inputYaw),m4=1.024f*(throttle+inputRoll+inputPitch-inputYaw);m1=constrain(m1,1180.0f,1999.0f);m2=constrain(m2,1180.0f,1999.0f);m3=constrain(m3,1180.0f,1999.0f);m4=constrain(m4,1180.0f,1999.0f);writeMotorOutputs(m1,m2,m3,m4);flightLoopCount++;
}

// ============================================================
// I2C bus / Python Lab scanner + LSM6DS3 raw sensor API
// ============================================================
String i2cHint(uint8_t address){
  switch(address){
    case 0x1E:return "possible HMC5883L magnetometer";
    case 0x27:return "possible LCD1602 I2C backpack";
    case 0x29:return "possible VL53L0X / VL53L1X ToF sensor";
    case 0x3C:return "possible SSD1306 OLED";
    case 0x68:return "possible MPU6050 / IMU";
    case 0x69:return "possible IMU";
    case 0x6A:return "possible LSM6DS3 / ISM330DHCX IMU";
    case 0x6B:return "possible LSM6DS3 / ISM330DHCX IMU";
    case 0x76:return "possible BMP280 / BMP388 / BMP585 barometer";
    case 0x77:return "possible BMP280 / BMP388 / BMP585 barometer";
    default:return "";
  }
}
String hexAddress(uint8_t address){char b[5];snprintf(b,sizeof(b),"0x%02X",address);return String(b);}
static const uint8_t LSM6DS3_ADDR_PRIMARY=0x6B;
static const uint8_t LSM6DS3_ADDR_SECONDARY=0x6A;
static const uint8_t MPU6050_ADDR_PRIMARY=0x68;
static const uint8_t MPU6050_ADDR_SECONDARY=0x69;
ImuSample lastImu;bool lastImuValid=false;ImuKind detectedImu=IMU_NONE;uint8_t detectedImuAddress=0;

bool i2cProbe(uint8_t address){Wire.beginTransmission(address);return Wire.endTransmission(true)==0;}
bool i2cWriteReg(uint8_t address,uint8_t reg,uint8_t value){Wire.beginTransmission(address);Wire.write(reg);Wire.write(value);return Wire.endTransmission(true)==0;}
bool i2cReadReg(uint8_t address,uint8_t reg,uint8_t& value){Wire.beginTransmission(address);Wire.write(reg);if(Wire.endTransmission(false)!=0)return false;if(Wire.requestFrom((int)address,1,true)!=1)return false;value=Wire.read();return true;}
bool i2cReadBlock(uint8_t address,uint8_t reg,uint8_t* dst,size_t len){Wire.beginTransmission(address);Wire.write(reg);if(Wire.endTransmission(false)!=0)return false;size_t got=Wire.requestFrom((int)address,(int)len,true);if(got!=len)return false;for(size_t i=0;i<len;i++)dst[i]=Wire.read();return true;}
const char* imuName(ImuKind k){return k==IMU_LSM6DS3?"LSM6DS3":k==IMU_MPU6050?"MPU6050":"NONE";}
uint16_t imuOdrHz(ImuKind k){return k==IMU_LSM6DS3?104:k==IMU_MPU6050?250:0;}
ImuKind detectImu(uint8_t& address,uint8_t& who){
  const uint8_t lsmAddr[2]={LSM6DS3_ADDR_PRIMARY,LSM6DS3_ADDR_SECONDARY};for(uint8_t i=0;i<2;i++){uint8_t a=lsmAddr[i];if(!i2cProbe(a))continue;uint8_t w=0;if(i2cReadReg(a,0x0F,w)&&w==0x69){address=a;who=w;return IMU_LSM6DS3;}}
  const uint8_t mpuAddr[2]={MPU6050_ADDR_PRIMARY,MPU6050_ADDR_SECONDARY};for(uint8_t i=0;i<2;i++){uint8_t a=mpuAddr[i];if(!i2cProbe(a))continue;uint8_t w=0;if(i2cReadReg(a,0x75,w)&&(w==0x68||w==0x69)){address=a;who=w;return IMU_MPU6050;}}
  address=0;who=0;return IMU_NONE;
}
bool readLsm6ds3(uint8_t address,uint8_t who,ImuSample& out){
 if(!i2cWriteReg(address,0x10,0x40)||!i2cWriteReg(address,0x11,0x40))return false;delay(2);uint8_t b[12];if(!i2cReadBlock(address,0x22,b,sizeof(b)))return false;
 auto s16=[&](int i)->int16_t{return (int16_t)(((uint16_t)b[i+1]<<8)|b[i]);};out.kind=IMU_LSM6DS3;out.address=address;out.whoAmI=who;out.rawGx=s16(0);out.rawGy=s16(2);out.rawGz=s16(4);out.rawAx=s16(6);out.rawAy=s16(8);out.rawAz=s16(10);out.gx=out.rawGx*0.00875f;out.gy=out.rawGy*0.00875f;out.gz=out.rawGz*0.00875f;out.ax=out.rawAx*0.000061f;out.ay=out.rawAy*0.000061f;out.az=out.rawAz*0.000061f;out.sampledAt=millis();return true;
}
bool readMpu6050(uint8_t address,uint8_t who,ImuSample& out){
 if(!i2cWriteReg(address,0x6B,0x00))return false;delay(2);i2cWriteReg(address,0x1A,0x05);i2cWriteReg(address,0x19,0x03);i2cWriteReg(address,0x1B,0x08);i2cWriteReg(address,0x1C,0x10);uint8_t b[14];if(!i2cReadBlock(address,0x3B,b,sizeof(b)))return false;
 auto be16=[&](int i)->int16_t{return (int16_t)(((uint16_t)b[i]<<8)|b[i+1]);};out.kind=IMU_MPU6050;out.address=address;out.whoAmI=who;out.rawAx=be16(0);out.rawAy=be16(2);out.rawAz=be16(4);out.rawGx=be16(8);out.rawGy=be16(10);out.rawGz=be16(12);out.ax=out.rawAx/4096.0f-0.10f;out.ay=out.rawAy/4096.0f+0.03f;out.az=out.rawAz/4096.0f+0.12f;out.gx=out.rawGx/65.5f;out.gy=out.rawGy/65.5f;out.gz=out.rawGz/65.5f;out.sampledAt=millis();return true;
}
bool readAnyImu(ImuSample& out){
 uint8_t address=0,who=0;ImuKind kind=detectedImu;if(kind==IMU_NONE||!detectedImuAddress){kind=detectImu(address,who);}else{address=detectedImuAddress;if(kind==IMU_LSM6DS3){if(!i2cReadReg(address,0x0F,who)||who!=0x69)kind=detectImu(address,who);}else if(kind==IMU_MPU6050){if(!i2cReadReg(address,0x75,who)||(who!=0x68&&who!=0x69))kind=detectImu(address,who);}}
 if(kind==IMU_NONE)return false;bool ok=kind==IMU_LSM6DS3?readLsm6ds3(address,who,out):readMpu6050(address,who,out);if(ok){detectedImu=kind;detectedImuAddress=address;}return ok;
}
void probeImuAtBoot(){Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);delay(2);uint8_t address=0,who=0;detectedImu=detectImu(address,who);detectedImuAddress=address;Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);Serial.println(String("IMU auto-detect: ")+imuName(detectedImu)+(address?String(" @ ")+hexAddress(address):String("")));}
void imuApi(){
 if(effectiveArmed()){sendMessage(423,"IMU bench read blocked while armed");return;}
 if(FLIGHT_CONTROL_ENABLED)Wire.setClock(400000);else{Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);delay(2);}ImuSample sample;bool ok=false;for(uint8_t attempt=0;attempt<3&&!ok;attempt++){ok=readAnyImu(sample);if(!ok)delay(5);}if(!FLIGHT_CONTROL_ENABLED){Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);}else if(detectedImu==IMU_MPU6050)configureMpu6050Flight();
 if(!ok){lastImuValid=false;sendMessage(404,"Supported IMU not found. Supported: LSM6DS3 at 0x6A/0x6B and MPU6050 at 0x68/0x69. Check SDA/SCL/VCC/GND.");return;}
 lastImu=sample;lastImuValid=true;String hx=hexAddress(sample.address),sensor=imuName((ImuKind)sample.kind),whoHex=String("0x")+(sample.whoAmI<16?"0":"")+String(sample.whoAmI,HEX);whoHex.toUpperCase();
 String j="{\"ok\":true,\"source\":\"real\",\"sensor\":\""+sensor+"\",\"address\":"+String(sample.address)+",\"addressHex\":\""+hx+"\",\"whoAmI\":"+String(sample.whoAmI)+",\"whoAmIHex\":\""+whoHex+"\",\"odrHz\":"+String(imuOdrHz((ImuKind)sample.kind))+",\"accelRangeG\":"+String(sample.kind==IMU_MPU6050?8:2)+",\"gyroRangeDps\":"+String(sample.kind==IMU_MPU6050?500:245);
 j+=",\"accel\":{\"x\":"+String(sample.ax,6)+",\"y\":"+String(sample.ay,6)+",\"z\":"+String(sample.az,6)+"}";j+=",\"gyro\":{\"x\":"+String(sample.gx,4)+",\"y\":"+String(sample.gy,4)+",\"z\":"+String(sample.gz,4)+"}";j+=",\"raw\":{\"ax\":"+String(sample.rawAx)+",\"ay\":"+String(sample.rawAy)+",\"az\":"+String(sample.rawAz)+",\"gx\":"+String(sample.rawGx)+",\"gy\":"+String(sample.rawGy)+",\"gz\":"+String(sample.rawGz)+"},\"sampleMs\":"+String(sample.sampledAt)+"}";sendJson(200,j);
}
void i2cScanApi(){
  if(effectiveArmed()){sendMessage(423,"I2C scan blocked while armed");return;}
  uint32_t started=millis();int deviceCount=0,errorCount=0;String devices="[",errors="[";bool firstDevice=true,firstError=true;
  if(FLIGHT_CONTROL_ENABLED)Wire.setClock(100000);else{Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);delay(2);}Serial.println("Scanning I2C bus...\n");
  for(uint8_t address=1;address<127;address++){
    Wire.beginTransmission(address);uint8_t error=Wire.endTransmission(true);
    if(error==0){String hx=hexAddress(address),hint=i2cHint(address);Serial.print("Found device at ");Serial.println(hx);if(!firstDevice)devices+=",";firstDevice=false;devices+="{\"address\":"+String(address)+",\"addressHex\":\""+hx+"\",\"hint\":\""+jsonEscape(hint)+"\"}";deviceCount++;}
    else if(error==4){String hx=hexAddress(address);Serial.print("Unknown I2C error at ");Serial.println(hx);if(!firstError)errors+=",";firstError=false;errors+="{\"address\":"+String(address)+",\"addressHex\":\""+hx+"\",\"code\":4}";errorCount++;}
    delay(1);
  }
  devices+="]";errors+="]";uint32_t elapsed=millis()-started;if(deviceCount==0)Serial.println("No I2C devices found.\n");else{Serial.print("Total I2C devices found: ");Serial.println(deviceCount);}Serial.println("\n-----------------------------\n");
  if(FLIGHT_CONTROL_ENABLED){Wire.setClock(400000);if(detectedImu==IMU_MPU6050)configureMpu6050Flight();}else{Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);}
  String j="{\"ok\":true,\"bus\":0,\"sda\":"+String(I2C_SDA_PIN)+",\"scl\":"+String(I2C_SCL_PIN)+",\"clockHz\":100000,\"count\":"+String(deviceCount)+",\"errorCount\":"+String(errorCount)+",\"durationMs\":"+String(elapsed)+",\"devices\":"+devices+",\"errors\":"+errors+"}";sendJson(200,j);
}

// ============================================================
// Status / telemetry / commands
// ============================================================
String statusJson(const String& clientId=""){
  expireLock();bool connected=WiFi.status()==WL_CONNECTED;String mode=setupMode?"AP SETUP":"STA / LOCAL";
  String j="{\"ok\":true,\"kit\":\"ZEBJUS_FLIGHTCORE\",\"version\":\""+String(FW_VERSION)+"\",\"firmware\":\""+String(FW_VERSION)+"\",\"firmwareBuiltAt\":\""+String(FW_BUILD_DATE)+" "+String(FW_BUILD_TIME)+" UTC\"";
  j+=",\"name\":\""+jsonEscape(kitName)+"\",\"deviceName\":\""+jsonEscape(kitName)+"\",\"hostname\":\""+hostFromName(kitName)+"\",\"deviceId\":\""+deviceId+"\",\"boardId\":\""+String(BOARD_ID)+"\",\"boardName\":\""+String(BOARD_NAME)+"\"";
  j+=",\"connected\":"+String(connected?"true":"false")+",\"ssid\":\""+jsonEscape(connected?WiFi.SSID():"")+"\",\"ip\":\""+(connected?WiFi.localIP().toString():WiFi.softAPIP().toString())+"\",\"rssi\":"+String(connected?WiFi.RSSI():0);
  j+=",\"mode\":\""+mode+"\",\"armed\":"+String(effectiveArmed()?"true":"false")+",\"locked\":"+String(lockActive()?"true":"false")+",\"lockMine\":"+String(lockMine(clientId)?"true":"false")+",\"lockTimeoutMs\":"+String(LOCK_TIMEOUT_MS)+",\"benchRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"webRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"apRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"firmwareRole\":\""+String(FLIGHT_CONTROL_ENABLED?"RATE_ANGLE_FLIGHT_CORE":"WIFI_SENSOR_BRIDGE")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"escOutputs\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidWritable\":false,\"calibrationIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightMode\":\""+String(flightModeName(flightMode))+"\",\"rcSource\":\""+String(rcSourceName(activeRcSource))+"\",\"otaUpdate\":true,\"receiverHealth\":\""+receiverHealth()+"\",\"receiverPin\":"+String(PPM_RECEIVER_PIN)+",\"i2cScan\":true,\"imuRead\":true,\"imuModel\":\""+String(imuName(detectedImu))+"\",\"i2cSda\":"+String(I2C_SDA_PIN)+",\"i2cScl\":"+String(I2C_SCL_PIN)+"}";
  return j;
}
void statusApi(){sendJson(200,statusJson(server.arg("clientId")));}
void telemetryApi(){
  uint16_t rc[10];RcSourceKind src=FLIGHT_CONTROL_ENABLED?chooseRcSource():RC_PPM;copyActiveRc(rc,src);String rx=receiverHealth();uint32_t age=receiverAgeMs();
  if(!FLIGHT_CONTROL_ENABLED&&!effectiveArmed()){Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);delay(1);ImuSample sample;if(readAnyImu(sample)){lastImu=sample;lastImuValid=true;}Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);}
  bool imuFresh=lastImuValid&&(uint32_t)(millis()-lastImu.sampledAt)<2500UL;String imuHealth=lastImuValid?(imuFresh?"OK":"STALE"):"NOT_FOUND";
  String j="{\"type\":\"telemetry\",\"source\":\""+String(FLIGHT_CONTROL_ENABLED?"flight_core":"bridge")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"flightMode\":\""+String(flightModeName(flightMode))+"\",\"rcSource\":\""+String(rcSourceName(src))+"\",\"roll\":"+String(FLIGHT_CONTROL_ENABLED?kalmanRoll:0.0f,3)+",\"pitch\":"+String(FLIGHT_CONTROL_ENABLED?kalmanPitch:0.0f,3)+",\"yaw\":"+String(FLIGHT_CONTROL_ENABLED?flightYaw:0.0f,3)+",\"gyroX\":"+String(FLIGHT_CONTROL_ENABLED?rateRoll:(lastImuValid?lastImu.gx:0.0f),4)+",\"gyroY\":"+String(FLIGHT_CONTROL_ENABLED?ratePitch:(lastImuValid?lastImu.gy:0.0f),4)+",\"gyroZ\":"+String(FLIGHT_CONTROL_ENABLED?rateYaw:(lastImuValid?lastImu.gz:0.0f),4)+",\"accX\":"+String(lastImuValid?lastImu.ax:0.0f,6)+",\"accY\":"+String(lastImuValid?lastImu.ay:0.0f,6)+",\"accZ\":"+String(lastImuValid?lastImu.az:0.0f,6)+",\"imuModel\":\""+String(imuName(detectedImu))+"\",\"sampleMs\":"+String(lastImuValid?lastImu.sampledAt:0)+",\"battery\":0.0,\"armed\":"+String(effectiveArmed()?"true":"false");
  j+=",\"rc\":[";for(int i=0;i<10;i++){if(i)j+=",";j+=String(rc[i]);}j+="]";
  j+=",\"motors\":["+String((int)motorInput[0])+","+String((int)motorInput[1])+","+String((int)motorInput[2])+","+String((int)motorInput[3])+"]";
  j+=",\"rcAgeMs\":"+String(src==RC_PPM?(age==0xFFFFFFFFUL?999999UL:age):(webRcLastMs?(uint32_t)(millis()-webRcLastMs):999999UL))+",\"receiverHealth\":\""+rx+"\"";
  j+=",\"imuHealth\":\""+imuHealth+"\",\"barometerHealth\":\"NOT_FOUND\",\"lidarHealth\":\"NOT_FOUND\"";
  j+=",\"sensorHealth\":{\"imu\":\""+imuHealth+"\",\"barometer\":\"NOT_FOUND\",\"lidar\":\"NOT_FOUND\",\"receiver\":\""+rx+"\"}}";sendJson(200,j);
}
void acquireApi(){String id=server.arg("clientId");id.trim();if(id.length()<4){sendMessage(400,"Invalid browser session ID");return;}expireLock();if(!controlOwner.length()||controlOwner==id){controlOwner=id;controlExpiresAt=millis()+LOCK_TIMEOUT_MS;sendJson(200,"{\"ok\":true,\"lockMine\":true,\"lockTimeoutMs\":"+String(LOCK_TIMEOUT_MS)+"}");return;}sendMessage(423,"Another browser is controlling this kit. View-only mode is active.");}
void lockPingApi(){String id=server.arg("clientId");if(!lockMine(id)){sendMessage(423,"Control lock is no longer owned by this browser.");return;}controlExpiresAt=millis()+LOCK_TIMEOUT_MS;sendJson(200,"{\"ok\":true}");}
void releaseApi(){String id=server.arg("clientId");if(lockMine(id)){controlOwner="";controlExpiresAt=0;}sendJson(200,"{\"ok\":true}");}
int parseRcCsv(const String& csv,uint16_t out[10]){int n=0,start=0;while(n<10&&start<(int)csv.length()){int comma=csv.indexOf(',',start);String part=comma<0?csv.substring(start):csv.substring(start,comma);part.trim();if(!part.length())break;long v=part.toInt();out[n++]=(uint16_t)constrain(v,1000L,2000L);if(comma<0)break;start=comma+1;}return n;}
void commandApi(){
  String type=server.arg("type");if(type=="ping"){sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"ping\",\"message\":\"PONG from "+jsonEscape(kitName)+" / "+deviceId+"\"}");return;}
  if(!requireControl())return;
  if(type=="pid_set"){if(effectiveArmed()){sendMessage(423,"PID edit blocked while armed");return;}sendMessage(501,"Rate/Angle PID is active onboard, but browser PID write is not enabled in this release.");return;}
  if(type.startsWith("calibrate_")||type.startsWith("acc_")||type=="motor_order_test"){if(effectiveArmed()){sendMessage(423,"Calibration blocked while armed");return;}sendMessage(501,"Boot gyro calibration is active; interactive calibration/motor-test commands are not enabled yet.");return;}
  if(type=="rc_frame"){
    if(!ALLOW_WEB_RC||!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Real web/AP RC is not enabled on this board profile.");return;}
    uint16_t next[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};int count=parseRcCsv(server.arg("channels"),next);if(count<6){sendMessage(400,"rc_frame requires at least CH1..CH6");return;}
    for(int i=0;i<10;i++)webRcCh[i]=next[i];webRcLastMs=millis();RcSourceKind chosen=chooseRcSource();
    sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"rc_frame\",\"activeSource\":\""+String(rcSourceName(chosen))+"\",\"message\":\"RC frame accepted\"}");return;
  }
  sendMessage(400,"Unknown command: "+type);
}
void renameApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Rename blocked while armed");return;}String requested=normalizeDisplayName(server.arg("name"));if(requested.length()<3){sendMessage(400,"Kit Name must be at least 3 characters");return;}
  String old=kitName;if(hostFromName(requested)==hostFromName(old)){saveKitName(requested);startKitMdns();sendJson(200,"{\"ok\":true,\"status\":"+statusJson(server.arg("clientId"))+"}");return;}
  if(!startProbeMdns()){startKitMdns();sendMessage(500,"Could not check Kit Name on this Wi-Fi");return;}
  bool conflict=nameExistsOnNetwork(requested);if(conflict){saveKitName(old);startKitMdns();sendMessage(409,"That Kit Name is already in use on this Wi-Fi. Choose another name.");return;}
  saveKitName(requested);startKitMdns();sendJson(200,"{\"ok\":true,\"status\":"+statusJson(server.arg("clientId"))+"}");
}

void savedWifiApi(){
  String current=WiFi.status()==WL_CONNECTED?WiFi.SSID():"";String j="{\"ok\":true,\"profiles\":[";bool first=true;
  for(int i=0;i<MAX_WIFI;i++){if(!savedSSID[i].length())continue;if(!first)j+=",";first=false;j+="{\"ssid\":\""+jsonEscape(savedSSID[i])+"\",\"current\":"+String(savedSSID[i]==current?"true":"false")+",\"preferred\":"+String(savedSSID[i]==preferredSSID?"true":"false")+",\"passwordSaved\":"+String(savedPASS[i].length()?"true":"false")+"}";}
  j+="]}";sendJson(200,j);
}
void setWifiApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Wi-Fi change blocked while armed");return;}String ssid=server.arg("ssid"),pass=server.arg("password");ssid.trim();if(!ssid.length()){sendMessage(400,"Wi-Fi SSID is required");return;}saveWiFi(ssid,pass,true);sendMessage(200,"Wi-Fi profile saved. Kit will restart and try this network first.");restartAt=millis()+900;
}
void useWifiApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Wi-Fi change blocked while armed");return;}String ssid=server.arg("ssid");if(savedIndex(ssid)<0){sendMessage(404,"Saved Wi-Fi profile not found");return;}setPreferredWiFi(ssid);sendMessage(200,"Preferred Wi-Fi selected. Kit will restart.");restartAt=millis()+900;
}
void forgetWifiApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Wi-Fi change blocked while armed");return;}String ssid=server.arg("ssid");if(savedIndex(ssid)<0){sendMessage(404,"Saved Wi-Fi profile not found");return;}forgetSavedWiFi(ssid);sendMessage(200,"Saved Wi-Fi profile removed");
}
void resetNameApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Auto-name reset blocked while armed");return;}
  clearKitName();
  sendMessage(200,"Auto name reset. Kit will restart and choose the first free zebjus_drone_N name on this Wi-Fi.");
  restartAt=millis()+900;
}

// ============================================================
// Captive portal
// ============================================================
String portalPage(){
  String h=R"rawliteral(<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ZEBJUS F450 Setup</title><style>
*{box-sizing:border-box}body{margin:0;background:#07131d;color:#eef;font-family:system-ui,-apple-system,Arial;padding:22px}.wrap{max-width:580px;margin:auto}.logo{width:54px;height:54px;border-radius:16px;background:#14a276;display:grid;place-items:center;font-size:28px;font-weight:900}.card{background:#10212c;border:1px solid #294455;border-radius:16px;padding:18px;margin-top:16px}h1{margin:12px 0 2px}p{color:#a9bdc9;line-height:1.45}label{display:block;margin:12px 0 5px;font-size:13px;color:#bdd0dc}input,select,button,a.open{width:100%;padding:14px;border-radius:10px;border:1px solid #385568;background:#07141d;color:#fff;font-size:16px}button,a.open{background:#11936d;border:0;font-weight:800;margin-top:12px;text-decoration:none;text-align:center;display:block}button.secondary{background:#243b4a}button.danger{background:#7c2f36}.row{display:grid;grid-template-columns:1fr auto;gap:8px}.row button{width:auto;margin:0}.id{font-family:ui-monospace,monospace;color:#73d8b5}.status{white-space:pre-wrap;background:#07141d;border-radius:10px;padding:12px;min-height:54px;color:#9fe5c9}.tiny{font-size:12px;color:#7893a4}.sep{height:1px;background:#28404e;margin:18px 0}</style></head><body><div class="wrap"><div class="logo">Z</div><h1>ZEBJUS FlightCore Kit Setup</h1><p>Choose the school Wi-Fi. Leave Kit Name blank to automatically use the first free name: zebjus_drone_1, zebjus_drone_2… You can also enter a custom name.</p><div class="card"><div class="tiny">PERMANENT DEVICE ID</div><div class="id">)rawliteral";
  h+=htmlEscape(deviceId);h+=R"rawliteral(</div><div class="tiny" style="margin-top:8px">SETUP AP</div><div class="id">)rawliteral";h+=htmlEscape(apName);
  h+=R"rawliteral(</div><label>Kit Name (optional)</label><input id="name" maxlength="28" placeholder="Auto: zebjus_drone_1, zebjus_drone_2…" value=")rawliteral";h+=htmlEscape(kitName);
  h+=R"rawliteral("><label>School Wi-Fi</label><div class="row"><select id="wifi"><option value="">Tap Scan Wi-Fi</option></select><button class="secondary" onclick="scan()">Scan</button></div><label>Wi-Fi Password</label><input id="pass" type="password" autocomplete="new-password" placeholder="Enter Wi-Fi password"><button id="saveBtn" onclick="testWifi()">SAVE & TEST WI-FI</button><p class="tiny">Wrong passwords are not saved. Kit Name is checked against other ZEBJUS kits on the same Wi-Fi.</p><div id="out" class="status">Ready. Scanning Wi-Fi…</div><a id="openWeb" class="open" style="display:none" href="#">OPEN DRONE LAB</a><a class="open" style="background:#1d455d" href="/fly">OPEN DIRECT AP FLIGHT CONTROL</a><div class="sep"></div><button class="secondary" onclick="forgetWifi()">Forget All Saved Wi-Fi</button><button class="danger" onclick="factoryReset()">Factory Reset Kit</button><p class="tiny">Recovery: hold BOOT about 5 seconds then release for setup AP. Hold about 10 seconds for factory reset.</p></div></div><script>
const $=id=>document.getElementById(id),out=$('out'),wifi=$('wifi'),kitName=$('name'),pass=$('pass'),saveBtn=$('saveBtn'),openWeb=$('openWeb');let pollTimer=0;
function safeOpt(s){return String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')}
async function scan(){out.textContent='Scanning nearby Wi-Fi…';try{const r=await fetch('/api/wifi/scan',{cache:'no-store'}),d=await r.json();if(!r.ok)throw Error(d.message||'Scan failed');wifi.innerHTML=d.networks.map(x=>`<option value="${safeOpt(x.ssid)}">${safeOpt(x.ssid)} (${x.rssi} dBm)</option>`).join('')||'<option value="">No networks found</option>';out.textContent=d.networks.length+' network(s) found.'}catch(e){out.textContent=e.message||'Scan failed.'}}
async function testWifi(){const body=new URLSearchParams({name:kitName.value.trim(),ssid:wifi.value,password:pass.value});if(!body.get('ssid'))return out.textContent='Select a Wi-Fi network.';saveBtn.disabled=true;out.textContent='Testing Wi-Fi and checking Kit Name…';openWeb.style.display='none';try{const r=await fetch('/api/setup/test',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body}),d=await r.json();if(!r.ok)throw Error(d.message||'Test could not start');clearInterval(pollTimer);pollTimer=setInterval(checkTest,650);checkTest()}catch(e){saveBtn.disabled=false;out.textContent=e.message||'Test failed.'}}
async function checkTest(){try{const r=await fetch('/api/setup/test/status',{cache:'no-store'}),d=await r.json();if(d.status==='testing'){out.textContent='Testing '+(d.ssid||'Wi-Fi')+'…';return}if(d.status==='failed'){clearInterval(pollTimer);saveBtn.disabled=false;out.textContent='Setup test failed: '+(d.message||'check password / name')+'\nNothing new was saved. Setup AP remains active.';return}if(d.status==='success'){clearInterval(pollTimer);out.textContent='Wi-Fi verified ✓\nKit Name: '+d.name+'\nDevice ID: '+d.deviceId+'\n\nAfter restart, reconnect this phone/computer to the same school Wi-Fi. In Drone Lab enter exactly: '+d.name; if(d.redirect){openWeb.href=d.redirect;openWeb.style.display='block';setTimeout(()=>location.href=d.redirect,3500)}}}catch(e){}}
async function forgetWifi(){if(!confirm('Forget all saved Wi-Fi networks?'))return;await fetch('/api/wifi/reset',{method:'POST'});out.textContent='Saved Wi-Fi cleared. Kit will restart in setup mode.'}
async function factoryReset(){if(!confirm('Factory reset Kit Name and Wi-Fi?'))return;await fetch('/api/factory-reset',{method:'POST'});out.textContent='Factory reset scheduled.'}
setTimeout(scan,400);
</script></body></html>)rawliteral";
  return h;
}
String flyPage(){return R"rawliteral(<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><title>ZEBJUS Direct RC</title><style>*{box-sizing:border-box}body{margin:0;background:#07131d;color:#e9f5fb;font-family:system-ui;padding:14px;touch-action:none}.w{max-width:760px;margin:auto}.top,.card{background:#0d202c;border:1px solid #294b5d;border-radius:15px;padding:14px;margin-bottom:10px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.badge{padding:7px 10px;border-radius:999px;background:#48202a;color:#ffadba;font-weight:800;font-size:12px}.badge.ok{background:#123c30;color:#7bf0c0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.pad{height:220px;border-radius:50%;border:1px solid #375a6c;background:radial-gradient(circle,#173447 0 8%,#0a1a24 9% 65%,#07131d 66%);position:relative}.knob{position:absolute;width:54px;height:54px;border-radius:50%;background:#49dbae;box-shadow:0 6px 20px #0008;left:50%;top:50%;transform:translate(-50%,-50%)}button,select{width:100%;min-height:46px;border:0;border-radius:10px;background:#1d3949;color:#fff;font-weight:800}button.primary{background:#118b69}button.danger{background:#a92d43}.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.read{font:12px ui-monospace,monospace;color:#9ec1d2;text-align:center;margin-top:8px}.thr{width:100%}.warn{color:#f7c98d;font-size:12px;line-height:1.45}</style></head><body><div class="w"><div class="top"><div><b>ZEBJUS DIRECT RC</b><div id="info" class="read">Connecting…</div></div><span id="state" class="badge">SAFE</span></div><div class="card"><div class="row"><button id="start" class="primary">TAKE CONTROL</button><button id="arm" class="danger">ARM</button><select id="mode"><option value="1000">ANGLE</option><option value="1500">RATE</option></select></div><p class="warn">PPM receiver has priority when present. ARM requires throttle at 1000. Loss of web RC frames automatically disarms the flight core.</p></div><div class="grid"><div class="card"><div id="left" class="pad"><i class="knob"></i></div><div class="read">LEFT • YAW / THROTTLE</div></div><div class="card"><div id="right" class="pad"><i class="knob"></i></div><div class="read">RIGHT • ROLL / PITCH</div></div></div><div class="card"><button id="kill" class="danger">DISARM + THROTTLE ZERO</button><div id="ch" class="read"></div></div></div><script>const ch=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000],cid='AP-'+Math.random().toString(36).slice(2)+Date.now().toString(36);let own=false,on=false;const $=s=>document.querySelector(s),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));async function post(path,data){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)}),j=await r.json();if(!r.ok)throw Error(j.message||'Request failed');return j}async function take(){try{await post('/api/control/acquire',{clientId:cid});own=true;on=true;$('#start').textContent='CONTROL ACTIVE';$('#state').className='badge ok';$('#state').textContent='CONNECTED'}catch(e){$('#info').textContent=e.message}}$('#start').onclick=take;$('#arm').onclick=()=>{if(!own)return;if(ch[4]>1500){ch[4]=1000;$('#arm').textContent='ARM'}else if(ch[2]<=1050){ch[4]=2000;$('#arm').textContent='DISARM'}render()};$('#mode').onchange=e=>{if(ch[4]>1500){e.target.value=String(ch[5]);return}ch[5]=+e.target.value;ch[2]=1000;render()};$('#kill').onclick=()=>{ch[0]=ch[1]=ch[3]=1500;ch[2]=ch[4]=1000;$('#arm').textContent='ARM';render()};function bind(id,left){const el=$(id),k=el.querySelector('.knob');let drag=false,pid=null;function u(e){const r=el.getBoundingClientRect(),x=clamp((e.clientX-(r.left+r.width/2))/(r.width*.38),-1,1),y=clamp((e.clientY-(r.top+r.height/2))/(r.height*.38),-1,1);k.style.left=(50+x*32)+'%';k.style.top=(50+y*32)+'%';if(left){ch[3]=Math.round(1500+x*500);ch[2]=Math.round(clamp(1500-y*500,1000,2000))}else{ch[0]=Math.round(1500+x*500);ch[1]=Math.round(1500-y*500)}render()}function end(){if(!drag)return;drag=false;k.style.left='50%';if(left){ch[3]=1500}else{k.style.top='50%';ch[0]=ch[1]=1500}render()}el.onpointerdown=e=>{drag=true;pid=e.pointerId;el.setPointerCapture?.(pid);u(e)};el.onpointermove=e=>{if(drag&&e.pointerId===pid)u(e)};el.onpointerup=end;el.onpointercancel=end}bind('#left',true);bind('#right',false);function render(){$('#ch').textContent=`R ${ch[0]}  P ${ch[1]}  T ${ch[2]}  Y ${ch[3]}  ARM ${ch[4]}  MODE ${ch[5]}`}render();setInterval(async()=>{if(!on||!own)return;try{const j=await post('/api/command',{clientId:cid,type:'rc_frame',channels:ch.join(',')});$('#info').textContent='Active source: '+(j.activeSource||'WEB')}catch(e){$('#info').textContent=e.message;ch[4]=1000}},40);setInterval(async()=>{if(!own)return;try{await post('/api/control/ping',{clientId:cid})}catch(e){own=false;on=false;ch[4]=1000;$('#state').className='badge';$('#state').textContent='LOCK LOST'}},2500);</script></body></html>)rawliteral";}
void sendFlyPage(){server.sendHeader("Cache-Control","no-store");server.send(200,"text/html",flyPage());}
void sendPortal(){server.sendHeader("Cache-Control","no-store");server.sendHeader("Captive-Portal","http://192.168.4.1/");server.send(200,"text/html",portalPage());}
void redirectPortal(){server.sendHeader("Location","http://192.168.4.1/",true);server.send(302,"text/plain","");}
void wifiScanApi(){
  int n=WiFi.scanNetworks();String j="{\"ok\":true,\"networks\":[";bool first=true;
  for(int i=0;i<n;i++){String ssid=WiFi.SSID(i);if(!ssid.length())continue;if(!first)j+=",";first=false;j+="{\"ssid\":\""+jsonEscape(ssid)+"\",\"rssi\":"+String(WiFi.RSSI(i))+",\"secure\":"+String(WiFi.encryptionType(i)!=WIFI_AUTH_OPEN?"true":"false")+"}";}
  WiFi.scanDelete();j+="]}";sendJson(200,j);
}
void startWifiTestApi(){
  if(!setupMode){sendMessage(409,"Wi-Fi setup is available from AP setup mode");return;}if(wifiTestState==WT_RUNNING){sendMessage(409,"A Wi-Fi test is already running");return;}
  testName=normalizeDisplayName(server.arg("name"));testSSID=server.arg("ssid");testSSID.trim();testPASS=server.arg("password");if(testName.length()&&testName.length()<3){sendMessage(400,"Kit Name must be at least 3 characters, or leave it blank for automatic naming");return;}if(!testSSID.length()){sendMessage(400,"Wi-Fi SSID is required");return;}
  wifiTestState=WT_RUNNING;testMessage="Connecting";testRedirect="";wifiTestStarted=millis();wifiTestRestartAt=0;
  WiFi.mode(WIFI_AP_STA);WiFi.begin(testSSID.c_str(),testPASS.c_str());sendJson(202,"{\"ok\":true,\"status\":\"testing\"}");
}
void wifiTestStatusApi(){
  String st=wifiTestState==WT_RUNNING?"testing":wifiTestState==WT_SUCCESS?"success":wifiTestState==WT_FAILED?"failed":"idle";
  String j="{\"ok\":true,\"status\":\""+st+"\",\"ssid\":\""+jsonEscape(testSSID)+"\",\"name\":\""+jsonEscape(kitName)+"\",\"deviceId\":\""+deviceId+"\",\"message\":\""+jsonEscape(testMessage)+"\",\"redirect\":\""+jsonEscape(testRedirect)+"\"}";sendJson(200,j);
}
void processWifiTest(){
  if(wifiTestState!=WT_RUNNING)return;
  if(WiFi.status()==WL_CONNECTED){
    Serial.println("Wi-Fi test connected: "+WiFi.localIP().toString());
    if(!startProbeMdns()){wifiTestState=WT_FAILED;testMessage="Could not check Kit Name on this Wi-Fi";WiFi.disconnect(false,false);return;}
    delay(180);int count=MDNS.queryService("zebjus-drone","tcp");
    if(!testName.length())testName=chooseFreeAutoNameFromCurrentQuery(count);
    else{for(int i=0;i<count;i++)if(queryResultIsName(i,testName,false)){wifiTestState=WT_FAILED;testMessage="Kit Name already exists on this Wi-Fi. Choose another name or leave it blank for automatic naming.";MDNS.end();mdnsStarted=false;WiFi.disconnect(false,false);return;}}
    MDNS.end();mdnsStarted=false;saveKitName(testName);autoNameRequired=false;saveWiFi(testSSID,testPASS,true);testRedirect=optionalWebappUrl();testMessage="Wi-Fi verified and saved";wifiTestState=WT_SUCCESS;wifiTestRestartAt=millis()+7500;Serial.println("Setup verified. Saved Kit Name: "+kitName);return;
  }
  if(millis()-wifiTestStarted>CONNECT_TIMEOUT_MS){wifiTestState=WT_FAILED;testMessage="Could not connect. Check password and signal.";WiFi.disconnect(false,false);WiFi.mode(WIFI_AP_STA);}
}

bool allowDisruptiveAdminAction(const char* action){
  if(setupMode)return true;
  if(!requireControl())return false;
  if(effectiveArmed()){sendMessage(423,String(action)+" blocked while armed");return false;}
  return true;
}
void resetWifiApi(){if(!allowDisruptiveAdminAction("Wi-Fi reset"))return;clearSavedWiFi();sendMessage(200,"Saved Wi-Fi cleared; restarting in setup mode");setForceSetupFlag(true);restartAt=millis()+700;}
void factoryResetApi(){if(!allowDisruptiveAdminAction("Factory reset"))return;factoryResetAll();setForceSetupFlag(true);sendMessage(200,"Factory reset scheduled");restartAt=millis()+700;}

// ============================================================
// Firmware update / reboot
// ============================================================
void firmwareInfoApi(){
  String j="{\"ok\":true,\"product\":\"ZEBJUS_FLIGHTCORE\",\"firmware\":\""+String(FW_VERSION)+"\",\"firmwareBuiltAt\":\""+String(FW_BUILD_DATE)+" "+String(FW_BUILD_TIME)+" UTC\",\"boardId\":\""+String(BOARD_ID)+"\",\"boardName\":\""+String(BOARD_NAME)+"\",\"flashBytes\":"+String(ESP.getFlashChipSize())+",\"freeSketchBytes\":"+String(ESP.getFreeSketchSpace())+",\"ota\":true,\"firmwareRole\":\""+String(FLIGHT_CONTROL_ENABLED?"RATE_ANGLE_FLIGHT_CORE":"WIFI_SENSOR_BRIDGE")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"escOutputs\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidWritable\":false,\"calibrationIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"webRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"ppmRc\":true,\"i2cScan\":true,\"imuRead\":true,\"imuModel\":\""+String(imuName(detectedImu))+"\",\"i2cSda\":"+String(I2C_SDA_PIN)+",\"i2cScl\":"+String(I2C_SCL_PIN)+",\"armed\":"+String(effectiveArmed()?"true":"false")+"}";sendJson(200,j);
}
void rebootApi(){
  if(!requireControl())return;if(effectiveArmed()){sendMessage(423,"Reboot blocked while armed");return;}sendMessage(200,"Reboot scheduled");restartAt=millis()+850;
}
void firmwareUploadDone(){
  if(!firmwareUploadActive){sendMessage(400,"No firmware upload was started");return;}
  if(!firmwareUploadSuccess){String m=firmwareUploadError.length()?firmwareUploadError:"Firmware update failed";firmwareUploadActive=false;sendMessage(500,m);return;}
  String j="{\"ok\":true,\"message\":\"Firmware written successfully; rebooting\",\"bytes\":"+String(firmwareUploadBytes)+",\"file\":\""+jsonEscape(firmwareUploadName)+"\",\"rebooting\":true}";sendJson(200,j);firmwareUploadActive=false;restartAt=millis()+1100;
}
void firmwareUploadHandler(){
  HTTPUpload& upload=server.upload();
  if(upload.status==UPLOAD_FILE_START){
    firmwareUploadActive=true;firmwareUploadSuccess=false;firmwareUploadError="";firmwareUploadName=upload.filename;firmwareUploadBytes=0;
    if(effectiveArmed()){firmwareUploadError="Firmware update blocked while armed";return;}
    String targetBoard=server.arg("boardId");targetBoard.trim();if(targetBoard.length()&&targetBoard!=String(BOARD_ID)){firmwareUploadError="Firmware board profile mismatch";return;}
    if(!controlAuthorized()){firmwareUploadError=lockActive()?"Another browser controls this kit":"Take Control before firmware update";return;}
    if(!Update.begin(UPDATE_SIZE_UNKNOWN,U_FLASH)){firmwareUploadError=String("Update begin failed: ")+Update.errorString();return;}
    Serial.println("Firmware upload started: "+firmwareUploadName);
  }else if(upload.status==UPLOAD_FILE_WRITE){
    if(firmwareUploadError.length())return;
    size_t written=Update.write(upload.buf,upload.currentSize);firmwareUploadBytes+=written;
    if(written!=upload.currentSize)firmwareUploadError=String("Flash write failed: ")+Update.errorString();
  }else if(upload.status==UPLOAD_FILE_END){
    if(firmwareUploadError.length()){Update.abort();return;}
    if(!Update.end(true)){firmwareUploadError=String("Firmware finalize failed: ")+Update.errorString();return;}
    firmwareUploadSuccess=true;Serial.printf("Firmware upload complete: %u bytes\n",(unsigned)firmwareUploadBytes);
  }else if(upload.status==UPLOAD_FILE_ABORTED){
    Update.abort();firmwareUploadError="Firmware upload aborted";Serial.println("Firmware upload aborted");
  }
}

// ============================================================
// Routes / modes
// ============================================================
void setupRoutes(){
  const char* headers[]={"X-Zebjus-Control"};server.collectHeaders(headers,1);
  server.on("/",HTTP_GET,[](){if(setupMode)sendPortal();else statusApi();});server.on("/fly",HTTP_GET,sendFlyPage);
  server.on("/api/status",HTTP_GET,statusApi);server.on("/api/telemetry",HTTP_GET,telemetryApi);server.on("/api/i2c/scan",HTTP_GET,i2cScanApi);server.on("/api/imu",HTTP_GET,imuApi);
  server.on("/api/control/acquire",HTTP_POST,acquireApi);server.on("/api/control/ping",HTTP_POST,lockPingApi);server.on("/api/control/release",HTTP_POST,releaseApi);
  server.on("/api/command",HTTP_POST,commandApi);server.on("/api/name",HTTP_POST,renameApi);server.on("/api/name/reset",HTTP_POST,resetNameApi);
  server.on("/api/wifi/scan",HTTP_GET,wifiScanApi);server.on("/api/wifi/saved",HTTP_GET,savedWifiApi);server.on("/api/wifi/set",HTTP_POST,setWifiApi);server.on("/api/wifi/use",HTTP_POST,useWifiApi);server.on("/api/wifi/forget",HTTP_POST,forgetWifiApi);server.on("/api/setup/test",HTTP_POST,startWifiTestApi);server.on("/api/setup/test/status",HTTP_GET,wifiTestStatusApi);
  server.on("/api/wifi/reset",HTTP_POST,resetWifiApi);
  server.on("/api/factory-reset",HTTP_POST,factoryResetApi);
  server.on("/api/firmware/info",HTTP_GET,firmwareInfoApi);
  server.on("/api/reboot",HTTP_POST,rebootApi);
  server.on("/api/firmware/update",HTTP_POST,firmwareUploadDone,firmwareUploadHandler);
  // Captive portal probes
  server.on("/generate_204",HTTP_GET,sendPortal);server.on("/gen_204",HTTP_GET,sendPortal);server.on("/hotspot-detect.html",HTTP_GET,sendPortal);server.on("/library/test/success.html",HTTP_GET,sendPortal);server.on("/connecttest.txt",HTTP_GET,sendPortal);server.on("/ncsi.txt",HTTP_GET,sendPortal);server.on("/fwlink",HTTP_GET,sendPortal);server.on("/redirect",HTTP_GET,sendPortal);server.on("/canonical.html",HTTP_GET,sendPortal);server.on("/success.txt",HTTP_GET,sendPortal);
  server.onNotFound([](){if(server.method()==HTTP_OPTIONS){cors();server.send(204);return;}if(setupMode){redirectPortal();return;}sendMessage(404,"Not found");});
}
void startNormalServer(){
  setupMode=false;dnsServer.stop();WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.setSleep(false);ensureUniqueKitName();server.begin();wifiLostAt=0;
  Serial.println("==============================");Serial.println("ZEBJUS FlightCore V18.3.40 LOCAL MODE");Serial.println("Controller: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]");Serial.println("Device ID: "+deviceId);Serial.println("Kit Name : "+kitName);Serial.println("SSID     : "+WiFi.SSID());Serial.println("IP       : "+WiFi.localIP().toString());Serial.println("mDNS     : http://"+hostFromName(kitName)+".local");
}
void startSetupMode(){
  setupMode=true;controlOwner="";controlExpiresAt=0;if(mdnsStarted){MDNS.end();mdnsStarted=false;}WiFi.disconnect(false,false);delay(120);WiFi.mode(WIFI_AP_STA);WiFi.setSleep(false);updateApName();WiFi.softAPConfig(AP_IP,AP_GATEWAY,AP_SUBNET);bool ok=WiFi.softAP(apName.c_str(),AP_PASSWORD);dnsServer.start(DNS_PORT,"*",AP_IP);server.begin();wifiTestState=WT_IDLE;
  Serial.println("==============================");Serial.println("ZEBJUS FlightCore SETUP MODE");Serial.println("AP Status: "+String(ok?"STARTED":"FAILED"));Serial.println("SSID     : "+apName);Serial.println("Password : "+String(AP_PASSWORD));Serial.println("Setup    : http://192.168.4.1");Serial.println("Controller: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]");Serial.println("Device ID: "+deviceId);Serial.println("Kit Name : "+kitName);
}

// ============================================================
// Recovery / runtime
// ============================================================
void checkRecoveryButton(){
  if(RECOVERY_BUTTON_PIN<0)return;int state=digitalRead(RECOVERY_BUTTON_PIN);
  if(state==LOW){if(!recoveryPressedAt)recoveryPressedAt=millis();unsigned long held=millis()-recoveryPressedAt;if(held>=FACTORY_RESET_HOLD_MS&&!factoryResetTriggered){factoryResetTriggered=true;Serial.println("BOOT 10s -> FACTORY RESET");factoryResetAll();setForceSetupFlag(true);delay(150);ESP.restart();}}
  else if(recoveryPressedAt){unsigned long held=millis()-recoveryPressedAt;recoveryPressedAt=0;if(!factoryResetTriggered&&held>=FORCE_AP_HOLD_MS){Serial.println("BOOT 5s release -> FORCE SETUP AP");setForceSetupFlag(true);delay(120);ESP.restart();}factoryResetTriggered=false;}
}
void networkHealth(){
  if(setupMode)return;if(WiFi.status()==WL_CONNECTED){wifiLostAt=0;return;}if(effectiveArmed())return;if(!wifiLostAt)wifiLostAt=millis();if(millis()-wifiLostAt>WIFI_LOST_TO_SETUP_MS){Serial.println("Wi-Fi unavailable -> setup AP recovery");setForceSetupFlag(true);delay(100);ESP.restart();}
}

void setup(){
  Serial.begin(115200);delay(300);WiFi.persistent(false);WiFi.setAutoReconnect(true);if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);if(ENABLE_PPM_RECEIVER&&PPM_RECEIVER_PIN>=0){pinMode(PPM_RECEIVER_PIN,INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(PPM_RECEIVER_PIN),ppmIsr,RISING);}
  deviceId=getDeviceId();loadKitName();loadSavedWiFi();probeImuAtBoot();setupFlightCore();setupRoutes();
  Serial.println("\n==============================\nZEBJUS FlightCore V18.3.40 LOCAL Wi-Fi + I2C\nBoard: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]\nID: "+deviceId+"\n==============================");
  if(consumeForceSetupFlag()){startSetupMode();return;}
  if(connectSavedWiFi())startNormalServer();else startSetupMode();
}
void loop(){
  runFlightLoop();server.handleClient();if(setupMode)dnsServer.processNextRequest();expireLock();processWifiTest();checkRecoveryButton();networkHealth();
  if(wifiTestState==WT_SUCCESS&&wifiTestRestartAt&&(long)(millis()-wifiTestRestartAt)>=0){disarmFlight("restart");ESP.restart();}
  if(restartAt&&(long)(millis()-restartAt)>=0){disarmFlight("restart");ESP.restart();}
  yield();
}
