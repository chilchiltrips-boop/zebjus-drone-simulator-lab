(function(global){
'use strict';

const KNOWN_KEY='zebjus.drone.knownKits.v183';
const SESSION_KEY='zebjus.drone.controlSession.v183';

function normalizeKitName(value){
  let s=String(value||'').trim().toLowerCase();
  s=s.replace(/\s+/g,'-').replace(/_/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-');
  return s.replace(/^-+|-+$/g,'').slice(0,32);
}
function hostFromName(name){return normalizeKitName(name)}
function baseFromName(name){const h=hostFromName(name);return h?`http://${h}.local`:''}
function loadKnown(){try{const a=JSON.parse(localStorage.getItem(KNOWN_KEY)||'[]');return Array.isArray(a)?a.filter(x=>x&&x.name&&x.deviceId):[]}catch(_){return []}}
function saveKnown(list){try{localStorage.setItem(KNOWN_KEY,JSON.stringify(list.slice(0,40)))}catch(_){}}
function rememberKit(status,base){
  if(!status?.deviceId||!status?.name)return;
  const id=String(status.deviceId), now=Date.now();
  const old=loadKnown().filter(x=>String(x.deviceId)!==id && normalizeKitName(x.name)!==normalizeKitName(status.name));
  old.unshift({deviceId:id,name:status.name,ip:status.ip||'',base:base||baseFromName(status.name),ssid:status.ssid||'',lastSeen:now});
  saveKnown(old);
}
function sessionId(){
  try{let s=sessionStorage.getItem(SESSION_KEY);if(s)return s;s='WEB-'+Math.random().toString(36).slice(2,10)+'-'+Date.now().toString(36);sessionStorage.setItem(SESSION_KEY,s);return s}catch(_){return 'WEB-'+Math.random().toString(36).slice(2,12)}
}
function formBody(data){const p=new URLSearchParams();Object.entries(data||{}).forEach(([k,v])=>{if(v!==undefined&&v!==null)p.set(k,String(v))});return p.toString()}
let localAddressSpaceMode=null;
function emit(detail){try{global.dispatchEvent(new CustomEvent('zebjus-drone-diagnostic',{detail:{ts:new Date().toISOString(),...(detail||{})}}))}catch(_){}}
async function fetchLocal(url,options={},timeoutMs=2200){
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs),base={cache:'no-store',...options,signal:ctrl.signal};
  try{
    if(localAddressSpaceMode===true)return await fetch(url,{...base,targetAddressSpace:'local'});
    if(localAddressSpaceMode===false)return await fetch(url,base);
    try{const r=await fetch(url,{...base,targetAddressSpace:'local'});localAddressSpaceMode=true;return r}
    catch(first){if(first?.name==='AbortError')throw first;const r=await fetch(url,base);localAddressSpaceMode=false;return r}
  }catch(e){
    if(e?.name==='AbortError'||e?.name==='TimeoutError'||/aborted|abort/i.test(String(e?.message||''))){
      const err=new Error('Local kit request timed out.');err.code='LOCAL_TIMEOUT';err.timeout=true;throw err;
    }
    throw e;
  }finally{clearTimeout(timer)}
}
async function requestBase(base,path,{method='GET',data=null,timeout=2200,keepalive=false}={}){
  const started=performance.now(),headers={'Accept':'application/json'},opts={method,headers,keepalive};
  if(data!==null){headers['Content-Type']='application/x-www-form-urlencoded;charset=UTF-8';opts.body=formBody(data)}
  let res;try{res=await fetchLocal(base+path,opts,timeout)}catch(e){emit({kind:'http-fail',base,path,message:e?.message||String(e)});throw e}
  const text=await res.text();let payload={};try{payload=text?JSON.parse(text):{}}catch(_){payload={ok:res.ok,message:text}}
  if(!res.ok){const err=new Error(payload?.message||payload?.error||`Kit HTTP ${res.status}`);err.status=res.status;err.payload=payload;err.reachable=true;throw err}
  emit({kind:'http-ok',base,path,status:res.status,latencyMs:Math.round(performance.now()-started)});return payload||{};
}
function isDeviceId(value){return /^(?:ZJ-DRONE|ZFC)-[A-Z0-9-]+$/i.test(String(value||'').trim())}
function deviceIdentityParts(value){
  const s=String(value||'').trim().toUpperCase();
  let m=s.match(/^ZJ-DRONE-([A-Z0-9]{6,})$/);if(m)return{family:'LEGACY',suffix:m[1]};
  m=s.match(/^ZFC-([A-Z0-9]{6,})$/);if(m)return{family:'FLIGHTCORE',suffix:m[1]};
  return null;
}
function sameDeviceIdentity(a,b){
  const aa=String(a||'').trim().toUpperCase(),bb=String(b||'').trim().toUpperCase();
  if(!aa||!bb)return false;if(aa===bb)return true;
  const pa=deviceIdentityParts(aa),pb=deviceIdentityParts(bb);if(!pa||!pb)return false;
  if(pa.suffix===pb.suffix)return true;
  // Migration compatibility: old firmware exposed only the last 24 MAC bits.
  // New firmware uses the complete 48-bit MAC to avoid collisions.
  const shorter=pa.suffix.length<=pb.suffix.length?pa.suffix:pb.suffix,longer=pa.suffix.length<=pb.suffix.length?pb.suffix:pa.suffix;
  return shorter.length===6&&longer.length>=12&&longer.endsWith(shorter);
}
function isCompatibleKit(status){
  if(!status||status.ok===false||!status.deviceId||!status.name)return false;
  const kit=String(status.kit||'').trim().toUpperCase();
  const boardId=String(status.boardId||'').trim().toUpperCase();
  if(['ZEBJUS_F450','ZEBJUS_FLIGHTCORE','ZEBJUS_FLIGHTCORE_BOOTSTRAP'].includes(kit))return true;
  return kit.startsWith('ZEBJUS_FLIGHTCORE_')&&/^ZFC-[A-Z0-9-]+$/.test(boardId);
}

function clearKnownAddress(identity=''){
  const key=String(identity||'').trim().toLowerCase();if(!key)return;
  const list=loadKnown().map(x=>{
    const match=String(x.deviceId||'').toLowerCase()===key||normalizeKitName(x.name)===normalizeKitName(identity);
    return match?{...x,ip:'',base:baseFromName(x.name)}:x;
  });
  saveKnown(list);
}
function candidateKnown(query){
  const q=String(query||'').trim().toLowerCase();
  if(!q)return null;
  return loadKnown().find(x=>String(x.deviceId).toLowerCase()===q||normalizeKitName(x.name)===normalizeKitName(q))||null;
}
async function connect(query,ipHint='',expectedDeviceId='',clientId=''){
  query=String(query||'').trim();
  const known=candidateKnown(query)||candidateKnown(expectedDeviceId);
  const expected=String(expectedDeviceId||(isDeviceId(query)?query:'')||known?.deviceId||'');
  const name=isDeviceId(query)?(known?.name||''):query;
  const bases=[];
  if(ipHint&&/^\d{1,3}(?:\.\d{1,3}){3}$/.test(ipHint))bases.push(`http://${ipHint}`);
  if(known?.ip)bases.push(`http://${known.ip}`);
  if(known?.base)bases.push(known.base);
  if(name)bases.push(baseFromName(name));
  if(!bases.length)throw new Error('For a new browser, enter the Kit Name once. Device ID lookup works after the kit has been seen on this browser.');
  let last=null;
  for(const base of [...new Set(bases.filter(Boolean))]){
    try{
      const qs=clientId?`?clientId=${encodeURIComponent(clientId)}`:'';
      const st=await requestBase(base,'/api/status'+qs,{timeout:2100});
      if(!isCompatibleKit(st))throw new Error('This device is not a compatible ZEBJUS FlightCore controller.');
      if(expected&&!sameDeviceIdentity(st.deviceId,expected))throw new Error('Device ID mismatch: this address belongs to another kit.');
      if(expected&&String(st.deviceId).toUpperCase()!==String(expected).toUpperCase())emit({kind:'identity-migrated',from:expected,to:st.deviceId,name:st.name});
      if(name&&!expected&&normalizeKitName(st.name)!==normalizeKitName(name))throw new Error('Kit Name mismatch: this address belongs to another kit.');
      rememberKit(st,base);return {status:st,base};
    }catch(e){last=e}
  }
  throw new Error(last?.name==='AbortError'?'Kit connection timed out. Confirm the kit is powered and this computer is on the same Wi-Fi.':(last instanceof TypeError?'Kit not reachable. Allow Local Network Access for this site in Chrome/Edge, confirm both devices are on the same Wi-Fi, then Rescan.':(last?.message||'Kit not found on this Wi-Fi.')));
}
async function scanDefaultKits({max=30,extraNames=[],onProgress=null}={}){
  max=Math.max(1,Math.min(80,Number(max)||30));
  const candidates=[];
  for(let i=1;i<=max;i++)candidates.push(`zebjus_drone_${i}`);
  loadKnown().forEach(k=>candidates.push(k.name));
  extraNames.forEach(n=>candidates.push(n));
  const names=[...new Set(candidates.map(n=>String(n||'').trim()).filter(Boolean))],found=[];
  let cursor=0,done=0;
  async function worker(){
    while(cursor<names.length){
      const name=names[cursor++];
      try{const r=await connect(name);if(!found.some(x=>x.status.deviceId===r.status.deviceId))found.push(r)}catch(_){}
      done++;if(onProgress)onProgress(done,names.length,found.length);
    }
  }
  await Promise.all(Array.from({length:Math.min(8,names.length)},worker));
  return found.sort((a,b)=>String(a.status.name).localeCompare(String(b.status.name),undefined,{numeric:true}));
}

class LocalKitClient{
  constructor(){this.base='';this.status=null;this.name='';this.deviceId='';this.ipHint='';this.clientId=sessionId();this._reconnectPromise=null;this._lastGoodAt=0}
  get connected(){return !!this.base&&!!this.status}
  get lastGoodAgeMs(){return this._lastGoodAt?Date.now()-this._lastGoodAt:Infinity}
  _accept(st,base){this.base=base;this.status=st;this.name=st?.name||this.name;this.deviceId=st?.deviceId||this.deviceId;this.ipHint=st?.ip||this.ipHint;this._lastGoodAt=Date.now();rememberKit(st,base);return st}
  async connect(query='',ipHint='',expectedDeviceId=''){const explicit=String(query||'').trim(),q=explicit||this.name||this.deviceId,expected=expectedDeviceId||(explicit?'':this.deviceId),r=await connect(q,ipHint||this.ipHint,expected,this.clientId);return this._accept(r.status,r.base)}
  disconnect({forgetIdentity=false}={}){this.base='';this.status=null;this._lastGoodAt=0;if(forgetIdentity){this.name='';this.deviceId='';this.ipHint=''}}
  async refresh(timeout=2100){if(!this.base)throw new Error('Kit not connected.');const st=await requestBase(this.base,`/api/status?clientId=${encodeURIComponent(this.clientId)}`,{timeout});if(this.deviceId&&!sameDeviceIdentity(st.deviceId,this.deviceId))throw new Error('Connected device identity changed.');return this._accept(st,this.base)}
  async reconnect(retries=4){if(this._reconnectPromise)return this._reconnectPromise;this._reconnectPromise=(async()=>{let last;const waits=[0,350,800,1500,2500];for(let i=0;i<Math.max(1,retries);i++){if(waits[i])await new Promise(r=>setTimeout(r,waits[i]));try{return await this.connect(this.name||this.deviceId,this.ipHint,this.deviceId)}catch(e){last=e}}throw last||new Error('Kit reconnect failed.')})();try{return await this._reconnectPromise}finally{this._reconnectPromise=null}}
  async telemetry(){return requestBase(this.base,'/api/telemetry',{timeout:1400})}
  async i2cScan(){if(!this.base)throw new Error('Kit not connected.');return requestBase(this.base,'/api/i2c/scan',{timeout:6500})}
  async imuRead(){if(!this.base)throw new Error('Kit not connected.');return requestBase(this.base,'/api/imu',{timeout:2200})}
  async acquire(){const r=await requestBase(this.base,'/api/control/acquire',{method:'POST',data:{clientId:this.clientId},timeout:1800});await this.refresh();return r}
  async heartbeat(){return requestBase(this.base,'/api/control/ping',{method:'POST',data:{clientId:this.clientId},timeout:1500})}
  async release({keepalive=false}={}){if(!this.base)return{ok:true};try{return await requestBase(this.base,'/api/control/release',{method:'POST',data:{clientId:this.clientId},timeout:1200,keepalive})}finally{if(this.status)this.status.lockMine=false}}
  async command(command){if(!this.base)throw new Error('Kit not connected.');const c=command||{},data={clientId:this.clientId,type:String(c.type||'')};Object.entries(c).forEach(([k,v])=>{if(k==='type')return;data[k]=Array.isArray(v)?v.join(','):(typeof v==='object'&&v!==null?JSON.stringify(v):v)});return requestBase(this.base,'/api/command',{method:'POST',data,timeout:2200})}
  async rename(name){const r=await requestBase(this.base,'/api/name',{method:'POST',data:{clientId:this.clientId,name},timeout:3200});if(r?.status){const ip=r.status.ip||this.ipHint,base=ip?`http://${ip}`:this.base;return this._accept(r.status,base)}return this.refresh()}
  async resetName(){return requestBase(this.base,'/api/name/reset',{method:'POST',data:{clientId:this.clientId},timeout:4200})}
  async scanWifi(){return requestBase(this.base,'/api/wifi/scan',{timeout:9000})}
  async savedWifi(){return requestBase(this.base,'/api/wifi/saved',{timeout:2200})}
  async setWifi(ssid,password){return requestBase(this.base,'/api/wifi/set',{method:'POST',data:{clientId:this.clientId,ssid,password},timeout:2600})}
  async useWifi(ssid){return requestBase(this.base,'/api/wifi/use',{method:'POST',data:{clientId:this.clientId,ssid},timeout:2200})}
  async forgetWifi(ssid){return requestBase(this.base,'/api/wifi/forget',{method:'POST',data:{clientId:this.clientId,ssid},timeout:2200})}
  async resetWifi(){return requestBase(this.base,'/api/wifi/reset',{method:'POST',data:{clientId:this.clientId},timeout:2200})}
  async firmwareInfo(){return requestBase(this.base,'/api/firmware/info',{timeout:2200})}
  async reboot(){return requestBase(this.base,'/api/reboot',{method:'POST',data:{clientId:this.clientId},timeout:2200})}
}

global.ZebjusDroneKit={normalizeKitName,hostFromName,baseFromName,loadKnown,rememberKit,clearKnownAddress,isDeviceId,sameDeviceIdentity,isCompatibleKit,connect,scanDefaultKits,LocalKitClient};
})(window);
