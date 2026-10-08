#pragma once
#include <string.h>
namespace ZfcSecure {
inline bool same(const char* a,const char* b){return strcmp(a,b)==0;}
inline bool prefix(const char* a,const char* b){return strncmp(a,b,strlen(b))==0;}
inline bool permitted(bool owner,bool ap,bool maintenance,bool disarmed,const char* path,const char* type){
 if(!owner){
  bool read=same(path,"/api/status")||same(path,"/api/telemetry")||same(path,"/api/firmware/info")||same(path,"/api/security/info")||same(path,"/api/webapp/register")||same(path,"/api/webapp/unregister");
  bool command=same(path,"/api/command")&&(same(type,"pid_get")||same(type,"pid_set")||same(type,"training_status")||same(type,"training_request")||same(type,"training_stop")||same(type,"training_sensor")||same(type,"training_engine")||same(type,"receiver_read")||same(type,"flight_settings_get")||same(type,"diagnostics_get")||same(type,"snapshot_get"));
  if(!read&&!command)return false;
 }
 if(!ap)return true;
 bool flight=prefix(path,"/api/control/")||same(path,"/api/status")||same(path,"/api/telemetry")||same(path,"/api/security/info")||same(path,"/api/firmware/info")||same(path,"/api/security/maintenance")||same(path,"/api/command")&&(same(type,"rc_frame")||same(type,"flight_stop")||same(type,"ping")||same(type,"rc_source_set"));
 bool admin=owner&&maintenance&&disarmed&&(prefix(path,"/api/wifi/")||prefix(path,"/api/setup/test")||same(path,"/api/name")||same(path,"/api/reboot"));
 return flight||admin;
}
}
