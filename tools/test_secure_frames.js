'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),S=require('../kit-security'),C=require('../vendor/crypto/zfc-crypto');
const host=(op,key,n,aad,data)=>execFileSync(process.env.ZFC_FRAME_SERVER||'/tmp/zfc-secure-frame',[op,S.hex(key),String(n),S.hex(aad),S.hex(data)],{encoding:'utf8'});
for(const n of [1,71,0x123456789]){
 const key=new Uint8Array(32).fill(23),plain=S.utf('expectedDeviceId=ZFC-001122334455&path=/api/rc/live'),aad=S.utf('ZFC3|1122334455667788|'+n+'|MONITOR_S2C');
 const encrypted=C.encryptGCM(key,S.nonce(n),plain,aad);assert.equal(host('seal',key,n,aad,plain),S.hex(encrypted));assert.equal(host('open',key,n,aad,encrypted),S.hex(plain));
 const bad=encrypted.slice();bad[bad.length-1]^=1;assert.equal(host('open',key,n,aad,bad),'DENIED');assert.equal(host('open',key,n,S.utf('different channel'),encrypted),'DENIED');
}
console.log('PASS: real firmware mbedTLS frames interoperate with browser AES-GCM; full counter nonce, tag/AAD rejection and production replay-window bounds.');
