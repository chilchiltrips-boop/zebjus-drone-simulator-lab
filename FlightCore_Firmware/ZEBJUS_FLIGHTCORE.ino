/*
  ZEBJUS FlightCore V18.3.60 - RATE/ANGLE FLIGHT CORE + PYTHON CONTROL LAB

  Connection model copied from the proven ZEBJUS Python Lab approach:
    - Saved Wi-Fi -> direct STA connection on boot.
    - No cloud/server is required to find or control the kit on the same LAN.
    - Kit is reached by Kit Name through mDNS: http://<kit-name>.local
    - Webapp caches the last good DHCP IP, then falls back to mDNS.
    - /api/status always exposes permanent Device ID so a cached IP can never
      silently connect to the wrong physical kit.
    - Captive AP is used for first-time setup, Wi-Fi recovery or a selected AP mode.

  First use:
    1. Power kit. If no valid saved Wi-Fi exists it starts a setup AP.
    2. Join ZEBJUS-FC-<full Device ID suffix>, using the unique key printed
       to Serial on first boot. Record the credentials on the case.
    3. Choose Kit Name + Wi-Fi + password and press SAVE & TEST.
    4. Password is saved only after a real STA connection succeeds.
    5. On restart, kit joins that Wi-Fi and advertises <kit-name>.local.
    6. In Drone Lab enter the same Kit Name once. Future reconnect uses cached IP
       first and mDNS as fallback.

  Multi-user rule:
    - One browser may hold the real-kit control lock at a time.
    - Everyone else stays view-only and can still use the simulator.
    - Browser sends lock heartbeat; lock auto-releases after 10 seconds.

  Network modes:
    - Settings can select persistent AP while disarmed; the AP page can return
      to saved Wi-Fi without reaching the enclosed board's BOOT button.
    - If saved Wi-Fi is unavailable at boot or lost while disarmed, AP starts
      automatically and stays selected until saved Wi-Fi is chosen in the AP
      portal. The physical BOOT recovery remains optional.

  Required libraries:
    - Supported vendor Arduino core 3.3.x
    - No WebSockets / cloud library required for same-Wi-Fi access.
*/

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <ESPmDNS.h>
#include <Preferences.h>
#include <esp_random.h>
#include <string.h>
#include <Update.h>
#include <Wire.h>
#include <freertos/FreeRTOS.h>
#include <freertos/task.h>
#include "ZEBJUS_FLIGHTCORE_TYPES.h"
#if defined(CONFIG_IDF_TARGET_ESP32C6)
#include "src/DroneGPS.h" // Bundled u-blox 7/NEO-7 driver; no external library install.
#endif

// ---------------- General ----------------
static const char* FW_VERSION="18.3.60";
static const char* FW_BUILD_DATE=__DATE__;
static const char* FW_BUILD_TIME=__TIME__;

// ZEBJUS board identity. The silicon family stays an internal implementation detail;
// browser/API users see only stable ZEBJUS FlightCore profile names.
#if defined(CONFIG_IDF_TARGET_ESP32C3)
static const char* BOARD_ID="ZFC-A1";
static const char* BOARD_NAME="ZEBJUS FlightCore Bridge";
static const int RECOVERY_BUTTON_PIN=9;
static const int DEFAULT_PPM_RECEIVER_PIN=18;
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=false; // A1 stays bridge-only until its motor-pin map is confirmed.
static const int MOTOR_PINS[4]={-1,-1,-1,-1};
#elif defined(CONFIG_IDF_TARGET_ESP32C6)
static const char* BOARD_ID="ZFC-A2";
static const char* BOARD_NAME="ZEBJUS Aerion F1";
static const int RECOVERY_BUTTON_PIN=9;
static const int DEFAULT_PPM_RECEIVER_PIN=16; // XIAO D6; GPIO18/D10 is selectable if the kit is wired that way.
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=true;
static const int MOTOR_PINS[4]={D1,D2,D3,D0}; // M1,M2,M3,M4 exactly as the proven FC sketches.
#else
static const char* BOARD_ID="ZFC-DEV";
static const char* BOARD_NAME="ZEBJUS FlightCore Developer";
static const int RECOVERY_BUTTON_PIN=9;
static const int DEFAULT_PPM_RECEIVER_PIN=18;
static const int I2C_SDA_PIN=SDA;
static const int I2C_SCL_PIN=SCL;
static const bool FLIGHT_CONTROL_ENABLED=false;
static const int MOTOR_PINS[4]={-1,-1,-1,-1};
#endif

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
static const bool ALLOW_WEB_RC=true; // Browser/AP/Python RC requires the control lock. Fresh web RC owns the source; PPM is automatic fallback.

// Physical transmitter / PPM receiver mirror.
// The board profile above owns the receiver pin so future FlightCore boards can route it differently.
static const bool ENABLE_PPM_RECEIVER=true;
static const uint32_t PPM_SYNC_US=3000;
static const uint32_t PPM_MIN_US=750;
static const uint32_t PPM_MAX_US=2250;
static const uint32_t PPM_STALE_US=300000;
static const uint32_t WEB_RC_STALE_MS=300;
static const uint32_t FLIGHT_LOOP_US=4000;
static const uint32_t ARMED_LOOP_GAP_LIMIT_US=30000; // Disarm after a long scheduler/HTTP stall; arming needs a new CH5 low cycle.
static const uint32_t ARM_GESTURE_HOLD_MS=1000;
static const uint32_t IDLE_AUTO_DISARM_MS=15000; // Only at minimum throttle; centred sticks in flight never disarm.

// Optional: after successful AP setup, show/open your hosted webapp automatically.
// Example: "https://lab.zebjus.com". Leave blank until the final URL is known.
static const char* WEBAPP_URL="";

IPAddress AP_IP(192,168,4,1),AP_GATEWAY(192,168,4,1),AP_SUBNET(255,255,255,0);
WebServer server(80);
DNSServer dnsServer;
Preferences prefs;

// ---------------- Identity / Wi-Fi ----------------
String deviceId,kitName,apName,apPassword;
bool autoNameRequired=false;
static const int MAX_WIFI=4;
String savedSSID[MAX_WIFI],savedPASS[MAX_WIFI],preferredSSID;
bool setupMode=false,mdnsStarted=false;volatile bool armed=false;
unsigned long wifiLostAt=0,restartAt=0;

// ---------------- Control lock ----------------
String controlOwner="";
unsigned long controlExpiresAt=0;

// Explicit forward declarations keep this sketch independent of Arduino's auto-prototype ordering.
bool i2cWriteReg(uint8_t address,uint8_t reg,uint8_t value);
bool i2cReadReg(uint8_t address,uint8_t reg,uint8_t& value);
bool i2cReadBlock(uint8_t address,uint8_t reg,uint8_t* dst,size_t len);
bool readAnyImu(ImuSample& out);
void disarmFlight(const char* reason);
bool webRcFresh();
void setCalibrationDefaults();

