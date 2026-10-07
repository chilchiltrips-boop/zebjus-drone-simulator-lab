#include <assert.h>
#include <iostream>
#include "../FlightCore_Firmware/VirtualPid.h"
int main(){
 VirtualPid p;FlightSettings settings;settings.maxRate=100;FlightPidSettings gain;gain.rateRoll={1,0,0};gain.ratePitch={1,0,0};gain.rateYaw={1,0,0};
 uint16_t rc[10]={1500,1500,1000,1500,1000,2000,1000,1000,1500,1000};float sensors[5]={};
 p.tick(1,1,true,rc,sensors,gain,settings,.004f);rc[4]=2000;p.tick(1,1,true,rc,sensors,gain,settings,.004f);assert(p.armed);
 rc[2]=1500;rc[0]=1750;p.tick(1,1,true,rc,sensors,gain,settings,.004f);assert(p.motors[0]>p.motors[1]);float correction=p.motors[0]-p.motors[1];
 gain.rateRoll.p=2;p.tick(1,2,true,rc,sensors,gain,settings,.004f);assert(p.armed&&p.motors[0]-p.motors[1]>correction);
 p.tick(1,2,false,rc,sensors,gain,settings,.004f);assert(!p.armed);for(float m:p.motors)assert(m==1000);
 p.tick(1,2,true,rc,sensors,gain,settings,.004f);assert(!p.armed);rc[2]=1000;rc[4]=1000;rc[0]=1500;p.tick(1,2,true,rc,sensors,gain,settings,.004f);rc[4]=2000;p.tick(1,2,true,rc,sensors,gain,settings,.004f);assert(p.armed);
 p.tick(2,2,true,rc,sensors,gain,settings,.004f);assert(!p.armed);
 std::cout<<"PASS: actual FC PID math, roll mixer sign, live PID revision, stale/run isolation and manual virtual re-arm.\n";
}
