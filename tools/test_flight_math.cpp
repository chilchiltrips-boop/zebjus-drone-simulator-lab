#include "../FlightCore_Firmware/FlightControlMath.h"
#include <assert.h>
#include <stdio.h>
#include <limits>
#include <initializer_list>
static bool close(float a,float b){return fabsf(a-b)<.00001f;}
int main(){
 FlightSettings c;assert(FlightMath::valid(c));
 for(float dt:{.002f,.004f,.012f}){float v=0;for(int i=0;i<1000;i++){v=FlightMath::lowPass(v,75,60,dt);assert(isfinite(v)&&v>=0&&v<=75);}assert(close(v,75));}
 c.maxTilt=NAN;assert(!FlightMath::valid(c));c=FlightSettings();c.maxThrottle=2000;assert(!FlightMath::valid(c));c=FlightSettings();c.orientation=8;assert(!FlightMath::valid(c));c=FlightSettings();c.cells=0;assert(!FlightMath::valid(c));c=FlightSettings();c.lowCell=c.criticalCell;assert(!FlightMath::valid(c));
 // Every mounting transform preserves length and right-handed axes.
 for(int m=0;m<8;m++){float x=1,y=2,z=3;FlightMath::orient(x,y,z,m);assert(close(x*x+y*y+z*z,14));float a=1,b=0,d=0,e=0,f=1,g=0,h=0,i=0,j=1;FlightMath::orient(a,b,d,m);FlightMath::orient(e,f,g,m);FlightMath::orient(h,i,j,m);assert(close(b*g-d*f,h)&&close(d*e-a*g,i)&&close(a*f-b*e,j));}
 uint16_t app[10]={1500,1500,1350,1500,2000,1000,1000,1000,1500,1000},ppm[10]={1550,1450,1400,1500,2000,1000,1000,1000,1500,1000};
 assert(FlightMath::canHandover(app,ppm,true));assert(FlightMath::canHandover(ppm,app,true));assert(!FlightMath::canHandover(app,ppm,false));ppm[2]=1451;assert(!FlightMath::canHandover(app,ppm,true));ppm[2]=1350;ppm[4]=1000;assert(!FlightMath::canHandover(app,ppm,true));ppm[4]=2000;ppm[0]=1651;assert(!FlightMath::canHandover(app,ppm,true));
 float faces[6][3]={{1.04f,0,0},{-.96f,0,0},{0,.98f,0},{0,-1.02f,0},{0,0,1.06f},{0,0,-.94f}},offset[3],scale[3];assert(FlightMath::sixPoint(faces,offset,scale));assert(close(offset[0],-.04f)&&close(offset[1],.02f)&&close(offset[2],-.06f));for(int k=0;k<3;k++){assert(close((faces[2*k][k]+offset[k])*scale[k],1));assert(close((faces[2*k+1][k]+offset[k])*scale[k],-1));}faces[5][2]=NAN;assert(!FlightMath::sixPoint(faces,offset,scale));faces[5][2]=-.1f;assert(!FlightMath::sixPoint(faces,offset,scale));
 puts("PASS: actual flight math; filter/dt bounds; mount handedness; bidirectional matched handover; invalid standby rejection; six-face calibration");
}
