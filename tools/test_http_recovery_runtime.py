#!/usr/bin/env python3
"""Exercise the production HTTP wrapper and loop guards with timing doubles."""
import subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
ino=(root/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
start=ino.index('void runFlightLoop(){');end=ino.index('  uint16_t rc[10];',start)
loop=ino[start:end]+'  activeCalls++;\n}\n'
header=r'''#pragma once
#include <memory>
#include <deque>
#include <cstdint>
uint32_t clockMs=0;unsigned long millis(){return clockMs;}
struct Socket{bool open=true,hasBytes=false;};
class NetworkClient{std::shared_ptr<Socket>s;public:NetworkClient(){}NetworkClient(std::shared_ptr<Socket>x):s(x){}bool available(){return s&&s->open&&s->hasBytes;}bool connected()const{return s&&s->open;}void stop(){if(s)s->open=false;}operator bool()const{return connected();}};
class NetworkServer{public:std::deque<NetworkClient>queue;NetworkClient accept(){if(queue.empty())return {};auto c=queue.front();queue.pop_front();return c;}};
enum HTTPClientStatus{HC_NONE,HC_WAIT_READ,HC_WAIT_CLOSE};
class WebServer{protected:NetworkServer _server;NetworkClient _currentClient;HTTPClientStatus _currentStatus=HC_NONE;uint32_t _statusChange=0;std::unique_ptr<int>_currentUpload,_currentRaw;public:int handled=0;WebServer(int){}virtual void handleClient(){if(_currentStatus==HC_NONE){_currentClient=_server.accept();if(!_currentClient)return;_currentStatus=HC_WAIT_READ;_statusChange=millis();}if(_currentClient.available()){handled++;_currentClient.stop();_currentClient={};_currentStatus=HC_NONE;}}void enqueue(NetworkClient c){_server.queue.push_back(c);}};
'''
source=r'''#include <cassert>
#include <algorithm>
#include <iostream>
#include "FlightHttpServer.h"
uint32_t clockUs=0,flightLoopTimerUs=0,maxFlightLoopGapUs=0,flightLoopOverruns=0,flightWatchdogTrips=0;
uint32_t micros(){return clockUs;}const uint32_t FLIGHT_LOOP_US=4000,ARMED_LOOP_GAP_LIMIT_US=30000;
bool FLIGHT_CONTROL_ENABLED=true,flightReady=true,configurationBusy=false,armed=false,flightWatchdogTripped=false;int benchMode=0,BENCH_NONE=0,activeCalls=0;float flightDt=0;
template<class T>T constrain(T value,T low,T high){return std::clamp(value,low,high);}
'''+loop+r'''
int main(){
 FlightHttpServer server(80);auto idle=std::make_shared<Socket>(),ready=std::make_shared<Socket>();ready->hasBytes=true;
 server.enqueue(NetworkClient(idle));server.enqueue(NetworkClient(ready));server.handleClient();assert(server.handled==0);
 clockMs=250;server.handleClient();assert(idle->open&&server.handled==0);clockMs=251;server.handleClient();assert(!idle->open&&server.handled==1);
 auto later=std::make_shared<Socket>();server.enqueue(NetworkClient(later));clockMs=300;server.handleClient();later->hasBytes=true;clockMs=700;server.handleClient();assert(server.handled==2);
 configurationBusy=true;clockUs=4000000;runFlightLoop();assert(flightLoopTimerUs==clockUs&&activeCalls==0);
 configurationBusy=false;armed=true;clockUs+=4000;runFlightLoop();assert(activeCalls==1&&maxFlightLoopGapUs==4000&&!flightWatchdogTripped);
 benchMode=1;clockUs+=4000000;runFlightLoop();assert(flightLoopTimerUs==clockUs);benchMode=0;clockUs+=4000;runFlightLoop();assert(!flightWatchdogTripped);
 clockUs+=40000;runFlightLoop();assert(flightWatchdogTripped&&flightWatchdogTrips==1&&maxFlightLoopGapUs==40000);
 configurationBusy=true;clockUs+=4000000;runFlightLoop();assert(flightWatchdogTripped);
 std::cout<<"PASS: production idle-socket expiry, ready-request preservation, deliberate configuration/bench pauses and genuine armed-stall watchdog\n";
}
'''
with tempfile.TemporaryDirectory(prefix='aerion-http-') as directory:
 p=Path(directory);(p/'WebServer.h').write_text(header);(p/'test.cpp').write_text(source)
 subprocess.run(['g++','-std=c++17','-I'+str(p),'-I'+str(root/'FlightCore_Firmware'),str(p/'test.cpp'),'-o',str(p/'test')],check=True)
 subprocess.run([str(p/'test')],check=True)
