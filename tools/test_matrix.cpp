#include <cassert>
#include <cstdint>
#include <iostream>
#include <map>
#include <vector>
enum {LOW=0,HIGH=1,INPUT=0,OUTPUT=1};
int servoPin=-1,gpsRxPin=-1,gpsTxPin=-1,ppmReceiverPin=16;
uint8_t matrixRows[8]={1,2,4,8,16,32,64,128};
std::map<int,int> levels,modes;
std::vector<uint16_t> transfers;
uint16_t shiftWord=0;int bits=0;
bool auxPinAllowed(int pin){return pin!=ppmReceiverPin&&(pin==17||pin==19||pin==20||pin==18);}
int gpioOutput=-1;bool auxOutputActive(int pin){return pin==gpioOutput;}
void pinMode(int pin,int mode){modes[pin]=mode;}
void digitalWrite(int pin,int value);
#include "../FlightCore_Firmware/FlightMatrix.h"
void digitalWrite(int pin,int value){
 int previous=levels[pin];levels[pin]=value;
 if(pin==matrixCs&&value==LOW){shiftWord=0;bits=0;}
 if(pin==matrixClk&&previous==LOW&&value==HIGH){assert(levels[matrixCs]==LOW);shiftWord=(shiftWord<<1)|levels[matrixDin];bits++;}
 if(pin==matrixCs&&previous==LOW&&value==HIGH&&bits){assert(bits==16);transfers.push_back(shiftWord);}
}
int main(){
 assert(matrixPinsValid(17,19,20));assert(!matrixPinsValid(17,17,20));assert(!matrixPinsValid(16,19,20));
 servoPin=17;assert(!matrixPinsValid(17,19,20));servoPin=-1;gpsRxPin=19;assert(!matrixPinsValid(17,19,20));gpsRxPin=-1;gpsTxPin=20;assert(!matrixPinsValid(17,19,20));gpsTxPin=-1;gpioOutput=20;assert(!matrixPinsValid(17,19,20));gpioOutput=-1;ppmReceiverPin=18;assert(!matrixPinsValid(17,19,18));
 matrixSpi=true;matrixDin=17;matrixClk=19;matrixCs=20;matrixSpiBegin();
 assert(transfers.size()==13);assert(transfers[0]==0x0F00&&transfers[1]==0x0900&&transfers[2]==0x0B07&&transfers[3]==0x0A08&&transfers[4]==0x0C01);
 for(int row=0;row<8;row++)assert(transfers[row+5]==((row+1)<<8|matrixRows[row]));
 assert(matrixUsesPin(17)&&matrixUsesPin(19)&&matrixUsesPin(20)&&!matrixUsesPin(18));
 matrixSpiSend(3,0xA5);assert(transfers.back()==0x03A5&&levels[20]==HIGH&&levels[19]==LOW);
 matrixSpiRelease();assert(transfers.back()==0x0C00);assert(!matrixSpi&&!matrixUsesPin(17)&&matrixDin==-1&&matrixClk==-1&&matrixCs==-1);assert(modes[17]==INPUT&&modes[19]==INPUT&&modes[20]==INPUT);
 std::cout<<"PASS: production MAX7219 16-bit MSB-first clock/latch, initialization, rows, shutdown and servo/GPS/PPM/GPIO pin conflicts\n";
}
