#pragma once
// Dedicated networking task: a slow HTTP request cannot stall Android RC.
WiFiUDP rcUdp;
TaskHandle_t rcUdpTaskHandle=nullptr;
uint64_t rcUdpToken=0;
uint32_t rcUdpLastSequence=0;
bool rcUdpSequenceSeen=false;
void invalidateRcUdp(){
 portENTER_CRITICAL(&stateMux);rcUdpToken=0;rcUdpSequenceSeen=false;portEXIT_CRITICAL(&stateMux);
}
String rcUdpGrantJson(){
 uint64_t token;portENTER_CRITICAL(&stateMux);token=rcUdpToken;portEXIT_CRITICAL(&stateMux);
 char encoded[17];snprintf(encoded,sizeof(encoded),"%016llx",(unsigned long long)token);
 return String(",\"rcUdpPort\":")+String(token?RcUdpProtocol::PORT:0)+",\"rcUdpToken\":\""+(token?String(encoded):String(""))+"\",\"rcUdpHz\":50";
}
void rcUdpTask(void*){
 const uint64_t key=ESP.getEfuseMac()&0xFFFFFFFFFFFFULL;
 for(;;){
  for(int count=0;count<8;count++){
   int size=rcUdp.parsePacket();if(size<=0)break;
   uint8_t bytes[RcUdpProtocol::FRAME_BYTES];int read=rcUdp.read(bytes,sizeof(bytes));
   RcUdpProtocol::Frame frame;if(size!=(int)sizeof(bytes)||!RcUdpProtocol::decode(bytes,read,frame)||frame.device!=key)continue;
   uint32_t now=millis();bool accepted=false,actualArmed=false,ready=false;
   portENTER_CRITICAL(&stateMux);
   if(rcUdpToken&&frame.token==rcUdpToken&&(int32_t)(controlExpiresAt-now)>0&&benchMode==BENCH_NONE&&!fcSetupActive&&!configurationBusy&&!firmwareUploadActive&&(!rcUdpSequenceSeen||RcUdpProtocol::newer(frame.sequence,rcUdpLastSequence))){
    for(int i=0;i<10;i++)webRcCh[i]=frame.channels[i];
    webRcLastMs=now;webRcFrames++;controlExpiresAt=now+LOCK_TIMEOUT_MS;
    rcUdpLastSequence=frame.sequence;rcUdpSequenceSeen=true;accepted=true;actualArmed=armed;ready=flightReady;
   }
   portEXIT_CRITICAL(&stateMux);
   if(accepted){uint8_t ack[RcUdpProtocol::ACK_BYTES];RcUdpProtocol::ack(ack,frame,actualArmed,ready);rcUdp.beginPacket(rcUdp.remoteIP(),rcUdp.remotePort());rcUdp.write(ack,sizeof(ack));rcUdp.endPacket();}
  }
  vTaskDelay(pdMS_TO_TICKS(2));
 }
}
void startRcUdp(){
 if(rcUdpTaskHandle||!FLIGHT_CONTROL_ENABLED)return;
 if(!rcUdp.begin(RcUdpProtocol::PORT))return;
 if(xTaskCreate(rcUdpTask,"aerion-rc-udp",4096,nullptr,2,&rcUdpTaskHandle)!=pdPASS){rcUdp.stop();rcUdpTaskHandle=nullptr;}
}
