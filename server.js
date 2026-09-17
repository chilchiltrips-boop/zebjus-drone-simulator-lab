'use strict';
const http=require('http');
const fs=require('fs');
const path=require('path');
const crypto=require('crypto');
const {WebSocketServer,WebSocket}=require('ws');

const PORT=Number(process.env.PORT||8787);
const DEVICE_SHARED_TOKEN=String(process.env.DEVICE_SHARED_TOKEN||'zebjus-lab-device');
const ALLOW_REMOTE_BENCH_RC=/^(1|true|yes)$/i.test(String(process.env.ALLOW_REMOTE_BENCH_RC||'false'));
const LOCK_TIMEOUT_MS=Math.max(6000,Number(process.env.KIT_LOCK_TIMEOUT_MS||10000));
const OFFLINE_VISIBLE_MS=Math.max(30000,Number(process.env.OFFLINE_VISIBLE_MS||300000));
const ROOT=path.resolve(__dirname);

const browsers=new Map();
const devices=new Map();
const locks=new Map();

const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webmanifest':'application/manifest+json','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.glb':'model/gltf-binary','.txt':'text/plain; charset=utf-8','.md':'text/markdown; charset=utf-8'};
const json=(ws,o)=>{if(ws&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(o))};
const id=()=>crypto.randomUUID().replace(/-/g,'').slice(0,12);
const safe=(s,n=120)=>String(s??'').trim().slice(0,n);
const now=()=>Date.now();

function normalizeIp(ip){
 ip=String(ip||'').trim();
 if(ip.startsWith('::ffff:'))ip=ip.slice(7);
 if(ip==='::1')return '127.0.0.1';
 return ip;
}
function clientIp(req){
 const xf=String(req.headers['x-forwarded-for']||'').split(',')[0].trim();
 return normalizeIp(xf||req.socket.remoteAddress||'');
}
function networkGroup(ip){
 ip=normalizeIp(ip);
 if(ip.includes(':')){
  const h=ip.split(':');
  return h.slice(0,4).join(':')+'::/64';
 }
 const p=ip.split('.').map(Number);
 if(p.length===4&&p.every(Number.isFinite)){
  const priv=p[0]===10||(p[0]===192&&p[1]===168)||(p[0]===172&&p[1]>=16&&p[1]<=31);
  if(priv)return `${p[0]}.${p[1]}.${p[2]}.0/24`;
 }
 return ip||'unknown';
}
function sameNetwork(a,b){return !!a?.networkGroup&&a.networkGroup===b?.networkGroup}
function staticHandler(req,res){
 let u;try{u=new URL(req.url,'http://localhost')}catch{return res.writeHead(400).end('Bad request')}
 if(u.pathname==='/health'){
  res.writeHead(200,{'content-type':'application/json','cache-control':'no-store'});
  return res.end(JSON.stringify({ok:true,version:'18.2.0',devices:[...devices.values()].filter(d=>d.ws&&d.ws.readyState===WebSocket.OPEN).length,browsers:browsers.size,locks:activeLocks().length,lockTimeoutMs:LOCK_TIMEOUT_MS,remoteBenchRc:ALLOW_REMOTE_BENCH_RC}));
 }
 let rel=decodeURIComponent(u.pathname);if(rel==='/'||!rel)rel='/index.html';
 const file=path.resolve(ROOT,'.'+rel);if(!file.startsWith(ROOT+path.sep)){res.writeHead(403);return res.end('Forbidden')}
 fs.stat(file,(err,st)=>{
  if(err||!st.isFile()){res.writeHead(404);return res.end('Not found')}
  res.writeHead(200,{'content-type':mime[path.extname(file).toLowerCase()]||'application/octet-stream','cache-control':path.extname(file)==='.html'?'no-cache':'public, max-age=300'});
  fs.createReadStream(file).pipe(res);
 });
}