// ---------------- Physical PPM receiver ----------------
int ppmReceiverPin=DEFAULT_PPM_RECEIVER_PIN;
volatile uint16_t ppmCh[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
volatile uint16_t ppmPending[10]={};
volatile uint8_t ppmIndex=0;
volatile bool ppmInvalidFrame=false;
volatile uint32_t ppmLastEdgeUs=0,ppmLastFrameUs=0,ppmFrames=0;

// ---------------- Rate/Angle flight core (A2 / XIAO ESP32-C6) ----------------
uint16_t webRcCh[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
unsigned long webRcLastMs=0;
RcSourceKind activeRcSource=RC_NONE,lastRcSource=RC_NONE;
FlightModeKind flightMode=FLIGHT_ANGLE,lastFlightMode=FLIGHT_ANGLE;
bool flightReady=false,armLowSeen=false,escPwmReady=false;
uint32_t flightLoopTimerUs=0,flightLoopCount=0,imuFaultCount=0;
uint32_t maxFlightLoopGapUs=0,flightLoopOverruns=0;
volatile uint32_t flightHeartbeatUs=0;
volatile bool flightWatchdogTripped=false;
volatile uint32_t flightWatchdogTrips=0;
uint32_t webRcFrames=0,ppmFrameHz=0,webRcFrameHz=0,flightLoopHz=0;
uint32_t rateWindowMs=0,rateLastPpmFrames=0,rateLastWebFrames=0,rateLastFlightLoops=0;
float rateRoll=0,ratePitch=0,rateYaw=0,gyroBiasRoll=0,gyroBiasPitch=0,gyroBiasYaw=0;
float accelOffsetX=-0.10f,accelOffsetY=0.03f,accelOffsetZ=0.12f,levelTrimRoll=0.0f,levelTrimPitch=0.0f;
float accX=0,accY=0,accZ=0,accAngleRoll=0,accAnglePitch=0,kalmanRoll=0,kalmanPitch=0,flightYaw=0,kalmanRollUnc=4,kalmanPitchUnc=4;
float motorInput[4]={1000,1000,1000,1000};
// Dedicated ESC outputs are the four XIAO motor pads D0..D3. A permutation maps
// CC3D top view: M1 front-left, M2 front-right, M3 rear-right, M4 rear-left.
// Verify physical ESC wiring against this layout; saved NVS routing can override the defaults.
uint8_t motorSlots[4]={1,2,3,0}; // M1=D1, M2=D2, M3=D3, M4=D0
bool ppmEdgeFalling=false,ppmReverse[4]={false,false,false,false};
bool ppmYawStickArm=true; // Physical PPM: yaw right arms, yaw left disarms. Web/AP/Python keep CH5.
uint32_t yawGestureStartedMs=0,idleLastMovementMs=0;
int8_t yawGesture=0;
bool yawGestureLatched=false;
uint16_t idleRcLast[4]={1500,1500,1000,1500};
int servoPin=-1,gpsRxPin=-1,gpsTxPin=-1;bool gpsUbx10Hz=false;uint8_t auxOutputMask=0;uint8_t matrixAddress=0x70,matrixRows[8]={0};
bool servoAttached=false,gpsReady=false;int servoPulseUs=1500;String gpsLine="",gpsLastSentence="";uint32_t gpsSentences=0,gpsLastMs=0;
uint32_t gpsMeasuredHz=0,gpsEpochsThisSecond=0,gpsRateWindowMs=0;
#if defined(CONFIG_IDF_TARGET_ESP32C6)
DroneGPS* gpsDriver=nullptr;
#endif

float prevRateErrRoll=0,prevRateErrPitch=0,prevRateErrYaw=0,iRateRoll=0,iRatePitch=0,iRateYaw=0;
float prevAngleErrRoll=0,prevAngleErrPitch=0,iAngleRoll=0,iAnglePitch=0;
unsigned long lastFlightSampleMs=0,lastSourceChangeMs=0;
FlightPidSettings flightPid;
volatile BenchModeKind benchMode=BENCH_NONE;
uint8_t benchMotor=0,benchSequenceMotor=0,benchEscStage=0;
uint16_t benchPulse=1000;
unsigned long benchUntilMs=0,benchStageUntilMs=0;

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
void updateApName(){apName="ZEBJUS-FC-"+deviceId.substring(4);}
void loadApPassword(){
  // Fixed AP credential requested for classroom kits. Migrate an older saved
  // random credential on the next boot; avoid rewriting NVS on every startup.
  static const char* requestedPassword="12345678";
  apPassword=requestedPassword;
  prefs.begin("zjap",false);
  if(prefs.getString("pass","")!=apPassword)prefs.putString("pass",apPassword);
  prefs.end();
}
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
void setPreferredApMode(bool on){prefs.begin("zjsys",false);if(on)prefs.putBool("preferap",true);else prefs.remove("preferap");prefs.end();}
bool preferredApMode(){prefs.begin("zjsys",true);bool on=prefs.getBool("preferap",false);prefs.end();return on;}
void factoryResetAll(){clearSavedWiFi();clearKitName();prefs.begin("zjsys",false);prefs.clear();prefs.end();prefs.begin("zjpid",false);prefs.clear();prefs.end();prefs.begin("zjcal",false);prefs.clear();prefs.end();prefs.begin("zjio",false);prefs.clear();prefs.end();setCalibrationDefaults();}

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
void expireLock(){if(controlOwner.length()&&(long)(millis()-controlExpiresAt)>=0){if(webRcFresh()||activeRcSource==RC_WEB_AP||activeRcSource==RC_WEB_STA)disarmFlight("control lock expired");armLowSeen=false;webRcLastMs=0;Serial.println("Control lock expired");controlOwner="";controlExpiresAt=0;}}
bool lockMine(const String& id){expireLock();return id.length()&&controlOwner==id;}
bool lockActive(){expireLock();return controlOwner.length();}
bool controlAuthorized(){String id=server.arg("clientId");if(lockMine(id)){controlExpiresAt=millis()+LOCK_TIMEOUT_MS;return true;}return false;}
bool requireControl(){if(server.hasArg("expectedDeviceId")&&!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){sendMessage(409,"Device ID mismatch: this request belongs to another kit");return false;}if(controlAuthorized())return true;sendMessage(lockActive()?423:409,lockActive()?"Kit is controlled by another browser. View-only mode is active.":"Take Control before changing real hardware.");return false;}

// ============================================================
// Physical PPM receiver
// ============================================================
void IRAM_ATTR ppmIsr(){
  uint32_t now=micros(),dt=now-ppmLastEdgeUs;ppmLastEdgeUs=now;
  if(dt>PPM_SYNC_US){
    // Publish a complete frame only. CH5/CH6 may never inherit a previous frame.
    if(!ppmInvalidFrame&&ppmIndex>=6){
      for(int i=0;i<10;i++)ppmCh[i]=i<ppmIndex?ppmPending[i]:((i==8)?1500:1000);
      ppmLastFrameUs=now;ppmFrames++;
    }
    ppmIndex=0;ppmInvalidFrame=false;return;
  }
  if(dt<PPM_MIN_US||dt>PPM_MAX_US||ppmIndex>=10){ppmInvalidFrame=true;return;}
  if(!ppmInvalidFrame)ppmPending[ppmIndex++]=(uint16_t)dt;
}
bool receiverFresh(){if(!ENABLE_PPM_RECEIVER||!ppmLastFrameUs)return false;return (uint32_t)(micros()-ppmLastFrameUs)<PPM_STALE_US;}
uint32_t receiverAgeMs(){if(!ppmLastFrameUs)return 0xFFFFFFFFUL;return (uint32_t)(micros()-ppmLastFrameUs)/1000UL;}
String receiverHealth(){if(!ENABLE_PPM_RECEIVER||!ppmFrames)return "NOT_FOUND";return receiverFresh()?"OK":"STALE";}
void copyReceiver(uint16_t out[10]){noInterrupts();for(int i=0;i<10;i++)out[i]=ppmCh[i];interrupts();for(int i=0;i<4;i++)if(ppmReverse[i])out[i]=3000-out[i];}
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
void updateControlRates(){uint32_t now=millis(),elapsed=now-rateWindowMs;if(elapsed<1000)return;uint32_t ppmCount;noInterrupts();ppmCount=ppmFrames;interrupts();ppmFrameHz=(uint32_t)((uint64_t)(ppmCount-rateLastPpmFrames)*1000/elapsed);webRcFrameHz=(uint32_t)((uint64_t)(webRcFrames-rateLastWebFrames)*1000/elapsed);flightLoopHz=(uint32_t)((uint64_t)(flightLoopCount-rateLastFlightLoops)*1000/elapsed);rateLastPpmFrames=ppmCount;rateLastWebFrames=webRcFrames;rateLastFlightLoops=flightLoopCount;rateWindowMs=now;}
RcSourceKind chooseRcSource(){if(webRcFresh())return setupMode?RC_WEB_AP:RC_WEB_STA;if(receiverFresh())return RC_PPM;return RC_NONE;}
void copyActiveRc(uint16_t out[10],RcSourceKind src){if(src==RC_PPM){copyReceiver(out);return;}if(src==RC_WEB_AP||src==RC_WEB_STA){for(int i=0;i<10;i++)out[i]=webRcCh[i];return;}for(int i=0;i<10;i++)out[i]=(i==2||i==4||i==5||i==6||i==7||i==9)?1000:1500;}
void resetFlightPid(){prevRateErrRoll=prevRateErrPitch=prevRateErrYaw=0;iRateRoll=iRatePitch=iRateYaw=0;prevAngleErrRoll=prevAngleErrPitch=0;iAngleRoll=iAnglePitch=0;}
float pidStep(float error,float kp,float ki,float kd,float& prevErr,float& iTerm){const float dt=.004f;float p=kp*error;iTerm+=ki*(error+prevErr)*dt*.5f;iTerm=constrain(iTerm,-400.0f,400.0f);float d=kd*(error-prevErr)/dt;prevErr=error;return constrain(p+iTerm+d,-400.0f,400.0f);}
void kalmanStep(float& state,float& uncertainty,float rate,float measurement){const float dt=.004f;state+=dt*rate;uncertainty+=dt*dt*16.0f;float gain=uncertainty/(uncertainty+9.0f);state+=gain*(measurement-state);uncertainty=(1.0f-gain)*uncertainty;}
// 250 Hz, 12-bit duty: 4096 / 4000 = 1.024 ticks per microsecond.
// Bench/safe outputs use microseconds; the proven flight mixer writes duty ticks directly.
uint32_t escDutyFromUs(int us){return (uint32_t)((uint64_t)constrain(us,1000,2000)*4096UL+2000UL)/4000UL;}
uint32_t servoDutyFromUs(int us){return (uint32_t)((uint64_t)constrain(us,1000,2000)*4096UL+10000UL)/20000UL;}
int motorPinForIndex(int i){if(i<0||i>3)return -1;
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  static const int pads[4]={D0,D1,D2,D3};return pads[motorSlots[i]];
#else
  return MOTOR_PINS[i];
#endif
}
bool motorSlotsValid(const uint8_t m[4]){bool seen[4]={false,false,false,false};for(int i=0;i<4;i++){if(m[i]>3||seen[m[i]])return false;seen[m[i]]=true;}return true;}
bool auxPinAllowed(int pin){
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  return pin!=ppmReceiverPin&&(pin==D7||pin==D8||pin==D9||pin==D10);
#else
  (void)pin;return false;
#endif
}
bool ppmPinAllowed(int pin){
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  return pin==D6||pin==D10;
#else
  return pin==DEFAULT_PPM_RECEIVER_PIN;
#endif
}
int auxPinIndex(int pin){
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  const int pins[4]={D7,D8,D9,D10};for(int i=0;i<4;i++)if(pin==pins[i])return i;
#endif
  return -1;
}
bool auxOutputActive(int pin){int i=auxPinIndex(pin);return i>=0&&(auxOutputMask&(1u<<i));}
String auxOutputsJson(){String j="[";bool first=true;
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  const int pins[4]={D7,D8,D9,D10};for(int i=0;i<4;i++)if(auxOutputMask&(1u<<i)){if(!first)j+=",";first=false;j+=String(pins[i]);}
#endif
  return j+"]";}
void saveExpansionSettings(){prefs.begin("zjio",false);for(int i=0;i<4;i++){String k="m"+String(i);prefs.putUChar(k.c_str(),motorSlots[i]);}prefs.putInt("ppmpin",ppmReceiverPin);prefs.putBool("edge",ppmEdgeFalling);prefs.putBool("yawarm",ppmYawStickArm);for(int i=0;i<4;i++){String k="r"+String(i);prefs.putBool(k.c_str(),ppmReverse[i]);}prefs.putInt("servo",servoPin);prefs.putInt("gps",gpsRxPin);prefs.putInt("gpstx",gpsTxPin);prefs.putBool("gpsubx",gpsUbx10Hz);prefs.putUChar("matrix",matrixAddress);prefs.end();}
void loadExpansionSettings(){prefs.begin("zjio",true);uint8_t next[4];for(int i=0;i<4;i++){String k="m"+String(i);next[i]=prefs.getUChar(k.c_str(),motorSlots[i]);}if(motorSlotsValid(next))for(int i=0;i<4;i++)motorSlots[i]=next[i];int ppm=prefs.getInt("ppmpin",DEFAULT_PPM_RECEIVER_PIN);if(ppmPinAllowed(ppm))ppmReceiverPin=ppm;ppmEdgeFalling=prefs.getBool("edge",false);ppmYawStickArm=prefs.getBool("yawarm",true);for(int i=0;i<4;i++){String k="r"+String(i);ppmReverse[i]=prefs.getBool(k.c_str(),false);}int sv=prefs.getInt("servo",-1),gp=prefs.getInt("gps",-1),gt=prefs.getInt("gpstx",-1);if(auxPinAllowed(sv))servoPin=sv;if(auxPinAllowed(gp)&&gp!=servoPin)gpsRxPin=gp;gpsUbx10Hz=prefs.getBool("gpsubx",false);if(gpsUbx10Hz&&gpsRxPin>=0&&auxPinAllowed(gt)&&gt!=gpsRxPin&&gt!=servoPin)gpsTxPin=gt;else if(gpsUbx10Hz){gpsRxPin=-1;gpsUbx10Hz=false;}uint8_t adr=prefs.getUChar("matrix",0x70);if(adr>=0x70&&adr<=0x77)matrixAddress=adr;prefs.end();}
void setupExpansionPeripherals(){
#if defined(CONFIG_IDF_TARGET_ESP32C6)
 if(servoPin>=0){servoAttached=ledcAttachChannel(servoPin,50,12,4);if(servoAttached&&(!escPwmReady||ledcReadFreq(motorPinForIndex(0))==250))ledcWrite(servoPin,servoDutyFromUs(1500));else{if(servoAttached)ledcDetach(servoPin);servoAttached=false;servoPin=-1;}}
 if(gpsRxPin>=0){
   if(gpsUbx10Hz&&gpsTxPin>=0){
     gpsDriver=new DroneGPS(Serial1,gpsRxPin,gpsTxPin);
     gpsReady=gpsDriver->begin(&Serial,38400,9600,3,350);
     if(!gpsReady)Serial.println(String("DroneGPS configuration failed: ")+DroneGPS::configErrorText(gpsDriver->configurationReport().error));
   }else{Serial1.begin(9600,SERIAL_8N1,gpsRxPin,-1);gpsReady=true;}
   gpsRateWindowMs=millis();
 }
#endif
}
void pollGps(){
 if(!gpsReady)return;
#if defined(CONFIG_IDF_TARGET_ESP32C6)
 if(gpsUbx10Hz&&gpsDriver){
   gpsDriver->update();
   const uint16_t epochs=gpsDriver->takeMessageCounters().completeEpochs;
   if(epochs){gpsEpochsThisSecond+=epochs;gpsLastMs=millis();}
   const uint32_t elapsed=(uint32_t)(millis()-gpsRateWindowMs);
   if(elapsed>=1000){gpsMeasuredHz=(uint32_t)((uint64_t)gpsEpochsThisSecond*1000/elapsed);gpsEpochsThisSecond=0;gpsRateWindowMs=millis();}
   return;
 }
#endif
 int budget=24;while(budget--&&Serial1.available()){char c=(char)Serial1.read();if(c=='\n'){if(gpsLine.length()>5&&gpsLine.startsWith("$")){gpsLastSentence=gpsLine;gpsLastMs=millis();gpsSentences++;}gpsLine="";}else if(c!='\r'){if(gpsLine.length()<96)gpsLine+=c;else gpsLine="";}}
}
String expansionJson(){String j="{\"motors\":[";for(int i=0;i<4;i++){if(i)j+=",";j+="{\"motor\":"+String(i+1)+",\"connector\":\"D"+String(motorSlots[i])+"\",\"gpio\":"+String(motorPinForIndex(i))+"}";}j+="],\"ppmPin\":"+String(ppmReceiverPin)+",\"ppmEdge\":\""+String(ppmEdgeFalling?"FALLING":"RISING")+"\",\"ppmReverse\":[";for(int i=0;i<4;i++){if(i)j+=",";j+=ppmReverse[i]?"true":"false";}j+="],\"ppmArmMode\":\""+String(ppmYawStickArm?"YAW_STICK":"CH5_SWITCH")+"\",\"idleDisarmSeconds\":15,\"servoPin\":"+String(servoPin)+",\"servoReady\":"+String(servoAttached?"true":"false")+",\"gpsRxPin\":"+String(gpsRxPin)+",\"gpsTxPin\":"+String(gpsTxPin)+",\"gpsProtocol\":\""+String(gpsUbx10Hz?"UBX_10HZ":"NMEA_9600")+"\",\"gpsTargetHz\":"+String(gpsUbx10Hz?10:0)+",\"gpsMeasuredHz\":"+String(gpsMeasuredHz)+",\"gpsReady\":"+String(gpsReady?"true":"false")+",\"matrixAddress\":"+String(matrixAddress)+",\"gpioOutputs\":"+auxOutputsJson()+"}";return j;}
void writeEscMicroseconds(int i,int us){int pin=motorPinForIndex(i);if(pin>=0)ledcWrite(pin,escDutyFromUs(flightWatchdogTripped?1000:us));}
void writeMotorOutputs(float m1,float m2,float m3,float m4){motorInput[0]=m1;motorInput[1]=m2;motorInput[2]=m3;motorInput[3]=m4;if(!FLIGHT_CONTROL_ENABLED)return;for(int i=0;i<4;i++)writeEscMicroseconds(i,(int)motorInput[i]);}
void writeFlightDutyOutputs(float d1,float d2,float d3,float d4){
  const float duty[4]={d1,d2,d3,d4};
  for(int i=0;i<4;i++){
    motorInput[i]=duty[i]/1.024f; // Telemetry continues to report the effective pulse in microseconds.
    int pin=motorPinForIndex(i);if(pin>=0)ledcWrite(pin,flightWatchdogTripped?escDutyFromUs(1000):(uint32_t)duty[i]);
  }
}
// RTOS supervisor runs while the main task is in a slow HTTP handler or I2C call.
// A fresh, low-throttle RC frame is required to clear a latched output trip.
void flightOutputSupervisor(void*){
  for(;;){
    if(FLIGHT_CONTROL_ENABLED&&escPwmReady){
      if((armed||benchMode!=BENCH_NONE)&&flightHeartbeatUs&&
         (uint32_t)(micros()-flightHeartbeatUs)>ARMED_LOOP_GAP_LIMIT_US&&
         !flightWatchdogTripped){flightWatchdogTripped=true;flightWatchdogTrips++;}
      if(flightWatchdogTripped)for(int i=0;i<4;i++){
        int pin=motorPinForIndex(i);if(pin>=0)ledcWrite(pin,escDutyFromUs(1000));
      }
    }
    vTaskDelay(pdMS_TO_TICKS(2)>0?pdMS_TO_TICKS(2):1);
  }
}
void motorsSafe(){writeMotorOutputs(1000,1000,1000,1000);}
void setPidDefaults(){
  flightPid.rateRoll={.9f,15.0f,.03f};flightPid.ratePitch=flightPid.rateRoll;flightPid.rateYaw={3.0f,15.0f,0.0f};
  flightPid.angleRateRoll={.9f,15.0f,.03f};flightPid.angleRatePitch=flightPid.angleRateRoll;flightPid.angleRateYaw={3.0f,15.0f,0.0f};
  flightPid.angleRoll={3.0f,0.0f,0.0f};flightPid.anglePitch=flightPid.angleRoll;
}
void loadPidSettings(){setPidDefaults();prefs.begin("zjpid",true);if(!prefs.getBool("saved",false)){prefs.end();return;}
  #define GP(K,V) V=prefs.getFloat(K,V)
  GP("rrp",flightPid.rateRoll.p);GP("rri",flightPid.rateRoll.i);GP("rrd",flightPid.rateRoll.d);GP("rpp",flightPid.ratePitch.p);GP("rpi",flightPid.ratePitch.i);GP("rpd",flightPid.ratePitch.d);GP("ryp",flightPid.rateYaw.p);GP("ryi",flightPid.rateYaw.i);GP("ryd",flightPid.rateYaw.d);
  GP("arp",flightPid.angleRateRoll.p);GP("ari",flightPid.angleRateRoll.i);GP("ard",flightPid.angleRateRoll.d);GP("app",flightPid.angleRatePitch.p);GP("api",flightPid.angleRatePitch.i);GP("apd",flightPid.angleRatePitch.d);GP("ayp",flightPid.angleRateYaw.p);GP("ayi",flightPid.angleRateYaw.i);GP("ayd",flightPid.angleRateYaw.d);
  GP("orp",flightPid.angleRoll.p);GP("ori",flightPid.angleRoll.i);GP("ord",flightPid.angleRoll.d);GP("opp",flightPid.anglePitch.p);GP("opi",flightPid.anglePitch.i);GP("opd",flightPid.anglePitch.d);
  #undef GP
  prefs.end();
}
void savePidSettings(){prefs.begin("zjpid",false);prefs.putBool("saved",true);
  #define PP(K,V) prefs.putFloat(K,V)
  PP("rrp",flightPid.rateRoll.p);PP("rri",flightPid.rateRoll.i);PP("rrd",flightPid.rateRoll.d);PP("rpp",flightPid.ratePitch.p);PP("rpi",flightPid.ratePitch.i);PP("rpd",flightPid.ratePitch.d);PP("ryp",flightPid.rateYaw.p);PP("ryi",flightPid.rateYaw.i);PP("ryd",flightPid.rateYaw.d);
  PP("arp",flightPid.angleRateRoll.p);PP("ari",flightPid.angleRateRoll.i);PP("ard",flightPid.angleRateRoll.d);PP("app",flightPid.angleRatePitch.p);PP("api",flightPid.angleRatePitch.i);PP("apd",flightPid.angleRatePitch.d);PP("ayp",flightPid.angleRateYaw.p);PP("ayi",flightPid.angleRateYaw.i);PP("ayd",flightPid.angleRateYaw.d);
  PP("orp",flightPid.angleRoll.p);PP("ori",flightPid.angleRoll.i);PP("ord",flightPid.angleRoll.d);PP("opp",flightPid.anglePitch.p);PP("opi",flightPid.anglePitch.i);PP("opd",flightPid.anglePitch.d);
  #undef PP
  prefs.end();
}
void setCalibrationDefaults(){accelOffsetX=-0.10f;accelOffsetY=0.03f;accelOffsetZ=0.12f;levelTrimRoll=0.0f;levelTrimPitch=0.0f;}
void loadCalibrationSettings(){setCalibrationDefaults();prefs.begin("zjcal",true);if(prefs.getBool("saved",false)){accelOffsetX=prefs.getFloat("axoff",accelOffsetX);accelOffsetY=prefs.getFloat("ayoff",accelOffsetY);accelOffsetZ=prefs.getFloat("azoff",accelOffsetZ);levelTrimRoll=prefs.getFloat("rtrim",levelTrimRoll);levelTrimPitch=prefs.getFloat("ptrim",levelTrimPitch);}prefs.end();}
void saveCalibrationSettings(){prefs.begin("zjcal",false);prefs.putBool("saved",true);prefs.putFloat("axoff",accelOffsetX);prefs.putFloat("ayoff",accelOffsetY);prefs.putFloat("azoff",accelOffsetZ);prefs.putFloat("rtrim",levelTrimRoll);prefs.putFloat("ptrim",levelTrimPitch);prefs.end();}
bool calibrationValid(float axo,float ayo,float azo,float rt,float pt){return isfinite(axo)&&isfinite(ayo)&&isfinite(azo)&&isfinite(rt)&&isfinite(pt)&&fabsf(axo)<=0.5f&&fabsf(ayo)<=0.5f&&fabsf(azo)<=0.5f&&fabsf(rt)<=10.0f&&fabsf(pt)<=10.0f;}
String calibrationJson(){String j="{\"accelOffset\":{\"x\":"+String(accelOffsetX,6)+",\"y\":"+String(accelOffsetY,6)+",\"z\":"+String(accelOffsetZ,6)+"}";j+=",\"gyroBias\":{\"roll\":"+String(gyroBiasRoll,5)+",\"pitch\":"+String(gyroBiasPitch,5)+",\"yaw\":"+String(gyroBiasYaw,5)+"}";j+=",\"levelTrim\":{\"roll\":"+String(levelTrimRoll,4)+",\"pitch\":"+String(levelTrimPitch,4)+"}";j+=",\"accel\":{\"x\":"+String(accX,6)+",\"y\":"+String(accY,6)+",\"z\":"+String(accZ,6)+"}";j+=",\"attitude\":{\"roll\":"+String(kalmanRoll,3)+",\"pitch\":"+String(kalmanPitch,3)+",\"yaw\":"+String(flightYaw,3)+"}}";return j;}
bool pidAxisValid(const PidAxis& a,bool angleOuter=false){float pMax=angleOuter?10.0f:8.0f,iMax=angleOuter?10.0f:50.0f,dMax=angleOuter?.5f:.2f;return isfinite(a.p)&&isfinite(a.i)&&isfinite(a.d)&&a.p>=0&&a.p<=pMax&&a.i>=0&&a.i<=iMax&&a.d>=0&&a.d<=dMax;}
bool pidConfigValid(const FlightPidSettings& p){return pidAxisValid(p.rateRoll)&&pidAxisValid(p.ratePitch)&&pidAxisValid(p.rateYaw)&&pidAxisValid(p.angleRateRoll)&&pidAxisValid(p.angleRatePitch)&&pidAxisValid(p.angleRateYaw)&&pidAxisValid(p.angleRoll,true)&&pidAxisValid(p.anglePitch,true);}
String pidAxisJson(const PidAxis& a){return String("{\"P\":")+String(a.p,5)+",\"I\":"+String(a.i,5)+",\"D\":"+String(a.d,5)+"}";}
String pidJson(){String j="{\"rateRoll\":"+pidAxisJson(flightPid.rateRoll)+",\"ratePitch\":"+pidAxisJson(flightPid.ratePitch)+",\"rateYaw\":"+pidAxisJson(flightPid.rateYaw);j+=",\"angleRateRoll\":"+pidAxisJson(flightPid.angleRateRoll)+",\"angleRatePitch\":"+pidAxisJson(flightPid.angleRatePitch)+",\"angleRateYaw\":"+pidAxisJson(flightPid.angleRateYaw);j+=",\"angleRoll\":"+pidAxisJson(flightPid.angleRoll)+",\"anglePitch\":"+pidAxisJson(flightPid.anglePitch)+"}";return j;}
float argFloat(const char* key,float fallback){if(!server.hasArg(key))return fallback;String v=server.arg(key);v.trim();if(!v.length())return fallback;return v.toFloat();}
void readPidArgs(FlightPidSettings& n){
  n.rateRoll={argFloat("rateRollP",n.rateRoll.p),argFloat("rateRollI",n.rateRoll.i),argFloat("rateRollD",n.rateRoll.d)};n.ratePitch={argFloat("ratePitchP",n.ratePitch.p),argFloat("ratePitchI",n.ratePitch.i),argFloat("ratePitchD",n.ratePitch.d)};n.rateYaw={argFloat("rateYawP",n.rateYaw.p),argFloat("rateYawI",n.rateYaw.i),argFloat("rateYawD",n.rateYaw.d)};
  n.angleRateRoll={argFloat("angleRateRollP",n.angleRateRoll.p),argFloat("angleRateRollI",n.angleRateRoll.i),argFloat("angleRateRollD",n.angleRateRoll.d)};n.angleRatePitch={argFloat("angleRatePitchP",n.angleRatePitch.p),argFloat("angleRatePitchI",n.angleRatePitch.i),argFloat("angleRatePitchD",n.angleRatePitch.d)};n.angleRateYaw={argFloat("angleRateYawP",n.angleRateYaw.p),argFloat("angleRateYawI",n.angleRateYaw.i),argFloat("angleRateYawD",n.angleRateYaw.d)};
  n.angleRoll={argFloat("angleRollP",n.angleRoll.p),argFloat("angleRollI",n.angleRoll.i),argFloat("angleRollD",n.angleRoll.d)};n.anglePitch={argFloat("anglePitchP",n.anglePitch.p),argFloat("anglePitchI",n.anglePitch.i),argFloat("anglePitchD",n.anglePitch.d)};
}
bool propsRemovedConfirmed(){String c=server.arg("confirm");c.toUpperCase();return c=="PROPS_REMOVED";}
void benchStop(){benchMode=BENCH_NONE;benchMotor=0;benchSequenceMotor=0;benchEscStage=0;benchUntilMs=benchStageUntilMs=0;motorsSafe();}
void directMotorPulse(int index,int pulse){if(!FLIGHT_CONTROL_ENABLED)return;for(int i=0;i<4;i++){int v=(i==index)?pulse:1000;motorInput[i]=v;writeEscMicroseconds(i,v);}}
void allMotorPulse(int pulse){if(!FLIGHT_CONTROL_ENABLED)return;for(int i=0;i<4;i++){motorInput[i]=pulse;writeEscMicroseconds(i,pulse);}}
void serviceBenchMode(){if(benchMode==BENCH_NONE)return;if(flightWatchdogTripped){benchStop();return;}unsigned long now=millis();if(benchMode==BENCH_MOTOR){if((long)(now-benchUntilMs)>=0){benchStop();return;}directMotorPulse((int)benchMotor-1,benchPulse);return;}if(benchMode==BENCH_MOTOR_SEQUENCE){if((long)(now-benchStageUntilMs)>=0){benchSequenceMotor++;if(benchSequenceMotor>4){benchStop();return;}benchStageUntilMs=now+700;}directMotorPulse((int)benchSequenceMotor-1,1200);return;}if(benchMode==BENCH_ESC_CAL){if(benchEscStage==0){allMotorPulse(2000);if((long)(now-benchStageUntilMs)>=0){benchEscStage=1;benchStageUntilMs=now+3000;}}else if(benchEscStage==1){allMotorPulse(1000);if((long)(now-benchStageUntilMs)>=0){benchStop();}}}}
bool configureMpu6050Flight(){if(detectedImu!=IMU_MPU6050||!detectedImuAddress)return false;return i2cWriteReg(detectedImuAddress,0x6B,0x00)&&i2cWriteReg(detectedImuAddress,0x1A,0x05)&&i2cWriteReg(detectedImuAddress,0x1C,0x10)&&i2cWriteReg(detectedImuAddress,0x1B,0x08)&&i2cWriteReg(detectedImuAddress,0x19,0x03);}
bool readMpuFlight(float& rr,float& rp,float& ry,float& ax,float& ay,float& az){uint8_t b[14];if(!i2cReadBlock(detectedImuAddress,0x3B,b,sizeof(b)))return false;auto be16=[&](int i)->int16_t{return (int16_t)(((uint16_t)b[i]<<8)|b[i+1]);};int16_t rax=be16(0),ray=be16(2),raz=be16(4),rgx=be16(8),rgy=be16(10),rgz=be16(12);ax=(float)rax/4096.0f+accelOffsetX;ay=(float)ray/4096.0f+accelOffsetY;az=(float)raz/4096.0f+accelOffsetZ;rr=(float)rgx/65.5f;rp=(float)rgy/65.5f;ry=(float)rgz/65.5f;lastImu.kind=IMU_MPU6050;lastImu.address=detectedImuAddress;lastImu.whoAmI=detectedImuAddress;lastImu.rawAx=rax;lastImu.rawAy=ray;lastImu.rawAz=raz;lastImu.rawGx=rgx;lastImu.rawGy=rgy;lastImu.rawGz=rgz;lastImu.ax=ax;lastImu.ay=ay;lastImu.az=az;lastImu.gx=rr;lastImu.gy=rp;lastImu.gz=ry;lastImu.sampledAt=millis();lastImuValid=true;return true;}
void disarmFlight(const char* reason){if(armed&&reason&&strlen(reason))Serial.println(String("DISARM • ")+reason);armed=false;motorsSafe();resetFlightPid();}
void resetArmGesture(){yawGesture=0;yawGestureStartedMs=0;yawGestureLatched=false;}
void armFlight(const uint16_t rc[10]){
  armed=true;resetFlightPid();idleLastMovementMs=millis();
  for(int i=0;i<4;i++)idleRcLast[i]=rc[i];
  Serial.println(String("ARMED • ")+flightModeName(flightMode)+" • "+rcSourceName(activeRcSource));
}
void serviceArming(const uint16_t rc[10]){
  const uint32_t now=millis();
  if(activeRcSource==RC_PPM&&ppmYawStickArm){
    // Deliberate 1-second yaw gesture at minimum throttle with roll/pitch near centre.
    int8_t direction=rc[2]<=1050&&abs((int)rc[0]-1500)<=80&&abs((int)rc[1]-1500)<=80
      ?(rc[3]>=1900?1:rc[3]<=1100?-1:0):0;
    if(direction!=yawGesture){yawGesture=direction;yawGestureStartedMs=direction?now:0;yawGestureLatched=false;}
    if(direction&&!yawGestureLatched&&(uint32_t)(now-yawGestureStartedMs)>=ARM_GESTURE_HOLD_MS){
      if(direction<0&&armed)disarmFlight("PPM yaw left");
      if(direction>0&&!armed)armFlight(rc);
      yawGestureLatched=true; // Return yaw to centre before another gesture.
    }
  }else{
    resetArmGesture();
    if(rc[4]<1500){if(armed)disarmFlight("CH5 low");armLowSeen=true;}
    else if(!armed&&armLowSeen&&rc[2]<=1050)armFlight(rc);
  }
  if(!armed)return;
  if(rc[2]>1050){idleLastMovementMs=now;for(int i=0;i<4;i++)idleRcLast[i]=rc[i];return;}
  for(int i=0;i<4;i++)if(abs((int)rc[i]-(int)idleRcLast[i])>=12){
    idleLastMovementMs=now;for(int j=0;j<4;j++)idleRcLast[j]=rc[j];break;
  }
  if((uint32_t)(now-idleLastMovementMs)>=IDLE_AUTO_DISARM_MS){
    disarmFlight("15 s low-throttle stick inactivity");armLowSeen=false;
  }
}
void setupFlightCore(){
  if(!FLIGHT_CONTROL_ENABLED){flightReady=false;return;}
  Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,400000);
  if(!escPwmReady){bool escAttached=true;int attached=0;for(int i=0;i<4;i++){int pin=motorPinForIndex(i);if(pin<0||!ledcAttachChannel(pin,250,12,i)){escAttached=false;break;}attached++;writeEscMicroseconds(i,1000);}if(!escAttached){for(int i=0;i<attached;i++)ledcDetach(motorPinForIndex(i));}escPwmReady=escAttached;}
  if(!escPwmReady){flightReady=false;motorsSafe();Serial.println("FlightCore: ESC PWM attach failed • arming disabled");return;}
  motorsSafe();
  delay(40);
  if(detectedImu!=IMU_MPU6050||!detectedImuAddress){flightReady=false;Serial.println("FlightCore: MPU6050 not detected • ESC outputs held at minimum");return;}
  // Match the proven MPU6050 FC configuration: DLPF=0x05, ±8g, ±500 dps.
  if(!configureMpu6050Flight()){flightReady=false;Serial.println("FlightCore: MPU6050 configuration failed");return;}
  Serial.println("FlightCore: keep the frame LEVEL and STILL • calibrating gyro (2000 samples)");
  gyroBiasRoll=gyroBiasPitch=gyroBiasYaw=0;float gyroSqR=0,gyroSqP=0,gyroSqY=0;int good=0;for(int i=0;i<2000;i++){float rr,rp,ry,ax,ay,az;if(readMpuFlight(rr,rp,ry,ax,ay,az)){gyroBiasRoll+=rr;gyroBiasPitch+=rp;gyroBiasYaw+=ry;gyroSqR+=rr*rr;gyroSqP+=rp*rp;gyroSqY+=ry*ry;good++;}delay(1);}
  if(good<1800){flightReady=false;motorsSafe();Serial.println("FlightCore: gyro calibration failed • sensor reads unstable");return;}
  gyroBiasRoll/=good;gyroBiasPitch/=good;gyroBiasYaw/=good;float noiseR=sqrtf(fmaxf(0.0f,gyroSqR/good-gyroBiasRoll*gyroBiasRoll)),noiseP=sqrtf(fmaxf(0.0f,gyroSqP/good-gyroBiasPitch*gyroBiasPitch)),noiseY=sqrtf(fmaxf(0.0f,gyroSqY/good-gyroBiasYaw*gyroBiasYaw));if(noiseR>1.5f||noiseP>1.5f||noiseY>1.5f){flightReady=false;motorsSafe();Serial.println("FlightCore: gyro calibration motion detected • keep frame still and reboot");return;}float rr,rp,ry;if(readMpuFlight(rr,rp,ry,accX,accY,accZ)){accAngleRoll=atan2f(accY,sqrtf(accX*accX+accZ*accZ))*57.2957795f+levelTrimRoll;accAnglePitch=-atan2f(accX,sqrtf(accY*accY+accZ*accZ))*57.2957795f+levelTrimPitch;kalmanRoll=accAngleRoll;kalmanPitch=accAnglePitch;}
  armLowSeen=false;resetArmGesture();flightMode=FLIGHT_ANGLE;lastFlightMode=flightMode;activeRcSource=lastRcSource=RC_NONE;flightLoopTimerUs=micros();flightReady=true;
  Serial.printf("FlightCore READY • gyro bias R %.3f P %.3f Y %.3f dps • 250 Hz ESC pulses in microseconds\n",gyroBiasRoll,gyroBiasPitch,gyroBiasYaw);
}
void runFlightLoop(){
  if(!FLIGHT_CONTROL_ENABLED||!flightReady||benchMode!=BENCH_NONE)return;uint32_t now=micros(),gap=(uint32_t)(now-flightLoopTimerUs);if(gap<FLIGHT_LOOP_US)return;if(gap>maxFlightLoopGapUs)maxFlightLoopGapUs=gap;if(gap>FLIGHT_LOOP_US*2)flightLoopOverruns++;if(armed&&gap>ARMED_LOOP_GAP_LIMIT_US&&!flightWatchdogTripped){flightWatchdogTripped=true;flightWatchdogTrips++;}flightLoopTimerUs+=FLIGHT_LOOP_US;if((uint32_t)(now-flightLoopTimerUs)>FLIGHT_LOOP_US*4)flightLoopTimerUs=now;
  uint16_t rc[10];activeRcSource=chooseRcSource();copyActiveRc(rc,activeRcSource);
  if(flightWatchdogTripped){disarmFlight("output supervisor: loop stalled");armLowSeen=false;resetArmGesture();if(activeRcSource!=RC_NONE&&rc[2]<=1050&&abs((int)rc[3]-1500)<=80&&((activeRcSource==RC_PPM&&ppmYawStickArm)||rc[4]<1500))flightWatchdogTripped=false;return;}
  if(activeRcSource!=lastRcSource){if(armed)disarmFlight("RC source changed");armLowSeen=false;resetArmGesture();lastRcSource=activeRcSource;lastSourceChangeMs=millis();Serial.println(String("RC source: ")+rcSourceName(activeRcSource));}
  // Always sample/fuse the MPU6050 at 250 Hz, even when no RC source is active.
  // Python attitude/level tools and telemetry must remain live while DISARMED.
  float rr,rp,ry;if(!readMpuFlight(rr,rp,ry,accX,accY,accZ)){imuFaultCount++;if(imuFaultCount>=3){disarmFlight("IMU read failure");flightReady=false;}return;}imuFaultCount=0;rateRoll=rr-gyroBiasRoll;ratePitch=rp-gyroBiasPitch;rateYaw=ry-gyroBiasYaw;flightYaw+=rateYaw*.004f;if(flightYaw>180)flightYaw-=360;if(flightYaw<-180)flightYaw+=360;lastFlightSampleMs=millis();
  accAngleRoll=atan2f(accY,sqrtf(accX*accX+accZ*accZ))*57.2957795f+levelTrimRoll;accAnglePitch=-atan2f(accX,sqrtf(accY*accY+accZ*accZ))*57.2957795f+levelTrimPitch;kalmanStep(kalmanRoll,kalmanRollUnc,rateRoll,accAngleRoll);kalmanStep(kalmanPitch,kalmanPitchUnc,ratePitch,accAnglePitch);
  FlightModeKind requested=rc[5]>=1500?FLIGHT_RATE:FLIGHT_ANGLE;if(requested!=flightMode){if(armed)disarmFlight("mode changed");flightMode=requested;resetFlightPid();}
  flightLoopCount++;
  if(activeRcSource==RC_NONE){armLowSeen=false;resetArmGesture();disarmFlight("RC timeout");return;}
  serviceArming(rc);
  if(!armed||rc[2]<1050){motorsSafe();resetFlightPid();return;}
  float desiredRateRoll=0,desiredRatePitch=0,desiredRateYaw=.15f*((float)rc[3]-1500.0f);float inputRoll=0,inputPitch=0,inputYaw=0;
  if(flightMode==FLIGHT_RATE){desiredRateRoll=.15f*((float)rc[0]-1500.0f);desiredRatePitch=.15f*((float)rc[1]-1500.0f);inputRoll=pidStep(desiredRateRoll-rateRoll,flightPid.rateRoll.p,flightPid.rateRoll.i,flightPid.rateRoll.d,prevRateErrRoll,iRateRoll);inputPitch=pidStep(desiredRatePitch-ratePitch,flightPid.ratePitch.p,flightPid.ratePitch.i,flightPid.ratePitch.d,prevRateErrPitch,iRatePitch);inputYaw=pidStep(desiredRateYaw-rateYaw,flightPid.rateYaw.p,flightPid.rateYaw.i,flightPid.rateYaw.d,prevRateErrYaw,iRateYaw);}
  else{float desiredAngleRoll=.10f*((float)rc[0]-1500.0f),desiredAnglePitch=.10f*((float)rc[1]-1500.0f);desiredRateRoll=pidStep(desiredAngleRoll-kalmanRoll,flightPid.angleRoll.p,flightPid.angleRoll.i,flightPid.angleRoll.d,prevAngleErrRoll,iAngleRoll);desiredRatePitch=pidStep(desiredAnglePitch-kalmanPitch,flightPid.anglePitch.p,flightPid.anglePitch.i,flightPid.anglePitch.d,prevAngleErrPitch,iAnglePitch);inputRoll=pidStep(desiredRateRoll-rateRoll,flightPid.angleRateRoll.p,flightPid.angleRateRoll.i,flightPid.angleRateRoll.d,prevRateErrRoll,iRateRoll);inputPitch=pidStep(desiredRatePitch-ratePitch,flightPid.angleRatePitch.p,flightPid.angleRatePitch.i,flightPid.angleRatePitch.d,prevRateErrPitch,iRatePitch);inputYaw=pidStep(desiredRateYaw-rateYaw,flightPid.angleRateYaw.p,flightPid.angleRateYaw.i,flightPid.angleRateYaw.d,prevRateErrYaw,iRateYaw);}
  // Proven duty-tick mixer, CC3D X: M1 FL(+R-P+Y), M2 FR(-R-P-Y),
  // M3 RR(-R+P+Y), M4 RL(+R+P-Y). Clamp duty before the 1180-tick armed idle.
  float throttle=min((float)rc[2],1800.0f);
  float m1=1.024f*(throttle+inputRoll-inputPitch+inputYaw);
  float m2=1.024f*(throttle-inputRoll-inputPitch-inputYaw);
  float m3=1.024f*(throttle-inputRoll+inputPitch+inputYaw);
  float m4=1.024f*(throttle+inputRoll+inputPitch-inputYaw);
  m1=max(1180.0f,constrain(m1,1000.0f,1999.0f));
  m2=max(1180.0f,constrain(m2,1000.0f,1999.0f));
  m3=max(1180.0f,constrain(m3,1000.0f,1999.0f));
  m4=max(1180.0f,constrain(m4,1000.0f,1999.0f));
  if(flightWatchdogTripped){disarmFlight("output supervisor");return;}
  writeFlightDutyOutputs(m1,m2,m3,m4);
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
 auto be16=[&](int i)->int16_t{return (int16_t)(((uint16_t)b[i]<<8)|b[i+1]);};out.kind=IMU_MPU6050;out.address=address;out.whoAmI=who;out.rawAx=be16(0);out.rawAy=be16(2);out.rawAz=be16(4);out.rawGx=be16(8);out.rawGy=be16(10);out.rawGz=be16(12);out.ax=out.rawAx/4096.0f+accelOffsetX;out.ay=out.rawAy/4096.0f+accelOffsetY;out.az=out.rawAz/4096.0f+accelOffsetZ;out.gx=out.rawGx/65.5f;out.gy=out.rawGy/65.5f;out.gz=out.rawGz/65.5f;out.sampledAt=millis();return true;
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
  if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"I2C scan blocked while armed or motor test runs");return;}
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

