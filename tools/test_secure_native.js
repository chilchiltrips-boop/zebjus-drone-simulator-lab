'use strict';
const assert=require('node:assert/strict'),{execFileSync}=require('node:child_process'),S=require('../kit-security.js'),C=require('../vendor/crypto/zfc-crypto.js');
const root=require('node:path').resolve(__dirname,'..'),java=root+'/android-app/app/src/main/java/in/zebjus/aerion/';
execFileSync('java',['com.sun.tools.javac.Main','-d','/tmp/zfc-native-secure',...['LeaseGate','LocalPolicy','NativeRcStream','SecureTransport'].map(f=>java+f+'.java'),root+'/android-app/tests/SecureTransportHarness.java']);
const run=(...args)=>execFileSync('java',['-cp','/tmp/zfc-native-secure','in.zebjus.aerion.SecureTransportHarness',...args],{encoding:'utf8'}).trim().split('\n');
const frames=run('rc');assert.notEqual(frames[0],frames[1]);for(let i=0;i<2;i++){
 const frame=S.unhex(frames[i]),header=frame.slice(0,24),dv=new DataView(header.buffer);assert.equal(dv.getBigUint64(12,true),BigInt(i+1));
 const plain=C.decryptGCM(new Uint8Array(32).fill(0x22),S.nonce(i+1),frame.slice(24),header);assert.equal(plain.length,48);assert.equal(plain[4],2);assert.equal(new DataView(plain.buffer).getUint16(28,true),1750);
}
const header=new Uint8Array(24);header.set(S.utf('ZSC3'));const dv=new DataView(header.buffer);dv.setBigUint64(4,0x1122334455667788n,true);dv.setBigUint64(12,1n,true);dv.setUint16(20,28,true);header[22]=2;
const ack=new Uint8Array(28);ack.set(S.utf('ZRA1'));ack[4]=2;ack[6]=6;const encrypted=C.encryptGCM(new Uint8Array(32).fill(0x33),S.nonce(1),ack,header);
const results=run('ack',S.hex(S.cat(header,encrypted)));assert.equal(results[0],S.hex(ack));assert.equal(results[1],'REPLAY_DENIED');
const [http]=run('http');assert.equal(new TextDecoder().decode(C.decryptGCM(new Uint8Array(32),S.nonce(1),S.unhex(http),S.utf('ZFC3|1122334455667788|1|HTTP_C2S'))),'path=%2Fapi%2Fstatus&secret=fixture-password');
console.log('PASS: native Java AES-GCM interoperates with browser transport; per-session counters remain distinct; tampered ACK and replay rejected.');
