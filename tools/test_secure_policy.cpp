#include <assert.h>
#include <iostream>
#include "../FlightCore_Firmware/SecurePolicy.h"
int main(){using ZfcSecure::permitted;
 for(const char* t:{"pid_get","pid_set","training_engine","training_sensor","training_status"})assert(permitted(false,false,false,true,"/api/command",t));
 for(const char* t:{"rc_frame","flight_stop","motor_test","network_mode_set","esc_calibrate","settings_restore","setup_begin"})assert(!permitted(false,false,false,true,"/api/command",t));
 for(const char* path:{"/api/control/acquire","/api/control/release","/api/wifi/set","/api/security/invite","/api/firmware/begin"})assert(!permitted(false,false,false,true,path,""));
 for(const char* t:{"training_select","training_begin","training_engine","training_sensor","pid_set","motor_test"})assert(!permitted(true,true,true,true,"/api/command",t));
 assert(permitted(true,true,false,true,"/api/command","rc_frame"));assert(permitted(true,true,false,true,"/api/command","flight_stop"));
 assert(!permitted(true,true,false,true,"/api/wifi/set",""));assert(permitted(true,true,true,true,"/api/wifi/set",""));assert(!permitted(true,true,true,false,"/api/wifi/set",""));
 assert(!permitted(false,true,true,true,"/api/wifi/set",""));assert(permitted(true,false,false,true,"/api/firmware/begin",""));
 std::cout<<"PASS: companion cannot control/ARM/flash; AP joystick/STOP only; separate disarmed Wi-Fi maintenance; STA scoped training/PID.\n";
}
