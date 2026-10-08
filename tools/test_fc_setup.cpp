#include "../FlightCore_Firmware/FlightSetupPolicy.h"
#include <cassert>
#include <iostream>
int main(){
 using namespace FlightSetupPolicy;ReceiverSetup r;assert(valid(r));r.calibrated=true;r.minimum[0]=920;r.centre[0]=1480;r.maximum[0]=2080;
 assert(normalise(920,0,r,false)==1000&&normalise(1480,0,r,false)==1500&&normalise(2080,0,r,false)==2000);
 assert(normalise(1200,0,r,false)==1250&&normalise(1780,0,r,false)==1750);assert(normalise(2200,0,r,true)==1000);
 r.channel[1]=r.channel[0];assert(!valid(r));r.channel[1]=1;r.maximum[2]=1300;assert(!valid(r));r.maximum[2]=2000;r.centre[0]=970;assert(!valid(r));r.centre[0]=1480;assert(valid(r));
 uint16_t rc[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};assert(safeAfterSetup(rc));rc[2]=1300;assert(!safeAfterSetup(rc));rc[2]=1000;rc[4]=2000;assert(!safeAfterSetup(rc));rc[4]=1000;rc[3]=1900;assert(!safeAfterSetup(rc));
 assert(live(99,100)&&!live(100,100)&&live(0xfffffff0u,50)&&!live(50,50));
 std::cout<<"PASS: PPM endpoints, centres, reversals, channel uniqueness, neutral re-arm and lease rollover\n";
}
