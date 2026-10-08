#include <cassert>
#include <iostream>
#include "../FlightCore_Firmware/ApWifiPolicy.h"
int main(){using namespace ZfcApWifi;
 for(const char* role:{"MOBILE","WEB"}){assert(allowed(true,true,role));assert(!allowed(false,true,role));assert(!allowed(true,false,role));}
 assert(!allowed(true,true,"COMPANION"));assert(!allowed(true,true,"ADMIN"));
 assert(sessionAllowed(true,"AP_WIFI"));assert(!sessionAllowed(false,"AP_WIFI"));assert(sessionAllowed(false,"OWNER"));
 assert(physicalRcAllowed("AP_WIFI","MOBILE"));assert(!physicalRcAllowed("AP_WIFI","WEB"));
 std::cout<<"PASS: AP Wi-Fi authentication requires local AP peer and permitted role; AP sessions expire on STA and browser AP cannot publish physical RC\n";
}
