#!/usr/bin/env python3
"""Execute the production monitor task with partial writes and a stalled observer."""
import subprocess,tempfile
from pathlib import Path
root=Path(__file__).resolve().parents[1]
source=r'''
#include <cassert>
#include <cerrno>
#include <cstring>
#include <deque>
#include <iostream>
#include <memory>
#include <string>
#include <vector>
#include <sys/socket.h>
struct Socket{int fd;bool open=true,blocked=false;std::string input,output;size_t at=0;};
std::vector<std::shared_ptr<Socket>> sockets;
int rcMonitorSend(int fd,const void* bytes,size_t count,int flags){assert(flags==MSG_DONTWAIT);auto s=sockets.at(fd);if(s->blocked){errno=EAGAIN;return -1;}size_t n=std::min(count,(size_t)11);s->output.append((const char*)bytes,n);return n;}
class WiFiClient{std::shared_ptr<Socket> s;public:WiFiClient(){}explicit WiFiClient(std::shared_ptr<Socket> x):s(x){}operator bool()const{return s&&s->open;}bool connected()const{return s&&s->open;}void stop(){if(s)s->open=false;}void setNoDelay(bool){}int available(){return connected()?s->input.size()-s->at:0;}int read(){return available()?(unsigned char)s->input[s->at++]:-1;}int fd(){return s->fd;}};
class WiFiServer{public:std::deque<WiFiClient> pending;bool started=false;WiFiServer(int port,int clients){assert(port==4211&&clients==3);}void begin(){started=true;}void end(){started=false;}void setNoDelay(bool){}WiFiClient accept(){if(pending.empty())return {};auto c=pending.front();pending.pop_front();return c;}};
using TaskHandle_t=void*;constexpr int pdPASS=1;bool fail=false;int xTaskCreate(void(*)(void*),const char*,int stack,void*,int priority,void** h){assert(stack==8192&&priority==1);if(fail)return 0;*h=(void*)1;return pdPASS;}
uint32_t clockMs=0;uint32_t millis(){return clockMs;}int pdMS_TO_TICKS(int n){return n;}struct Done{};void vTaskDelay(int n){clockMs+=n;if(clockMs>=1600)throw Done{};}
std::string deviceId="ZFC-001122334455";unsigned builds=0;void buildRcMonitorPacket(char* out,size_t size){builds++;snprintf(out,size,"{\"type\":\"rc_live\",\"controllerMs\":%u}",clockMs);}
#include "FlightRcMonitor.h"
#undef send
std::shared_ptr<Socket> add(std::string input,bool blocked=false){auto s=std::make_shared<Socket>();s->fd=sockets.size();s->input=input;s->blocked=blocked;sockets.push_back(s);rcMonitorServer.pending.emplace_back(s);return s;}
int main(){fail=true;startRcMonitor();assert(!rcMonitorTaskHandle&&!rcMonitorServer.started);fail=false;startRcMonitor();assert(rcMonitorTaskHandle&&rcMonitorServer.started);
try{rcMonitorTask(nullptr);}catch(Done&){}assert(builds==0);clockMs=0;
auto get="GET /api/rc/live?deviceId="+deviceId+" HTTP/1.1\r\nHost: kit\r\n\r\n";auto live=add(get),slow=add(get,true),command=add("POST /api/command HTTP/1.1\r\n\r\n");try{rcMonitorTask(nullptr);}catch(Done&){}
assert(live->open&&!slow->open&&!command->open&&rcMonitorSlowClients==1);assert(live->output.find("HTTP/1.1 200 OK")==0&&live->output.find("Transfer-Encoding: chunked")!=std::string::npos);assert(live->output.find("Access-Control-Allow-Private-Network: true")!=std::string::npos);
size_t pos=live->output.find("\r\n\r\n")+4;unsigned packets=0,last=0;while(pos<live->output.size()){auto end=live->output.find("\r\n",pos);if(end==std::string::npos)break;size_t n=std::stoul(live->output.substr(pos,end-pos),nullptr,16);pos=end+2;if(pos+n+2>live->output.size())break;auto json=live->output.substr(pos,n);assert(json.back()=='\n');unsigned tick=0;assert(sscanf(json.c_str(),"{\"type\":\"rc_live\",\"controllerMs\":%u}",&tick)==1);assert(!packets||tick>last);last=tick;packets++;assert(live->output.substr(pos+n,2)=="\r\n");pos+=n+2;}
assert(packets>=30&&last>=1500&&builds==39);assert(command->output.find("HTTP/1.1 404 Not Found")==0);clockMs=0;auto empty=add("GET /"),large=add(std::string(900,'x'));try{rcMonitorTask(nullptr);}catch(Done&){}assert(!empty->open&&!large->open);std::cout<<"PASS: production read-only monitor task, partial/nonblocking sends, slow-client isolation, bounded/incomplete requests and task-start failure\n";}
'''
with tempfile.TemporaryDirectory(prefix='aerion-monitor-') as directory:
 p=Path(directory);(p/'lwip').mkdir();(p/'lwip/sockets.h').write_text('#include <sys/socket.h>\n#define send rcMonitorSend\n');(p/'test.cpp').write_text(source)
 subprocess.run(['g++','-std=c++17','-I'+str(p),'-I'+str(root/'FlightCore_Firmware'),str(p/'test.cpp'),'-o',str(p/'test')],check=True);subprocess.run([str(p/'test')],check=True)