// All generic expansion bus work is kept off the armed flight loop.
void expansionBusBegin(){if(FLIGHT_CONTROL_ENABLED)Wire.setClock(100000);else Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);}
void expansionBusEnd(){if(FLIGHT_CONTROL_ENABLED)Wire.setClock(400000);else{Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);}}
bool expansionBusAvailable(){if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Expansion I2C is blocked while armed or motor test runs");return false;}return true;}
bool expansionPinConfigAllowed(){if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Auxiliary pin outputs require the verified A2 XIAO profile");return false;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Pin changes are blocked while armed or during bench output");return false;}return true;}
String matrixRowsJson(){String j="[";for(int i=0;i<8;i++){if(i)j+=",";j+=String(matrixRows[i]);}return j+"]";}
int parseEightRows(const String& csv,uint8_t out[8]){int start=0,n=0;while(start<csv.length()&&n<8){int end=csv.indexOf(',',start);if(end<0)end=csv.length();String v=csv.substring(start,end);v.trim();if(!v.length())return -1;for(size_t i=0;i<v.length();i++)if(v[i]<'0'||v[i]>'9')return -1;int row=v.toInt();if(row<0||row>255)return -1;out[n++]=(uint8_t)row;start=end+1;}return start>=csv.length()?n:-1;}
// XIAO ESP32-C6 orange user LED on GPIO15; active low. The scheduler never delays flight control.
#if defined(CONFIG_IDF_TARGET_ESP32C6)
const int USER_LED_PIN=15;
#else
const int USER_LED_PIN=-1;
#endif
uint16_t userLedIntervalMs=0;
uint32_t userLedLastMs=0;
bool userLedLit=false;
void serviceUserLed(){
 if(USER_LED_PIN<0||!userLedIntervalMs)return;
 uint32_t now=millis();
 if((uint32_t)(now-userLedLastMs)>=userLedIntervalMs){userLedLastMs=now;userLedLit=!userLedLit;digitalWrite(USER_LED_PIN,userLedLit?LOW:HIGH);}
}
void expansionReadCommand(const String& type){
 if(type=="led_read"){sendJson(200,"{\"ok\":true,\"command\":\"led_read\",\"supported\":"+String(USER_LED_PIN>=0?"true":"false")+",\"gpio\":"+String(USER_LED_PIN)+",\"on\":"+String(userLedLit?"true":"false")+",\"intervalMs\":"+String(userLedIntervalMs)+"}");return;}
 if(type=="pinmap_get"){sendJson(200,"{\"ok\":true,\"command\":\"pinmap_get\",\"expansion\":"+expansionJson()+"}");return;}
 if(type=="gps_read"){
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  if(gpsUbx10Hz&&gpsDriver){
    const DroneGPSData& g=gpsDriver->data();const DroneGPSConfigReport& c=gpsDriver->configurationReport();
    const bool fresh=gpsDriver->dataFresh(),rateOk=fresh&&gpsMeasuredHz>=9&&gpsMeasuredHz<=11;
    String j="{\"ok\":true,\"command\":\"gps_read\",\"protocol\":\"UBX_10HZ\",\"targetHz\":10,\"measuredHz\":"+String(gpsMeasuredHz)+",\"rateOk\":"+String(rateOk?"true":"false")+",\"configured\":"+String(gpsReady?"true":"false")+",\"configError\":\""+jsonEscape(DroneGPS::configErrorText(c.error))+"\",\"fresh\":"+String(fresh?"true":"false")+",\"ageMs\":"+String(gpsLastMs?millis()-gpsLastMs:0)+",\"readyForEkf\":"+String(gpsDriver->readyForEkf()?"true":"false")+",\"fixValid\":"+String(g.fixValid?"true":"false")+",\"satellites\":"+String(g.satellites)+",\"latitude\":"+String(g.latitude,7)+",\"longitude\":"+String(g.longitude,7)+",\"altitudeM\":"+String(g.altitudeMSLM,2)+",\"horizontalAccuracyM\":"+String(g.horizontalAccuracyM,2)+",\"speedAccuracyMps\":"+String(g.speedAccuracyMps,2)+",\"pdop\":"+String(g.positionDOP,2)+"}";
    sendJson(200,j);return;
  }
#endif
  String j="{\"ok\":true,\"command\":\"gps_read\",\"protocol\":\""+String(gpsUbx10Hz?"UBX_10HZ":"NMEA_9600")+"\",\"ready\":"+String(gpsReady?"true":"false")+",\"sentence\":\""+jsonEscape(gpsLastSentence)+"\",\"sentences\":"+String(gpsSentences)+",\"measuredHz\":0,\"ageMs\":"+String(gpsLastMs?millis()-gpsLastMs:0)+"}";sendJson(200,j);return;
 }
 if(type=="matrix_read"){sendJson(200,"{\"ok\":true,\"command\":\"matrix_read\",\"address\":"+String(matrixAddress)+",\"rows\":"+matrixRowsJson()+"}");return;}
 if(type=="gpio_read"){int pin=server.arg("pin").toInt();if(!auxPinAllowed(pin)||pin==servoPin||pin==gpsRxPin||pin==gpsTxPin){sendMessage(400,"Choose an unreserved A2 D7-D10 GPIO");return;}if(effectiveArmed()){sendMessage(423,"GPIO bench read blocked while armed");return;}String mode=server.arg("mode");if(mode.length()==0)mode="pullup";if(mode!="pullup"&&mode!="pulldown"&&mode!="floating"){sendMessage(400,"Input mode must be pullup, pulldown or floating");return;}if(!auxOutputActive(pin))pinMode(pin,mode=="pullup"?INPUT_PULLUP:mode=="pulldown"?INPUT_PULLDOWN:INPUT);sendJson(200,"{\"ok\":true,\"command\":\"gpio_read\",\"pin\":"+String(pin)+",\"value\":"+String(digitalRead(pin)) +",\"mode\":\""+mode+"\"}");return;}
 if(type=="i2c_read"){
  if(!expansionBusAvailable())return;int address=server.arg("address").toInt(),reg=server.arg("reg").toInt(),length=server.arg("length").toInt();if(address<8||address>0x77||reg<0||reg>255||length<1||length>16){sendMessage(400,"I2C read needs address 8-119, register 0-255, length 1-16");return;}
  expansionBusBegin();Wire.beginTransmission((uint8_t)address);Wire.write((uint8_t)reg);int error=Wire.endTransmission(false);int got=error==0?Wire.requestFrom(address,length,true):0;String values="[";for(int i=0;i<got;i++){if(i)values+=",";values+=String(Wire.read());}values+="]";expansionBusEnd();if(error||got!=length){sendMessage(502,"I2C device did not return the requested bytes; check address/register/wiring");return;}
  sendJson(200,"{\"ok\":true,\"command\":\"i2c_read\",\"address\":"+String(address)+",\"reg\":"+String(reg)+",\"bytes\":"+values+"}");return;
 }
}
void expansionWriteCommand(const String& type){
 if(type=="ppm_config"){if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"PPM changes blocked while armed or bench outputs run");return;}}else if(type!="i2c_write"&&type!="matrix_write"&&type!="matrix_config"&&!expansionPinConfigAllowed())return;
 if(type=="motor_map_set"){
  uint8_t next[4];for(int i=0;i<4;i++){String key="m"+String(i+1)+"slot";if(!server.hasArg(key)){sendMessage(400,"Specify all four motor slots 0-3");return;}int v=server.arg(key).toInt();if(v<0||v>3){sendMessage(400,"Motor slot must be D0-D3");return;}next[i]=(uint8_t)v;}
  if(!motorSlotsValid(next)){sendMessage(400,"Each D0-D3 motor connector must appear exactly once");return;}for(int i=0;i<4;i++)motorSlots[i]=next[i];saveExpansionSettings();sendJson(200,"{\"ok\":true,\"command\":\"motor_map_set\",\"rebooting\":true,\"expansion\":"+expansionJson()+"}");restartAt=millis()+800;return;
 }
 if(type=="ppm_config"){
  if(!server.hasArg("edge")){sendMessage(400,"PPM edge is required: RISING or FALLING");return;}String edge=server.arg("edge");edge.toUpperCase();if(edge!="RISING"&&edge!="FALLING"){sendMessage(400,"PPM edge must be RISING or FALLING");return;}bool reverse[4];for(int i=0;i<4;i++){String k="reverse"+String(i);if(!server.hasArg(k)){sendMessage(400,"Specify reverse0..reverse3 for roll/pitch/throttle/yaw");return;}reverse[i]=server.arg(k)=="1"||server.arg(k)=="true";}String mode=server.hasArg("armMode")?server.arg("armMode"):String(ppmYawStickArm?"YAW_STICK":"CH5_SWITCH");mode.toUpperCase();if(mode!="YAW_STICK"&&mode!="CH5_SWITCH"){sendMessage(400,"PPM armMode must be YAW_STICK or CH5_SWITCH");return;}int pin=server.hasArg("pin")?server.arg("pin").toInt():ppmReceiverPin;if(!ppmPinAllowed(pin)){sendMessage(400,"PPM pin must be A2 D6/GPIO16 or D10/GPIO18");return;}if(pin!=ppmReceiverPin&&(pin==servoPin||pin==gpsRxPin||pin==gpsTxPin||auxOutputActive(pin))){sendMessage(409,"Selected PPM pin is assigned to servo, GPS or GPIO. Release it first.");return;}if(ENABLE_PPM_RECEIVER&&ppmReceiverPin>=0)detachInterrupt(digitalPinToInterrupt(ppmReceiverPin));noInterrupts();ppmLastFrameUs=0;ppmLastEdgeUs=0;ppmIndex=0;ppmInvalidFrame=false;interrupts();ppmReceiverPin=pin;ppmEdgeFalling=edge=="FALLING";for(int i=0;i<4;i++)ppmReverse[i]=reverse[i];ppmYawStickArm=mode=="YAW_STICK";armLowSeen=false;resetArmGesture();saveExpansionSettings();if(ENABLE_PPM_RECEIVER&&ppmReceiverPin>=0){pinMode(ppmReceiverPin,ppmEdgeFalling?INPUT_PULLDOWN:INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(ppmReceiverPin),ppmIsr,ppmEdgeFalling?FALLING:RISING);}sendJson(200,"{\"ok\":true,\"command\":\"ppm_config\",\"expansion\":"+expansionJson()+"}");return;
 }
 if(type=="servo_config"){
  int pin=server.arg("pin").toInt();if(pin!=-1&&(!auxPinAllowed(pin)||pin==gpsRxPin||pin==gpsTxPin||auxOutputActive(pin))){sendMessage(400,"Servo needs an unreserved D7-D10 pin or -1 to disable");return;}int old=servoPin;if(servoAttached){ledcWrite(old,servoDutyFromUs(1500));ledcDetach(old);servoAttached=false;}servoPin=pin;servoPulseUs=1500;
  if(pin>=0){servoAttached=ledcAttachChannel(pin,50,12,4);if(!servoAttached||(escPwmReady&&ledcReadFreq(motorPinForIndex(0))!=250)){if(servoAttached)ledcDetach(pin);servoPin=old;if(old>=0){servoAttached=ledcAttachChannel(old,50,12,4);if(servoAttached)ledcWrite(old,servoDutyFromUs(1500));}sendMessage(503,"Servo PWM channel unavailable or ESC timer affected; mapping unchanged");return;}ledcWrite(pin,servoDutyFromUs(1500));}
  saveExpansionSettings();sendJson(200,"{\"ok\":true,\"command\":\"servo_config\",\"expansion\":"+expansionJson()+"}");return;
 }
 if(type=="servo_write"){if(!servoAttached){sendMessage(409,"Configure a free servo pin first");return;}int pulse=server.arg("pulseUs").toInt();if(pulse<1000||pulse>2000){sendMessage(400,"Servo pulse must be 1000-2000 us");return;}servoPulseUs=pulse;ledcWrite(servoPin,servoDutyFromUs(pulse));sendJson(200,"{\"ok\":true,\"command\":\"servo_write\",\"pulseUs\":"+String(pulse)+"}");return;}
 if(type=="gps_config"){
  int pin=server.arg("pin").toInt();String protocol=server.hasArg("protocol")?server.arg("protocol"):"NMEA_9600";protocol.toUpperCase();
  if(protocol!="NMEA_9600"&&protocol!="UBX_10HZ"){sendMessage(400,"GPS protocol must be NMEA_9600 or UBX_10HZ");return;}
  const bool ubx=pin>=0&&protocol=="UBX_10HZ";int tx=ubx?(server.hasArg("txPin")?server.arg("txPin").toInt():-1):-1;
  if(pin!=-1&&(!auxPinAllowed(pin)||pin==servoPin||auxOutputActive(pin))){sendMessage(400,"GPS RX needs a free A2 D7-D10 pin");return;}
  if(ubx&&(!auxPinAllowed(tx)||tx==pin||tx==servoPin||auxOutputActive(tx))){sendMessage(400,"UBX 10 Hz needs a second free A2 D7-D10 TX pin for GPS RX");return;}
  Serial1.end();
#if defined(CONFIG_IDF_TARGET_ESP32C6)
  if(gpsDriver){delete gpsDriver;gpsDriver=nullptr;}
#endif
  gpsRxPin=pin;gpsTxPin=tx;gpsUbx10Hz=ubx;gpsReady=false;gpsLine="";gpsLastSentence="";gpsSentences=0;gpsLastMs=0;gpsMeasuredHz=0;gpsEpochsThisSecond=0;
  saveExpansionSettings();
  if(ubx){sendJson(200,"{\"ok\":true,\"command\":\"gps_config\",\"rebooting\":true,\"message\":\"Configuring bundled DroneGPS after restart; read gps_read for measured epoch Hz\",\"expansion\":"+expansionJson()+"}");restartAt=millis()+800;return;}
  if(pin>=0){Serial1.begin(9600,SERIAL_8N1,pin,-1);gpsReady=true;}
  sendJson(200,"{\"ok\":true,\"command\":\"gps_config\",\"expansion\":"+expansionJson()+"}");return;
 }
 if(type=="led_set"){
  if(USER_LED_PIN<0){sendMessage(403,"Onboard user LED available on ZEBJUS Aerion F1 only");return;}
  String mode=server.arg("mode");int interval=server.arg("intervalMs").toInt();
  if(mode!="on"&&mode!="off"&&mode!="blink"){sendMessage(400,"LED mode must be on, off or blink");return;}
  if(mode=="blink"&&(interval<100||interval>5000)){sendMessage(400,"Blink intervalMs must be 100-5000");return;}
  userLedIntervalMs=mode=="blink"?(uint16_t)interval:0;
  userLedLastMs=millis();userLedLit=mode!="off";digitalWrite(USER_LED_PIN,userLedLit?LOW:HIGH);
  sendJson(200,"{\"ok\":true,\"command\":\"led_set\",\"mode\":\""+mode+"\",\"intervalMs\":"+String(userLedIntervalMs)+"}");return;
 }
 if(type=="gpio_write"){
  int pin=server.arg("pin").toInt(),value=server.arg("value").toInt();if(!auxPinAllowed(pin)||pin==servoPin||pin==gpsRxPin||pin==gpsTxPin||value<0||value>1){sendMessage(400,"GPIO write needs an unreserved A2 D7-D10 pin and value 0/1");return;}auxOutputMask|=(1u<<auxPinIndex(pin));pinMode(pin,OUTPUT);digitalWrite(pin,value?HIGH:LOW);sendJson(200,"{\"ok\":true,\"command\":\"gpio_write\",\"pin\":"+String(pin)+",\"value\":"+String(value)+"}");return;
 }
 if(type=="gpio_release"){
  int pin=server.arg("pin").toInt();if(!auxPinAllowed(pin)||!auxOutputActive(pin)){sendMessage(400,"GPIO release needs an active D7-D10 output");return;}
  digitalWrite(pin,LOW);pinMode(pin,INPUT);auxOutputMask&=~(1u<<auxPinIndex(pin));sendJson(200,"{\"ok\":true,\"command\":\"gpio_release\",\"expansion\":"+expansionJson()+"}");return;
 }
 if(type=="matrix_config"||type=="matrix_write"||type=="i2c_write"){
  if(!expansionBusAvailable())return;
  if(type=="matrix_config"){int addr=server.arg("address").toInt();if(addr<0x70||addr>0x77){sendMessage(400,"HT16K33 address must be 0x70-0x77 (112-119)");return;}matrixAddress=addr;saveExpansionSettings();sendJson(200,"{\"ok\":true,\"command\":\"matrix_config\",\"expansion\":"+expansionJson()+"}");return;}
  if(type=="matrix_write"){
   uint8_t rows[8];if(parseEightRows(server.arg("rows"),rows)!=8){sendMessage(400,"HT16K33 rows needs exactly eight decimal bytes (0-255)");return;}expansionBusBegin();Wire.beginTransmission(matrixAddress);Wire.write(0x21);int error=Wire.endTransmission();if(!error){Wire.beginTransmission(matrixAddress);Wire.write(0x81);error=Wire.endTransmission();}if(!error){Wire.beginTransmission(matrixAddress);Wire.write(0xE8);error=Wire.endTransmission();}if(!error){Wire.beginTransmission(matrixAddress);Wire.write(0x00);for(int i=0;i<8;i++){Wire.write(rows[i]);Wire.write(0);}error=Wire.endTransmission();}expansionBusEnd();if(error){sendMessage(502,"HT16K33 matrix not responding; check 0x70-0x77 and 3.3 V logic");return;}for(int i=0;i<8;i++)matrixRows[i]=rows[i];sendJson(200,"{\"ok\":true,\"command\":\"matrix_write\",\"rows\":"+matrixRowsJson()+"}");return;
  }
  int address=server.arg("address").toInt(),reg=server.arg("reg").toInt();String bytes=server.arg("bytes");if(address<8||address>0x77||address==detectedImuAddress||reg<0||reg>255||!bytes.length()){sendMessage(400,"I2C write needs a non-IMU address 8-119, register 0-255 and decimal bytes");return;}uint8_t values[8];int n=0,start=0;while(start<bytes.length()&&n<8){int end=bytes.indexOf(',',start);if(end<0)end=bytes.length();String b=bytes.substring(start,end);b.trim();if(!b.length()){sendMessage(400,"Empty I2C byte");return;}for(size_t i=0;i<b.length();i++)if(b[i]<'0'||b[i]>'9'){sendMessage(400,"I2C bytes must be decimal 0-255");return;}int v=b.toInt();if(v<0||v>255){sendMessage(400,"I2C byte out of range");return;}values[n++]=v;start=end+1;}if(start<bytes.length()){sendMessage(400,"I2C write maximum is eight bytes");return;}expansionBusBegin();Wire.beginTransmission((uint8_t)address);Wire.write((uint8_t)reg);for(int i=0;i<n;i++)Wire.write(values[i]);int error=Wire.endTransmission();expansionBusEnd();if(error){sendMessage(502,"I2C write NACK; check device address/wiring");return;}sendJson(200,"{\"ok\":true,\"command\":\"i2c_write\",\"written\":"+String(n)+"}");return;
 }
 sendMessage(400,"Unknown expansion command: "+type);
}