const server=http.createServer(staticHandler);
const wss=new WebSocketServer({noServer:true,maxPayload:1024*1024});
server.on('upgrade',(req,socket,head)=>{
 let u;try{u=new URL(req.url,'http://localhost')}catch{socket.destroy();return}
 if(u.pathname!=='/ws'){socket.destroy();return}
 wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});

function activeLock(deviceId){
 const l=locks.get(deviceId);if(!l)return null;
 if(now()-l.lastSeen>LOCK_TIMEOUT_MS){locks.delete(deviceId);return null}
 return l;
}
function activeLocks(){
 const out=[];for(const [deviceId] of locks){const l=activeLock(deviceId);if(l)out.push({deviceId,...l})}
 return out;
}
function lockForViewer(deviceId,viewer){
 const l=activeLock(deviceId);
 return {locked:!!l,mine:!!(l&&viewer&&l.clientId===viewer.clientId),expiresInMs:l?Math.max(0,LOCK_TIMEOUT_MS-(now()-l.lastSeen)):0};
}
function deviceDto(d,viewer){
 const lk=lockForViewer(d.deviceId,viewer);
 const online=!!(d.ws&&d.ws.readyState===WebSocket.OPEN);
 return {deviceId:d.deviceId,deviceName:d.deviceName,firmware:d.firmware,mode:d.mode,network:d.network,ssid:d.ssid,rssi:d.rssi,ip:d.ip,gateway:d.gateway,online,lastSeen:d.lastSeen,lastSeenText:d.lastSeen?new Date(d.lastSeen).toLocaleTimeString():'--',locked:lk.locked,lockMine:lk.mine,lockExpiresInMs:lk.expiresInMs};
}
function matchingDevices(info,query=''){
 query=safe(query,80).toLowerCase();
 return [...devices.values()]
  .filter(d=>sameNetwork(info,d))
  .filter(d=>(d.ws&&d.ws.readyState===WebSocket.OPEN)||(now()-(d.lastSeen||0)<OFFLINE_VISIBLE_MS))
  .filter(d=>!query||String(d.deviceId).toLowerCase().includes(query)||String(d.deviceName).toLowerCase().includes(query))
  .sort((a,b)=>{const ao=!!(a.ws&&a.ws.readyState===WebSocket.OPEN),bo=!!(b.ws&&b.ws.readyState===WebSocket.OPEN);if(ao!==bo)return bo-ao;return (b.lastSeen||0)-(a.lastSeen||0)})
  .map(d=>deviceDto(d,info));
}
function sendDeviceList(info,query=''){
 json(info.ws,{type:'device_list',query:safe(query,80),networkGroup:info.networkGroup,devices:matchingDevices(info,query),lockTimeoutMs:LOCK_TIMEOUT_MS});
}
function refreshNetwork(group){for(const b of browsers.values())if(b.networkGroup===group)sendDeviceList(b,b.lastQuery||'')}
function refreshDevice(deviceId){const d=devices.get(deviceId);if(d)refreshNetwork(d.networkGroup)}
function releaseLock(deviceId,clientId,reason='released'){
 const l=activeLock(deviceId);if(!l)return false;
 if(clientId&&l.clientId!==clientId)return false;
 locks.delete(deviceId);refreshDevice(deviceId);
 const d=devices.get(deviceId);if(d)for(const b of browsers.values())if(sameNetwork(b,d))json(b.ws,{type:'lock_released',deviceId,reason});
 return true;
}
function releaseLocksByClient(clientId,reason='client disconnected'){
 for(const [deviceId,l] of [...locks])if(l.clientId===clientId)releaseLock(deviceId,clientId,reason);
}

