"""Execute the real FC arming / bench / setup / PWM guard functions on a host clock."""
from pathlib import Path
import tempfile,subprocess
root=Path(__file__).resolve().parents[1]
ino=(root/'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino').read_text()
setup=(root/'FlightCore_Firmware/FlightSetup.h').read_text()
training=(root/'FlightCore_Firmware/FlightTraining.h').read_text()
def function(source,name):
 start=source.index('void '+name+'(');brace=source.index('{',start);depth=1;end=brace+1
 while depth:
  depth+=int(source[end]=='{')-int(source[end]=='}');end+=1
 return source[start:end]
prefix=r'''
#include <cstdint>
#include <cstdlib>
#include <cmath>
#include <cassert>
#include <iostream>
#include <string>
#include "FlightSetupPolicy.h"
enum {RC_NONE,RC_PPM,RC_WEB_STA,RC_WEB_AP};
enum {BENCH_NONE,BENCH_MOTOR,BENCH_MOTOR_SEQUENCE,BENCH_ESC_CAL,BENCH_ESC_MANUAL};
uint32_t clockMs=10;uint32_t millis(){return clockMs;}
bool trainingActive=false,trainingAppOwned=false;std::string trainingOwner,controlOwner;uint8_t trainingTarget=0;uint32_t trainingRunId=0,trainingExpires=5000;bool armed=false,configurationBusy=false,firmwareUploadActive=false,forceDisarmRequested=false,flightWatchdogTripped=false;
bool fcSetupActive=false,setupAfterNeutral=false,setupCalibrationCancel=false,armLowSeen=false,ppmYawStickArm=true,ppmArmLeft=false;
uint32_t fcSetupExpires=5000,controlExpiresAt=5000,restartAt=0,batterySampleMs=0,yawGestureStartedMs=0,idleLastMovementMs=0;
bool batteryValid=false,batteryCritical=false,yawGestureLatched=false;
float kalmanRoll=0,kalmanPitch=0,accZ=1;int imuFaultCount=0;int8_t yawGesture=0;
struct {int batteryKind=0;} flightSettings;
int activeRcSource=RC_PPM,benchMode=BENCH_NONE;uint8_t benchMask=0,benchMotor=0,benchSequenceMotor=0,benchEscStage=0;uint16_t benchPulse=1000;
uint32_t benchUntilMs=0,benchStageUntilMs=0,webRcLastMs=0;void invalidateRcUdp(){}
uint16_t idleRcLast[4]={1500,1500,1000,1500};float motorInput[4]={};int outputs[4]={1000,1000,1000,1000};
const int ARM_GESTURE_HOLD_MS=1000,IDLE_AUTO_DISARM_MS=15000;
int motorPinForIndex(int i){return i;}int escDutyFromUs(int v){return v;}void ledcWrite(int i,int v){outputs[i]=v;}
'''
helpers=r'''
void motorsSafe(){for(int i=0;i<4;i++){motorInput[i]=1000;writeEscMicroseconds(i,1000);}}
void resetArmGesture(){yawGesture=0;yawGestureStartedMs=0;yawGestureLatched=false;}
void disarmFlight(const char*){armed=false;motorsSafe();}
void armFlight(const uint16_t*){armed=true;idleLastMovementMs=millis();}
void directMotorPulse(int m,int p){for(int i=0;i<4;i++)writeEscMicroseconds(i,i==m?p:1000);}
void allMotorPulse(int p){for(int i=0;i<4;i++)writeEscMicroseconds(i,p);}
'''
checks=r'''
int main(){
 trainingActive=true;armed=true;benchMode=BENCH_MOTOR;benchPulse=1250;benchUntilMs=9000;for(int i=0;i<4;i++){writeEscMicroseconds(i,1800);assert(outputs[i]==1000);}serviceBenchMode();assert(benchMode==BENCH_NONE);uint16_t trainRc[10]={1500,1500,1000,2000,2000,1000};serviceArming(trainRc);assert(!armed);trainingActive=false;

 uint16_t rc[10]={1500,1500,1000,1500,1000,1000,1000,1000,1500,1000};
 trainingActive=true;trainingExpires=clockMs;armed=true;webRcLastMs=clockMs;serviceTraining();assert(!trainingActive&&!armed&&setupAfterNeutral&&webRcLastMs==0);setupAfterNeutral=false;
 trainingActive=trainingAppOwned=true;trainingTarget=2;trainingOwner="phone";controlOwner="other";trainingExpires=clockMs+5000;serviceTraining();assert(!trainingActive&&trainingTarget==0&&setupAfterNeutral);trainingAppOwned=false;setupAfterNeutral=false;
 fcSetupActive=true;rc[3]=2000;serviceArming(rc);clockMs+=1200;serviceArming(rc);assert(!armed);
 fcSetupActive=false;setupAfterNeutral=true;serviceArming(rc);assert(setupAfterNeutral&&!armed);
 rc[3]=1500;serviceArming(rc);assert(!setupAfterNeutral&&!armed);
 ppmArmLeft=true;rc[3]=1000;serviceArming(rc);clockMs+=999;serviceArming(rc);assert(!armed);clockMs++;serviceArming(rc);assert(armed);
 rc[3]=1500;serviceArming(rc);rc[3]=2000;serviceArming(rc);clockMs+=1000;serviceArming(rc);assert(!armed);
 activeRcSource=RC_WEB_AP;rc[3]=1000;serviceArming(rc);clockMs+=1000;serviceArming(rc);assert(!armed);rc[3]=1500;rc[4]=2000;serviceArming(rc);assert(armed);
 armed=false;fcSetupActive=true;fcSetupExpires=clockMs+5000;controlExpiresAt=clockMs+10000;benchMode=BENCH_MOTOR;benchMask=5;benchPulse=1120;benchUntilMs=clockMs+800;serviceBenchMode();assert(outputs[0]==1120&&outputs[1]==1000&&outputs[2]==1120&&outputs[3]==1000);
 clockMs+=800;serviceBenchMode();assert(benchMode==BENCH_NONE);for(int v:outputs)assert(v==1000);
 benchMode=BENCH_ESC_MANUAL;benchPulse=2000;benchUntilMs=clockMs+12000;serviceBenchMode();for(int v:outputs)assert(v==2000);
 clockMs=fcSetupExpires;writeEscMicroseconds(0,2000);assert(outputs[0]==1000);serviceFcSetup();assert(!fcSetupActive&&benchMode==BENCH_NONE&&setupAfterNeutral);for(int v:outputs)assert(v==1000);
 fcSetupActive=true;fcSetupExpires=clockMs+5000;controlExpiresAt=clockMs+10000;setupCalibrationCancel=false;benchMode=BENCH_ESC_MANUAL;benchPulse=1000;benchUntilMs=clockMs+3000;clockMs+=3000;serviceBenchMode();assert(benchMode==BENCH_NONE);
 benchMode=BENCH_MOTOR;benchPulse=1200;benchMask=15;benchUntilMs=clockMs+800;serviceBenchMode();benchStop();writeEscMicroseconds(1,1200);assert(outputs[1]==1000); // delayed output after STOP
 benchMode=BENCH_MOTOR;benchUntilMs=clockMs+800;controlExpiresAt=clockMs;serviceFcSetup();assert(setupCalibrationCancel&&!fcSetupActive&&benchMode==BENCH_NONE);
 std::cout<<"PASS: actual FC setup inhibition, yaw-left dwell, Web manual ARM, masked motors, deadlines, ESC lease / owner loss and stale PWM after STOP\n";
}
'''
with tempfile.TemporaryDirectory() as d:
 p=Path(d);src=p/'fc.cpp';binary=p/'fc';src.write_text(prefix+function(ino,'writeEscMicroseconds')+helpers+function(ino,'benchStop')+function(ino,'serviceBenchMode')+function(ino,'serviceArming')+function(setup,'serviceFcSetup')+function(training,'finishTraining')+function(training,'serviceTraining')+checks)
 subprocess.run(['g++','-std=c++17','-I',str(root/'FlightCore_Firmware'),str(src),'-o',str(binary)],check=True);subprocess.run([str(binary)],check=True)
