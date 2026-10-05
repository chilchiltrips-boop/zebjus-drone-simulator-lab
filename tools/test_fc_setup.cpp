#include "../FlightCore_Firmware/FlightSetupPolicy.h"
#include <cassert>
#include <iostream>
int main(){
 using namespace FlightSetupPolicy;ReceiverSetup r;assert(valid(r));r.calibrated=true;r.minimum[0]=920;r.centre[0]=1480;r.maximum[0]=2080;
 assert(normalise(920,0,r,false)==1000&&normalise(1480,0,r,false)==1500&&normalise(2080,0,r,false)==2000);
 assert(normalise(1200,0,r,false)==1250&&normalise(1780,0,r,false)==1750);assert(normalise(2200,0,r,true)==1000);
 r.channel[1]=r.channel[0];assert(!valid(r));r.channel[1]=1;r.maximum[2]=1300;assert(!valid(r));r.maximum[2]=2000;r.centre[0]=970;assert(!valid(r));r.centre[0]=1480;assert(valid(r));
 for(int i=4;i<8;i++)r.channel[i]=255;assert(valid(r));assert(normalise(1800,4,r,false)==1000);r.channel[2]=255;assert(!valid(r));r.channel[2]=2;
 r.txMode=0;assert(!valid(r));for(int mode=1;mode<=4;mode++){r.txMode=mode;assert(valid(r));}r.txMode=5;assert(!valid(r));r.txMode=2;
 r.channel[7]=r.channel[0];assert(!valid(r));r.channel[7]=9;assert(valid(r));r.channel[7]=10;assert(!valid(r));r.channel[7]=255;
 uint16_t rc[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};assert(safeAfterSetup(rc));rc[2]=1300;assert(!safeAfterSetup(rc));rc[2]=1000;rc[4]=2000;assert(!safeAfterSetup(rc));rc[4]=1000;rc[3]=1900;assert(!safeAfterSetup(rc));
 assert(live(99,100)&&!live(100,100)&&live(0xfffffff0u,50)&&!live(50,50));
 std::cout<<"PASS: PPM endpoints, centres, reversals, four mandatory / four optional channels, transmitter modes, channel uniqueness, neutral re-arm and lease rollover\n";
}