function browserHello(ws,m,req){
 const ip=clientIp(req);
 const info={ws,clientId:id(),clientType:'browser',ip,networkGroup:networkGroup(ip),lastQuery:''};
 browsers.set(ws,info);ws._zinfo=info;
 json(ws,{type:'hello_ack',ok:true,clientId:info.clientId,version:'18.2.0',remoteBenchRc:ALLOW_REMOTE_BENCH_RC,networkGroup:info.networkGroup,lockTimeoutMs:LOCK_TIMEOUT_MS});
 sendDeviceList(info,'');return true;
}
function deviceHello(ws,m,req){
 if(DEVICE_SHARED_TOKEN&&String(m.token||'')!==DEVICE_SHARED_TOKEN){json(ws,{type:'hello_ack',ok:false,error:'Invalid device token'});return false}
 const deviceId=safe(m.deviceId);if(!deviceId){json(ws,{type:'hello_ack',ok:false,error:'deviceId required'});return false}
 const ip=clientIp(req),old=devices.get(deviceId);
 if(old?.ws&&old.ws!==ws)try{old.ws.close(4001,'Replaced by new connection')}catch{}
 const d={...(old||{}),ws,clientType:'device',deviceId,deviceName:safe(m.deviceName)||deviceId,firmware:safe(m.firmware)||'unknown',mode:safe(m.mode)||'STA / INTERNET',network:safe(m.network||m.ssid),ssid:safe(m.ssid),rssi:Number.isFinite(+m.rssi)?+m.rssi:null,ip:safe(m.ip),gateway:safe(m.gateway),lastSeen:now(),sourceIp:ip,networkGroup:networkGroup(ip)};
 devices.set(deviceId,d);ws._zinfo=d;
 json(ws,{type:'hello_ack',ok:true,deviceId,version:'18.2.0',remoteBenchRc:ALLOW_REMOTE_BENCH_RC});
 refreshNetwork(d.networkGroup);return true;
}

function acquireLock(info,m){
 const deviceId=safe(m.deviceId),d=devices.get(deviceId);
 if(!d||!sameNetwork(info,d))return json(info.ws,{type:'lock_result',ok:false,deviceId,error:'Kit not found on this network'});
 if(!d.ws||d.ws.readyState!==WebSocket.OPEN)return json(info.ws,{type:'lock_result',ok:false,deviceId,error:'Kit is offline'});
 const existing=activeLock(deviceId);
 if(existing&&existing.clientId!==info.clientId){return json(info.ws,{type:'lock_result',ok:false,deviceId,locked:true,mine:false,error:'Kit is already controlled by another browser. View-only mode is active.'})}
 locks.set(deviceId,{clientId:info.clientId,lastSeen:now(),acquiredAt:existing?.acquiredAt||now()});
 json(info.ws,{type:'lock_result',ok:true,deviceId,locked:true,mine:true,message:'Control acquired'});refreshDevice(deviceId);
}
function heartbeatLock(info,m){
 const deviceId=safe(m.deviceId),l=activeLock(deviceId);
 if(l&&l.clientId===info.clientId){l.lastSeen=now();locks.set(deviceId,l);return json(info.ws,{type:'lock_heartbeat_ack',deviceId,ok:true})}
 json(info.ws,{type:'lock_heartbeat_ack',deviceId,ok:false});refreshDevice(deviceId);
}

