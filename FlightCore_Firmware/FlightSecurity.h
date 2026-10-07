#pragma once
#include <esp_ota_ops.h>
// This file follows API handlers; dispatch reuses their safety checks with authenticated arguments.
struct PairCredential {String id;uint8_t salt[16],verifier[384];int length=0;uint32_t expires=0;};
PairCredential pairOwner,pairInvites[4];
struct PairPending {esp_srp_handle_t* srp=nullptr;String client,role,credential;uint64_t id=0;uint32_t expires=0;uint8_t saltHash[32],key[64];} pairPending;
SecureSession* secureCurrent=nullptr;uint64_t secureRequestSeq=0;uint32_t secureMaintenanceUntil[6]={};
uint32_t pairRateAt=0;int pairRateCount=0;String pairSerial;
bool makeCredential(PairCredential& c,const String& id,String& code){
 uint8_t random[16];esp_fill_random(random,16);code=secureHex(random,16);code.toUpperCase();String user=deviceId+"/"+id;char* salt=nullptr;char* verifier=nullptr;int len=0;
 int ret=esp_srp_gen_salt_verifier(user.c_str(),user.length(),code.c_str(),code.length(),&salt,16,&verifier,&len);
 bool ok=ret==ESP_OK&&salt&&verifier&&len>0&&len<=384;if(ok){c.id=id;c.length=len;memcpy(c.salt,salt,16);memcpy(c.verifier,verifier,len);}if(salt){memset(salt,0,16);free(salt);}if(verifier){memset(verifier,0,len);free(verifier);}memset(random,0,16);return ok;
}
void clearPairPending(){if(pairPending.srp)esp_srp_free(pairPending.srp);pairPending.srp=nullptr;memset(pairPending.key,0,64);pairPending.id=0;}
void initPairing(bool reset=false){
 if(!secureMutex)secureMutex=xSemaphoreCreateMutex();Preferences p;p.begin("zjpair",false);
 size_t n=reset?0:p.getBytesLength("verifier");pairOwner.id="OWNER";
 if(n>0&&n<=384&&p.getBytesLength("salt")==16){pairOwner.length=n;p.getBytes("salt",pairOwner.salt,16);p.getBytes("verifier",pairOwner.verifier,n);}
 else{String code;if(!makeCredential(pairOwner,"OWNER",code)){Serial.println("PAIRING ERROR: outputs unavailable");flightReady=false;p.end();return;}p.putBytes("salt",pairOwner.salt,16);p.putBytes("verifier",pairOwner.verifier,pairOwner.length);Serial.println("PAIR LABEL: "+deviceId+" / "+kitName+" / "+code);code="";}
 p.end();if(reset){xSemaphoreTake(secureMutex,portMAX_DELAY);for(auto& s:secureSessions){s.id=0;memset(s.keys,0,sizeof(s.keys));}xSemaphoreGive(secureMutex);for(auto& c:pairInvites)c.length=0;clearPairPending();invalidateRcUdp();forceDisarmRequested=true;}
}
void servicePairing(){
 if(pairPending.srp&&(int32_t)(pairPending.expires-millis())<=0)clearPairPending();
 for(int i=0;i<32&&Serial.available();i++){char c=Serial.read();if(c=='\n'||c=='\r'){pairSerial.trim();if(pairSerial=="PAIR RESET"&&!armed&&benchMode==BENCH_NONE&&!trainingActive&&!firmwareUploadActive)initPairing(true);pairSerial="";}else if(pairSerial.length()<32)pairSerial+=c;}
}
void pairingHello(){
 uint32_t now=millis();if(now-pairRateAt>60000){pairRateAt=now;pairRateCount=0;}
 if(++pairRateCount>8){sendMessage(429,"Pairing attempts limited; wait one minute");return;}
 if(armed||benchMode!=BENCH_NONE||firmwareUploadActive){sendMessage(423,"Disarm before pairing");return;}
 if(!server.arg("deviceId").equals(deviceId)||!server.arg("expectedDeviceId").equals(deviceId)){sendMessage(409,"Exact Device ID required");return;}
 String cid=server.arg("clientId"),role=server.arg("role"),credential=server.arg("credential");
 if(cid.length()<8||cid.length()>96||!(role=="MOBILE"||role=="WEB"||role=="COMPANION")){sendMessage(400,"Invalid pairing identity");return;}
 PairCredential* c=nullptr;if(credential=="OWNER"&&role!="COMPANION")c=&pairOwner;
 else if(role=="COMPANION")for(auto& invite:pairInvites)if(invite.id==credential&&invite.length&&(int32_t)(invite.expires-now)>0)c=&invite;
 if(!c){sendMessage(403,"Pairing invitation expired or invalid");return;}
 uint8_t A[384];if(!secureUnhex(server.arg("A"),A,384)){sendMessage(400,"Invalid SRP public key");return;}
 // Reject A=0 and A>=N before Espressif's SRP math. The group is immutable.
 mbedtls_mpi ai,ni;mbedtls_mpi_init(&ai);mbedtls_mpi_init(&ni);mbedtls_mpi_read_binary(&ai,A,384);mbedtls_mpi_read_string(&ni,16,ZFC_SRP_GROUP);
 bool valid=mbedtls_mpi_cmp_int(&ai,0)>0&&mbedtls_mpi_cmp_mpi(&ai,&ni)<0;mbedtls_mpi_free(&ai);mbedtls_mpi_free(&ni);
 if(!valid){sendMessage(400,"Invalid SRP public key");return;}
 clearPairPending();pairPending.srp=esp_srp_init(ESP_NG_3072);char* B=nullptr;int bl=0;char* K=nullptr;uint16_t kl=0;
 bool ok=pairPending.srp&&esp_srp_set_salt_verifier(pairPending.srp,(char*)c->salt,16,(char*)c->verifier,c->length)==ESP_OK&&esp_srp_srv_pubkey_from_salt_verifier(pairPending.srp,&B,&bl)==ESP_OK&&esp_srp_get_session_key(pairPending.srp,(char*)A,384,&K,&kl)==ESP_OK&&kl==64;
 if(!ok){clearPairPending();sendMessage(503,"Pairing unavailable");return;}
 pairPending.id=(uint64_t(esp_random())<<32)|esp_random();if(!pairPending.id)pairPending.id=1;pairPending.client=cid;pairPending.role=role;pairPending.credential=credential;pairPending.expires=now+20000;memcpy(pairPending.key,K,64);
 mbedtls_sha256_context h;mbedtls_sha256_init(&h);mbedtls_sha256_starts(&h,0);mbedtls_sha256_update(&h,A,384);mbedtls_sha256_update(&h,(uint8_t*)B,bl);mbedtls_sha256_update(&h,c->salt,16);mbedtls_sha256_finish(&h,pairPending.saltHash);mbedtls_sha256_free(&h);
 sendJson(200,"{\"ok\":true,\"deviceId\":\""+deviceId+"\",\"sessionId\":\""+secureId(pairPending.id)+"\",\"B\":\""+secureHex((uint8_t*)B,bl)+"\",\"salt\":\""+secureHex(c->salt,16)+"\"}");
}
void pairingProof(){
 uint8_t proof[64],answer[64];String user=deviceId+"/"+pairPending.credential;
 if(!pairPending.srp||(int32_t)(pairPending.expires-millis())<=0||server.arg("sessionId")!=secureId(pairPending.id)||!secureUnhex(server.arg("M1"),proof,64)||esp_srp_exchange_proofs(pairPending.srp,(char*)user.c_str(),user.length(),(char*)proof,(char*)answer)!=ESP_OK){clearPairPending();sendMessage(403,"Pairing code not accepted");return;}
 xSemaphoreTake(secureMutex,portMAX_DELAY);SecureSession* target=nullptr;for(auto& s:secureSessions)if(!s.id||(int32_t)(s.expires-millis())<=0){target=&s;break;}
 if(!target){xSemaphoreGive(secureMutex);clearPairPending();sendMessage(423,"All pairing sessions are in use");return;}
 *target=SecureSession();target->id=pairPending.id;target->client=pairPending.client;target->role=pairPending.role;target->credential=pairPending.credential;target->expires=millis()+7200000;
 const char* channels[]={"HTTP_C2S","HTTP_S2C","RC_C2S","ACK_S2C","MONITOR_S2C"};
 for(int i=0;i<5;i++){String info="ZFC3|"+deviceId+"|"+user+"|"+secureId(target->id)+"|"+target->client+"|"+target->role+"|"+channels[i];mbedtls_hkdf(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),pairPending.saltHash,32,pairPending.key,64,(const uint8_t*)info.c_str(),info.length(),target->keys[i],32);}
 String sid=secureId(target->id);xSemaphoreGive(secureMutex);
 for(auto& c:pairInvites)if(c.id==pairPending.credential)c.length=0;clearPairPending();sendJson(200,"{\"ok\":true,\"sessionId\":\""+sid+"\",\"M2\":\""+secureHex(answer,64)+"\"}");
}
String securePercent(const String& v){String s;for(size_t i=0;i<v.length();i++){if(v[i]=='+')s+=' ';else if(v[i]=='%'&&i+2<v.length()){uint8_t b;if(!secureUnhex(v.substring(i+1,i+3),&b,1)||!b)return String();s+=(char)b;i+=2;}else s+=v[i];}return s;}
bool secureParse(const String& form){server.secureCount=0;int at=0;while(at<(int)form.length()){int end=form.indexOf('&',at);if(end<0)end=form.length();String part=form.substring(at,end);int eq=part.indexOf('=');if(eq<1||server.secureCount>=64)return false;String k=securePercent(part.substring(0,eq)),v=securePercent(part.substring(eq+1));if(!k.length()||server.hasArg(k))return false;server.setSecureArg(k,v);at=end+1;}return true;}
bool secureSendJson(int code,const String& body){
 if(!secureCurrent)return false;String plain="{\"status\":"+String(code)+",\"requestSeq\":\""+String((unsigned long long)secureRequestSeq)+"\",\"body\":"+body+"}";
 uint64_t seq=++secureCurrent->send;String sid=secureId(secureCurrent->id),counter=String((unsigned long long)seq),aad="ZFC3|"+sid+"|"+counter+"|HTTP_S2C";
 auto out=std::unique_ptr<uint8_t[]>(new uint8_t[plain.length()+16]);if(!ZfcSecure::seal(secureCurrent->keys[1],seq,(uint8_t*)aad.c_str(),aad.length(),(uint8_t*)plain.c_str(),plain.length(),out.get()))return true;
 cors();server.sendHeader("Cache-Control","no-store");server.send(200,"application/json","{\"sessionId\":\""+sid+"\",\"seq\":\""+counter+"\",\"cipher\":\""+secureHex(out.get(),plain.length()+16)+"\"}");return true;
}
bool secureOwner(){return secureCurrent&&secureCurrent->credential=="OWNER";}
void secureInvite(){
 if(!secureOwner()||armed||benchMode!=BENCH_NONE||setupMode||!lockMine(secureCurrent->client)){sendMessage(403,"Owner control on STA and disarmed kit required to invite a laptop");return;}
 PairCredential* c=nullptr;for(auto& x:pairInvites)if(!x.length||(int32_t)(x.expires-millis())<=0){c=&x;break;}if(!c){sendMessage(429,"Use or wait for existing invitations");return;}
 String code,id="LAB-"+String(esp_random(),HEX);if(!makeCredential(*c,id,code)){sendMessage(503,"Invitation unavailable");return;}c->expires=millis()+60000;
 sendJson(200,"{\"ok\":true,\"deviceId\":\""+deviceId+"\",\"name\":\""+jsonEscape(kitName)+"\",\"invitation\":\""+id+":"+code+"\",\"expiresMs\":60000,\"permissions\":[\"observe\",\"training\",\"pid\"]}");
}
bool securePermission(const String& path){
 if(!secureCurrent)return false;String type=server.arg("type");bool owner=secureOwner();
 if(!owner){bool read=path=="/api/status"||path=="/api/telemetry"||path=="/api/firmware/info"||path=="/api/security/info";
  bool cmd=path=="/api/command"&&(type=="pid_get"||type=="pid_set"||type=="training_status"||type=="training_sensor"||type=="training_engine"||type=="receiver_read"||type=="flight_settings_get"||type=="diagnostics_get"||type=="snapshot_get");if(!read&&!cmd){sendMessage(403,"Laptop permission does not include control, ARM or administration");return false;}}
 if(setupMode){
  bool flight=path.startsWith("/api/control/")||path=="/api/status"||path=="/api/telemetry"||path=="/api/security/info"||path=="/api/firmware/info"||path=="/api/security/maintenance"||path=="/api/command"&&(type=="rc_frame"||type=="flight_stop"||type=="ping"||type=="rc_source_set");
  bool maintenance=owner&&!armed&&benchMode==BENCH_NONE&&(int32_t)(secureMaintenanceUntil[secureCurrent-secureSessions]-millis())>0&&(path.startsWith("/api/wifi/")||path.startsWith("/api/setup/test")||path=="/api/name"||path=="/api/reboot");
  if(!flight&&!maintenance){sendMessage(403,"AP supports joystick and STOP; use STA for training and PID");return false;}
 }return true;
}
void secureDispatch(const String& p){
 if(!securePermission(p))return;
 if(p=="/api/security/info"){sendJson(200,"{\"ok\":true,\"deviceId\":\""+deviceId+"\",\"name\":\""+jsonEscape(kitName)+"\",\"role\":\""+secureCurrent->role+"\",\"protocol\":\"ZFC3\",\"pidPermission\":true,\"controlPermission\":"+String(secureOwner()?"true":"false")+"}");return;}
 if(p=="/api/security/maintenance"){if(!secureOwner()||armed||benchMode!=BENCH_NONE){sendMessage(423,"Disarm for Wi-Fi maintenance");return;}secureMaintenanceUntil[secureCurrent-secureSessions]=millis()+120000;sendMessage(200,"Wi-Fi maintenance available for two minutes");return;}
 if(p=="/api/security/invite"){secureInvite();return;}
 if(p=="/api/security/revoke"){if(!secureOwner()){sendMessage(403,"Owner required");return;}xSemaphoreTake(secureMutex,portMAX_DELAY);for(auto& s:secureSessions)if(s.role=="COMPANION")s.expires=0;xSemaphoreGive(secureMutex);for(auto& c:pairInvites)c.length=0;sendMessage(200,"Laptop permissions revoked");return;}
 if(p=="/api/status")statusApi();else if(p=="/api/telemetry")telemetryApi();else if(p=="/api/control/acquire")acquireApi();else if(p=="/api/control/ping")lockPingApi();else if(p=="/api/control/release")releaseApi();else if(p=="/api/command")commandApi();else if(p=="/api/name")renameApi();else if(p=="/api/name/reset")resetNameApi();else if(p=="/api/wifi/scan")wifiScanApi();else if(p=="/api/wifi/saved")savedWifiApi();else if(p=="/api/wifi/set")setWifiApi();else if(p=="/api/wifi/use")useWifiApi();else if(p=="/api/wifi/forget")forgetWifiApi();else if(p=="/api/wifi/reset")resetWifiApi();else if(p=="/api/wifi/sta")returnToSavedWifiApi();else if(p=="/api/setup/test")startWifiTestApi();else if(p=="/api/setup/test/status")wifiTestStatusApi();else if(p=="/api/firmware/info")firmwareInfoApi();else if(p=="/api/reboot")rebootApi();else if(p=="/api/i2c/scan")i2cScanApi();else if(p=="/api/imu")imuApi();else sendMessage(404,"Secure operation unavailable");
}
void secureRequest(){
 String sid=server.arg("sessionId"),counter=server.arg("seq"),encoded=server.arg("cipher");uint8_t idbytes[8];
 if(!secureUnhex(sid,idbytes,8)||counter.length()<1||counter.length()>19||encoded.length()<32||encoded.length()>16384||encoded.length()%2){sendMessage(400,"Invalid secure envelope");return;}
 for(char c:counter)if(c<'0'||c>'9'){sendMessage(400,"Invalid secure counter");return;}
 uint64_t id=strtoull(sid.c_str(),nullptr,16),seq=strtoull(counter.c_str(),nullptr,10);size_t n=encoded.length()/2;
 auto cipher=std::unique_ptr<uint8_t[]>(new uint8_t[n]);auto plain=std::unique_ptr<uint8_t[]>(new uint8_t[n]);if(!secureUnhex(encoded,cipher.get(),n)){sendMessage(400,"Invalid secure envelope");return;}
 String aad="ZFC3|"+sid+"|"+counter+"|HTTP_C2S";xSemaphoreTake(secureMutex,portMAX_DELAY);auto* s=secureFind(id);
 bool ok=s&&s->httpReplay.allowed(seq)&&ZfcSecure::open(s->keys[0],seq,(uint8_t*)aad.c_str(),aad.length(),cipher.get(),n,plain.get());if(ok)s->httpReplay.accept(seq);xSemaphoreGive(secureMutex);
 if(!ok){sendMessage(401,"Pair this kit again; session or authentication expired");return;}plain[n-16]=0;
 secureCurrent=s;secureRequestSeq=seq;server.secureContext=true;
 if(!secureParse(String((char*)plain.get()))){sendMessage(400,"Invalid authenticated arguments");}else if(server.arg("expectedDeviceId")!=deviceId||server.arg("clientId")!=s->client){sendMessage(409,"Authenticated identity differs");}else{server.setSecureArg("clientId",s->client);server.setSecureArg("clientRole",s->role);secureDispatch(server.arg("path"));}
 server.secureContext=false;server.secureCount=0;secureCurrent=nullptr;memset(plain.get(),0,n);
}
void secureDiscovery(){sendJson(200,"{\"ok\":true,\"kit\":\"ZEBJUS_FLIGHTCORE\",\"deviceId\":\""+deviceId+"\",\"name\":\""+jsonEscape(kitName)+"\",\"ip\":\""+(setupMode?AP_IP.toString():WiFi.localIP().toString())+"\",\"mode\":\""+String(setupMode?"AP":"STA")+"\",\"firmware\":\""+String(FW_VERSION)+"\",\"boardId\":\""+String(BOARD_ID)+"\",\"securityRequired\":true,\"securityProtocol\":\"ZFC3\",\"partitionLayout\":\"ZFC_DUAL_1E0000\",\"rcMonitorProtocol\":\"SECURE_POLL\"}");}
