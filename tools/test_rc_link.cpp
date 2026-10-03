#include "../FlightCore_Firmware/RcLinkPolicy.h"
#include "../FlightCore_Firmware/RcUdpProtocol.h"
#include <cassert>
#include <cstring>
#include <iostream>
int main(){
 uint16_t ch[10]={1900,1100,1450,1800,2000,1500,1000,1000,1500,1000};
 RcLinkPolicy::centreDuringGap(ch,299);assert(ch[0]==1900&&ch[2]==1450);
 RcLinkPolicy::centreDuringGap(ch,300);assert(ch[0]==1500&&ch[1]==1500&&ch[3]==1500&&ch[2]==1450&&ch[4]==2000);
 assert(RcLinkPolicy::live(1499,500));assert(!RcLinkPolicy::live(1500,500));assert(!RcLinkPolicy::live(10,0));
 assert(RcLinkPolicy::live(100,0xfffffff0u)); // millis rollover
 uint8_t bytes[48]={};RcUdpProtocol::put(bytes,0x3143525a,4);bytes[4]=bytes[5]=1;
 RcUdpProtocol::put(bytes+8,0x112233445566,8);RcUdpProtocol::put(bytes+16,0xfedcba9876543210ULL,8);RcUdpProtocol::put(bytes+24,42,4);
 for(int i=0;i<10;i++)RcUdpProtocol::put(bytes+28+2*i,ch[i],2);
 RcUdpProtocol::Frame frame;assert(RcUdpProtocol::decode(bytes,48,frame));assert(frame.sequence==42&&frame.channels[2]==1450&&frame.device==0x112233445566);
 assert(!RcUdpProtocol::decode(bytes,47,frame));bytes[6]=1;assert(!RcUdpProtocol::decode(bytes,48,frame));bytes[6]=0;
 RcUdpProtocol::put(bytes+28,999,2);assert(!RcUdpProtocol::decode(bytes,48,frame));RcUdpProtocol::put(bytes+28,1500,2);
 assert(RcUdpProtocol::decode(bytes,48,frame));uint8_t ack[28];RcUdpProtocol::ack(ack,frame,true,true);assert(ack[6]==3&&RcUdpProtocol::get(ack+16,8)==frame.token);
 assert(!RcUdpProtocol::newer(42,42)&&!RcUdpProtocol::newer(41,42)&&RcUdpProtocol::newer(43,42)&&RcUdpProtocol::newer(1,0xffffffffu));
 std::cout<<"PASS: bounded radio-gap centering/throttle/ARM, expiry/rollover, UDP frame bounds, channel validation, ACK identity and replay ordering\n";
}
