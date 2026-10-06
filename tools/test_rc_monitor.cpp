#include "../FlightCore_Firmware/RcMonitorProtocol.h"
#include <cassert>
#include <string>
#include <iostream>
int main(){
 const char* id="ZFC-001122334455";std::string request=std::string("GET /api/rc/live?deviceId=")+id+" HTTP/1.1\r\nHost: kit\r\n\r\n";
 assert(RcMonitorProtocol::requestKind(request.c_str(),id)==1);
 assert(RcMonitorProtocol::requestKind(request.c_str(),"OTHER")==0);
 request.replace(0,3,"OPTIONS");assert(RcMonitorProtocol::requestKind(request.c_str(),id)==2);
 assert(RcMonitorProtocol::requestKind("POST /api/command HTTP/1.1\r\n",id)==0);
 assert(RcMonitorProtocol::requestKind("GET /api/rc/live?deviceId=ZFC-001122334455&token=abc HTTP/1.1\r\n",id)==0);
 char chunk[64];assert(RcMonitorProtocol::chunk(chunk,sizeof(chunk),"{}")>0);assert(std::string(chunk)=="3\r\n{}\n\r\n");assert(!RcMonitorProtocol::chunk(chunk,2,"{}"));assert(RcMonitorProtocol::PORT==4211&&RcMonitorProtocol::PERIOD_MS==40);
 std::cout<<"PASS: production read-only monitor subscription, exact identity/method/path, preflight and bounded HTTP chunk framing\n";
}