// ============================================================
// Status / telemetry / commands
// ============================================================
String statusJson(const String& clientId=""){
  expireLock();bool connected=WiFi.status()==WL_CONNECTED;String mode=setupMode?"AP SETUP":"STA / LOCAL";
  String j="{\"ok\":true,\"kit\":\"ZEBJUS_FLIGHTCORE\",\"version\":\""+String(FW_VERSION)+"\",\"firmware\":\""+String(FW_VERSION)+"\",\"firmwareBuiltAt\":\""+String(FW_BUILD_DATE)+" "+String(FW_BUILD_TIME)+" UTC\"";
  j+=",\"name\":\""+jsonEscape(kitName)+"\",\"deviceName\":\""+jsonEscape(kitName)+"\",\"hostname\":\""+hostFromName(kitName)+"\",\"deviceId\":\""+deviceId+"\",\"boardId\":\""+String(BOARD_ID)+"\",\"boardName\":\""+String(BOARD_NAME)+"\"";
  j+=",\"connected\":"+String(connected?"true":"false")+",\"ssid\":\""+jsonEscape(connected?WiFi.SSID():"")+"\",\"ip\":\""+(setupMode?WiFi.softAPIP().toString():WiFi.localIP().toString())+"\",\"rssi\":"+String(connected?WiFi.RSSI():0);
  j+=",\"mode\":\""+mode+"\",\"apPreferred\":"+String(preferredApMode()?"true":"false")+",\"apSsid\":\""+jsonEscape(apName)+"\",\"armed\":"+String(effectiveArmed()?"true":"false")+",\"locked\":"+String(lockActive()?"true":"false")+",\"lockMine\":"+String(lockMine(clientId)?"true":"false")+",\"lockTimeoutMs\":"+String(LOCK_TIMEOUT_MS)+",\"benchRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"webRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"apRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"firmwareRole\":\""+String(FLIGHT_CONTROL_ENABLED?"RATE_ANGLE_FLIGHT_CORE":"WIFI_SENSOR_BRIDGE")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"escOutputs\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidWritable\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"calibrationIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightMode\":\""+String(flightModeName(flightMode))+"\",\"rcSource\":\""+String(rcSourceName(activeRcSource))+"\",\"rcPolicy\":\"WEB_ACTIVE_THEN_PPM_FALLBACK\",\"otaUpdate\":true,\"receiverHealth\":\""+receiverHealth()+"\",\"receiverPin\":"+String(ppmReceiverPin)+",\"i2cScan\":true,\"imuRead\":true,\"imuModel\":\""+String(imuName(detectedImu))+"\",\"i2cSda\":"+String(I2C_SDA_PIN)+",\"i2cScl\":"+String(I2C_SCL_PIN)+",\"benchMode\":"+String((int)benchMode)+",\"loopCount\":"+String(flightLoopCount)+",\"maxLoopGapUs\":"+String(maxFlightLoopGapUs)+",\"loopOverruns\":"+String(flightLoopOverruns)+",\"outputWatchdogTripped\":"+String(flightWatchdogTripped?"true":"false")+",\"outputWatchdogTrips\":"+String(flightWatchdogTrips)+",\"ppmFrameHz\":"+String(ppmFrameHz)+",\"webRcFrameHz\":"+String(webRcFrameHz)+",\"flightLoopHz\":"+String(flightLoopHz)+",\"expansion\":"+expansionJson()+",\"pid\":"+pidJson()+"}";
  return j;
}
void statusApi(){sendJson(200,statusJson(server.arg("clientId")));}
void telemetryApi(){
  uint16_t rc[10];RcSourceKind src=FLIGHT_CONTROL_ENABLED?chooseRcSource():RC_PPM;copyActiveRc(rc,src);String rx=receiverHealth();uint32_t age=receiverAgeMs();
  if(!FLIGHT_CONTROL_ENABLED&&!effectiveArmed()){Wire.begin(I2C_SDA_PIN,I2C_SCL_PIN,100000);delay(1);ImuSample sample;if(readAnyImu(sample)){lastImu=sample;lastImuValid=true;}Wire.end();if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);}
  bool imuFresh=lastImuValid&&(uint32_t)(millis()-lastImu.sampledAt)<2500UL;String imuHealth=lastImuValid?(imuFresh?"OK":"STALE"):"NOT_FOUND";
  String j="{\"type\":\"telemetry\",\"source\":\""+String(FLIGHT_CONTROL_ENABLED?"flight_core":"bridge")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"flightMode\":\""+String(flightModeName(flightMode))+"\",\"rcSource\":\""+String(rcSourceName(src))+"\",\"roll\":"+String(FLIGHT_CONTROL_ENABLED?kalmanRoll:0.0f,3)+",\"pitch\":"+String(FLIGHT_CONTROL_ENABLED?kalmanPitch:0.0f,3)+",\"yaw\":"+String(FLIGHT_CONTROL_ENABLED?flightYaw:0.0f,3)+",\"gyroX\":"+String(FLIGHT_CONTROL_ENABLED?rateRoll:(lastImuValid?lastImu.gx:0.0f),4)+",\"gyroY\":"+String(FLIGHT_CONTROL_ENABLED?ratePitch:(lastImuValid?lastImu.gy:0.0f),4)+",\"gyroZ\":"+String(FLIGHT_CONTROL_ENABLED?rateYaw:(lastImuValid?lastImu.gz:0.0f),4)+",\"accX\":"+String(lastImuValid?lastImu.ax:0.0f,6)+",\"accY\":"+String(lastImuValid?lastImu.ay:0.0f,6)+",\"accZ\":"+String(lastImuValid?lastImu.az:0.0f,6)+",\"imuModel\":\""+String(imuName(detectedImu))+"\",\"sampleMs\":"+String(lastImuValid?lastImu.sampledAt:0)+",\"battery\":null,\"batteryValid\":false,\"armed\":"+String(effectiveArmed()?"true":"false");
  j+=",\"rc\":[";for(int i=0;i<10;i++){if(i)j+=",";j+=String(rc[i]);}j+="]";
  j+=",\"expansion\":"+expansionJson();j+=",\"motors\":["+String((int)motorInput[0])+","+String((int)motorInput[1])+","+String((int)motorInput[2])+","+String((int)motorInput[3])+"]";
  j+=",\"rcAgeMs\":"+String(src==RC_PPM?(age==0xFFFFFFFFUL?999999UL:age):(webRcLastMs?(uint32_t)(millis()-webRcLastMs):999999UL))+",\"receiverHealth\":\""+rx+"\"";
  j+=",\"imuHealth\":\""+imuHealth+"\",\"barometerHealth\":\"NOT_FOUND\",\"lidarHealth\":\"NOT_FOUND\",\"loopCount\":"+String(flightLoopCount)+",\"maxLoopGapUs\":"+String(maxFlightLoopGapUs)+",\"loopOverruns\":"+String(flightLoopOverruns)+",\"outputWatchdogTripped\":"+String(flightWatchdogTripped?"true":"false")+",\"outputWatchdogTrips\":"+String(flightWatchdogTrips)+",\"ppmFrameHz\":"+String(ppmFrameHz)+",\"webRcFrameHz\":"+String(webRcFrameHz)+",\"flightLoopHz\":"+String(flightLoopHz);
  j+=",\"sensorHealth\":{\"imu\":\""+imuHealth+"\",\"barometer\":\"NOT_FOUND\",\"lidar\":\"NOT_FOUND\",\"receiver\":\""+rx+"\"}}";sendJson(200,j);
}
void acquireApi(){String id=server.arg("clientId");id.trim();if(server.hasArg("expectedDeviceId")&&!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){sendMessage(409,"Device ID mismatch: control belongs to another kit");return;}if(id.length()<4){sendMessage(400,"Invalid browser session ID");return;}if(setupMode&&(wifiTestState==WT_RUNNING||wifiTestState==WT_SUCCESS)){sendMessage(423,"Control unavailable during Wi-Fi setup/restart");return;}expireLock();if(!controlOwner.length()||controlOwner==id){controlOwner=id;controlExpiresAt=millis()+LOCK_TIMEOUT_MS;sendJson(200,"{\"ok\":true,\"lockMine\":true,\"lockTimeoutMs\":"+String(LOCK_TIMEOUT_MS)+"}");return;}sendMessage(423,"Another browser is controlling this kit. View-only mode is active.");}
void lockPingApi(){if(!requireControl())return;controlExpiresAt=millis()+LOCK_TIMEOUT_MS;sendJson(200,"{\"ok\":true}");}
void releaseApi(){String id=server.arg("clientId");if(server.hasArg("expectedDeviceId")&&!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){sendMessage(409,"Device ID mismatch: release belongs to another kit");return;}if(lockMine(id)){if(webRcFresh()||activeRcSource==RC_WEB_AP||activeRcSource==RC_WEB_STA)disarmFlight("control released");armLowSeen=false;webRcLastMs=0;controlOwner="";controlExpiresAt=0;}sendJson(200,"{\"ok\":true}");}
int parseRcCsv(const String& csv,uint16_t out[10]){int n=0,start=0;while(n<10&&start<(int)csv.length()){int comma=csv.indexOf(',',start);String part=comma<0?csv.substring(start):csv.substring(start,comma);part.trim();if(!part.length()||part.length()>4)return -1;for(size_t k=0;k<part.length();k++)if(!isdigit((unsigned char)part[k]))return -1;long v=part.toInt();if(v<1000||v>2000)return -1;out[n++]=(uint16_t)v;if(comma<0)break;start=comma+1;if(start>=(int)csv.length())return -1;}if(n==10&&csv.indexOf(',',start)>=0)return -1;return n;}
void commandApi(){
  String type=server.arg("type");
  if(server.hasArg("expectedDeviceId")&&!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){sendMessage(409,"Device ID mismatch: this command belongs to another kit");return;}
  if(type=="ping"){sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"ping\",\"message\":\"PONG from "+jsonEscape(kitName)+" / "+deviceId+"\"}");return;}
  // Read-only commands intentionally work in View Only mode. They never alter motors, PID, calibration or RC state.
  if(type=="pid_get"){sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"pid_get\",\"pid\":"+pidJson()+"}");return;}
  if(type=="receiver_read"||type=="ppm_read"){uint16_t rc[10];RcSourceKind src=chooseRcSource();copyActiveRc(rc,src);String j="{\"ok\":true,\"type\":\"ack\",\"command\":\"receiver_read\",\"source\":\""+String(rcSourceName(src))+"\",\"ppmFresh\":"+String(receiverFresh()?"true":"false")+",\"channels\":[";for(int i=0;i<10;i++){if(i)j+=",";j+=String(rc[i]);}j+="],\"ppmFrameHz\":"+String(ppmFrameHz)+",\"webRcFrameHz\":"+String(webRcFrameHz)+",\"flightLoopHz\":"+String(flightLoopHz)+"}";sendJson(200,j);return;}
  if(type=="attitude_read"){uint32_t age=lastFlightSampleMs?(uint32_t)(millis()-lastFlightSampleMs):0xFFFFFFFFu;String j="{\"ok\":true,\"type\":\"ack\",\"command\":\"attitude_read\",\"source\":\"MPU6050_KALMAN\",\"flightReady\":"+String(flightReady?"true":"false")+",\"sampleMs\":"+String(lastFlightSampleMs)+",\"sampleAgeMs\":"+String(age)+",\"roll\":"+String(kalmanRoll,3)+",\"pitch\":"+String(kalmanPitch,3)+",\"yaw\":"+String(flightYaw,3)+",\"accRoll\":"+String(accAngleRoll,3)+",\"accPitch\":"+String(accAnglePitch,3)+",\"rateRoll\":"+String(rateRoll,3)+",\"ratePitch\":"+String(ratePitch,3)+",\"rateYaw\":"+String(rateYaw,3)+"}";sendJson(200,j);return;}
  if(type=="calibration_get"){sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"calibration_get\",\"calibration\":"+calibrationJson()+"}");return;}
  if(type=="pinmap_get"||type=="gps_read"||type=="matrix_read"||type=="gpio_read"||type=="i2c_read"||type=="led_read"){expansionReadCommand(type);return;}
  if(type=="bench_status"){sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"bench_status\",\"benchMode\":"+String((int)benchMode)+",\"motor\":"+String((int)benchMotor)+",\"pulse\":"+String((int)benchPulse)+"}");return;}

  // Everything below this line changes hardware state and requires the selected browser to own control.
  if(!requireControl())return;
  if(type=="ap_credentials"){
    sendJson(200,"{\"ok\":true,\"apSsid\":\""+jsonEscape(apName)+"\",\"apPassword\":\""+jsonEscape(apPassword)+"\",\"deviceId\":\""+deviceId+"\"}");return;
  }
  if(type=="network_mode_set"){
    if(server.arg("mode")!="AP"){sendMessage(400,"Choose AP mode from Settings");return;}
    if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Network mode change blocked while armed or bench outputs active");return;}
    if(setupMode){sendMessage(409,"AP mode is already active");return;}
    updateApName();setPreferredApMode(true);
    sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"network_mode_set\",\"apSsid\":\""+jsonEscape(apName)+"\",\"apPassword\":\""+jsonEscape(apPassword)+"\",\"deviceId\":\""+deviceId+"\",\"message\":\"Restarting in AP mode. Connect to this kit AP and open http://192.168.4.1/\"}");
    restartAt=millis()+900;return;
  }
  if(type=="led_set"){expansionWriteCommand(type);return;}
  if(type=="motor_map_set"||type=="ppm_config"||type=="servo_config"||type=="servo_write"||type=="gps_config"||type=="gpio_write"||type=="gpio_release"||type=="matrix_config"||type=="matrix_write"||type=="i2c_write"){expansionWriteCommand(type);return;}
  if(type=="pid_set"){
    if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"PID write is not available on this board profile.");return;}if(effectiveArmed()){sendMessage(423,"PID edit blocked while armed. Land, disarm, then tune.");return;}if(benchMode!=BENCH_NONE){sendMessage(423,"PID edit blocked during bench motor/ESC operation.");return;}
    FlightPidSettings next=flightPid;readPidArgs(next);if(!pidConfigValid(next)){sendMessage(400,"PID values outside guarded limits. Rate P 0-8, I 0-50, D 0-0.2; outer angle P/I 0-10, D 0-0.5.");return;}flightPid=next;resetFlightPid();savePidSettings();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"pid_set\",\"saved\":true,\"pid\":"+pidJson()+",\"message\":\"PID saved to FlightCore NVS\"}");return;
  }
  if(type=="pid_defaults"){if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"PID restore unavailable on this board profile.");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"PID restore blocked while armed or during bench output.");return;}setPidDefaults();savePidSettings();resetFlightPid();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"pid_defaults\",\"pid\":"+pidJson()+"}");return;}
  if(type=="calibration_set"){
    if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Persistent flight calibration is unavailable on this board profile.");return;}if(effectiveArmed()){sendMessage(423,"Calibration edit blocked while armed.");return;}if(benchMode!=BENCH_NONE){sendMessage(423,"Calibration edit blocked during bench output.");return;}
    float axo=argFloat("accelOffsetX",accelOffsetX),ayo=argFloat("accelOffsetY",accelOffsetY),azo=argFloat("accelOffsetZ",accelOffsetZ),rt=argFloat("levelTrimRoll",levelTrimRoll),pt=argFloat("levelTrimPitch",levelTrimPitch);if(!calibrationValid(axo,ayo,azo,rt,pt)){sendMessage(400,"Calibration outside guarded limits: accel offsets +/-0.5 g, level trim +/-10 deg.");return;}accelOffsetX=axo;accelOffsetY=ayo;accelOffsetZ=azo;levelTrimRoll=rt;levelTrimPitch=pt;saveCalibrationSettings();kalmanRollUnc=kalmanPitchUnc=4;resetFlightPid();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"calibration_set\",\"saved\":true,\"calibration\":"+calibrationJson()+",\"message\":\"Level calibration saved to FlightCore NVS\"}");return;
  }
  if(type=="calibration_defaults"){if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Calibration restore unavailable on this board profile.");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Calibration restore blocked while armed or during bench output.");return;}setCalibrationDefaults();saveCalibrationSettings();kalmanRollUnc=kalmanPitchUnc=4;sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"calibration_defaults\",\"calibration\":"+calibrationJson()+"}");return;}
  if(type=="level_calibrate"||type=="calibrate_level"){
    if(!FLIGHT_CONTROL_ENABLED||detectedImu!=IMU_MPU6050){sendMessage(403,"Level calibration requires the A2 MPU6050 flight profile.");return;}if(effectiveArmed()){sendMessage(423,"Level calibration blocked while armed.");return;}if(benchMode!=BENCH_NONE){sendMessage(423,"Level calibration blocked during bench output.");return;}
    int requested=server.hasArg("samples")?server.arg("samples").toInt():400;int samples=constrain(requested,100,1000),good=0;float sx=0,sy=0,sz=0,sgx=0,sgy=0,sgz=0,sxx=0,syy=0,szz=0;for(int i=0;i<samples;i++){float rr,rp,ry,ax,ay,az;if(readMpuFlight(rr,rp,ry,ax,ay,az)){float rawX=ax-accelOffsetX,rawY=ay-accelOffsetY,rawZ=az-accelOffsetZ;sx+=rawX;sy+=rawY;sz+=rawZ;sxx+=rawX*rawX;syy+=rawY*rawY;szz+=rawZ*rawZ;sgx+=rr;sgy+=rp;sgz+=ry;good++;}delay(2);}if(good<(int)(samples*.9f)){sendMessage(500,"Level calibration failed: unstable MPU6050 reads.");return;}float mx=sx/good,my=sy/good,mz=sz/good,noise=sqrtf(fmaxf(0.0f,(sxx+syy+szz)/good-(mx*mx+my*my+mz*mz)));if(noise>0.035f||fabsf(mx)>0.20f||fabsf(my)>0.20f||mz<0.75f||mz>1.25f){sendMessage(400,"Level capture requires a level, motionless, Z-up frame. Keep propellers removed and retry.");return;}float axo=-mx,ayo=-my,azo=1.0f-mz;if(!calibrationValid(axo,ayo,azo,levelTrimRoll,levelTrimPitch)){sendMessage(400,"Calculated level offsets are outside safe limits. Check mounting/orientation.");return;}accelOffsetX=axo;accelOffsetY=ayo;accelOffsetZ=azo;gyroBiasRoll=sgx/good;gyroBiasPitch=sgy/good;gyroBiasYaw=sgz/good;saveCalibrationSettings();float rr,rp,ry;if(readMpuFlight(rr,rp,ry,accX,accY,accZ)){accAngleRoll=atan2f(accY,sqrtf(accX*accX+accZ*accZ))*57.2957795f+levelTrimRoll;accAnglePitch=-atan2f(accX,sqrtf(accY*accY+accZ*accZ))*57.2957795f+levelTrimPitch;kalmanRoll=accAngleRoll;kalmanPitch=accAnglePitch;kalmanRollUnc=kalmanPitchUnc=4;}resetFlightPid();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"level_calibrate\",\"samples\":"+String(good)+",\"calibration\":"+calibrationJson()+",\"message\":\"Level accelerometer offsets and gyro bias captured\"}");return;
  }
  if(type=="calibrate_gyro"){
    if(effectiveArmed()){sendMessage(423,"Gyro calibration blocked while armed.");return;}if(benchMode!=BENCH_NONE){sendMessage(423,"Gyro calibration blocked during bench output.");return;}setupFlightCore();if(flightReady)sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"calibrate_gyro\",\"calibration\":"+calibrationJson()+",\"message\":\"Gyro calibrated\"}");else sendMessage(500,"Gyro calibration failed. Keep frame level/still and check MPU6050.");return;
  }
  if(type=="motor_stop"){benchStop();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"motor_stop\"}");return;}
  if(type=="motor_test"){
    if(!FLIGHT_CONTROL_ENABLED||!escPwmReady){sendMessage(403,"Motor outputs unavailable on this board profile.");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Motor test blocked while armed or another bench test is running.");return;}if(!propsRemovedConfirmed()){sendMessage(412,"Motor test requires confirm=PROPS_REMOVED.");return;}int motor=constrain(server.arg("motor").toInt(),1,4),pulse=constrain(server.arg("pulse").toInt(),1050,1300),duration=constrain(server.arg("durationMs").toInt(),100,3000);benchMode=BENCH_MOTOR;benchMotor=motor;benchPulse=pulse;benchUntilMs=millis()+duration;directMotorPulse(motor-1,pulse);sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"motor_test\",\"motor\":"+String(motor)+",\"pulse\":"+String(pulse)+",\"durationMs\":"+String(duration)+"}");return;
  }
  if(type=="motor_order_test"){
    if(!FLIGHT_CONTROL_ENABLED||!escPwmReady){sendMessage(403,"Motor outputs unavailable on this board profile.");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Motor order test blocked while armed or another bench test is running.");return;}if(!propsRemovedConfirmed()){sendMessage(412,"Motor order test requires confirm=PROPS_REMOVED.");return;}benchMode=BENCH_MOTOR_SEQUENCE;benchSequenceMotor=1;benchStageUntilMs=millis()+700;directMotorPulse(0,1200);sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"motor_order_test\",\"message\":\"M1-M4 sequence started\"}");return;
  }
  if(type=="esc_calibrate"){
    if(!FLIGHT_CONTROL_ENABLED||!escPwmReady){sendMessage(403,"ESC outputs unavailable on this board profile.");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"ESC calibration blocked while armed or another bench test is running.");return;}if(!propsRemovedConfirmed()){sendMessage(412,"ESC calibration requires confirm=PROPS_REMOVED.");return;}benchMode=BENCH_ESC_CAL;benchEscStage=0;benchStageUntilMs=millis()+3000;allMotorPulse(2000);sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"esc_calibrate\",\"message\":\"ESC calibration started: 3 s high, then 3 s low\"}");return;
  }
  if(type=="rc_frame"){
    if(!ALLOW_WEB_RC||!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Real web/AP RC is not enabled on this board profile.");return;}if(benchMode!=BENCH_NONE){sendMessage(423,"RC blocked during bench motor/ESC operation.");return;}
    uint16_t next[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};int count=parseRcCsv(server.arg("channels"),next);if(count<6){sendMessage(400,"rc_frame requires at least CH1..CH6");return;}
    for(int i=0;i<10;i++)webRcCh[i]=next[i];webRcLastMs=millis();webRcFrames++;RcSourceKind chosen=chooseRcSource();sendJson(200,"{\"ok\":true,\"type\":\"ack\",\"command\":\"rc_frame\",\"activeSource\":\""+String(rcSourceName(chosen))+"\",\"message\":\"RC frame accepted\"}");return;
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
  if(!requireControl())return;if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Wi-Fi change blocked while armed or bench outputs active");return;}String ssid=server.arg("ssid"),pass=server.arg("password");ssid.trim();if(!ssid.length()){sendMessage(400,"Wi-Fi SSID is required");return;}saveWiFi(ssid,pass,true);setPreferredApMode(false);setForceSetupFlag(false);sendMessage(200,"Wi-Fi profile saved. Kit will restart and try this network first.");restartAt=millis()+900;
}
void useWifiApi(){
  if(!requireControl())return;if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Wi-Fi change blocked while armed or bench outputs active");return;}String ssid=server.arg("ssid");if(savedIndex(ssid)<0){sendMessage(404,"Saved Wi-Fi profile not found");return;}setPreferredWiFi(ssid);setPreferredApMode(false);setForceSetupFlag(false);sendMessage(200,"Preferred Wi-Fi selected. Kit will restart.");restartAt=millis()+900;
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
  String h=R"rawliteral(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ZEBJUS FlightCore • AP Setup</title>
<style>
:root{color-scheme:dark;--bg:#07131d;--card:#102430;--line:#315467;--muted:#a8c0cb;--mint:#67eac0}*{box-sizing:border-box}html,body{margin:0;min-height:100%;background:var(--bg);color:#edf8fd;font:15px/1.5 system-ui,-apple-system,Segoe UI,sans-serif}body{padding:clamp(12px,4vw,24px)}main{max-width:880px;margin:auto}header{display:flex;align-items:center;gap:14px;margin-bottom:15px}.logo{width:46px;height:46px;flex:none;border-radius:14px;background:linear-gradient(135deg,#40e5b3,#318fe6);color:#07131d;display:grid;place-items:center;font-weight:950;font-size:27px}h1{font-size:clamp(20px,4vw,28px);margin:0}p{color:var(--muted);margin:6px 0 14px}nav{display:flex;gap:8px;overflow:auto;padding:5px 0 14px}button,a.button{cursor:pointer;min-height:44px;border:1px solid var(--line);border-radius:12px;padding:9px 14px;background:#173745;color:white;font:inherit;font-weight:700;text-decoration:none;text-align:center}button.active,button.primary,a.primary{background:#138760;border-color:#25b788}button.danger{background:#63333e}button:disabled{opacity:.55;cursor:not-allowed}.card{border:1px solid var(--line);border-radius:18px;padding:clamp(15px,3vw,24px);background:var(--card);box-shadow:0 12px 35px #0002;margin-bottom:12px}.page{display:none}.page.active{display:block}h2{font-size:19px;margin:0 0 10px}label{display:block;color:#bfd6df;font-size:13px;margin:15px 0 4px}input,select{width:100%;min-height:46px;border:1px solid var(--line);border-radius:10px;background:#091923;color:#fff;padding:9px;font:inherit}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.actions>*{flex:1 1 170px}.kv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.kv>div{min-width:0;background:#091923;border-radius:10px;padding:10px}.kv small{display:block;color:var(--muted)}.kv b{display:block;overflow-wrap:anywhere;color:var(--mint)}.log{white-space:pre-wrap;overflow-wrap:anywhere;min-height:64px;background:#071923;border:1px solid #294555;border-radius:10px;padding:12px;color:var(--mint)}.hint{font-size:12px;color:var(--muted)}.id{font:12px/1.45 ui-monospace,monospace;overflow-wrap:anywhere}@media(max-width:540px){.kv{grid-template-columns:1fr}header{align-items:flex-start}nav button{white-space:nowrap;flex:1}body{padding:12px}.actions>*{flex-basis:100%}}
</style></head><body><main>
<header><div class="logo">Z</div><div><h1>Aerion Flight App</h1><p>Settings • kit Wi-Fi and diagnostics</p></div></header>
<nav aria-label="AP pages"><a class="button primary" href="/">← Flight App</a><button type="button" class="active" data-page="wifi">Wi-Fi setup</button><button type="button" data-page="status">Kit status</button><button type="button" data-page="control">More controls</button></nav>
<section id="page-wifi" class="page active card"><h2>Connect this kit to school Wi-Fi</h2><p>Use a unique kit name or leave it empty for zebjus_drone_1, zebjus_drone_2… Saved Wi-Fi is activated only after a successful test.</p>
<div class="kv"><div><small>Permanent Device ID</small><b class="id">{{DEVICE_ID}}</b></div><div><small>AP network</small><b class="id">{{AP_NAME}}</b></div></div><p class="hint">Use the unique password recorded on this kit's case. AP and saved Wi-Fi are separate modes; this AP remains active after power cycles until you activate saved Wi-Fi.</p>
<label for="name">Kit name (optional)</label><input id="name" maxlength="28" placeholder="Automatic name" value="{{KIT_NAME}}">
<label for="wifi">Nearby networks</label><select id="wifi"><option value="">Scan nearby Wi-Fi</option></select><div class="actions"><button id="scan" type="button">Scan Wi-Fi</button></div>
<p class="hint">Kit AP password: <b>12345678</b>. Use the unique kit SSID on its case.</p><label for="ssid">Wi-Fi SSID (you can type a hidden network)</label><input id="ssid" autocomplete="off" placeholder="School Wi-Fi network name">
<label for="pass">Wi-Fi password</label><input id="pass" type="password" autocomplete="new-password" placeholder="Network password">
<div class="actions"><button class="primary" id="save" type="button">Save &amp; test Wi-Fi</button></div>
<p class="hint">Credentials are saved only after the kit connects successfully. Keep this page open until verification finishes.</p><div class="log" id="out" role="status">Ready. Scan Wi-Fi or type an SSID.</div><a class="button primary" id="openWeb" hidden href="#">Open Drone Lab</a>
</section>
<section id="page-status" class="page card"><h2>Connection and kit identity</h2><div class="kv"><div><small>Device</small><b id="sName">--</b></div><div><small>Board</small><b id="sBoard">--</b></div><div><small>Network mode</small><b id="sMode">--</b></div><div><small>STA Wi-Fi / signal</small><b id="sSsid">--</b></div><div><small>IP address</small><b id="sIp">--</b></div><div><small>Firmware / IMU</small><b id="sFirmware">--</b></div><div><small>Flight</small><b id="sFlight">--</b></div><div><small>Control source</small><b id="sSource">--</b></div></div>
<div class="actions"><button id="refresh" type="button">Refresh status</button></div><p class="hint">Saved Wi-Fi profiles (passwords are never displayed):</p><div class="log" id="profiles">Reading…</div>
<div class="actions"><button class="primary" id="returnWifi" type="button">Activate saved Wi-Fi mode</button></div><p class="hint">This keeps saved profiles and restarts the kit. If the network cannot be reached, this kit stays in AP mode until you choose Wi-Fi here again. Disarm and stop bench outputs first.</p>
<div class="actions"><button id="forget" type="button">Forget all Wi-Fi</button><button class="danger" id="reset" type="button">Factory reset</button></div></section>
<section id="page-control" class="page card"><h2>Direct AP flight control</h2><p>The Flight App has touch sticks, keyboard control and live telemetry. It uses a control lock and a short RC timeout. Confirm motor order and frame orientation before any flight.</p><a class="button primary" href="/">Open Flight App →</a><a class="button" href="/io">Open hardware I/O →</a><p class="hint">Drone Lab on school Wi-Fi connects by verified Device ID. When this kit restarts into STA, reconnect your phone or laptop to the same school Wi-Fi.</p></section>
</main><script>
const $=id=>document.getElementById(id);let timer=0;
function page(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id==='page-'+id));document.querySelectorAll('nav button').forEach(x=>x.classList.toggle('active',x.dataset.page===id));if(id==='status')refreshStatus()}
document.querySelectorAll('nav button').forEach(x=>x.onclick=()=>page(x.dataset.page));
async function json(path,options){const response=await fetch(path,{cache:'no-store',...options});const data=await response.json();if(!response.ok)throw Error(data.message||'Request failed');return data}
async function scan(){const out=$('out');out.textContent='Scanning nearby Wi-Fi…';try{const d=await json('/api/wifi/scan');const list=$('wifi');list.replaceChildren();for(const x of d.networks||[]){const opt=new Option(`${x.ssid} (${x.rssi} dBm)${x.secure?' 🔒':''}`,x.ssid);list.add(opt)}if(!list.options.length)list.add(new Option('No networks found',''));out.textContent=`${(d.networks||[]).length} network(s) found.`}catch(e){out.textContent=e.message}}
$('scan').onclick=scan;$('wifi').onchange=e=>{$('ssid').value=e.target.value};
async function testWifi(){const ssid=$('ssid').value.trim()||$('wifi').value,name=$('name').value.trim(),password=$('pass').value;if(!ssid){$('out').textContent='Enter or select a Wi-Fi SSID.';return}const save=$('save');save.disabled=true;$('out').textContent='Testing Wi-Fi and checking kit name…';$('openWeb').hidden=true;try{await json('/api/setup/test',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name,ssid,password})});clearInterval(timer);timer=setInterval(checkTest,700);checkTest()}catch(e){save.disabled=false;$('out').textContent=e.message}}
async function checkTest(){try{const d=await json('/api/setup/test/status');if(d.status==='testing'){$('out').textContent=`Testing ${d.ssid||'Wi-Fi'}…`;return}clearInterval(timer);$('save').disabled=false;if(d.status==='failed'){$('out').textContent=`Setup failed: ${d.message}. Nothing was saved; AP remains active.`;return}if(d.status==='success'){$('out').textContent=`Wi-Fi verified ✓\nKit name: ${d.name}\nDevice ID: ${d.deviceId}\nReconnect your phone/computer to ${d.ssid} after kit restart. Then open the same Wi-Fi Drone Lab.`;if(d.redirect){$('openWeb').href=d.redirect;$('openWeb').hidden=false}}}catch(e){$('out').textContent=`Setup status unavailable: ${e.message}`}}
async function refreshStatus(){try{const d=await json('/api/status');$('sName').textContent=d.name||'Automatic on STA';$('sBoard').textContent=d.boardName||'--';$('sMode').textContent=d.mode||'--';$('sSsid').textContent=d.connected?`${d.ssid} • ${d.rssi} dBm`:'Not connected to STA';$('sIp').textContent=d.ip||'--';$('sFirmware').textContent=`${d.firmware||'--'} • ${d.imuModel||'--'}`;$('sFlight').textContent=`${d.armed?'ARMED':'DISARMED'} • ${d.flightMode||'--'}`;$('sSource').textContent=d.rcSource||'NONE';const saved=await json('/api/wifi/saved');$('profiles').textContent=(saved.profiles||[]).map(x=>`${x.ssid}${x.preferred?' • preferred':''}${x.current?' • current':''}`).join('\n')||'No saved networks'}catch(e){$('profiles').textContent=e.message}}
async function admin(path,question){if(!confirm(question))return;try{const d=await json(path,{method:'POST'});$('profiles').textContent=d.message||'Kit restarting…'}catch(e){$('profiles').textContent=e.message}}
$('save').onclick=testWifi;$('refresh').onclick=refreshStatus;$('returnWifi').onclick=()=>admin('/api/wifi/sta','Restart this kit on its saved Wi-Fi? The AP connection will close.');$('forget').onclick=()=>admin('/api/wifi/reset','Forget all saved Wi-Fi networks?');$('reset').onclick=()=>admin('/api/factory-reset','Reset Kit Name, Wi-Fi, PID and level calibration?');
setTimeout(scan,250);
</script></body></html>)rawliteral";
  h.replace("{{DEVICE_ID}}",htmlEscape(deviceId));
  h.replace("{{AP_NAME}}",htmlEscape(apName));
  h.replace("{{KIT_NAME}}",htmlEscape(kitName));
  return h;
}
String flyPage(){return R"rawliteral(<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#08090b"><title>ZEBJUS Aerion • Flight App</title><style>
:root{color-scheme:dark;--blue:#12c7ff;--muted:#8a919a;--ring:clamp(170px,32vh,290px)}*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#08090b;color:#f4f6f8;font:14px system-ui,-apple-system,sans-serif}button,a,input{font:inherit}button{cursor:pointer;color:inherit;border:0}button:disabled{opacity:.35;cursor:default}button:focus-visible,a:focus-visible,input:focus-visible{outline:2px solid var(--blue);outline-offset:4px}svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.symbols{position:absolute;width:0;height:0;overflow:hidden}[hidden]{display:none!important}#flightApp{height:100dvh;width:100%;position:relative;overflow:hidden;user-select:none;background:radial-gradient(ellipse at 50% 30%,#17191d55,transparent 55%)}.top{position:absolute;z-index:3;top:max(16px,env(safe-area-inset-top));left:max(20px,env(safe-area-inset-left));right:max(20px,env(safe-area-inset-right));height:48px;display:flex;align-items:center;gap:14px}.round{width:44px;height:44px;flex:none;border-radius:50%;background:#ffffff0c;border:1px solid #ffffff20;display:grid;place-items:center}.round:hover{background:#ffffff20}.arm{color:var(--blue)}.arm.active{color:#ff7575;border-color:#a84646}.brand{flex:none;letter-spacing:.18em;font-size:12px;font-weight:800}.brand small{display:block;color:#747b85;font-size:9px;letter-spacing:.27em;margin-top:3px}.connection{background:none;display:flex;gap:9px;align-items:center;min-width:0;max-width:310px;margin-left:auto;text-align:left;padding:6px}.connection svg{flex:none;color:#68717c}.connection.online svg{color:var(--blue)}.connection span{min-width:0}.connection b{display:block;font-size:12px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden}.connection small{display:block;font-size:10px;color:var(--muted);margin-top:3px}.state{font-size:10px;letter-spacing:.1em;color:#9ba3ac;min-width:48px;text-align:center}.state.active{color:#ff7575}.mode{height:34px;min-width:76px;border:1px solid #ffffff30;border-radius:18px;background:none;font-size:11px;font-weight:700}.stop{height:34px;padding:0 16px;color:#ff8888;background:#cc404019;border:1px solid #cc404040;border-radius:18px;font-size:11px;font-weight:800}.battery{font-size:11px;color:#b8c4be}.watermark{position:absolute;top:32%;width:100%;text-align:center;font-size:clamp(40px,9vw,110px);font-weight:800;letter-spacing:.25em;color:#ffffff03;pointer-events:none}.hero{position:absolute;z-index:2;top:28%;left:50%;transform:translateX(-50%);text-align:center;width:min(340px,56vw)}.hero h1{font-size:clamp(20px,3vw,30px);margin:0 0 8px;font-weight:500}.hero p{font-size:12px;color:var(--muted);line-height:1.6;margin:0 0 17px}.primary{color:#02131b;background:var(--blue);padding:12px 24px;border-radius:7px;font-weight:800;min-height:44px}.primary:hover{background:#6cddff}.identity{position:absolute;top:80px;left:0;right:0;text-align:center;font-size:10px;letter-spacing:.04em;color:#737b87;padding:0 18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;pointer-events:none}.zone{position:absolute;bottom:max(35px,env(safe-area-inset-bottom));width:38%;height:55%;touch-action:none}.zone.left{left:3%}.zone.right{right:3%}.base{width:var(--ring);height:var(--ring);position:absolute;left:50%;top:58%;transform:translate(-50%,-50%);border-radius:50%;background:radial-gradient(circle,#41464d0c 0 41%,#6e72781b 42% 65%,#696d7542 66% 70%,#262a3099 71% 80%);border:1px solid #a4a9b033;box-shadow:inset 0 0 0 12px #0e101466;pointer-events:none;transition:opacity .15s}.zone.disabled .base{opacity:.35}.knob{width:30%;height:30%;border-radius:50%;position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 40% 30%,#b0b4ba,#777c84 62%,#555a62);border:2px solid #c4c8cf44;box-shadow:0 5px 18px #0009,inset 0 0 0 5px #73788066}.base .dir{position:absolute;color:#bdc2cb88;width:20px;height:20px}.dir.up{left:calc(50% - 10px);top:11%;transform:rotate(-90deg)}.dir.down{left:calc(50% - 10px);bottom:11%;transform:rotate(90deg)}.dir.east{right:11%;top:calc(50% - 10px)}.dir.west{left:11%;top:calc(50% - 10px);transform:rotate(180deg)}.yaw{position:absolute;font-size:25px;color:#bdc2cb88;top:calc(50% - 18px)}.yaw.west{left:11%}.yaw.east{right:11%}.caption{position:absolute;bottom:-20px;text-align:center;width:100%;font-size:10px;color:#757e89;letter-spacing:.16em;pointer-events:none}.throttle{position:absolute;bottom:36px;left:50%;transform:translateX(-50%);width:125px;text-align:center;font-size:10px;color:#9da6b1;letter-spacing:.1em}.track{height:3px;background:#ffffff15;margin:9px 0 0;border-radius:3px;overflow:hidden}.track i{display:block;width:0;height:100%;background:var(--blue)}.hint{position:absolute;bottom:12px;left:44%;right:44%;color:#656e79;font-size:9px;text-align:center;white-space:nowrap}.notice{position:absolute;z-index:5;top:105px;left:50%;transform:translateX(-50%);width:max-content;max-width:80%;padding:10px 16px;color:#e3ecf2;background:#222933ee;border:1px solid #414c5b;border-radius:7px;font-size:12px;text-align:center;pointer-events:none}.portrait{display:none}dialog{border:1px solid #333942;background:#111318;color:#f3f5f8;border-radius:14px;padding:28px;width:min(860px,92vw);max-height:90dvh;overflow:auto;box-shadow:0 30px 100px #000a}dialog::backdrop{background:#000b;backdrop-filter:blur(5px)}.dialog-head{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:24px}.dialog-head h2{font-size:24px;font-weight:500;margin:0}.close{font-size:26px;background:none;color:#acb4c0;width:40px;height:40px}.connect-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:28px}.step{border-radius:7px;background:#1b2028;padding:15px;margin-bottom:10px;color:#b6dff0;line-height:1.65;font-size:13px}.step b{color:var(--blue);font-weight:600}.step small{color:#929daa;display:block}.drone-art{display:block;width:100%;height:160px;stroke:#8793a0;stroke-width:3;align-self:center}.field{display:block;color:#8e9aa9;font-size:11px;margin-top:16px}.field input{display:block;width:100%;margin-top:7px;border:1px solid #39424e;border-radius:6px;background:#0b0e13;color:#e2ebf4;padding:10px;font-size:13px;user-select:text}.pair-bottom{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:24px}.pair-bottom p{font-size:12px;line-height:1.5;color:#9eabb9;margin:0;max-width:70%}.setting-row{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:15px 0;border-bottom:1px solid #292f38}.setting-row b{font-size:14px;font-weight:500}.setting-row small{display:block;font-size:11px;color:#8e9baa;margin-top:5px;line-height:1.5}.setting-row input{width:24px;height:24px;accent-color:var(--blue)}.read{font:12px/1.9 ui-monospace,monospace;color:#99b2c5;margin:20px 0;overflow-wrap:anywhere}.links{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.links a{color:var(--blue);text-decoration:none;font-size:12px;border:1px solid #324453;padding:10px 14px;border-radius:6px}.note{font-size:11px;color:#8b96a4;line-height:1.7}.secondary{border:1px solid #485566;border-radius:7px;background:none;padding:11px 18px;color:#c3cfdd;font-size:12px}@media(max-width:720px){.top{left:12px;right:12px;gap:9px}.brand{display:none}.connection{max-width:210px;margin-left:0;flex:1}.round{width:36px;height:36px}.mode{min-width:64px}.stop{padding:0 11px}#fullscreen{display:none}.state{min-width:40px}.hero{top:28%;width:42vw}.hero p{font-size:11px}.connect-grid{gap:14px}.drone-art{height:160px}.hint{display:none}.identity{top:70px}}@media(orientation:portrait){:root{--ring:clamp(145px,40vw,220px)}.top{gap:6px;flex-wrap:wrap;height:auto}.connection{max-width:none}.connection b{max-width:160px}.state{font-size:9px}.stop{padding:0 10px}.zone{width:46%;height:38%;bottom:70px}.zone.left{left:1%}.zone.right{right:1%}.hero{top:26%;width:80%}.hero h1{font-size:26px}.hero p{font-size:12px}.throttle{bottom:32px}.portrait{display:block;position:absolute;top:94px;left:0;width:100%;font-size:10px;color:#626b77;text-align:center}.connect-grid{grid-template-columns:1fr}.drone-art{display:none}dialog{padding:20px}.dialog-head{margin-bottom:16px}.dialog-head h2{font-size:22px}.pair-bottom{align-items:stretch;flex-direction:column}.pair-bottom p{max-width:100%}.caption{font-size:9px}.watermark{top:38%}.battery{display:none}}
@media(orientation:landscape) and (max-height:500px){dialog{padding:16px}.dialog-head{margin-bottom:12px}.dialog-head h2{font-size:21px}.connect-grid{gap:20px}.step{padding:9px 12px;margin-bottom:7px;font-size:11px;line-height:1.45}.step small{font-size:10px}.drone-art{height:70px}.field{margin-top:9px}.field input{margin-top:4px;padding:8px;font-size:12px}.pair-bottom{margin-top:12px}.pair-bottom p{font-size:10px}.primary{padding:10px 18px}.hero{top:25%}.hero h1{font-size:22px}.hero p{margin-bottom:10px}}
</style></head><body>
<svg class="symbols" aria-hidden="true"><defs><symbol id="i-up" viewBox="0 0 24 24"><path d="M12 19V5m-6 6 6-6 6 6M4 21h16"/></symbol><symbol id="i-settings" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="m9 3-1 3-3 1 1 3-3 2 3 2-1 3 3 1 1 3h6l1-3 3-1-1-3 3-2-3-2 1-3-3-1-1-3Z"/></symbol><symbol id="i-wifi" viewBox="0 0 24 24"><path d="M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="20" r=".6"/></symbol><symbol id="i-full" viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/></symbol><symbol id="i-arrow" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></symbol></defs></svg>
<main id="flightApp"><div class="watermark" aria-hidden="true">AERION</div><header class="top">
<button class="round arm" id="arm" disabled aria-label="Arm motors" title="ARM / DISARM"><svg><use href="#i-up"/></svg></button><button class="round" id="settings" aria-label="Flight settings"><svg><use href="#i-settings"/></svg></button><div class="brand">ZEBJUS<small>AERION FLIGHT</small></div>
<button class="connection" id="connect" aria-label="Connect drone"><svg><use href="#i-wifi"/></svg><span><b id="connectionLabel">DRONE DISCONNECTED</b><small id="networkLabel">Connect to your kit Wi-Fi</small></span></button><span id="battery" class="battery" hidden></span><b id="flightState" class="state">SAFE</b><button id="mode" class="mode" title="Change mode while disarmed"><span id="modeLabel">ANGLE</span></button><button class="stop" id="kill" title="Disarm and lower throttle">STOP</button><button id="fullscreen" class="round" aria-label="Full screen"><svg><use href="#i-full"/></svg></button></header>
<div id="identityHint" class="identity">LOCAL WI-FI • NO INTERNET REQUIRED</div><div class="portrait">Rotate your phone for a wider flight view</div><div class="notice" id="notice" role="status" hidden></div>
<section id="hero" class="hero"><h1 id="heroTitle">Connect your drone</h1><p id="heroText">Join your ZEBJUS kit Wi-Fi, then check the connection.</p><button id="heroAction" class="primary">Connect drone</button></section>
<div class="zone left disabled" id="left" aria-label="Left joystick: throttle and yaw"><div class="base"><svg class="dir up"><use href="#i-arrow"/></svg><svg class="dir down"><use href="#i-arrow"/></svg><span class="yaw west">↶</span><span class="yaw east">↷</span><i class="knob"></i></div><span class="caption">THROTTLE · YAW</span></div>
<div class="zone right disabled" id="right" aria-label="Right joystick: pitch and roll"><div class="base"><svg class="dir up"><use href="#i-arrow"/></svg><svg class="dir down"><use href="#i-arrow"/></svg><svg class="dir west"><use href="#i-arrow"/></svg><svg class="dir east"><use href="#i-arrow"/></svg><i class="knob"></i></div><span class="caption">PITCH · ROLL</span></div>
<div class="throttle">THROTTLE <b id="throttleValue">0%</b><div class="track"><i id="throttleFill"></i></div></div><div id="controlHint" class="hint">CONTROL OFF</div></main>
<dialog id="connectDialog"><div class="dialog-head"><h2>How to connect</h2><button class="close" data-close="connectDialog" aria-label="Close connection help">×</button></div><div class="connect-grid"><div><div class="step"><b>01</b> Power on your drone.<small>Wait for the kit's Wi-Fi network to appear.</small></div><div class="step"><b>02</b> Open your phone or laptop Wi-Fi settings.<small>Join this kit's unique network. AP password: 12345678. Keep the connection even if it says “No internet”.</small></div><div class="step"><b>03</b> Return here and check the connection.<small>In AP mode, open 192.168.4.1 in a normal browser. In STA mode, use the kit IP shown in its settings.</small></div></div><div class="connect-details"><svg class="drone-art" viewBox="0 0 300 240" aria-label="ZEBJUS quadcopter illustration"><path d="m90 65 55 52m65-52-55 52M90 180l55-52m65 52-55-52" stroke-width="16"/><rect x="123" y="85" width="55" height="65" rx="17" fill="#252e39"/><circle cx="78" cy="52" r="38"/><circle cx="222" cy="52" r="38"/><circle cx="78" cy="188" r="38"/><circle cx="222" cy="188" r="38"/><path d="M47 52h62m82 0h62M47 188h62m82 0h62" stroke="#14c6ff"/><text x="150" y="123" text-anchor="middle" fill="#dbe7f3" stroke="none" font-size="14" font-weight="700">Z</text></svg><label class="field">Kit address (optional)<input id="kitAddress" placeholder="192.168.4.1 or kit-name.local" autocomplete="off" spellcheck="false"></label><label class="field">Device ID on kit case (optional for first pairing)<input id="expectedId" placeholder="Exact Device ID" autocomplete="off" spellcheck="false"></label></div></div><div class="pair-bottom"><p id="pairMessage" role="status">Your browser cannot change Wi-Fi. Join the kit network in device settings first.</p><button class="primary" id="checkConnection">Check connection</button></div></dialog>
<dialog id="settingsDialog"><div class="dialog-head"><h2>Flight settings</h2><button class="close" data-close="settingsDialog" aria-label="Close settings">×</button></div><label class="setting-row"><span><b>Floating joysticks</b><small>Center appears where you touch. Left stays throttle/yaw; right stays pitch/roll.</small></span><input type="checkbox" id="floating" checked></label><div class="setting-row"><span><b>KEYBOARD</b><small>W / S throttle · A / D yaw · arrows pitch / roll<br>X or Escape stops · M changes mode while disarmed</small></span></div><div class="read">Device: <span id="deviceIdText">--</span><br>Controller: <span id="readyText">Not connected</span><br>Roll / pitch: <span id="angles">--</span><br>PPM input: <span id="ppmHz">--</span> · Web RC: <span id="webHz">--</span> · FC loop: <span id="fcHz">--</span></div><div class="links"><a id="wifiSettings" href="/setup">Kit Wi-Fi settings</a><a id="ioSettings" href="/io">Sensor / motor settings</a></div><p class="note">Up/down on the left stick raises/lowers throttle gradually. Throttle holds when released; pitch, roll and yaw center. This controller uses manual ARM/DISARM. Automatic take-off, landing and a drone video feed are not available.</p><button id="disconnect" class="secondary">Disconnect control</button> <button id="forget" class="secondary">Pair another kit</button></dialog>
<script>
(()=>{'use strict';
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),hosted=/\/flight\/(?:index\.html)?$/.test(location.pathname),params=new URLSearchParams(location.search),KNOWN='zebjus-known-kit';
function read(k,f){try{return JSON.parse(localStorage.getItem(k))??f}catch{return f}}function write(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}
const shared=read('zebjus.drone.knownKits.v183',[]),preferred=(()=>{try{return localStorage.getItem('zebjusV183LastKit')||''}catch{return ''}})(),saved=read(KNOWN,Array.isArray(shared)?shared.find(k=>k.deviceId===preferred)||shared[0]||{}:{}),channels=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000],held=new Set();
const newSession=()=>'FLY-'+Math.random().toString(36).slice(2)+Date.now().toString(36);let cid=newSession();
const state={base:'',deviceId:params.get('kitId')||saved.deviceId||'',name:params.get('kitName')||saved.name||'',online:false,own:false,tx:false,busy:false,epoch:0,txEpoch:0,manual:false,status:{},lastAck:0,lastStatus:0,lastFrame:0,armAt:0,wasArmed:false,fails:0,pending:null,cleanup:Promise.resolve(),floating:read('zebjus-flight-floating',true)};
const sticks={left:{x:0,y:0,pointer:null},right:{x:0,y:0,pointer:null}};let noticeTimer;
function notify(message){$('notice').textContent=message;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,4200)}
function address(value){value=value.trim();if(!value)return '';const u=new URL(value.includes('://')?value:'http://'+value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Enter a kit IP or local hostname.');return u.origin}
async function request(base,path,data,timeout=1000,id=''){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const body=data?{...data,...(id?{expectedDeviceId:id}:{})}:null;const r=await fetch(base+path,{method:body?'POST':'GET',body:body?new URLSearchParams(body):undefined,headers:body?{'Content-Type':'application/x-www-form-urlencoded'}:{},cache:'no-store',signal:ctl.signal});const result=await r.json();if(!r.ok||result.ok===false)throw Error(result.message||'Kit request failed');return result}catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw Error('Kit not found. Join its Wi-Fi and check the address.');throw e}finally{clearTimeout(timer)}}
const api=(path,data,timeout)=>request(state.base,path,data,timeout,state.deviceId);
function validate(s){if(s.kit!=='ZEBJUS_FLIGHTCORE'||!s.deviceId)throw Error('This address is not a ZEBJUS controller.');if(state.deviceId&&s.deviceId!==state.deviceId)throw Error('Different Device ID. Connect to your paired kit.');return s}
function remember(s){state.deviceId=s.deviceId;state.name=s.name||state.name||'Aerion';write(KNOWN,{...saved,deviceId:s.deviceId,name:state.name,ip:s.ip||new URL(state.base).hostname,base:state.base});$('expectedId').value=state.deviceId}
function candidates(){const custom=address($('kitAddress').value),list=[];if(custom)return [custom];if(!hosted)list.push(location.origin);if(params.get('kitId')===state.deviceId&&params.get('kitIp'))list.push(address(params.get('kitIp')));if(state.base)list.push(state.base);if(saved.base)list.push(address(saved.base));if(saved.ip)list.push(address(saved.ip));if(state.name){const host=state.name.toLowerCase().replace(/_/g,'-');if(/^[a-z0-9-]+$/.test(host))list.push(address(host+'.local'))}list.push('http://192.168.4.1');return [...new Set(list)]}
function render(){const s=state.status,active=state.own&&state.tx;$('connect').classList.toggle('online',state.online);$('connectionLabel').textContent=state.online?state.name:'DRONE DISCONNECTED';$('networkLabel').textContent=state.online?(String(s.mode).startsWith('AP')?'AP · Direct Wi-Fi':'STA · Local Wi-Fi'):'Connect to your kit Wi-Fi';$('identityHint').textContent=state.online?state.deviceId+' · '+(state.base?new URL(state.base).hostname:''):'LOCAL WI-FI · NO INTERNET REQUIRED';$('flightState').textContent=state.online&&s.armed?'ARMED':active?'CONTROL':'SAFE';$('flightState').classList.toggle('active',!!(state.online&&s.armed));$('arm').disabled=!active||!s.flightReady;$('arm').classList.toggle('active',channels[4]>1500||!!s.armed);$('arm').setAttribute('aria-label',channels[4]>1500||s.armed?'Disarm motors':'Arm motors');$('modeLabel').textContent=channels[5]>=1500?'RATE':'ANGLE';$('mode').disabled=channels[4]>1500||!!(state.online&&s.armed);$('hero').hidden=active;$('heroTitle').textContent=state.online?'Drone connected':'Connect your drone';$('heroText').textContent=state.online?(s.flightReady?'Take control, then tap ARM to start motors.':'Controller is not flight-ready. Check its profile and IMU.'):'Join your ZEBJUS kit Wi-Fi, then check the connection.';$('heroAction').textContent=state.online?'Take control':'Connect drone';$('heroAction').disabled=state.busy||(state.online&&!s.flightReady);for(const side of ['left','right'])$(side).classList.toggle('disabled',!active);const pct=Math.round((channels[2]-1000)/10);$('throttleValue').textContent=pct+'%';$('throttleFill').style.width=pct+'%';$('controlHint').textContent=active?'CONTROL ACTIVE':'CONTROL OFF';$('deviceIdText').textContent=state.deviceId||'--';$('readyText').textContent=state.online?(s.flightReady?'Flight-ready':'Not flight-ready'):'Not connected';$('wifiSettings').href=(state.base||'')+'/setup';$('ioSettings').href=(state.base||'')+'/io'}
function home(side){const b=$(side).querySelector('.base');b.style.left='50%';b.style.top='58%'}
function draw(side){const s=sticks[side],knob=$(side).querySelector('.knob');knob.style.left=(50+s.x*30)+'%';knob.style.top=(50+s.y*30)+'%'}
function resetInputs(){held.clear();for(const side of ['left','right']){const s=sticks[side],pointer=s.pointer;s.pointer=null;s.x=s.y=0;try{if(pointer!==null)$(side).releasePointerCapture(pointer)}catch{}home(side);draw(side)}}
function safeValues(){channels[0]=channels[1]=channels[3]=1500;channels[2]=channels[4]=1000;state.armAt=0;state.wasArmed=false;resetInputs();render()}
function stopControl(message='',offline=false){const had=state.own,base=state.base,id=state.deviceId,client=cid,pending=state.pending;state.txEpoch++;state.epoch++;state.busy=false;state.own=state.tx=false;state.pending=null;state.fails=0;if(offline){state.online=false;$('battery').hidden=true}safeValues();const safe=channels.join(',');if(had)state.cleanup=Promise.allSettled([state.cleanup,pending]).then(async()=>{try{await request(base,'/api/command',{clientId:client,type:'rc_frame',channels:safe},600,id)}catch{}try{await request(base,'/api/control/release',{clientId:client},600,id)}catch{}});if(message)notify(message)}
async function connect(take=false){if(state.busy)return;state.busy=true;state.manual=false;const epoch=++state.epoch;render();$('pairMessage').textContent='Checking your kit…';let found=false,error='Kit not found. Join its Wi-Fi and try again.';try{const typed=$('expectedId').value.trim();if(typed&&state.deviceId&&typed!==state.deviceId)throw Error('Paired Device ID differs. Disconnect before pairing another kit.');if(typed)state.deviceId=typed;for(const base of candidates()){try{const s=validate(await request(base,'/api/status?clientId='+encodeURIComponent(cid),null,1000));if(epoch!==state.epoch)return;state.base=base;state.status=s;state.online=true;state.lastStatus=performance.now();remember(s);channels[5]=String(s.flightMode).toUpperCase()==='RATE'?1500:1000;found=true;break}catch(e){error=e.message}}if(!found)throw Error(error);$('pairMessage').textContent='Connected to '+state.name+' · '+state.deviceId;if($('connectDialog').open)$('connectDialog').close()}catch(e){if(epoch!==state.epoch)return;state.online=false;$('pairMessage').textContent=e.message;if(take)notify(e.message)}finally{if(epoch===state.epoch){state.busy=false;render()}}if(found&&take)await takeControl()}
async function takeControl(){if(state.busy||!state.online||state.own)return;state.busy=true;const epoch=++state.epoch;render();try{await state.cleanup;if(epoch!==state.epoch)return;cid=newSession();const s=validate(await api('/api/status?clientId='+encodeURIComponent(cid)));state.status=s;if(!s.flightReady)throw Error('Controller is not flight-ready. Check the IMU / profile.');if(s.armed)throw Error('Controller is already armed. Disarm before taking control.');safeValues();const base=state.base,id=state.deviceId,client=cid;await request(base,'/api/control/acquire',{clientId:client},1000,id);if(epoch!==state.epoch){await request(base,'/api/control/release',{clientId:client},600,id);return}state.own=state.tx=true;state.txEpoch++;state.lastAck=state.lastFrame=performance.now();state.fails=0;await sendFrame();if(state.own)notify('Control active. Tap ARM when ready.')}catch(e){if(epoch===state.epoch)stopControl(e.message)}finally{if(epoch===state.epoch){state.busy=false;render()}}}
function updateAxes(){channels[0]=Math.round(1500+sticks.right.x*500);channels[1]=Math.round(1500-sticks.right.y*500);channels[3]=Math.round(1500+sticks.left.x*500);render()}
function bind(side){const el=$(side),s=sticks[side];function move(e){const b=el.querySelector('.base').getBoundingClientRect(),r=b.width*.3;let x=(e.clientX-b.left-b.width/2)/r,y=(e.clientY-b.top-b.height/2)/r;if(s.anchor){x=(e.clientX-s.anchor.x)/r;y=(e.clientY-s.anchor.y)/r}const n=Math.hypot(x,y);if(n>1){x/=n;y/=n}s.x=x;s.y=y;draw(side);updateAxes()}function release(e){if(s.pointer===null||e.pointerId!==s.pointer)return;const p=s.pointer;s.pointer=null;s.anchor=null;s.x=s.y=0;try{el.releasePointerCapture(p)}catch{}home(side);draw(side);updateAxes()}el.addEventListener('pointerdown',e=>{if(!state.own||!state.tx||s.pointer!==null||e.button>0)return;e.preventDefault();s.pointer=e.pointerId;held.clear();keyAxes();if(state.floating){const r=el.getBoundingClientRect(),b=el.querySelector('.base'),half=b.offsetWidth/2;b.style.left=clamp(e.clientX-r.left,half,Math.max(half,r.width-half))+'px';b.style.top=clamp(e.clientY-r.top,half,Math.max(half,r.height-half))+'px';s.anchor={x:e.clientX,y:e.clientY}}else s.anchor=null;try{el.setPointerCapture(e.pointerId)}catch{}move(e)});el.addEventListener('pointermove',e=>{if(s.pointer===e.pointerId)move(e)});for(const event of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(event,release)}bind('left');bind('right');
async function sendFrame(){if(!state.own||!state.tx||state.pending)return;const epoch=state.txEpoch,p=request(state.base,'/api/command',{clientId:cid,type:'rc_frame',channels:channels.join(',')},240,state.deviceId);state.pending=p;try{await p;if(epoch!==state.txEpoch)return;state.fails=0;state.lastAck=performance.now()}catch(e){if(epoch===state.txEpoch&&++state.fails>=2)stopControl('Control link lost. Reconnect and take control again.',true)}finally{if(state.pending===p)state.pending=null}}
function tick(){if(!state.own||!state.tx)return;const now=performance.now(),dt=clamp((now-state.lastFrame)/1000,0,.08);state.lastFrame=now;if(now-state.lastAck>300){stopControl('Control link timed out. Take control again after reconnecting.',true);return}let rate=-sticks.left.y;if(sticks.left.pointer===null)rate=(held.has('w')?1:0)-(held.has('s')?1:0);channels[2]=clamp(channels[2]+Math.round(rate*400*dt),1000,2000);render();sendFrame()}setInterval(tick,40);
let refreshing=false;async function refresh(){if(refreshing||state.busy||state.manual||document.hidden||$('connectDialog').open)return;if(!state.online){await connect(false);return}refreshing=true;const epoch=state.epoch;try{const s=validate(await api('/api/status?clientId='+encodeURIComponent(cid),null,1000));if(epoch!==state.epoch)return;state.status=s;state.lastStatus=performance.now();if(state.own&&(!s.lockMine||!s.flightReady))stopControl('Control released. Take control again when the kit is ready.');if(state.own&&channels[4]>1500){if(s.armed)state.wasArmed=true;else if(state.wasArmed||performance.now()-state.armAt>1500)stopControl('Controller disarmed. Take control again.')}if(!state.own)channels[5]=String(s.flightMode).toUpperCase()==='RATE'?1500:1000;render();const t=await api('/api/telemetry',null,1000);if(epoch!==state.epoch)return;$('angles').textContent=Number(t.roll||0).toFixed(1)+'° / '+Number(t.pitch||0).toFixed(1)+'°';$('ppmHz').textContent=(Number(t.ppmFrameHz)||0)+' Hz';$('webHz').textContent=(Number(t.webRcFrameHz)||0)+' Hz';$('fcHz').textContent=(Number(t.flightLoopHz)||0)+' Hz';$('battery').hidden=!(t.batteryValid&&Number.isFinite(t.battery));if(!$('battery').hidden)$('battery').textContent=t.battery+' V'}catch(e){if(epoch===state.epoch)stopControl(e.message,true)}finally{refreshing=false}}setInterval(refresh,1000);
setInterval(async()=>{if(!state.own)return;const epoch=state.txEpoch;try{await api('/api/control/ping',{clientId:cid},600)}catch(e){if(epoch===state.txEpoch)stopControl('Control lease lost. Take control again.',true)}},2400);
function openConnect(){if(state.own)stopControl('Control paused while connecting.');$('kitAddress').value='';$('expectedId').value=state.deviceId;$('connectDialog').showModal()}
$('connect').onclick=openConnect;$('heroAction').onclick=()=>state.online?takeControl():openConnect();$('checkConnection').onclick=()=>connect(true);$('settings').onclick=()=>{if(state.own)stopControl('Control paused for settings.');$('settingsDialog').showModal()};document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>$(b.dataset.close).close());$('floating').checked=state.floating;$('floating').onchange=e=>{state.floating=e.target.checked;write('zebjus-flight-floating',state.floating);resetInputs()};$('disconnect').onclick=()=>{stopControl('Disconnected.',true);state.manual=true;state.busy=false;$('settingsDialog').close()};
$('forget').onclick=()=>{stopControl('',true);state.manual=true;state.deviceId=state.name=state.base='';write(KNOWN,{});Object.assign(saved,{base:'',ip:'',name:'',deviceId:''});$('expectedId').value='';$('settingsDialog').close();openConnect()};
$('arm').onclick=()=>{if(!state.own||!state.tx)return;if(channels[4]>1500||state.status.armed){safeValues();sendFrame();return}if(channels[2]>1050){notify('Lower throttle before ARM.');return}safeValues();channels[4]=2000;state.armAt=performance.now();render();sendFrame()};$('kill').onclick=()=>stopControl('Stopped. Motors disarmed.');$('mode').onclick=()=>{if(channels[4]>1500||state.status.armed){notify('Disarm before changing flight mode.');return}channels[5]=channels[5]>=1500?1000:1500;render();if(state.own)sendFrame()};
function keyAxes(){if(sticks.right.pointer===null){sticks.right.x=(held.has('arrowright')?1:0)-(held.has('arrowleft')?1:0);sticks.right.y=(held.has('arrowdown')?1:0)-(held.has('arrowup')?1:0);draw('right')}if(sticks.left.pointer===null){sticks.left.x=(held.has('d')?1:0)-(held.has('a')?1:0);draw('left')}updateAxes()}
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('connectDialog').open&&!$('settingsDialog').open){stopControl('Stopped.');return}if(!state.own||e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();if(!['w','s','a','d','arrowleft','arrowright','arrowup','arrowdown','x','m'].includes(k))return;e.preventDefault();if(k==='x'){stopControl('Stopped.');return}if(k==='m'){if(!e.repeat)$('mode').click();return}held.add(k);keyAxes()});addEventListener('keyup',e=>{if(held.delete(e.key.toLowerCase()))keyAxes()});
function leave(){if(state.busy){state.epoch++;state.busy=false}if(!state.own)return;const base=state.base,id=state.deviceId;state.own=state.tx=false;state.txEpoch++;safeValues();try{navigator.sendBeacon(base+'/api/command',new URLSearchParams({clientId:cid,expectedDeviceId:id,type:'rc_frame',channels:channels.join(',')}));navigator.sendBeacon(base+'/api/control/release',new URLSearchParams({clientId:cid,expectedDeviceId:id}))}catch{}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)leave()});addEventListener('pagehide',leave);addEventListener('blur',leave);let lastWidth=innerWidth;addEventListener('resize',()=>{if(Math.abs(innerWidth-lastWidth)>40&&state.own)stopControl('View rotated. Take control again.');lastWidth=innerWidth;resetInputs()});$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else{await document.documentElement.requestFullscreen();try{await screen.orientation.lock('landscape')}catch{}}}catch{notify('Use your browser full-screen option.')}};
if(hosted){const link=document.createElement('link');link.rel='manifest';link.href='./app.webmanifest';document.head.appendChild(link);if('serviceWorker' in navigator)navigator.serviceWorker.register('./service-worker.js').catch(()=>{})}
render();connect(false);
})();
</script></body></html>)rawliteral";}
String ioPage(){return R"rawliteral(<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>ZEBJUS • Kit Hardware I/O</title><style>
:root{color-scheme:dark;--bg:#07131d;--card:#102532;--line:#34556a;--mint:#6beac3;--muted:#aac0cb}*{box-sizing:border-box}body{margin:0;padding:clamp(12px,3vw,25px);background:var(--bg);color:#eff9fc;font:14px/1.45 system-ui,-apple-system,sans-serif}main{max-width:1100px;margin:auto}header{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}h1{margin:0;font-size:clamp(21px,4vw,31px)}h2{font-size:18px;margin:0 0 8px}p{color:var(--muted);margin:8px 0 14px}.sub{font-size:12px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.card{padding:clamp(14px,2vw,22px);border:1px solid var(--line);border-radius:17px;background:var(--card);min-width:0}.wide{grid-column:1/-1}a,button,select,input{font:inherit}button,.link{min-height:42px;background:#19445a;border:1px solid var(--line);border-radius:10px;padding:8px 13px;color:#fff;font-weight:700;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}button.primary{background:#118861;border-color:#27be8c}button.danger{background:#66383d;border-color:#bd5963}button:disabled{opacity:.5;cursor:default}input,select{min-height:41px;min-width:0;width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;background:#091b26;color:#fff}label{display:grid;gap:5px;color:var(--muted);font-size:12px;font-weight:700}label.switch{display:flex;align-items:center;gap:8px}label.switch input{width:auto;min-height:0}.form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px}.buttons{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.top{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;max-width:650px;margin:12px auto}.motor{padding:11px;border:1px solid #476c78;border-radius:13px;background:#0b2933}.motor small{display:block;color:var(--mint);letter-spacing:.1em}.motor b{font-size:17px}.motor select{margin-top:8px}.front{text-align:center;color:var(--mint);font-weight:800;letter-spacing:.16em}.check{display:flex;gap:18px;flex-wrap:wrap}.log{min-height:95px;max-height:280px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--line);background:#071c26;border-radius:12px;padding:12px;color:#aef3d6;font:12px/1.6 ui-monospace,monospace}.log.error{color:#ff9da3}.matrix{display:grid;grid-template-columns:repeat(8,32px);gap:5px;margin:10px 0}.pixel{min-height:32px;width:32px;padding:0;border-radius:6px}.pixel.on{background:#61e8a9}.note{color:#ffd293}.status{font-weight:800;color:var(--mint)}@media(max-width:700px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.form{grid-template-columns:repeat(2,minmax(0,1fr))}.matrix{grid-template-columns:repeat(8,minmax(23px,32px))}.pixel{width:100%}}@media(max-width:360px){.form{grid-template-columns:1fr}}
</style></head><body><main><header><div><h1>ZEBJUS Kit Hardware I/O</h1><p>Direct controls from this kit in setup AP or school Wi-Fi STA</p></div><nav class="buttons"><a class="link" href="/fly">Flight App</a><a class="link" href="/setup">Kit setup / status</a></nav></header><p id="identity" class="status">Checking kit Device ID…</p><div class="buttons"><button class="primary" id="take">Take control</button><button id="release">Release control</button><button id="refresh">Refresh mapping</button></div><p class="note">Pin and bench actions require this browser to hold the kit control lock and the FC to be disarmed. Disconnect the battery when wiring. Remove every propeller before motor tests.</p><div class="grid">
<section class="card wide"><h2>Motor position → ESC connector</h2><div class="front">↑ FRONT OF FRAME</div><div class="top"><div class="motor"><small>FRONT LEFT • CW</small><b>M1</b><select data-motor="1"></select></div><div class="motor"><small>FRONT RIGHT • CCW</small><b>M2</b><select data-motor="2"></select></div><div class="motor"><small>REAR LEFT • CCW</small><b>M4</b><select data-motor="4"></select></div><div class="motor"><small>REAR RIGHT • CW</small><b>M3</b><select data-motor="3"></select></div></div><p>CC3D X layout: M1 front-left → D1, M2 front-right → D2, M3 rear-right → D3, M4 rear-left → D0 by default. Mixer duty ticks: 1.024 × (T+R−P+Y, T−R−P−Y, T−R+P+Y, T+R+P−Y); 1180 armed idle. Saving connector routing reboots the FC. Remove propellers and verify real motor positions/directions.</p><div class="buttons"><button id="saveMotors">Save four motor connectors</button><button id="test1">Test M1</button><button id="test2">Test M2</button><button id="test3">Test M3</button><button id="test4">Test M4</button><button class="danger" id="stopMotors">STOP motors</button></div></section>
<section class="card"><h2>PPM input</h2><div class="form"><label>Receiver signal pin<select id="ppmPin"><option value="16">D6 / GPIO16 (default)</option><option value="18">D10 / GPIO18</option></select></label><label>Signal edge<select id="edge"><option>RISING</option><option>FALLING</option></select></label><label>Physical PPM arming<select id="armMode"><option value="YAW_STICK">Yaw right arm / yaw left disarm</option><option value="CH5_SWITCH">CH5 switch</option></select></label></div><div class="check"><label class="switch"><input type="checkbox" data-rev="0">Flip roll</label><label class="switch"><input type="checkbox" data-rev="1">Flip pitch</label><label class="switch"><input type="checkbox" data-rev="2">Flip throttle</label><label class="switch"><input type="checkbox" data-rev="3">Flip yaw</label></div><div class="buttons"><button id="savePpm">Apply PPM</button><button id="readPpm">Read channels / Hz</button></div><p class="sub">Yaw gesture: minimum throttle, roll/pitch near centre, hold right/left for 1 s. The alternative CH5 switch is selectable. Web/AP/Python use CH5. 15 s stick inactivity disarms only at minimum throttle. CH6 low = Angle cascade; high = Rate.</p></section>
<section class="card"><h2>Multiple I²C devices</h2><p>Scan addresses 0x01–0x7E; read device registers by its datasheet. Writing unknown registers can change the device configuration.</p><div class="form"><label>Address<select id="addr"><option value="104">0x68</option></select></label><label>Register (decimal)<input id="reg" type="number" min="0" max="255" value="0"></label><label>Length 1–16<input id="len" type="number" min="1" max="16" value="1"></label><label>Write bytes 0–255<input id="bytes" value="0" placeholder="12,34"></label></div><div class="buttons"><button id="scan">Scan I²C</button><button id="readI2c">Read register</button><button id="writeI2c">Write register</button></div><p id="devices" class="sub"></p></section>
<section class="card"><h2>Servo and spare digital I/O</h2><div class="form"><label>Servo pin<select id="servoPin" class="pins"></select></label><label>Servo pulse µs<input id="pulse" type="number" min="1000" max="2000" value="1500"></label><label>GPIO<select id="gpioPin" class="pins"></select></label><label>Logic<select id="gpioValue"><option value="0">LOW</option><option value="1">HIGH</option></select></label></div><div class="buttons"><button id="configServo">Set servo pin</button><button id="writeServo">Move servo</button><button id="readGpio">Read GPIO</button><button id="writeGpio">Write GPIO</button><button id="releaseGpio">Release GPIO</button></div><p class="sub">A2 D7–D10 are 3.3 V signals. Supply a servo or load externally with common ground. Servo output is 50 Hz; ESC outputs are 250 Hz.</p></section>
<section class="card"><h2>GPS and 8×8 LED matrix</h2><div class="form"><label>GPS protocol<select id="gpsProtocol"><option value="NMEA_9600">Generic NMEA 9600</option><option value="UBX_10HZ">DroneGPS UBX 10 Hz / NEO-7</option></select></label><label>FC RX ← GPS TX<select id="gpsPin" class="pins"></select></label><label>FC TX → GPS RX (UBX)<select id="gpsTxPin" class="pins"></select></label><label>HT16K33 I²C address<select id="matrixAddress"></select></label></div><div class="buttons"><button id="configGps">Configure GPS</button><button id="readGps">Read GPS / Hz</button><button id="configMatrix">Set matrix address</button><button id="writeMatrix">Show 8×8</button><button id="clearMatrix">Clear</button></div><div id="pixels" class="matrix" aria-label="8 by 8 LED pixels"></div><p class="sub">For NEO-7 UBX, wire both TX/RX to separate D7–D10 pins (D9 RX/D8 TX suggested). Configuration reboots the FC; after reconnect, read measured complete epochs/second to confirm 10 Hz. Generic NMEA uses GPS TX only. Matrix driver: HT16K33 at 0x70–0x77.</p></section>
<section class="card wide"><h2>Kit replies</h2><div id="result" class="log" role="status" aria-live="polite">Connect to this kit and refresh.</div></section>
</div></main><script>
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],cid='IO-'+Date.now().toString(36)+Math.random().toString(36).slice(2);let device='',board='',owned=false,exp={},rows=Array(8).fill(0);
function log(v,error=false){const el=$('#result');el.textContent=typeof v==='string'?v:JSON.stringify(v,null,2);el.classList.toggle('error',error)}
async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',cache:'no-store',headers:data?{'Content-Type':'application/x-www-form-urlencoded'}:{},body:data?new URLSearchParams(data):undefined});let v;try{v=await r.json()}catch{throw Error('Invalid response from kit')};if(!r.ok||v.ok===false)throw Error(v.message||'Kit request failed');return v}
async function status(){const v=await api('/api/status?clientId='+encodeURIComponent(cid));if(device&&device!==v.deviceId)throw Error('Kit Device ID changed. Reload the page and inspect the connection.');device=v.deviceId;board=v.boardId;owned=!!v.lockMine;exp=v.expansion||{};$('#identity').textContent=`${v.name} • ${device} • ${board} • ${v.mode} • ${v.armed?'ARMED':'DISARMED'} • ${owned?'CONTROL':'VIEW ONLY'}`;if(exp.motors)$$('[data-motor]').forEach(el=>el.value=String(exp.motors[Number(el.dataset.motor)-1].connector).slice(1));$('#ppmPin').value=String(exp.ppmPin??16);$('#edge').value=exp.ppmEdge||'RISING';for(const select of $$('.pins')){const d10=select.querySelector('option[value="18"]');if(d10){d10.disabled=Number(exp.ppmPin)===18;d10.textContent=Number(exp.ppmPin)===18?'D10 / GPIO18 • PPM receiver':'D10 / GPIO18'}}$('#armMode').value=exp.ppmArmMode||'YAW_STICK';$$('[data-rev]').forEach(el=>el.checked=!!exp.ppmReverse?.[Number(el.dataset.rev)]);$('#servoPin').value=String(exp.servoPin??-1);$('#gpsPin').value=String(exp.gpsRxPin??-1);$('#gpsTxPin').value=String(exp.gpsTxPin??-1);$('#gpsProtocol').value=exp.gpsProtocol||'NMEA_9600';$('#matrixAddress').value=String(exp.matrixAddress??112);$('#take').disabled=owned;for(const id of ['savePpm','saveMotors','test1','test2','test3','test4','configServo','writeServo','configGps','writeGpio','releaseGpio'])$('#'+id).disabled=board!=='ZFC-A2'||!!v.armed;log(v);return v}
async function cmd(type,fields={},mutation=false){if(!device)await status();if(mutation&&!owned){await api('/api/control/acquire',{clientId:cid});owned=true}const v=await api('/api/command',{clientId:cid,type,...fields});log(v);if(v.expansion)exp=v.expansion;return v}
function action(id,fn){$('#'+id).onclick=()=>Promise.resolve().then(fn).catch(e=>log(e.message,true))}
for(const el of $$('[data-motor]'))el.innerHTML=[0,1,2,3].map((n)=>`<option value="${n}">D${n} • GPIO ${[0,1,2,21][n]}</option>`).join('');
for(const el of $$('.pins'))el.innerHTML=[[-1,'Off'],[17,'D7 / GPIO17'],[19,'D8 / GPIO19'],[20,'D9 / GPIO20'],[18,'D10 / GPIO18']].map(([n,t])=>`<option value="${n}">${t}</option>`).join('');
$('#gpioPin').querySelector('option[value="-1"]').remove();$('#matrixAddress').innerHTML=Array.from({length:8},(_,i)=>`<option value="${112+i}">0x${(112+i).toString(16).toUpperCase()}</option>`).join('');
const pixels=$('#pixels');for(let i=0;i<64;i++){const b=document.createElement('button');b.className='pixel';b.type='button';b.title=`Row ${Math.floor(i/8)+1}, column ${i%8+1}`;b.onclick=()=>{rows[i>>3]^=1<<(i&7);b.classList.toggle('on',!!(rows[i>>3]&(1<<(i&7))))};pixels.append(b)}
action('take',async()=>{await status();await api('/api/control/acquire',{clientId:cid});owned=true;await status()});action('release',async()=>{await api('/api/control/release',{clientId:cid});owned=false;await status()});action('refresh',status);
action('saveMotors',async()=>{const a=[1,2,3,4].map(n=>Number($(`[data-motor="${n}"]`).value));if(new Set(a).size!==4)throw Error('Use D0–D3 exactly once.');if(!confirm('Remove propellers. Save motor mapping and reboot this real kit?'))return;await cmd('motor_map_set',Object.fromEntries(a.map((n,i)=>[`m${i+1}slot`,n])),true)});
for(let i=1;i<=4;i++)action('test'+i,async()=>{if(!confirm(`M${i}: ALL propellers removed and frame secured?`))return;await cmd('motor_test',{motor:i,pulse:1150,durationMs:500,confirm:'PROPS_REMOVED'},true)});action('stopMotors',()=>cmd('motor_stop',{},true));
action('savePpm',async()=>{const fields={pin:$('#ppmPin').value,edge:$('#edge').value,armMode:$('#armMode').value};$$('[data-rev]').forEach(x=>fields['reverse'+x.dataset.rev]=x.checked?1:0);await cmd('ppm_config',fields,true)});action('readPpm',()=>cmd('receiver_read'));
action('scan',async()=>{const v=await api('/api/i2c/scan');$('#devices').textContent=(v.devices||[]).map(d=>`${d.addressHex} ${d.hint||''}`).join(' • ')||'No devices ACK';$('#addr').innerHTML=(v.devices||[]).map(d=>`<option value="${d.address}">${d.addressHex} • ${d.hint||'device'}</option>`).join('')||'<option value="104">0x68</option>';log(v)});
action('readI2c',()=>cmd('i2c_read',{address:$('#addr').value,reg:$('#reg').value,length:$('#len').value}));action('writeI2c',async()=>{if(!confirm('Write this register on the selected I²C device?'))return;await cmd('i2c_write',{address:$('#addr').value,reg:$('#reg').value,bytes:$('#bytes').value},true)});
action('configServo',()=>cmd('servo_config',{pin:$('#servoPin').value},true));action('writeServo',()=>cmd('servo_write',{pulseUs:$('#pulse').value},true));action('readGpio',()=>cmd('gpio_read',{pin:$('#gpioPin').value}));action('writeGpio',()=>cmd('gpio_write',{pin:$('#gpioPin').value,value:$('#gpioValue').value},true));action('releaseGpio',()=>cmd('gpio_release',{pin:$('#gpioPin').value},true));
action('configGps',()=>cmd('gps_config',{pin:$('#gpsPin').value,txPin:$('#gpsTxPin').value,protocol:$('#gpsProtocol').value},true));action('readGps',()=>cmd('gps_read'));action('configMatrix',()=>cmd('matrix_config',{address:$('#matrixAddress').value},true));action('writeMatrix',async()=>{if(Number(exp.matrixAddress)!==Number($('#matrixAddress').value))await cmd('matrix_config',{address:$('#matrixAddress').value},true);await cmd('matrix_write',{rows:rows.join(',')},true)});action('clearMatrix',()=>{rows.fill(0);$$('.pixel').forEach(x=>x.classList.remove('on'));return cmd('matrix_write',{rows:rows.join(',')},true)});
setInterval(()=>{if(owned)api('/api/control/ping',{clientId:cid}).catch(()=>{owned=false;log('Control lock lost. Refresh status.',true)})},3500);status().catch(e=>log(e.message,true));
</script></body></html>)rawliteral";}
void sendIoPage(){server.sendHeader("Cache-Control","no-store");server.send(200,"text/html",ioPage());}
String androidAppPage(){
  String address=setupMode?"192.168.4.1":WiFi.localIP().toString();
  String query="connect?kitId="+urlEncode(deviceId)+"&kitIp="+urlEncode(address);
  String link="intent://"+query+"#Intent;scheme=aerion;package=in.zebjus.aerion;end";
  return "<!doctype html><html><head><meta name=viewport content='width=device-width,initial-scale=1'><title>Aerion Flight</title><style>body{margin:0;padding:32px;background:#08090b;color:white;font:18px sans-serif;text-align:center}a{display:block;margin:28px auto;padding:18px;background:#14c6ff;color:#08090b;border-radius:12px;text-decoration:none;font-weight:bold}small{color:#abb4bf}</style></head><body><h1>Aerion Flight</h1><p>"+htmlEscape(apName)+"</p><a href='"+htmlEscape(link)+"'>Open Aerion Flight app</a><small>Install the Aerion Flight APK first. If this phone blocks app links, open Aerion Flight from its app icon. You can connect kit Wi-Fi directly inside the app.</small></body></html>";
}
void sendFlyPage(){server.sendHeader("Cache-Control","no-store");if(setupMode)server.sendHeader("Captive-Portal","http://192.168.4.1/");server.send(200,"text/html",server.header("User-Agent").indexOf("Android")>=0?androidAppPage():flyPage());}
void sendPortal(){server.sendHeader("Cache-Control","no-store");server.sendHeader("Captive-Portal","http://192.168.4.1/");server.send(200,"text/html",portalPage());}
void redirectPortal(){server.sendHeader("Location","http://192.168.4.1/",true);server.send(302,"text/plain","");}
void sendCaptiveApp(){if(setupMode)redirectPortal();else statusApi();}
void wifiScanApi(){
  if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Wi-Fi scan blocked while armed or bench outputs active");return;}
  if(setupMode&&(wifiTestState==WT_RUNNING||wifiTestState==WT_SUCCESS)){sendMessage(423,"Wait for Wi-Fi setup to finish before scanning");return;}
  if(setupMode)WiFi.mode(WIFI_AP_STA); // Station radio is used only for this scan.
  int n=WiFi.scanNetworks();String j="{\"ok\":true,\"networks\":[";bool first=true;
  for(int i=0;i<n;i++){String ssid=WiFi.SSID(i);if(!ssid.length())continue;if(!first)j+=",";first=false;j+="{\"ssid\":\""+jsonEscape(ssid)+"\",\"rssi\":"+String(WiFi.RSSI(i))+",\"secure\":"+String(WiFi.encryptionType(i)!=WIFI_AUTH_OPEN?"true":"false")+"}";}
  WiFi.scanDelete();if(setupMode&&wifiTestState!=WT_RUNNING)WiFi.mode(WIFI_AP);j+="]}";sendJson(200,j);
}
void startWifiTestApi(){
  if(!setupMode){sendMessage(409,"Wi-Fi setup is available from AP setup mode");return;}if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,"Wi-Fi test blocked while armed or bench outputs active");return;}if(wifiTestState==WT_RUNNING){sendMessage(409,"A Wi-Fi test is already running");return;}
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
    if(!startProbeMdns()){wifiTestState=WT_FAILED;testMessage="Could not check Kit Name on this Wi-Fi";WiFi.disconnect(false,false);WiFi.mode(WIFI_AP);return;}
    delay(180);int count=MDNS.queryService("zebjus-drone","tcp");
    if(!testName.length())testName=chooseFreeAutoNameFromCurrentQuery(count);
    else{for(int i=0;i<count;i++)if(queryResultIsName(i,testName,false)){wifiTestState=WT_FAILED;testMessage="Kit Name already exists on this Wi-Fi. Choose another name or leave it blank for automatic naming.";MDNS.end();mdnsStarted=false;WiFi.disconnect(false,false);WiFi.mode(WIFI_AP);return;}}
    MDNS.end();mdnsStarted=false;saveKitName(testName);autoNameRequired=false;saveWiFi(testSSID,testPASS,true);setPreferredApMode(false);setForceSetupFlag(false);testRedirect=optionalWebappUrl();testMessage="Wi-Fi verified and saved";wifiTestState=WT_SUCCESS;wifiTestRestartAt=millis()+7500;Serial.println("Setup verified. Saved Kit Name: "+kitName);return;
  }
  if(millis()-wifiTestStarted>CONNECT_TIMEOUT_MS){wifiTestState=WT_FAILED;testMessage="Could not connect. Check password and signal.";WiFi.disconnect(false,false);WiFi.mode(WIFI_AP);}
}

