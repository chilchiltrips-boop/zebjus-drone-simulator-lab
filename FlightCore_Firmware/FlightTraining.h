#pragma once
// The computer's simulation lease is separate from the phone's RC ownership.
// Every physical motor output remains inhibited while training receives RC.
String trainingOwner,trainingSession,trainingCancelled[16];uint8_t trainingCancelledNext=0;
bool trainingWasCancelled(const String& token){for(const String& t:trainingCancelled)if(t==token)return true;return false;}
void cancelTrainingToken(const String& token){if(!setupTokenValid(token)||trainingWasCancelled(token))return;trainingCancelled[trainingCancelledNext++%16]=token;}
void finishTraining(){
 setupAfterNeutral=true;armLowSeen=false;resetArmGesture();invalidateRcUdp();webRcLastMs=0;benchStop();disarmFlight("Training ended: neutral and manual ARM required");trainingActive=false;
}
void serviceTraining(){if(trainingActive&&!FlightSetupPolicy::live(millis(),trainingExpires))finishTraining();}
String trainingJson(){return String("{\"ok\":true,\"deviceId\":\"")+deviceId+"\",\"supported\":"+String(FLIGHT_CONTROL_ENABLED?"true":"false")+",\"active\":"+String(trainingActive?"true":"false")+",\"outputsBlocked\":"+String(trainingActive?"true":"false")+",\"input\":\""+String(trainingInput==2?"PPM":"APP")+"\",\"leaseMs\":5000}";}
bool trainingCommand(const String& type){
 if(!type.startsWith("training_"))return false;serviceTraining();
 if(type=="training_status"){sendJson(200,trainingJson());return true;}
 if(!server.arg("expectedDeviceId").equalsIgnoreCase(deviceId)){sendMessage(409,"Exact Device ID is required for training");return true;}
 const String token=server.arg("session"),owner=server.arg("clientId");if(!setupTokenValid(token)){sendMessage(400,"Unique training session is required");return true;}
 if(type=="training_end"){cancelTrainingToken(token);if(trainingSession==token&&trainingOwner==owner)finishTraining();sendJson(200,trainingJson());return true;}
 if(type=="training_begin"){
  if(!requireControl())return true;if(!FLIGHT_CONTROL_ENABLED){sendMessage(403,"Training RC bridge requires an A2 controller");return true;}
  if(trainingWasCancelled(token)||trainingSession==token&&!trainingActive){sendMessage(409,"Training session cancelled; create a new session");return true;}
  if(trainingActive){sendMessage(423,"A training session is already active");return true;}
  if(armed||benchMode!=BENCH_NONE||fcSetupActive||configurationBusy||firmwareUploadActive||restartAt){sendMessage(423,"Disarm and stop setup / outputs before training");return true;}
  if(server.arg("confirm")!="PROPS_REMOVED"){sendMessage(412,"Remove every propeller before connecting simulator RC");return true;}
  const String input=server.arg("source");if(input!="APP"&&input!="PPM"){sendMessage(400,"Choose APP or PPM");return true;}
  if(trainingSession.length())cancelTrainingToken(trainingSession);trainingOwner=owner;trainingSession=token;trainingInput=input=="PPM"?2:1;trainingExpires=millis()+5000;trainingActive=true;setupAfterNeutral=true;invalidateRcUdp();webRcLastMs=0;benchStop();disarmFlight("Training: physical outputs blocked");sendJson(200,trainingJson());return true;
 }
 if(!trainingActive||token!=trainingSession||owner!=trainingOwner){sendMessage(409,"Training lease expired or belongs to another session");return true;}
 if(type=="training_ping"){trainingExpires=millis()+5000;sendJson(200,trainingJson());return true;}
 sendMessage(400,"Unknown training command");return true;
}
