#pragma once
#include <WebServer.h>
// Chrome may open an idle speculative socket before the app's API request.
// Do not let that one socket monopolise the single-client HTTP server for 5 s.
class FlightHttpServer : public WebServer {
public:
 using WebServer::WebServer;
 void handleClient() override {
  if(_currentStatus==HC_WAIT_READ&&!_currentClient.available()&&
     (uint32_t)(millis()-_statusChange)>250){
   _currentClient.stop();_currentClient=NetworkClient();_currentStatus=HC_NONE;
   _currentUpload.reset();_currentRaw.reset();
  }
  WebServer::handleClient();
 }
};