bool allowDisruptiveAdminAction(const char* action){
  if(effectiveArmed()||benchMode!=BENCH_NONE){sendMessage(423,String(action)+" blocked while armed or bench outputs active");return false;}
  if(setupMode)return true;
  if(!requireControl())return false;
  return true;
}
void resetWifiApi(){if(!allowDisruptiveAdminAction("Wi-Fi reset"))return;clearSavedWiFi();sendMessage(200,"Saved Wi-Fi cleared; restarting in setup mode");setForceSetupFlag(true);restartAt=millis()+700;}
void returnToSavedWifiApi(){
  if(!setupMode){sendMessage(409,"Kit is already on saved Wi-Fi");return;}
  if(!allowDisruptiveAdminAction("Wi-Fi mode change"))return;
  if(wifiTestState==WT_RUNNING||wifiTestState==WT_SUCCESS){sendMessage(423,"Wait for Wi-Fi setup to finish");return;}
  bool hasSaved=false;for(int i=0;i<MAX_WIFI;i++)if(savedSSID[i].length()){hasSaved=true;break;}
  if(!hasSaved){sendMessage(409,"No saved Wi-Fi profile. Save and test a network first.");return;}
  setPreferredApMode(false);setForceSetupFlag(false);
  sendMessage(200,"Trying saved Wi-Fi after restart. If it is unavailable, AP returns automatically.");restartAt=millis()+900;
}
void factoryResetApi(){if(!allowDisruptiveAdminAction("Factory reset"))return;factoryResetAll();setForceSetupFlag(true);sendMessage(200,"Factory reset scheduled");restartAt=millis()+700;}