function handleBrowser(info,m){
 switch(m.type){
  case 'list_devices':
  case 'search_devices': info.lastQuery=safe(m.query,80);return sendDeviceList(info,info.lastQuery);
  case 'acquire_lock': return acquireLock(info,m);
  case 'lock_heartbeat': return heartbeatLock(info,m);
  case 'release_lock': return void releaseLock(safe(m.deviceId),info.clientId,'released by user');
  case 'device_command':{
   const deviceId=safe(m.deviceId),d=devices.get(deviceId);
   if(!d||!sameNetwork(info,d))return json(info.ws,{type:'error',error:'Kit not found on this network'});
   if(!d.ws||d.ws.readyState!==WebSocket.OPEN)return json(info.ws,{type:'error',error:'Kit is offline'});
   const cmd=m.command||{},type=safe(cmd.type,80);
   if(type!=='ping'){
    const l=activeLock(deviceId);
    if(!l||l.clientId!==info.clientId)return json(info.ws,{type:'error',deviceId,error:'View only: another browser controls this kit. Take control when it becomes available.'});
    l.lastSeen=now();locks.set(deviceId,l);
   }
   if(type==='rc_frame'&&!ALLOW_REMOTE_BENCH_RC)return json(info.ws,{type:'error',deviceId,error:'Real hardware joystick is disabled. Use Simulator, or enable supervised prop-off bench RC on the server.'});
   json(d.ws,{type:'device_command',deviceId:d.deviceId,from:{clientId:info.clientId},command:cmd});return;
  }
 }
}
function handleDevice(d,m){
 d.lastSeen=now();
 if(m.type==='status'){
  if(m.deviceName)d.deviceName=safe(m.deviceName);
  if(m.firmware)d.firmware=safe(m.firmware);
  if(m.mode)d.mode=safe(m.mode);
  if(m.network!=null)d.network=safe(m.network);
  if(m.ssid!=null)d.ssid=safe(m.ssid);
  if(Number.isFinite(+m.rssi))d.rssi=+m.rssi;
  if(m.ip!=null)d.ip=safe(m.ip);
  if(m.gateway!=null)d.gateway=safe(m.gateway);
  refreshNetwork(d.networkGroup);
 }
 const packet=m.packet||m;
 for(const b of browsers.values())if(sameNetwork(b,d))json(b.ws,{type:'device_packet',deviceId:d.deviceId,packet});
}

wss.on('connection',(ws,req)=>{
 ws.isAlive=true;ws.on('pong',()=>ws.isAlive=true);
 ws.on('message',buf=>{
  let m;try{m=JSON.parse(String(buf))}catch{return json(ws,{type:'error',error:'Invalid JSON'})}
  const info=ws._zinfo;
  if(!info){if(m.type!=='hello')return json(ws,{type:'error',error:'hello required first'});return m.clientType==='device'?deviceHello(ws,m,req):browserHello(ws,m,req)}
  if(info.clientType==='browser')handleBrowser(info,m);else handleDevice(info,m);
 });
 ws.on('close',()=>{
  const info=ws._zinfo;if(!info)return;
  if(info.clientType==='browser'){browsers.delete(ws);releaseLocksByClient(info.clientId,'browser disconnected')}
  else{
   const d=devices.get(info.deviceId);
   if(d&&d.ws===ws){d.ws=null;d.lastSeen=now();releaseLock(d.deviceId,null,'kit offline');refreshNetwork(d.networkGroup)}
  }
 });
});

const wsHeartbeat=setInterval(()=>{for(const ws of wss.clients){if(ws.isAlive===false){ws.terminate();continue}ws.isAlive=false;try{ws.ping()}catch{}}},30000);
const lockSweep=setInterval(()=>{
 for(const [deviceId,l] of [...locks])if(now()-l.lastSeen>LOCK_TIMEOUT_MS){locks.delete(deviceId);refreshDevice(deviceId);const d=devices.get(deviceId);if(d)for(const b of browsers.values())if(sameNetwork(b,d))json(b.ws,{type:'lock_released',deviceId,reason:'control timeout'})}
},1000);
wss.on('close',()=>{clearInterval(wsHeartbeat);clearInterval(lockSweep)});

server.listen(PORT,()=>{
 console.log(`ZEBJUS F450 Easy Access V18.2 on http://0.0.0.0:${PORT}`);
 console.log(`Device token: ${DEVICE_SHARED_TOKEN?'configured':'OFF'}`);
 console.log(`Auto discovery: same source network`);
 console.log(`Single-controller lock: ${LOCK_TIMEOUT_MS} ms timeout`);
 console.log(`Remote bench RC: ${ALLOW_REMOTE_BENCH_RC?'ENABLED':'DISABLED (recommended)'}`);
});
