#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "esp_srp.h"
static void hex(const char* p,int n){for(int i=0;i<n;i++)printf("%02x",(unsigned char)p[i]);}
static int unhex(const char* s,char* p,int n){if((int)strlen(s)!=2*n)return 0;for(int i=0;i<n;i++){unsigned int b;if(sscanf(s+2*i,"%2x",&b)!=1)return 0;p[i]=b;}return 1;}
int main(){char user[160],code[64],line[800],A[384],M1[64],M2[64];if(!fgets(user,sizeof(user),stdin)||!fgets(code,sizeof(code),stdin)||!fgets(line,sizeof(line),stdin))return 2;user[strcspn(user,"\r\n")]=0;code[strcspn(code,"\r\n")]=0;line[strcspn(line,"\r\n")]=0;if(!unhex(line,A,384))return 2;
 esp_srp_handle_t* h=esp_srp_init(ESP_NG_3072);char *B,*salt,*key;int nb;uint16_t nk;
 if(esp_srp_srv_pubkey(h,user,strlen(user),code,strlen(code),16,&B,&nb,&salt)!=ESP_OK||esp_srp_get_session_key(h,A,384,&key,&nk)!=ESP_OK)return 3;
 hex(salt,16);printf(" ");hex(B,nb);printf("\n");fflush(stdout);
 if(!fgets(line,sizeof(line),stdin))return 2;line[strcspn(line,"\r\n")]=0;if(!unhex(line,M1,64))return 2;
 int ok=esp_srp_exchange_proofs(h,user,strlen(user),M1,M2)==ESP_OK;
 if(ok){printf("OK ");hex(M2,64);}else printf("DENIED");printf("\n");fflush(stdout);esp_srp_free(h);return 0;
}
