'use strict';
// Actual browser pairing dialog + shipped client code. Physical controller I/O is simulated.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{chromium}=require('playwright'),S=require('../kit-security.js');
const root=path.resolve(__dirname,'..'),N=S.N,g=S.G;
const H=(...data)=>crypto.createHash('sha512').update(Buffer.concat(data)).digest(),B=v=>Buffer.from(S.bytes(v)),pad=v=>Buffer.from(S.bytes(v,384)),num=v=>BigInt('0x'+v.toString('hex'));
const fixtures=[],servers=[],errors=[];let browser;
function makeKit(id,name,code){
 const kit={id,name,code,owner:'',role:'',run:0,active:false,target:'NONE',revision:1,invites:new Map(),sessions:new Map(),pending:new Map()};fixtures.push(kit);
 const status=cid=>({ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:id,name,mode:'STA / LOCAL',ip:'127.0.0.1',firmware:'18.3.78',boardId:'ZFC-A2',securityRequired:true,securityProtocol:'ZFC3',flightReady:true,locked:!!kit.owner,lockMine:kit.owner===cid,controlRole:kit.role,trainingActive:kit.active,outputsBlocked:kit.active,trainingTarget:kit.target,trainingController:'APP',trainingRunId:kit.run,pidRevision:kit.revision});
 function encrypt(key,n,aad,plain){const c=crypto.createCipheriv('aes-256-gcm',key,Buffer.from(S.nonce(n)));c.setAAD(Buffer.from(aad));return Buffer.concat([c.update(plain),c.final(),c.getAuthTag()]);}
 function decrypt(key,n,aad,cipher){const c=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(S.nonce(n)));c.setAAD(Buffer.from(aad));c.setAuthTag(cipher.subarray(-16));return Buffer.concat([c.update(cipher.subarray(0,-16)),c.final()]);}
 const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const u=new URL(req.url,'http://localhost'),p=Object.fromEntries(new URLSearchParams(raw));res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store');
  const send=(code,body)=>{res.statusCode=code;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
  try{
   if(u.pathname==='/fixture'){res.setHeader('Content-Type','text/html');res.end('<script src="/vendor/crypto/zfc-crypto.js"></script><script src="/kit-security.js"></script><script src="/kit-local.js"></script><div>Pairing browser test</div>');return;}
   if(!u.pathname.startsWith('/api/')){const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.statusCode=404;res.end();return;}res.setHeader('Content-Type',f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'text/plain');res.end(fs.readFileSync(f));return;}
   if(u.pathname==='/api/status'){send(200,status(''));return;}
   if(u.pathname==='/api/security/hello'){
    if(p.deviceId!==id||p.expectedDeviceId!==id){send(409,{message:'Wrong kit'});return;}
    const credential=p.credential==='OWNER'?code:kit.invites.get(p.credential);if(!credential||p.credential!=='OWNER'&&p.role!=='COMPANION'){send(403,{message:'Invitation denied'});return;}
    const A=Buffer.from(p.A,'hex'),a=num(A);if(A.length!==384||a<=0n||a>=N){send(400,{message:'Invalid A'});return;}
    const salt=crypto.randomBytes(16),user=id+'/'+p.credential,x=num(H(salt,H(Buffer.from(user+':'+credential)))),v=S.pow(g,x),k=num(H(pad(N),pad(g))),b=num(crypto.randomBytes(32)),pub=(k*v+S.pow(g,b))%N,Braw=B(pub),K=H(B(S.pow(a*S.pow(v,num(H(A,pad(pub))))%N,b))),sid=crypto.randomBytes(8).toString('hex');
    const ng=H(pad(N)),gg=H(pad(g));for(let i=0;i<64;i++)ng[i]^=gg[i];const M1=H(ng,H(Buffer.from(user)),salt,A,Braw,K),M2=H(A,M1,K);kit.pending.set(sid,{sid,M1,M2,K,A,Braw,salt,user,cid:p.clientId,role:p.role,credential:p.credential});send(200,{deviceId:id,sessionId:sid,salt:salt.toString('hex'),B:Braw.toString('hex')});return;
   }
   if(u.pathname==='/api/security/proof'){
    const s=kit.pending.get(p.sessionId);kit.pending.delete(p.sessionId);if(!s||!crypto.timingSafeEqual(Buffer.from(p.M1,'hex'),s.M1)){send(403,{message:'Wrong pairing code'});return;}
    const hs=crypto.createHash('sha256').update(Buffer.concat([s.A,s.Braw,s.salt])).digest();s.keys={};for(const ch of ['HTTP_C2S','HTTP_S2C','RC_C2S','ACK_S2C','MONITOR_S2C'])s.keys[ch]=Buffer.from(crypto.hkdfSync('sha256',s.K,hs,Buffer.from('ZFC3|'+id+'|'+s.user+'|'+s.sid+'|'+s.cid+'|'+s.role+'|'+ch),32));s.seen=new Set();s.send=0;kit.sessions.set(s.sid,s);if(s.credential!=='OWNER')kit.invites.delete(s.credential);send(200,{M2:s.M2.toString('hex')});return;
   }
   if(u.pathname!=='/api/security/request'){send(401,{message:'Pair required'});return;}
   const s=kit.sessions.get(p.sessionId);if(!s||s.seen.has(p.seq)){send(401,{message:'Replay'});return;}
   const plain=decrypt(s.keys.HTTP_C2S,p.seq,'ZFC3|'+s.sid+'|'+p.seq+'|HTTP_C2S',Buffer.from(p.cipher,'hex')),d=Object.fromEntries(new URLSearchParams(plain.toString()));s.seen.add(p.seq);let result={ok:true},code=200;
   const fail=(c,m)=>{code=c;result={ok:false,message:m};};
   if(d.expectedDeviceId!==id||d.clientId!==s.cid)fail(409,'Identity differs');
   else if(s.role==='COMPANION'&&(d.path.startsWith('/api/control/')||d.type==='rc_frame'))fail(403,'Companion cannot control');
   else if(d.path==='/api/security/info')result={ok:true,deviceId:id,name,role:s.role,pidPermission:true,controlPermission:s.role!=='COMPANION',mode:'STA'};
   else if(d.path==='/api/status')result=status(s.cid);
   else if(d.path==='/api/control/acquire'){if(kit.owner&&kit.owner!==s.cid)fail(423,'In use');else{kit.owner=s.cid;kit.role=s.role;result={...status(s.cid),lockMine:true,lockTimeoutMs:10000};}}
   else if(d.path==='/api/security/invite'){if(kit.owner!==s.cid)fail(403,'Owner required');else{const credential='LAB-'+crypto.randomBytes(4).toString('hex'),secret=crypto.randomBytes(16).toString('hex').toUpperCase();kit.invites.set(credential,secret);result={ok:true,invitation:credential+':'+secret,deviceId:id,name};}}
   else if(d.type==='training_select'){kit.run++;kit.active=true;kit.target=d.target;result={ok:true,deviceId:id,active:true,outputsBlocked:true,runId:kit.run};}
   else if(d.type==='pid_get')result={ok:true,pidRevision:kit.revision,savedRevision:kit.revision,pid:{rateRoll:{P:1,I:0,D:0}}};
   else if(d.type==='pid_set'){if(!kit.active||Number(d.pidRevision)!==kit.revision)fail(409,'Revision / training differs');else{kit.revision++;result={ok:true,saving:true,pidRevision:kit.revision};}}
   else if(d.path==='/api/control/release'){kit.owner='';kit.role='';}
   const n=++s.send,cipher=encrypt(s.keys.HTTP_S2C,n,'ZFC3|'+s.sid+'|'+n+'|HTTP_S2C',Buffer.from(JSON.stringify({status:code,requestSeq:p.seq,body:result})));send(200,{sessionId:s.sid,seq:String(n),cipher:cipher.toString('hex')});
  }catch(e){send(400,{message:e.message});}
 });return new Promise(resolve=>server.listen(0,'127.0.0.1',()=>{servers.push(server);kit.base='http://127.0.0.1:'+server.address().port;resolve(kit);}));
}
async function pair(page,kit,role,code){
 await page.goto(kit.base+'/fixture');page.on('pageerror',e=>errors.push(e.message));
 const pending=page.evaluate(async({base,id,role})=>{window.client=new ZebjusDroneKit.LocalKitClient();const st=await (await fetch(base+'/api/status')).json();client.clientId=role+'-browser-test';await ZfcSecurity.ensure(base,st,client.clientId,role,async(p,d)=>{const r=await fetch(base+p,{method:'POST',body:new URLSearchParams(d)});const b=await r.json();if(!r.ok)throw Error(b.message);return b;});client._accept(await ZebjusDroneKit.requestBase(base,'/api/status'),base);return client.status;},{base:kit.base,id:kit.id,role});
 await page.locator('dialog input').fill(code);await page.locator('dialog button[value=pair]').click();return pending;
}
(async()=>{
 const a=await makeKit('ZFC-001122334455','zebjus_drone_001122334455','0123456789ABCDEF0123456789ABCDEF'),b=await makeKit('ZFC-FFEEDDCCBBAA','zebjus_drone_ffeeddccbbaa','FEDCBA9876543210FEDCBA9876543210');
 browser=await chromium.launch({headless:true});const phone=await browser.newPage(),web=await browser.newPage();await pair(phone,a,'MOBILE',a.code);
 // Avoid recursively wrapping a raw transport: public client acquire is WEB-only; native role is confirmed directly.
 await phone.evaluate(async()=>{const ch=ZfcSecurity.get(client.base);const raw=async(p,d)=>{const r=await fetch(client.base+p,{method:'POST',body:new URLSearchParams(d)});return r.json();};await ch.request('/api/control/acquire',{clientId:client.clientId,expectedDeviceId:client.deviceId},raw);});
 const invitation=await phone.evaluate(()=>client.request('/api/security/invite',{method:'POST',data:{clientId:client.clientId}}));await pair(web,a,'WEB',invitation.invitation);
 assert.equal(await web.evaluate(()=>ZfcSecurity.get(client.base).role),'COMPANION');
 await assert.rejects(web.evaluate(()=>client.acquire()),/App keeps joystick control/);
 await assert.rejects(web.evaluate(()=>client.request('/api/control/acquire',{method:'POST',data:{clientId:client.clientId}})),/Companion cannot control/);
 await phone.evaluate(()=>client.command({type:'training_select',target:'TRIPOD'}));const saved=await web.evaluate(()=>client.command({type:'pid_set',rateRollP:2}));assert.equal(saved.saved,true);assert.equal(a.role,'MOBILE');
 const wrong=await browser.newPage();await assert.rejects(pair(wrong,b,'WEB',a.code),/Wrong pairing code/);assert.equal(b.owner,'');
 assert.deepEqual(errors,[]);console.log('PASS: real browser dialog, encrypted pairing, unique kit identity, single-use app invitation, companion control denial and concurrent PID save.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();for(const s of servers)s.close();});