// ============================================================
// Firmware update / reboot
// ============================================================
void firmwareInfoApi(){
  String j="{\"ok\":true,\"product\":\"ZEBJUS_FLIGHTCORE\",\"firmware\":\""+String(FW_VERSION)+"\",\"firmwareBuiltAt\":\""+String(FW_BUILD_DATE)+" "+String(FW_BUILD_TIME)+" UTC\",\"boardId\":\""+String(BOARD_ID)+"\",\"boardName\":\""+String(BOARD_NAME)+"\",\"flashBytes\":"+String(ESP.getFlashChipSize())+",\"freeSketchBytes\":"+String(ESP.getFreeSketchSpace())+",\"ota\":true,\"firmwareRole\":\""+String(FLIGHT_CONTROL_ENABLED?"RATE_ANGLE_FLIGHT_CORE":"WIFI_SENSOR_BRIDGE")+"\",\"flightCoreIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"flightReady\":"+String(flightReady?"true":"false")+",\"escOutputs\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"pidWritable\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"calibrationIntegrated\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"webRc\":"+String((ALLOW_WEB_RC&&FLIGHT_CONTROL_ENABLED)?"true":"false")+",\"ppmRc\":true,\"i2cScan\":true,\"imuRead\":true,\"imuModel\":\""+String(imuName(detectedImu))+"\",\"i2cSda\":"+String(I2C_SDA_PIN)+",\"i2cScl\":"+String(I2C_SCL_PIN)+",\"armed\":"+String(effectiveArmed()?"true":"false")+"}";sendJson(200,j);
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
    if(effectiveArmed()||benchMode!=BENCH_NONE){firmwareUploadError="Firmware update blocked while armed or bench outputs active";return;}
    if(server.hasArg("expectedDeviceId")&&!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){firmwareUploadError="Firmware Device ID mismatch";return;}
    String targetBoard=server.arg("boardId");targetBoard.trim();if(targetBoard.length()&&targetBoard!=String(BOARD_ID)){firmwareUploadError="Firmware board profile mismatch";return;}
    if(!controlAuthorized()){firmwareUploadError=lockActive()?"Another browser controls this kit":"Take Control before firmware update";return;}
    if(!Update.begin(UPDATE_SIZE_UNKNOWN,U_FLASH)){firmwareUploadError=String("Update begin failed: ")+Update.errorString();return;}
    Serial.println("Firmware upload started: "+firmwareUploadName);
  }else if(upload.status==UPLOAD_FILE_WRITE){
    if(firmwareUploadError.length())return;
    if(firmwareUploadBytes==0){
      // ESP image header: magic at 0, little-endian chip ID at 12. OTA accepts APP only.
      const uint16_t expectedChip=FLIGHT_CONTROL_ENABLED?13:5;
      if(upload.currentSize<24||upload.buf[0]!=0xE9||uint16_t(upload.buf[12]|(uint16_t(upload.buf[13])<<8))!=expectedChip){firmwareUploadError="Wrong or invalid application image for this controller profile";Update.abort();return;}
    }
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
  const char* headers[]={"X-Zebjus-Control","User-Agent"};server.collectHeaders(headers,2);
  server.on("/",HTTP_GET,[](){if(setupMode)sendFlyPage();else statusApi();});server.on("/fly",HTTP_GET,sendFlyPage);server.on("/setup",HTTP_GET,sendPortal);server.on("/io",HTTP_GET,sendIoPage);
  server.on("/api/status",HTTP_GET,statusApi);server.on("/api/telemetry",HTTP_GET,telemetryApi);server.on("/api/i2c/scan",HTTP_GET,i2cScanApi);server.on("/api/imu",HTTP_GET,imuApi);
  server.on("/api/control/acquire",HTTP_POST,acquireApi);server.on("/api/control/ping",HTTP_POST,lockPingApi);server.on("/api/control/release",HTTP_POST,releaseApi);
  server.on("/api/command",HTTP_POST,commandApi);server.on("/api/name",HTTP_POST,renameApi);server.on("/api/name/reset",HTTP_POST,resetNameApi);
  server.on("/api/wifi/scan",HTTP_GET,wifiScanApi);server.on("/api/wifi/saved",HTTP_GET,savedWifiApi);server.on("/api/wifi/set",HTTP_POST,setWifiApi);server.on("/api/wifi/use",HTTP_POST,useWifiApi);server.on("/api/wifi/forget",HTTP_POST,forgetWifiApi);server.on("/api/setup/test",HTTP_POST,startWifiTestApi);server.on("/api/setup/test/status",HTTP_GET,wifiTestStatusApi);
  server.on("/api/wifi/reset",HTTP_POST,resetWifiApi);
  server.on("/api/wifi/sta",HTTP_POST,returnToSavedWifiApi);
  server.on("/api/factory-reset",HTTP_POST,factoryResetApi);
  server.on("/api/firmware/info",HTTP_GET,firmwareInfoApi);
  server.on("/api/reboot",HTTP_POST,rebootApi);
  server.on("/api/firmware/update",HTTP_POST,firmwareUploadDone,firmwareUploadHandler);
  // Captive portal probes
  server.on("/generate_204",HTTP_GET,sendCaptiveApp);server.on("/gen_204",HTTP_GET,sendCaptiveApp);server.on("/hotspot-detect.html",HTTP_GET,sendCaptiveApp);server.on("/library/test/success.html",HTTP_GET,sendCaptiveApp);server.on("/connecttest.txt",HTTP_GET,sendCaptiveApp);server.on("/ncsi.txt",HTTP_GET,sendCaptiveApp);server.on("/fwlink",HTTP_GET,sendCaptiveApp);server.on("/redirect",HTTP_GET,sendCaptiveApp);server.on("/canonical.html",HTTP_GET,sendCaptiveApp);server.on("/success.txt",HTTP_GET,sendCaptiveApp);
  server.onNotFound([](){if(server.method()==HTTP_OPTIONS){cors();server.send(204);return;}if(setupMode){redirectPortal();return;}sendMessage(404,"Not found");});
}
void startNormalServer(){
  setupMode=false;dnsServer.stop();WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.setSleep(false);ensureUniqueKitName();server.begin();wifiLostAt=0;
  Serial.println("==============================");Serial.println("ZEBJUS FlightCore V18.3.60 LOCAL MODE");Serial.println("Controller: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]");Serial.println("Device ID: "+deviceId);Serial.println("Kit Name : "+kitName);Serial.println("SSID     : "+WiFi.SSID());Serial.println("IP       : "+WiFi.localIP().toString());Serial.println("mDNS     : http://"+hostFromName(kitName)+".local");
}
void startSetupMode(){
  setupMode=true;if(!preferredApMode())setPreferredApMode(true);controlOwner="";controlExpiresAt=0;if(mdnsStarted){MDNS.end();mdnsStarted=false;}WiFi.disconnect(false,false);delay(120);WiFi.mode(WIFI_AP);WiFi.setSleep(false);updateApName();WiFi.softAPConfig(AP_IP,AP_GATEWAY,AP_SUBNET);bool ok=WiFi.softAP(apName.c_str(),apPassword.c_str());dnsServer.start(DNS_PORT,"*",AP_IP);server.begin();wifiTestState=WT_IDLE;
  Serial.println("==============================");Serial.println("ZEBJUS FlightCore SETUP MODE");Serial.println("AP Status: "+String(ok?"STARTED":"FAILED"));Serial.println("SSID     : "+apName);Serial.println("Password : "+apPassword);Serial.println("Write the AP SSID and password on the kit case before closing it.");Serial.println("Setup    : http://192.168.4.1");Serial.println("Controller: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]");Serial.println("Device ID: "+deviceId);Serial.println("Kit Name : "+kitName);
}

