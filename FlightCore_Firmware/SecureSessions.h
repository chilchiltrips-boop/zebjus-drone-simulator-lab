#pragma once
#include "SecureFrames.h"
#include <freertos/FreeRTOS.h>
#include <freertos/semphr.h>
#include <mbedtls/bignum.h>
#include "src/crypto/esp_srp.h"
struct SecureSession {
 uint64_t id=0,send=0,ackSend=0,monitorSend=0;uint32_t expires=0;
 String client,role,credential;uint8_t keys[5][32]={};ZfcSecure::ReplayWindow httpReplay,rcReplay;
};
SecureSession secureSessions[6];SemaphoreHandle_t secureMutex=nullptr;
String secureHex(const uint8_t* p,size_t n){static const char h[]="0123456789abcdef";String s;s.reserve(n*2);for(size_t i=0;i<n;i++){s+=h[p[i]>>4];s+=h[p[i]&15];}return s;}
bool secureUnhex(const String& s,uint8_t* p,size_t n){if(s.length()!=n*2)return false;for(size_t i=0;i<n;i++){int a=tolower(s[i*2]),b=tolower(s[i*2+1]);a=a>='0'&&a<='9'?a-'0':a>='a'&&a<='f'?a-'a'+10:-1;b=b>='0'&&b<='9'?b-'0':b>='a'&&b<='f'?b-'a'+10:-1;if(a<0||b<0)return false;p[i]=(a<<4)|b;}return true;}
String secureId(uint64_t n){char b[17];snprintf(b,sizeof(b),"%016llx",(unsigned long long)n);return String(b);}
SecureSession* secureFind(uint64_t id){for(auto& s:secureSessions)if(s.id==id&&id&&(int32_t)(s.expires-millis())>0)return &s;return nullptr;}
inline uint64_t secureReadLE(const uint8_t* p){uint64_t n=0;for(int i=0;i<8;i++)n|=uint64_t(p[i])<<(i*8);return n;}
inline void secureWriteLE(uint8_t* p,uint64_t n){for(int i=0;i<8;i++)p[i]=n>>(i*8);}
// UDP has its own counters and keys. Plain ZRC1/2 frames are never accepted on secure firmware.
bool secureRcOpen(const uint8_t* packet,size_t n,uint8_t plain[48],uint64_t& sid){
 if(n!=88||memcmp(packet,"ZSC3",4)||packet[22]!=1||packet[23]!=0||packet[20]!=48||packet[21])return false;
 sid=secureReadLE(packet+4);uint64_t seq=secureReadLE(packet+12);if(xSemaphoreTake(secureMutex,pdMS_TO_TICKS(2))!=pdTRUE)return false;
 auto* s=secureFind(sid);bool ok=s&&s->role=="MOBILE"&&s->rcReplay.allowed(seq)&&ZfcSecure::open(s->keys[2],seq,packet,24,packet+24,64,plain);
 if(ok)s->rcReplay.accept(seq);xSemaphoreGive(secureMutex);return ok;
}
bool secureRcAck(uint64_t sid,const uint8_t plain[28],uint8_t out[68]){
 if(xSemaphoreTake(secureMutex,pdMS_TO_TICKS(2))!=pdTRUE)return false;auto* s=secureFind(sid);bool ok=false;
 if(s){memcpy(out,"ZSC3",4);secureWriteLE(out+4,sid);secureWriteLE(out+12,++s->ackSend);out[20]=28;out[21]=0;out[22]=2;out[23]=0;ok=ZfcSecure::seal(s->keys[3],s->ackSend,out,24,plain,28,out+24);}
 xSemaphoreGive(secureMutex);return ok;
}
