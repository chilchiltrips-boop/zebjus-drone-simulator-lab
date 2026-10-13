#pragma once
#include <mbedtls/pk.h>
#include <mbedtls/sha256.h>
// An absent publisher trust anchor disables Wi-Fi OTA. Never embed a private key.
#ifndef ZEBJUS_OTA_PUBLISHER_PEM
#define ZEBJUS_OTA_PUBLISHER_PEM ""
#endif
bool otaVersionAllowed(String next){
 String current=String(FW_VERSION);
 for(int i=0;i<3;i++){
  int a=next.indexOf('.'),b=current.indexOf('.');
  String pa=next.substring(0,a<0?next.length():a),pb=current.substring(0,b<0?current.length():b);
  if(!pa.length()||pa.length()>6)return false;
  for(char c:pa)if(c<'0'||c>'9')return false;
  int n=pa.toInt(),v=pb.toInt();
  if(n<v)return false;if(n>v)return true;
  if((a<0)!=(i==2))return false;
  next=a<0?"":next.substring(a+1);current=b<0?"":current.substring(b+1);
 }
 return true;
}
// Publisher signs the SHA-256 of:
// "ZFC3-OTA-V1\n" + BOARD_ID + "\n" + version + "\n" + size + "\n" + imageSHA256 + "\n".
bool verifiedOtaPublisher(const String& digest,uint32_t size,const String& version,const String& signatureHex){
 const char* pem=ZEBJUS_OTA_PUBLISHER_PEM;size_t pemSize=strlen(pem),sigSize=signatureHex.length()/2;
 if(pemSize<64||sigSize<64||sigSize>512||signatureHex.length()!=sigSize*2||!otaVersionAllowed(version))return false;
 uint8_t signature[512],hash[32];
 if(!secureUnhex(signatureHex,signature,sigSize))return false;
 String message=String("ZFC3-OTA-V1\n")+BOARD_ID+"\n"+version+"\n"+String(size)+"\n"+digest+"\n";
 mbedtls_sha256((const uint8_t*)message.c_str(),message.length(),hash,0);
 mbedtls_pk_context key;mbedtls_pk_init(&key);
 int result=mbedtls_pk_parse_public_key(&key,(const uint8_t*)pem,pemSize+1);
 if(result==0)result=mbedtls_pk_verify(&key,MBEDTLS_MD_SHA256,hash,sizeof(hash),signature,sigSize);
 mbedtls_pk_free(&key);memset(signature,0,sizeof(signature));memset(hash,0,sizeof(hash));
 return result==0;
}
uint64_t otaSession=0;uint32_t otaExpected=0,otaAt=0;String otaDigest;mbedtls_sha256_context otaHash;
bool secureLayoutReady(){const esp_partition_t* running=esp_ota_get_running_partition();const esp_partition_t* next=esp_ota_get_next_update_partition(nullptr);return running&&next&&running->size==0x1e0000&&next->size==0x1e0000&&((running->address==0x10000&&next->address==0x1f0000)||(running->address==0x1f0000&&next->address==0x10000));}
void abortSecureOta(){if(firmwareUploadActive){Update.abort();mbedtls_sha256_free(&otaHash);}firmwareUploadActive=false;otaSession=0;}
void serviceSecureOta(){if(firmwareUploadActive&&millis()-otaAt>10000)abortSecureOta();}
void secureOta(const String& p){
 if(!secureOwner()||!controlAuthorized()||armed||benchMode!=BENCH_NONE||trainingActive||fcSetupActive){sendMessage(423,"Secure OTA requires owner control and an idle, disarmed kit");return;}
 if(p=="/api/firmware/begin"){
  uint32_t n=server.arg("size").toInt();String digest=server.arg("sha256");uint8_t hash[32];
  if(!secureLayoutReady()){sendMessage(409,"USB FACTORY migration required for the larger dual OTA layout");return;}
  if(firmwareUploadActive||n<24||n>0x1e0000||!secureUnhex(digest,hash,32)||server.arg("boardId")!=BOARD_ID){sendMessage(400,"Invalid firmware size, board or digest");return;}
  String version=server.arg("version");digest.toLowerCase();if(!verifiedOtaPublisher(digest,n,version,server.arg("signature"))){sendMessage(403,"No trusted publisher signature; signed OTA is required. Use verified USB flashing.");return;}
  if(!Update.begin(n)){sendMessage(503,"OTA partition unavailable");return;}
  firmwareUploadActive=true;firmwareUploadBytes=0;otaExpected=n;otaDigest=digest;otaDigest.toLowerCase();otaSession=secureCurrent->id;otaAt=millis();mbedtls_sha256_init(&otaHash);mbedtls_sha256_starts(&otaHash,0);sendMessage(200,"Encrypted OTA ready");return;
 }
 if(!firmwareUploadActive||otaSession!=secureCurrent->id){sendMessage(409,"Firmware upload belongs to another session");return;}
 if(p=="/api/firmware/chunk"){
  String hex=server.arg("data");size_t n=hex.length()/2;uint8_t bytes[1024];uint32_t offset=server.arg("offset").toInt();
  if(n<1||n>sizeof(bytes)||offset!=firmwareUploadBytes||offset+n>otaExpected||!secureUnhex(hex,bytes,n)){sendMessage(409,"Unexpected firmware offset or chunk");return;}
  const uint16_t chip=FLIGHT_CONTROL_ENABLED?13:5;if(!offset&&(n<24||bytes[0]!=0xe9||uint16_t(bytes[12]|uint16_t(bytes[13])<<8)!=chip)){abortSecureOta();sendMessage(400,"Wrong firmware chip/profile header");return;}
  if(Update.write(bytes,n)!=n){abortSecureOta();sendMessage(503,"Flash write failed");return;}mbedtls_sha256_update(&otaHash,bytes,n);firmwareUploadBytes+=n;otaAt=millis();sendJson(200,"{\"ok\":true,\"offset\":"+String(firmwareUploadBytes)+"}");return;
 }
 if(p=="/api/firmware/end"){
  uint8_t hash[32];mbedtls_sha256_finish(&otaHash,hash);mbedtls_sha256_free(&otaHash);
  if(firmwareUploadBytes!=otaExpected||secureHex(hash,32)!=otaDigest){Update.abort();firmwareUploadActive=false;sendMessage(409,"Firmware size / SHA-256 mismatch; not activated");return;}
  if(!Update.end(false)){firmwareUploadActive=false;sendMessage(503,"Firmware validation failed");return;}
  firmwareUploadActive=false;sendMessage(200,"Firmware verified; rebooting");restartAt=millis()+1000;return;
 }
 sendMessage(404,"Unknown encrypted OTA step");
}