// ============================================================
// Recovery / runtime
// ============================================================
void checkRecoveryButton(){
  if(RECOVERY_BUTTON_PIN<0)return;if(effectiveArmed()||benchMode!=BENCH_NONE){recoveryPressedAt=0;return;}int state=digitalRead(RECOVERY_BUTTON_PIN);
  if(state==LOW){if(!recoveryPressedAt)recoveryPressedAt=millis();unsigned long held=millis()-recoveryPressedAt;if(held>=FACTORY_RESET_HOLD_MS&&!factoryResetTriggered){factoryResetTriggered=true;Serial.println("BOOT 10s -> FACTORY RESET");factoryResetAll();setForceSetupFlag(true);delay(150);ESP.restart();}}
  else if(recoveryPressedAt){unsigned long held=millis()-recoveryPressedAt;recoveryPressedAt=0;if(!factoryResetTriggered&&held>=FORCE_AP_HOLD_MS){Serial.println("BOOT 5s release -> SELECT AP MODE");setForceSetupFlag(true);delay(120);ESP.restart();}factoryResetTriggered=false;}
}
void networkHealth(){
  if(setupMode)return;if(WiFi.status()==WL_CONNECTED){wifiLostAt=0;return;}if(effectiveArmed())return;if(!wifiLostAt)wifiLostAt=millis();if(millis()-wifiLostAt>WIFI_LOST_TO_SETUP_MS){Serial.println("Wi-Fi unavailable -> setup AP recovery");setForceSetupFlag(true);delay(100);ESP.restart();}
}

