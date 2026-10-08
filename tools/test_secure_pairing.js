'use strict';
const assert=require('node:assert/strict'),readline=require('node:readline'),{spawn}=require('node:child_process');
const S=require('../kit-security.js'),C=require('../vendor/crypto/zfc-crypto.js');
async function pair(serverCode,clientCode,credential="OWNER",role="WEB"){
 const p=spawn(process.env.ZFC_SRP_SERVER||'/tmp/zfc-srp-server');const lines=readline.createInterface({input:p.stdout})[Symbol.asyncIterator]();
 const read=async()=>{const r=await lines.next();if(r.done)throw Error('SRP server ended');return r.value;};
 const ch=new S.Channel('http://192.168.1.3','ZFC-001122334455','WEB-test-session',role,credential);
 const raw=async(path,data)=>{
  if(path.endsWith('/hello')){p.stdin.write(ch.id+'/'+ch.credential+'\n'+serverCode+'\n'+data.A+'\n');const [salt,B]=(await read()).split(' ');return{deviceId:ch.id,sessionId:'1122334455667788',salt,B};}
  if(path.endsWith('/proof')){p.stdin.write(data.M1+'\n');const [ok,M2]=(await read()).split(' ');if(ok!=='OK')throw Error('Wrong pairing code');return{M2};}
  const plain=new TextDecoder().decode(C.decryptGCM(ch.keys.HTTP_C2S,S.nonce(data.seq),S.unhex(data.cipher),S.utf('ZFC3|'+ch.sid+'|'+data.seq+'|HTTP_C2S')));
  assert.equal(new URLSearchParams(plain).get('expectedDeviceId'),ch.id);
  const body={deviceId:ch.id,name:'Kit 001122334455',role:ch.role};
  return{sessionId:ch.sid,seq:'1',cipher:S.hex(C.encryptGCM(ch.keys.HTTP_S2C,S.nonce(1),S.utf(JSON.stringify({status:200,requestSeq:data.seq,body})),S.utf('ZFC3|'+ch.sid+'|1|HTTP_S2C')))};
 };
 try{await ch.pair(clientCode,raw);return ch;}finally{p.stdin.end();p.kill();}
}
(async()=>{
 const code='0123456789ABCDEF0123456789ABCDEF',ch=await pair(code,code);
 assert.equal(ch.info.role,'WEB');const apCode=S.apWifiCode('ZFC-001122334455');const ap=await pair(apCode,apCode,'AP_WIFI','MOBILE');assert.equal(ap.info.role,'MOBILE');await assert.rejects(pair(apCode,S.apWifiCode('ZFC-FFEEDDCCBBAA'),'AP_WIFI','MOBILE'),/Wrong pairing code/);await assert.rejects(pair(code,'FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF'),/Wrong pairing code/);
 const envelope=ch.envelope('secret=router-password');assert(!JSON.stringify(envelope).includes('router-password'));
 const payload={sessionId:ch.sid,seq:'2',cipher:S.hex(C.encryptGCM(ch.keys.HTTP_S2C,S.nonce(2),S.utf('{"ok":true}'),S.utf('ZFC3|'+ch.sid+'|2|HTTP_S2C')))};
 const bad={...payload,cipher:(payload.cipher[0]==='0'?'1':'0')+payload.cipher.slice(1)};
 assert.throws(()=>ch.decode(bad));assert.deepEqual(ch.decode(payload),{ok:true});assert.throws(()=>ch.decode(payload),/Replayed/);
 assert.throws(()=>ch.decode({...payload,sessionId:'8877665544332211'}),/Wrong secure session/);
 assert(!S.equal(ch.keys.HTTP_C2S,ch.keys.HTTP_S2C));assert(!S.equal(ch.keys.RC_C2S,ch.keys.ACK_S2C));
 assert.throws(()=>C.decryptGCM(ch.keys.RC_C2S,S.nonce(envelope.seq),S.unhex(envelope.cipher),S.utf('ZFC3|'+ch.sid+'|'+envelope.seq+'|HTTP_C2S')));
 console.log('PASS: JavaScript client interoperates with Espressif SRP server; wrong code, tampering, replay, wrong kit/session and cross-channel substitution rejected.');
})().catch(e=>{console.error(e);process.exitCode=1;});