void setup(){
  if(USER_LED_PIN>=0){pinMode(USER_LED_PIN,OUTPUT);digitalWrite(USER_LED_PIN,HIGH);}
  Serial.begin(115200);delay(300);WiFi.persistent(false);WiFi.setAutoReconnect(true);if(RECOVERY_BUTTON_PIN>=0)pinMode(RECOVERY_BUTTON_PIN,INPUT_PULLUP);loadExpansionSettings();if(ENABLE_PPM_RECEIVER&&ppmReceiverPin>=0){pinMode(ppmReceiverPin,ppmEdgeFalling?INPUT_PULLDOWN:INPUT_PULLUP);attachInterrupt(digitalPinToInterrupt(ppmReceiverPin),ppmIsr,ppmEdgeFalling?FALLING:RISING);}
  deviceId=getDeviceId();loadKitName();updateApName();loadApPassword();loadSavedWiFi();loadPidSettings();loadCalibrationSettings();probeImuAtBoot();setupFlightCore();flightHeartbeatUs=micros();if(FLIGHT_CONTROL_ENABLED&&xTaskCreate(flightOutputSupervisor,"fc-output-guard",3072,nullptr,3,nullptr)!=pdPASS){flightReady=false;motorsSafe();Serial.println("Output supervisor unavailable: arming disabled");}setupExpansionPeripherals();setupRoutes();
  Serial.println("\n==============================\nZEBJUS FlightCore V18.3.60 LOCAL Wi-Fi + I2C\nBoard: "+String(BOARD_NAME)+" ["+String(BOARD_ID)+"]\nID: "+deviceId+"\n==============================");
  bool forceApOnce=consumeForceSetupFlag();if(forceApOnce||preferredApMode()){startSetupMode();return;}
  if(connectSavedWiFi())startNormalServer();else startSetupMode();
}
void loop(){
  flightHeartbeatUs=micros();
  serviceUserLed();serviceBenchMode();pollGps();runFlightLoop();server.handleClient();runFlightLoop();updateControlRates();if(setupMode)dnsServer.processNextRequest();expireLock();processWifiTest();checkRecoveryButton();networkHealth();
  if(wifiTestState==WT_SUCCESS&&wifiTestRestartAt&&(long)(millis()-wifiTestRestartAt)>=0){disarmFlight("restart");ESP.restart();}
  if(restartAt&&(long)(millis()-restartAt)>=0){disarmFlight("restart");ESP.restart();}
  yield();
}
