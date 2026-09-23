(function(){
'use strict';
window.__zebjusSchoolParsed=true;
window.__zebjusSchoolReady=false;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_CH=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];
const FAILURE_LIMIT=3;
const HEALTH_INTERVAL_MS=2000, OFFLINE_AFTER_MS=8000, RECONNECT_INTERVAL_MS=2500, STREAM_OK_MS=900, STREAM_DELAY_MS=2200, SENSOR_STALE_MS=2200;

const client=window.ZebjusDroneKit?new window.ZebjusDroneKit.LocalKitClient():null;
const st={devices:[],selectedDeviceId:'',query:'',preferredDeviceId:'',preferredDeviceName:'',autoAcquire:false,demoMode:false,joy:[...DEFAULT_CH],joySeq:0,lastJoySent:0,booted:false,lastDiscoverAt:0,lastHealthAt:0,lastTelemetryAt:0,lastTelemetryGoodAt:0,lastLockBeat:0,failures:0,reconnectBusy:false,healthBusy:false,telemetryBusy:false,lastReconnectAt:0,lastError:'',remoteBenchRc:false,txOn:false,joyKeys:new Set(),joyPointerActive:0,lastJoyInputAt:Date.now(),watchdogMs:1500,watchdogWarnArmed:true,watchdogLatched:false,lastCommandSentAt:0,lastCommandAckAt:0,lastCommandErrorAt:0,receiverLastAt:0,receiverChannels:null,receiverHealth:'NOT_FOUND',sensorHealth:{imu:'NOT_FOUND',barometer:'NOT_FOUND',lidar:'NOT_FOUND',receiver:'NOT_FOUND'},manualDisconnect:false};

function api(){return window.zebjusLabAPI||null}
function ready(){return !!client}
function selected(){return st.devices.find(d=>d.deviceId===st.selectedDeviceId)||null}
function ownsLock(){const d=selected();return !!(d&&d.online&&d.lockMine)}
function isViewOnly(){const d=selected();return !!(d&&d.online&&!d.lockMine)}
function canControl(){return !!(client?.connected&&ownsLock())}
function log(t){const e=$('#schoolLog');if(e)e.textContent=`${new Date().toLocaleTimeString()} ${t}\n${e.textContent}`.slice(0,9000)}
function signalText(rssi){rssi=+rssi;if(!Number.isFinite(rssi))return 'Unknown';if(rssi>=-55)return 'Excellent';if(rssi>=-67)return 'Good';if(rssi>=-75)return 'Weak';return 'Very weak'}
function setText(id,v){const e=$('#'+id);if(e)e.textContent=v}
function savePrefs(){try{localStorage.setItem('zebjusV183KitQuery',st.query||'');localStorage.setItem('zebjusV183Demo',st.demoMode?'1':'0');localStorage.setItem('zebjusV183WatchdogMs',String(st.watchdogMs));localStorage.setItem('zebjusV183WatchdogWarn',st.watchdogWarnArmed?'1':'0');if(st.selectedDeviceId)localStorage.setItem('zebjusV183LastKit',st.selectedDeviceId)}catch{}}
function loadPrefs(){
 st.query=localStorage.getItem('zebjusV183KitQuery')||'';st.demoMode=localStorage.getItem('zebjusV183Demo')==='1';st.watchdogMs=clamp(+(localStorage.getItem('zebjusV183WatchdogMs')||1500),500,10000);st.watchdogWarnArmed=localStorage.getItem('zebjusV183WatchdogWarn')!=='0';
 const p=new URLSearchParams(location.search),urlId=(p.get('kitId')||p.get('kit')||'').trim(),urlName=(p.get('kitName')||'').trim();
 st.preferredDeviceId=urlId||localStorage.getItem('zebjusV183LastKit')||'';st.preferredDeviceName=urlName;st.autoAcquire=p.get('autoconnect')==='1';
 if(urlName)st.query=urlName;else if(urlId)st.query=urlId;
 if(urlName||urlId)log(`Setup handoff received: ${urlName||urlId}. Connecting on local Wi-Fi…`);
}
function simpleError(msg){st.lastError=msg;log('ERROR: '+msg);const e=$('#simpleErrorStatus');if(e){e.textContent=msg;e.hidden=false}}
function clearError(){st.lastError='';const e=$('#simpleErrorStatus');if(e){e.textContent='';e.hidden=true}}
function upsertStatus(s,base=''){
 if(!s?.deviceId)return null;const i=st.devices.findIndex(x=>x.deviceId===s.deviceId),prev=i>=0?st.devices[i]:null,d={...(prev||{}),...s,deviceName:s.name||s.deviceName||s.deviceId,online:true,lastSeen:Date.now(),lastSeenText:'Now',base:base||s.base||''};if(prev?.lockMine&&client?.deviceId===s.deviceId&&client?.status?.lockMine)d.lockMine=true;if(s.receiverHealth){st.receiverHealth=normalizeHealth(s.receiverHealth);st.sensorHealth.receiver=st.receiverHealth;}
 if(i>=0)st.devices[i]=d;else st.devices.push(d);st.devices.sort((a,b)=>String(a.deviceName).localeCompare(String(b.deviceName),undefined,{numeric:true}));return d;
}
function markSelectedOffline(reason='Connection lost'){
 const d=selected();if(!d)return;
 d.online=false;d.lockMine=false;d.lastSeenText=reason;st.remoteBenchRc=false;st.receiverHealth='STALE';st.sensorHealth={imu:'STALE',barometer:'STALE',lidar:'STALE',receiver:'STALE'};
 try{api()?.setFcConnected(false)}catch{}
 client?.disconnect();
 statusUi();
}
function refreshLastSeenText(){
 const d=selected();if(!d||!d.lastSeen)return;
 if(!d.online)return;
 const age=Math.max(0,Date.now()-d.lastSeen);
 d.lastSeenText=age<1500?'Now':age<60000?`${Math.floor(age/1000)}s ago`:`${Math.floor(age/60000)}m ago`;
 const e=$('#selectedDeviceLastSeen');if(e)e.textContent=d.lastSeenText;
}
function serviceStatus(){
 const e=$('#simpleServiceStatus');if(e){e.textContent=ready()?'LOCAL READY':'UNAVAILABLE';e.className=ready()?'good':''}
 const d=selected(),k=$('#simpleKitStatus');if(k){k.textContent=d?(d.online?'ONLINE':'OFFLINE'):'NOT SELECTED';k.className=d?.online?'good':''}
 const c=$('#simpleControlStatus');if(c){c.textContent=!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';c.className=d?.lockMine?'good':d?.locked?'warn':''}
 const n=$('#simpleNetworkStatus');if(n)n.textContent=d?(d.ssid||'Same Wi-Fi'):'--';
}
function updateTopKitStatus(){
 const el=$('#topKitStatus'),d=selected();if(!el)return;
 if(d?.online){const mode=d.lockMine?'CONTROL':d.locked?'VIEW ONLY':'CONNECTED';el.className='top-kit-status online';el.innerHTML=`<i></i><span><b>KIT CONNECTED</b><em>${esc(d.deviceName||d.deviceId)} • ${mode}</em></span>`;}
 else{el.className='top-kit-status offline';el.innerHTML='<i></i><span><b>KIT OFFLINE</b><em>Simulation ready</em></span>';}
}
function targetUi(){
 const devOpt=$('#webJoyTarget option[value="device"]');if(devOpt){devOpt.disabled=!(st.remoteBenchRc&&ownsLock());devOpt.textContent=st.remoteBenchRc?(ownsLock()?'REAL KIT • PROP-OFF BENCH':'REAL KIT • TAKE CONTROL FIRST'):'REAL KIT • BENCH DISABLED'}
 const target=$('#webJoyTarget')?.value||'sim',tb=$('#joyTargetBadge');if(tb){tb.textContent=target==='sim'?'SIMULATOR':'REAL HARDWARE';tb.className='target-mode-badge '+(target==='sim'?'sim':'real')}
 const tn=$('#joyTargetNote');if(tn)tn.textContent=!st.txOn?'Transmitter is OFF. Outputs are held safe.':target==='sim'?'Simulator transmitter active. No real kit commands are sent.':ownsLock()?'Real-kit bench transmitter active. Propellers must be removed.':'Real kit is view-only until you take control.';
 setText('joyTargetSummary',target==='sim'?'SIMULATOR':'REAL KIT');
 const link=$('#webTxLedLink'),linkText=$('#webTxLinkText');if(link){const on=target==='sim'||(client?.connected&&selected()?.online);link.className='tx-led '+(on?'on':'warn')}if(linkText)linkText.textContent=target==='sim'?'SIM':(selected()?.online?'KIT':'OFFLINE');
}
function normalizeHealth(v,fallback='NOT_FOUND'){
 const x=String(v??fallback).trim().toUpperCase().replace(/\s+/g,'_');if(['OK','STALE','NOT_FOUND'].includes(x))return x;return fallback;
}
function setHealthUi(id,status,note=''){
 status=normalizeHealth(status);const b=$('#health'+id),dot=$('#health'+id+'Dot');if(!b||!dot)return;const cls=status==='OK'?'ok':status==='STALE'?'stale':'not-found';b.textContent=status.replace('_',' ');b.className=cls;dot.className='health-dot '+(status==='OK'?'ok':status==='STALE'?'stale':'lost');if(note){const n=$('#health'+id+'Age');if(n)n.textContent=note}
}
function updateHealthUi(){
 const d=selected(),now=Date.now(),streamAt=Math.max(st.lastCommandAckAt||0,st.lastTelemetryGoodAt||0),age=streamAt?now-streamAt:Infinity;let cmd='LOST',cls='lost';
 if(d?.online){if(age<=STREAM_OK_MS){cmd='COMMAND OK';cls='ok'}else if(age<=STREAM_DELAY_MS){cmd='DELAY';cls='delay'}}
 const ageText=!d?.online?'Kit offline':!Number.isFinite(age)?'Waiting for stream':age<1000?`${Math.round(age)} ms ago`:`${(age/1000).toFixed(1)} s ago`;const cb=$('#healthCommand'),cd=$('#healthCommandDot'),ca=$('#healthCommandAge');if(cb){cb.textContent=cmd;cb.className=cls}if(cd)cd.className='health-dot '+cls;if(ca)ca.textContent=ageText;const jcb=$('#joyCommandState'),jcd=$('#joyCommandDot'),jca=$('#joyCommandAge');if(jcb){jcb.textContent=cmd;jcb.className=cls}if(jcd)jcd.className='health-dot '+cls;if(jca)jca.textContent=ageText;
 const stale=!d?.online||(st.lastTelemetryGoodAt&&now-st.lastTelemetryGoodAt>SENSOR_STALE_MS);['Imu','Barometer','Lidar','Receiver'].forEach(k=>{let v=st.sensorHealth[k.toLowerCase()]||'NOT_FOUND';if(stale&&v==='OK')v='STALE';setHealthUi(k,v,k==='Receiver'?(st.receiverLastAt?`${Math.max(0,now-st.receiverLastAt)} ms since RC frame`:'PPM / RC input'):'')});
 const rxDot=$('#simRxMirrorLed'),rxBadge=$('#simRxMirrorBadge'),rxText=$('#simRxMirrorText'),rxOk=st.sensorHealth.receiver==='OK'&&now-st.receiverLastAt<900;if(rxDot)rxDot.className='health-dot '+(rxOk?'ok':st.receiverHealth==='STALE'?'stale':'lost');if(rxBadge)rxBadge.textContent=rxOk?'REAL RX • LIVE':st.receiverHealth==='STALE'?'REAL RX • STALE':'REAL RX WAITING';if(rxText)rxText.textContent=rxOk?'Physical transmitter is mirrored into the tripod sticks.':st.receiverHealth==='STALE'?'Receiver frames stopped; simulator directional commands were centered.':'Connect / bind the PPM receiver to mirror the physical transmitter.';
}
function healthFromTelemetry(t){
 const h=t?.sensorHealth||{};st.sensorHealth.imu=normalizeHealth(t?.imuHealth??h.imu??st.sensorHealth.imu);st.sensorHealth.barometer=normalizeHealth(t?.barometerHealth??t?.baroHealth??h.barometer??h.baro??st.sensorHealth.barometer);st.sensorHealth.lidar=normalizeHealth(t?.lidarHealth??h.lidar??st.sensorHealth.lidar);st.sensorHealth.receiver=normalizeHealth(t?.receiverHealth??h.receiver??st.sensorHealth.receiver);st.receiverHealth=st.sensorHealth.receiver;
}
function receiverModeFromChannels(c){return c[5]>=1900?'altitude':c[5]>=1400?'rate':'angle'}
function applyPhysicalReceiver(t){
 const c=Array.isArray(t?.rc)?t.rc:Array.isArray(t?.channels)?t.channels:null;if(!c||c.length<4)return;const rc=c.slice(0,10).map((v,i)=>clamp(Math.round(+v||DEFAULT_CH[i]),1000,2000));while(rc.length<10)rc.push(DEFAULT_CH[rc.length]);st.receiverChannels=rc;st.receiverLastAt=Date.now();st.sensorHealth.receiver='OK';st.receiverHealth='OK';api()?.controlSim?.({roll:(rc[0]-1500)/500,pitch:(rc[1]-1500)/500,throttle:rc[2],yaw:(rc[3]-1500)/500});api()?.setSimFlightMode?.(receiverModeFromChannels(rc));api()?.setSimRunning?.(rc[4]>1500);if(!st.txOn){st.joy=[...rc];renderJoy()}
}
function statusUi(){
 const b=$('#schoolCloudBadge');if(b){b.textContent=ready()?'LOCAL LINK':'UNAVAILABLE';b.className='status '+(ready()?'good':'')}
 const q=$('#kitSearchInput');if(q&&document.activeElement!==q)q.value=st.query;
 const ng=$('#networkGroupBadge');if(ng)ng.textContent='Same Wi-Fi • mDNS';
 const wr=$('#webJoyRoleBadge');if(wr){wr.textContent='OPEN ACCESS';wr.className='status good'}
 const ss=$('#shareStateBadge');if(ss){const d=selected();ss.textContent=d?.lockMine?'CONTROL':d?.online?'VIEW ONLY':ready()?'READY':'OFFLINE';ss.className='status '+(d?.lockMine?'good':'')}
 renderModules();renderSelected();serviceStatus();targetUi();updateTopKitStatus();updateHealthUi();
}
function renderModules(){
 const box=$('#moduleList'),list=st.query?st.devices.filter(d=>String(d.deviceName||'').toLowerCase().includes(st.query.toLowerCase())||String(d.deviceId||'').toLowerCase().includes(st.query.toLowerCase())):st.devices;
 const count=$('#moduleCountBadge');if(count)count.textContent=`${list.length} kit${list.length===1?'':'s'}`;if(!box)return;
 if(!ready()){box.innerHTML='<div class="empty-module">Local kit connector did not load.</div>';return}
 if(!list.length){box.innerHTML='<div class="empty-module">Scanning zebjus_drone_1, zebjus_drone_2… on this Wi-Fi. Found kits appear here automatically.</div>';return}
 box.innerHTML=list.map(d=>{const sel=d.deviceId===st.selectedDeviceId,ctl=d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';return `<button class="module-card ${sel?'selected':''}" data-device="${esc(d.deviceId)}"><span class="module-online-dot ${d.online?'on':''}"></span><div><b>${esc(d.deviceName||d.deviceId)}</b><small>${esc(d.deviceId)}</small><em>${esc(d.ssid||'Same Wi-Fi')} • ${Number.isFinite(+d.rssi)?d.rssi+' dBm / '+signalText(d.rssi):'RSSI --'}</em></div><i class="${d.lockMine?'mine':d.locked?'busy':''}">${d.online?ctl:'OFFLINE'}</i></button>`}).join('');
 $$('.module-card').forEach(b=>b.onclick=()=>selectDevice(b.dataset.device));
}
function renderSelected(){
 const d=selected();setText('selectedDeviceName',d?.deviceName||'No kit selected');setText('selectedDeviceId',d?.deviceId||'--');setText('selectedDeviceSchool','Open access');setText('selectedDeviceMode',d?.mode||'--');setText('selectedDeviceNetwork',d?.ssid||'--');setText('selectedDeviceRssi',Number.isFinite(+d?.rssi)?`${d.rssi} dBm • ${signalText(d.rssi)}`:'--');setText('selectedDeviceFirmware',d?.firmware||d?.version||'--');setText('selectedDeviceLastSeen',d?.lastSeenText||'--');setText('selectedDeviceLock',!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY • IN USE':'AVAILABLE');
 setText('selectedDeviceIp',d?.ip||'--');setText('apModeIndicator',d?(String(d.mode||'').toUpperCase().includes('AP')?'ACTIVE':'OFF'):'--');setText('staModeIndicator',d?(String(d.mode||'').toUpperCase().includes('STA')?'ACTIVE':'OFF'):'--');setText('pythonI2cPins',d?.online&&Number.isFinite(+d.i2cSda)&&Number.isFinite(+d.i2cScl)?`I²C: SDA GPIO${d.i2cSda} • SCL GPIO${d.i2cScl}`:'I²C pins: from connected board');
 const online=$('#selectedDeviceOnline');if(online){online.textContent=d?.online?'Online':'Offline';online.className='status '+(d?.online?'good':'')}
 const rename=$('#deviceRenameInput');if(rename&&d&&!rename.matches(':focus'))rename.value=d.deviceName||'';
 const ping=$('#pingSelectedDeviceBtn');if(ping)ping.disabled=!(d&&d.online);const renameBtn=$('#renameDeviceBtn');if(renameBtn)renameBtn.disabled=!canControl();
 const take=$('#takeControlBtn');if(take){take.disabled=!(d&&d.online&&!d.lockMine&&!d.locked);take.hidden=!!d?.lockMine;take.textContent=d?.locked?'Kit In Use • View Only':'Take Control'}
 const rel=$('#releaseControlBtn');if(rel){rel.hidden=!d?.lockMine;rel.disabled=!d?.lockMine}
 const jm=$('#joySelectedModule');if(jm)jm.textContent=d?.deviceName||'None';const jl=$('#joyLock');if(jl)jl.textContent=!d?'--':d.lockMine?'CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';
 const jt=$('#webJoyTarget');if(jt&&jt.value==='device'&&!d?.lockMine){jt.value='sim';st.joy[4]=1000;centerJoy()}
 try{api()?.setFcConnected(!!(d&&d.online))}catch(e){log('UI bridge: '+e.message)}const note=$('#selectedControlNote');if(note)note.textContent=!d?'Select a discovered kit or enter its Kit Name.':d.lockMine?'This browser controls the real kit. Other browsers are view-only until your heartbeat stops.':d.locked?'Another browser controls this kit. Telemetry and simulator remain available.':'Kit is available. Take Control for real-hardware changes.';const badge=$('#kitConnBadge');if(badge){badge.textContent=d?.online?'Connected':'Not connected';badge.className='status '+(d?.online?'good':'')}const info=$('#kitInfo');if(info)info.innerHTML=d?.online?`<b>${esc(d.deviceName)} • VERIFIED</b><span>${esc(d.deviceId)} • ${esc(d.boardName||'ZEBJUS FlightCore')} • ${esc(d.ip||'local')} • ${esc(d.ssid||'Wi-Fi')} • ${Number.isFinite(+d.rssi)?d.rssi+' dBm / '+signalText(d.rssi):'RSSI --'}</span>`:'<b>Automatic connection order</b><span>Cached IP → Device ID verification → kit-name.local → Device ID verification.</span>';const ip=$('#kitCachedIp');if(ip&&d?.ip&&!ip.matches(':focus'))ip.value=d.ip;serviceStatus();targetUi();
}
async function connectExact(query,autoAcquire=true){
 st.manualDisconnect=false;query=String(query||'').trim();if(!query)throw new Error('Enter a Kit Name such as zebjus_drone_1, or press Scan Default Kits.');
 clearError();log('Looking for '+query+' on the same Wi-Fi…');
 const samePreferredName=st.preferredDeviceName&&window.ZebjusDroneKit.normalizeKitName(st.preferredDeviceName)===window.ZebjusDroneKit.normalizeKitName(query);const expected=window.ZebjusDroneKit.isDeviceId?.(query)?query:(samePreferredName?st.preferredDeviceId:'');
 const status=await client.connect(query,'',expected);const d=upsertStatus(status,client.base);st.selectedDeviceId=d.deviceId;st.preferredDeviceId=d.deviceId;st.preferredDeviceName=d.deviceName;st.query=d.deviceName;st.remoteBenchRc=!!status.benchRc;st.failures=0;savePrefs();log(`Connected locally: ${d.deviceName} • ${d.deviceId} • ${status.ip||''}`);statusUi();if(autoAcquire)await acquireLock(true);return d;
}
async function searchModules(){st.manualDisconnect=false;const q=$('#kitSearchInput')?.value.trim()||st.query,ip=$('#kitCachedIp')?.value.trim()||'';st.query=q;savePrefs();if(!q)return scanKitsUi();try{clearError();const known=window.ZebjusDroneKit.loadKnown().find(k=>window.ZebjusDroneKit.normalizeKitName(k.name)===window.ZebjusDroneKit.normalizeKitName(q));const status=await client.connect(q,ip,known?.deviceId||'');const d=upsertStatus(status,client.base);st.selectedDeviceId=d.deviceId;st.query=d.deviceName;savePrefs();statusUi();await acquireLock(true);await refreshSavedWifi()}catch(e){simpleError(e.message)}}
async function requestModules(force=false){
 if(!ready()||st.reconnectBusy)return;if(!force&&client?.connected&&selected()?.online)return;const now=performance.now();if(!force&&now-st.lastDiscoverAt<15000)return;st.lastDiscoverAt=now;
 const extras=[st.preferredDeviceName,st.query].filter(x=>x&&!/^ZJ-DRONE-/i.test(x));
 try{const found=await window.ZebjusDroneKit.scanDefaultKits({max:30,extraNames:extras});found.forEach(r=>upsertStatus(r.status,r.base));reconcileSelection();clearError();try{statusUi()}catch(e){console.warn('[ZEBJUS] discovery UI update skipped',e)}}catch(e){console.warn('[ZEBJUS] Background discovery',e)}
}
function reconcileSelection(){if(st.selectedDeviceId&&!selected())st.selectedDeviceId='';if(st.manualDisconnect){st.selectedDeviceId='';savePrefs();return}if(!st.selectedDeviceId){let d=null;if(st.preferredDeviceId)d=st.devices.find(x=>x.deviceId===st.preferredDeviceId)||null;if(!d&&st.preferredDeviceName)d=st.devices.find(x=>String(x.deviceName).toLowerCase()===st.preferredDeviceName.toLowerCase())||null;if(!d&&st.devices.length===1)d=st.devices[0];if(d)st.selectedDeviceId=d.deviceId}savePrefs()}
async function selectDevice(id){st.manualDisconnect=false;const d=st.devices.find(x=>x.deviceId===id);if(!d)return;try{if(ownsLock())await releaseLock(false);const s=await client.connect(d.deviceName,d.ip,d.deviceId);upsertStatus(s,client.base);st.selectedDeviceId=id;st.query=d.deviceName;savePrefs();await acquireLock(true);statusUi()}catch(e){simpleError(e.message)}}
async function acquireLock(auto=false){const d=selected();if(!d?.online||!client?.connected)return false;if(d.lockMine)return true;if(auto&&d.locked)return false;try{const r=await client.acquire();const s=await client.refresh();upsertStatus(s,client.base);if(r.ok)log('Control acquired for '+(s.name||d.deviceName));clearError();statusUi();return !!r.ok}catch(e){log(e.message||'Kit is in use. View-only mode active.');try{upsertStatus(await client.refresh(),client.base)}catch{}statusUi();return false}}
async function releaseLock(clearSelection=false){try{if(client?.connected&&ownsLock())await client.release()}catch{}if(selected())selected().lockMine=false;if(clearSelection)st.selectedDeviceId='';statusUi()}
async function renameDevice(){const d=selected(),name=$('#deviceRenameInput')?.value.trim();if(!d||!name)return log('Select a kit and enter a name.');if(!canControl())return log('VIEW ONLY • Take Control first.');try{const s=await client.rename(name);upsertStatus(s,client.base);st.query=s.name;st.preferredDeviceName=s.name;savePrefs();log('Kit renamed: '+s.name);statusUi()}catch(e){simpleError(e.message)}}
async function i2cScan(){
 const d=selected();if(!d?.online||!client?.connected)throw new Error('Connect a ZEBJUS kit first.');
 log(`I2C scan requested • SDA GPIO${d.i2cSda??4} / SCL GPIO${d.i2cScl??5}`);
 try{const r=await client.i2cScan();log(`I2C scan complete • ${Number(r?.count||0)} device(s) • ${Number(r?.durationMs||0)} ms`);return r}
 catch(e){if(e?.status===404)throw new Error('I2C scan API is not installed on this kit yet. Update FlightCore firmware to V18.3.27 first.');throw e}
}
async function imuRead(){
 const d=selected();if(!d?.online||!client?.connected)throw new Error('Connect a ZEBJUS kit first.');
 try{return await client.imuRead()}catch(e){if(e?.status===404)throw new Error('LSM6DS3 was not found. Check I2C wiring and confirm address 0x6B/0x6A.');if(e?.status===409)throw new Error(e.message||'Connected I2C device is not an LSM6DS3.');throw e}
}
function sendDeviceCommand(command){
 const d=selected();if(!d?.online||!client?.connected)return false;if(command?.type!=='ping'&&!d.lockMine){log('VIEW ONLY • Take Control before changing the real kit.');return false}
 const type=String(command?.type||''),sent=Date.now();st.lastCommandSentAt=sent;updateHealthUi();client.command(command).then(r=>{st.lastCommandAckAt=Date.now();if(r?.packet)api()?.receiveDevicePacket(r.packet);else if(r)api()?.receiveDevicePacket(r);if(r?.message)log(r.message);window.dispatchEvent(new CustomEvent('zebjus-device-command-result',{detail:{ok:true,type,response:r,sentAt:sent,ackAt:st.lastCommandAckAt}}));updateHealthUi()}).catch(e=>{st.lastCommandErrorAt=Date.now();simpleError(e.message);window.dispatchEvent(new CustomEvent('zebjus-device-command-result',{detail:{ok:false,type,error:e?.message||String(e),sentAt:sent}}));if(e.status===423||e.status===409)healthRefresh(true);updateHealthUi()});return true
}
async function healthRefresh(force=false){
 const d=selected();
 if(!d)return;
 const now=performance.now();
 if(st.healthBusy)return;
 if(!force&&now-st.lastHealthAt<HEALTH_INTERVAL_MS)return;
 st.lastHealthAt=now;
 if(!client?.connected){
   if(d.online&&Date.now()-(d.lastSeen||0)>OFFLINE_AFTER_MS)markSelectedOffline('Connection lost');
   return;
 }
 st.healthBusy=true;
 try{
   const s=await client.refresh(2600);
   st.failures=0;upsertStatus(s,client.base);st.remoteBenchRc=!!s.benchRc;clearError();statusUi();
 }catch(e){
   const current=selected(),age=current?.lastSeen?Date.now()-current.lastSeen:Infinity;
   const recentStream=st.lastTelemetryGoodAt&&Date.now()-st.lastTelemetryGoodAt<3000;
   if(recentStream){st.failures=0;if(current){current.lastSeenText='Live stream OK';renderSelected();}return;}
   st.failures++;
   if(current&&st.failures<FAILURE_LIMIT&&age<OFFLINE_AFTER_MS){current.lastSeenText=`Checking link… ${st.failures}/${FAILURE_LIMIT}`;renderSelected();}
   if(st.failures>=FAILURE_LIMIT&&age>=Math.min(OFFLINE_AFTER_MS,HEALTH_INTERVAL_MS*FAILURE_LIMIT)){
     log(`Kit offline • ${e?.timeout?'health timeout':(e?.message||'health check failed')}`);
     markSelectedOffline('Connection lost');
   }
 }finally{st.healthBusy=false}
}
async function reconnectTick(force=false){
 const d=selected();if(!d||d.online||st.reconnectBusy)return;
 const now=performance.now();if(!force&&now-st.lastReconnectAt<RECONNECT_INTERVAL_MS)return;st.lastReconnectAt=now;
 st.reconnectBusy=true;
 try{
   const s=await client.reconnect(1);st.failures=0;upsertStatus(s,client.base);st.remoteBenchRc=!!s.benchRc;clearError();log('Kit is online again • reconnected automatically.');statusUi();
 }catch(_){/* stay OFFLINE; next watchdog pass retries */}
 finally{st.reconnectBusy=false}
}
async function telemetryTick(now){
 const d=selected();
 if(!client?.connected||!d?.online||d.flightCoreIntegrated===false||st.telemetryBusy||now-st.lastTelemetryAt<150)return;
 st.lastTelemetryAt=now;st.telemetryBusy=true;
 try{
   const t=await client.telemetry();st.lastTelemetryGoodAt=Date.now();healthFromTelemetry(t);
   const rcLive=(t?.receiverHealth||t?.sensorHealth?.receiver)==='OK'||(Array.isArray(t?.rc)&&(+t.rcAgeMs||0)<700);
   if(rcLive)applyPhysicalReceiver(t);else if(st.receiverHealth==='STALE'){api()?.controlSim?.({roll:0,pitch:0,yaw:0});api()?.setSimRunning?.(false)}
   api()?.receiveDevicePacket(t);api()?.setFcConnected(true);updateHealthUi();
 }catch(_){updateHealthUi()}
 finally{st.telemetryBusy=false}
}
async function lockTick(now){if(!ownsLock()||now-st.lastLockBeat<2500)return;st.lastLockBeat=now;try{await client.heartbeat()}catch(_){healthRefresh(true)}}

function setJoyKnob(which,x,y){const k=$(which==='left'?'#webLeftKnob':'#webRightKnob');if(k){k.style.left=`${50+x*31}%`;k.style.top=`${50+y*31}%`}}
function modeName(){return st.joy[5]>=1900?'ALTITUDE':st.joy[5]>=1400?'RATE':'ANGLE'}
function altitudeMode(){return modeName()==='ALTITUDE'}
function armGate(){
 if(!st.txOn)return{ok:false,title:'TRANSMITTER OFF',text:'Turn the transmitter on before arming.'};
 const ok=st.joy[2]<=1050,mode=modeName();
 return{ok,title:ok?(mode==='ALTITUDE'?'READY TO ARM • ALTITUDE':'READY TO ARM'):'THROTTLE LOW REQUIRED',text:ok?`Throttle is low (${st.joy[2]}). Arm is available in ${mode} mode.`:`Lower throttle to 1000 before arming. Current: ${st.joy[2]}.`};
}
function setTxSafe({keepMode=true}={}){const mode=keepMode?st.joy[5]:1000;st.joy=[1500,1500,1000,1500,1000,mode,mode>=1900?2000:1000,1000,1500,1000];st.joyKeys.clear()}
function updateArmGuidance(){
 const box=$('#webArmMessage'),gate=armGate(),armed=st.joy[4]>1500;
 if(box){box.className='arm-guidance '+(armed?'armed':gate.ok?'ready':'safe');box.innerHTML=armed?'<b>ARMED</b><span>Press DISARM or X before changing flight mode.</span>':`<b>${gate.title}</b><span>${gate.text}</span>`}
 const btn=$('#webArmBtn');if(btn){btn.disabled=!st.txOn||(!armed&&!gate.ok);btn.textContent=armed?'DISARM • CH5':'ARM • CH5';btn.className='btn full '+(armed?'danger':gate.ok?'primary':'ghost')}
}
function updateTxIndicators(){
 const mode=modeName(),armed=st.joy[4]>1500,power=$('#webTxLedPower'),arm=$('#webTxLedArm'),m=$('#webTxLedMode'),alt=$('#webTxLedAlt');
 if(power)power.className='tx-led '+(st.txOn?'on':'');if(arm)arm.className='tx-led '+(armed?'danger':'');if(m)m.className='tx-led mode '+(st.txOn?'on':'');if(alt)alt.className='tx-led '+(mode==='ALTITUDE'?'warn':'');
 setText('webTxPowerText',st.txOn?'ON':'OFF');setText('webTxArmText',armed?'ARMED':'SAFE');setText('webTxModeText',mode);setText('webTxAltText',mode==='ALTITUDE'?(armed?'ACTIVE':'READY'):'OFF');
 const p=$('#webTxPowerBtn');if(p){p.className='tx-power-btn '+(st.txOn?'on':'off');const span=p.querySelector('span');if(span)span.textContent=st.txOn?'TRANSMITTER ON':'TRANSMITTER OFF'}
 ['#webLeftStick','#webRightStick'].forEach(id=>$(id)?.classList.toggle('disabled',!st.txOn));
 const lamp=$('#webLedOutputLamp');if(lamp)lamp.className='mini-led '+(st.txOn&&st.joy[9]>1500?'on':'');
}
function renderJoy(){
 const c=st.joy;setJoyKnob('left',(c[3]-1500)/500,(1500-c[2])/500);setJoyKnob('right',(c[0]-1500)/500,(1500-c[1])/500);
 const l=$('#webLeftRead'),r=$('#webRightRead');if(l)l.textContent=`T ${c[2]} • Y ${Math.round((c[3]-1500)/5)}%`;if(r)r.textContent=`P ${Math.round((c[1]-1500)/5)}% • R ${Math.round((c[0]-1500)/5)}%`;
 const m=$('#webMode');if(m)m.value=String(c[5]);const ch9=$('#webCh9');if(ch9)ch9.value=c[8];const o=$('#webCh9Out');if(o)o.textContent=c[8];const led=$('#webLed');if(led)led.checked=c[9]>1500;
 const labels=['ROLL','PITCH','THROTTLE','YAW','ARM','MODE','ALT','AUX','CAM/AUX','LED'];const g=$('#webChannelGrid');if(g)g.innerHTML=c.map((v,i)=>`<div><span>CH${i+1} • ${labels[i]}</span><b>${v}</b><i style="--p:${(v-1000)/10}%"></i></div>`).join('');
 updateArmGuidance();updateTxIndicators();targetUi();
}
function setTransmitter(on){
 on=!!on;if(on===st.txOn)return;st.txOn=on;
 if(!on){setTxSafe();api()?.setSimRunning?.(false);log('Joystick transmitter OFF • channels returned to safe values.')}else{st.joy[2]=1000;st.joy[6]=altitudeMode()?2000:1000;noteJoyInput();log('Joystick transmitter ON • throttle held low.');}
 renderJoy();
}
function setFlightMode(value){
 if(st.joy[4]>1500){log('DISARM before changing flight mode.');const m=$('#webMode');if(m)m.value=String(st.joy[5]);return false}
 const v=+value;st.joy[5]=v;st.joy[6]=v>=1900?2000:1000;st.joy[2]=1000;st.joy[3]=1500;renderJoy();log(`${modeName()} mode selected • throttle held low for arming.`);return true;
}
function tryToggleArm(){
 if(st.joy[4]>1500){st.joy[4]=1000;renderJoy();log('DISARMED');return}
 const gate=armGate();if(!gate.ok){log(gate.title+' • '+gate.text);renderJoy();return}
 const target=$('#webJoyTarget')?.value||'sim';if(target==='device'){if(!ownsLock()){log('Real kit is view-only. Take Control first.');return}if(!st.remoteBenchRc){log('Real web joystick is disabled in kit firmware.');return}if(!confirm('PROP-OFF BENCH ONLY. Confirm propellers are removed before ARM.'))return}
 st.joy[4]=2000;renderJoy();log('ARMED • '+modeName());
}
function bindWebStick(el,which){
 if(!el)return;let drag=false,pointerId=null;
 const spring=()=>{if(which==='left'){st.joy[3]=1500}else{st.joy[0]=1500;st.joy[1]=1500}renderJoy()};
 const finish=e=>{if(!drag)return;drag=false;st.joyPointerActive=Math.max(0,st.joyPointerActive-1);const id=pointerId;pointerId=null;if(id!==null){try{el.releasePointerCapture?.(id)}catch{}}spring()};
 const outside=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,rad=Math.min(r.width,r.height)/2;return e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom||Math.hypot(e.clientX-cx,e.clientY-cy)>rad};
 const update=e=>{if(!st.txOn){finish(e);return}if(outside(e)){finish(e);return}noteJoyInput();const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(e.clientX-cx)/(r.width*.39),dy=(e.clientY-cy)/(r.height*.39),mag=Math.hypot(dx,dy),sc=mag>1?1/mag:1,x=clamp(dx*sc,-1,1),y=clamp(dy*sc,-1,1);if(which==='left'){st.joy[3]=Math.round(1500+x*500);st.joy[2]=Math.round(clamp(1500-y*500,1000,2000))}else{st.joy[0]=Math.round(1500+x*500);st.joy[1]=Math.round(1500-y*500)}renderJoy()};
 el.onpointerdown=e=>{if(!st.txOn)return;drag=true;st.joyPointerActive++;noteJoyInput();pointerId=e.pointerId;try{el.setPointerCapture?.(e.pointerId)}catch{}update(e)};
 el.onpointermove=e=>{if(drag&&e.pointerId===pointerId)update(e)};el.onpointerup=finish;el.onpointercancel=finish;el.onpointerleave=e=>{if(drag)finish(e)};
 window.addEventListener('pointerup',e=>{if(drag&&(pointerId===null||e.pointerId===pointerId))finish(e)});window.addEventListener('blur',()=>finish());
}
function centerJoy(){const mode=st.joy[5];st.joy=[1500,1500,1000,1500,1000,mode,mode>=1900?2000:1000,1000,1500,st.joy[9]>1500?2000:1000];renderJoy();log('Sticks centered • throttle held low at 1000.')}
function joyTypingTarget(el){return !!(el&&(el.matches?.('input,textarea,select')||el.isContentEditable))}
function joystickKeyDown(e){
 if(api()?.getActiveTab?.()!=='joystick'||joyTypingTarget(e.target))return;const k=e.key.toLowerCase();
 if(k==='t'){e.preventDefault();if(!e.repeat)setTransmitter(!st.txOn);return}if(k==='x'){e.preventDefault();st.joy[4]=1000;st.joy[0]=1500;st.joy[1]=1500;st.joy[3]=1500;st.joy[2]=1000;st.joyKeys.delete('w');st.joyKeys.delete('s');renderJoy();log('X SAFE • DISARMED • throttle held at 1000.');return}if(k==='m'){e.preventDefault();if(e.repeat)return;const seq=[1000,1500,2000],i=seq.indexOf(st.joy[5]);setFlightMode(seq[(i+1)%seq.length]);return}
 if(!st.txOn)return;const handled=['arrowleft','arrowright','arrowup','arrowdown','w','s','a','d'];if(!handled.includes(k))return;e.preventDefault();st.joyKeys.add(k);
 if(k==='arrowleft')st.joy[0]=1000;if(k==='arrowright')st.joy[0]=2000;if(k==='arrowup')st.joy[1]=2000;if(k==='arrowdown')st.joy[1]=1000;if(k==='a')st.joy[3]=1000;if(k==='d')st.joy[3]=2000;
 if(k==='w')st.joy[2]=clamp(st.joy[2]+25,1000,2000);if(k==='s')st.joy[2]=clamp(st.joy[2]-25,1000,2000);renderJoy();
}
function joystickKeyUp(e){
 const k=e.key.toLowerCase();if(!st.joyKeys.has(k))return;st.joyKeys.delete(k);if(k==='arrowleft'||k==='arrowright')st.joy[0]=1500;if(k==='arrowup'||k==='arrowdown')st.joy[1]=1500;if(k==='a'||k==='d')st.joy[3]=1500;renderJoy();
}
function releaseJoystickDirectionalKeys(){st.joyPointerActive=0;if(!st.joyKeys.size&&st.joy[0]===1500&&st.joy[1]===1500&&st.joy[3]===1500)return;st.joyKeys.clear();st.joy[0]=1500;st.joy[1]=1500;st.joy[3]=1500;renderJoy();}
function noteJoyInput(){st.lastJoyInputAt=Date.now();st.watchdogLatched=false;const b=$('#joyWatchdogBadge');if(b){b.textContent='READY';b.className='health-badge ok'}}
function joystickWatchdogTick(){
 if(!st.txOn)return;const active=st.joyPointerActive>0||st.joyKeys.size>0;if(active){st.lastJoyInputAt=Date.now();return}const age=Date.now()-st.lastJoyInputAt,offCenter=st.joy[0]!==1500||st.joy[1]!==1500||st.joy[3]!==1500;if(!offCenter||age<st.watchdogMs)return;st.joy[0]=1500;st.joy[1]=1500;st.joy[3]=1500;st.watchdogLatched=true;renderJoy();const armed=st.joy[4]>1500,target=$('#webJoyTarget')?.value||'sim',b=$('#joyWatchdogBadge');if(b){b.textContent=armed&&target==='device'?'ARMED WARN':'CENTERED';b.className='health-badge warn'}if(armed&&target==='device'&&st.watchdogWarnArmed)log(`WATCHDOG • directional channels centered after ${(st.watchdogMs/1000).toFixed(2)} s inactivity while ARMED. Throttle unchanged.`);else log('WATCHDOG • Roll / Pitch / Yaw returned to center. Throttle unchanged.');st.lastJoyInputAt=Date.now()
}
function initJoystick(){
 bindWebStick($('#webLeftStick'),'left');bindWebStick($('#webRightStick'),'right');const wd=$('#joyWatchdogMs'),ww=$('#joyWatchdogWarnArmed');if(wd){wd.value=String(st.watchdogMs);wd.onchange=()=>{st.watchdogMs=clamp(+wd.value,500,10000);savePrefs();noteJoyInput()}}if(ww){ww.checked=st.watchdogWarnArmed;ww.onchange=()=>{st.watchdogWarnArmed=ww.checked;savePrefs()}}renderJoy();
 $('#webTxPowerBtn')?.addEventListener('click',()=>setTransmitter(!st.txOn));$('#webArmBtn')?.addEventListener('click',tryToggleArm);$('#webJoyDisarmBtn')?.addEventListener('click',()=>{st.joy[4]=1000;st.joy[0]=1500;st.joy[1]=1500;st.joy[3]=1500;st.joy[2]=1000;renderJoy();log('DISARM / SAFE • throttle held low')});
 $('#webMode')?.addEventListener('change',e=>setFlightMode(e.target.value));$('#webCh9')?.addEventListener('input',e=>{if(!st.txOn)return;st.joy[8]=+e.target.value;renderJoy()});$('#webLed')?.addEventListener('change',e=>{if(!st.txOn){e.target.checked=false;return}st.joy[9]=e.target.checked?2000:1000;renderJoy()});$('#webJoyCenterBtn')?.addEventListener('click',centerJoy);
 $('#webJoyTarget')?.addEventListener('change',e=>{if(e.target.value==='device'&&!ownsLock()){e.target.value='sim';log('Real kit target requires Take Control.')}renderJoy()});window.addEventListener('keydown',joystickKeyDown);window.addEventListener('keyup',joystickKeyUp);window.addEventListener('blur',releaseJoystickDirectionalKeys);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseJoystickDirectionalKeys()});
}
function joystickTick(now){
 if(api()?.getActiveTab?.()!=='joystick'||!st.txOn)return;const rate=+($('#webJoyRate')?.value||20),period=1000/Math.max(1,rate);if(now-st.lastJoySent<period)return;st.lastJoySent=now;const c=st.joy,target=$('#webJoyTarget')?.value||'sim';if(target==='sim'){api()?.controlSim?.({roll:(c[0]-1500)/500,pitch:(c[1]-1500)/500,throttle:c[2],yaw:(c[3]-1500)/500});api()?.setSimRunning?.(c[4]>1500)}else if(canControl()&&st.remoteBenchRc)sendDeviceCommand({type:'rc_frame',sequence:++st.joySeq,timestamp:Date.now(),channels:[...c]})
}
async function scanKitsUi(){
 st.manualDisconnect=false;const btn=$('#refreshModulesBtn'),sel=$('#kitSelect');if(btn)btn.disabled=true;if(sel)sel.innerHTML='<option value="">Scanning 0/30…</option>';
 try{
   const extras=[st.preferredDeviceName,st.query].filter(x=>x&&!/^ZJ-DRONE-/i.test(x));
   const found=await window.ZebjusDroneKit.scanDefaultKits({max:30,extraNames:extras,onProgress:(done,total,count)=>{if(sel&&sel.options.length===1)sel.options[0].textContent=`Scanning ${done}/${total} — ${count} found`;}});
   found.forEach(r=>upsertStatus(r.status,r.base));reconcileSelection();clearError();statusUi();
   const list=st.devices.filter(d=>d.online).sort((a,b)=>String(a.deviceName).localeCompare(String(b.deviceName),undefined,{numeric:true}));
   if(sel){sel.innerHTML='';if(!list.length)sel.innerHTML='<option value="">No default kits found</option>';else list.forEach(d=>{const o=document.createElement('option');o.value=d.deviceName;o.dataset.ip=d.ip||'';o.dataset.id=d.deviceId||'';o.textContent=`${d.deviceName}  •  ${d.deviceId}  •  ${d.ip||'local'}`;sel.appendChild(o)})}
   if(list.length){
     const q=$('#kitSearchInput'),ip=$('#kitCachedIp');let chosen=list.find(d=>d.deviceId===st.selectedDeviceId)||list.find(d=>d.deviceName===st.query)||list.find(d=>d.deviceName===st.preferredDeviceName)||list[0];
     st.query=chosen.deviceName;if(q&&document.activeElement!==q)q.value=chosen.deviceName;if(ip&&document.activeElement!==ip)ip.value=chosen.ip||'';if(sel)sel.value=chosen.deviceName;savePrefs();
     setText('kitNameMessage',`${list.length} kit(s) found. ${chosen.deviceName} is ready to connect.`);
   }else setText('kitNameMessage','No zebjus_drone_N kit found yet. Make sure the kit is powered and connected to this same Wi-Fi.');
   if(list.length===1&&!st.selectedDeviceId){await connectExact(list[0].deviceName,true).catch(()=>{});}
 }finally{if(btn)btn.disabled=false}
}
function disconnectKit(manual=true){if(manual)st.manualDisconnect=true;releaseLock(false).catch(()=>{});client?.disconnect();st.selectedDeviceId='';st.lastTelemetryGoodAt=0;st.lastCommandAckAt=0;st.receiverLastAt=0;st.receiverHealth='NOT_FOUND';st.sensorHealth={imu:'NOT_FOUND',barometer:'NOT_FOUND',lidar:'NOT_FOUND',receiver:'NOT_FOUND'};const b=$('#kitConnBadge');if(b){b.textContent='Not connected';b.className='status'};if(manual)setText('kitNameMessage','Disconnected by user. Press Connect Kit or Scan This Wi-Fi to reconnect.');statusUi()}
async function resetKitName(){if(!client?.connected)return setText('kitNameMessage','Connect kit first.');try{const r=await client.resetName();setText('kitNameMessage',r.message||'Auto name selected; kit restarting.');disconnectKit(false)}catch(e){setText('kitNameMessage','Reset failed: '+e.message)}}
async function scanWifi(){const sel=$('#wifiSelect');if(!client?.connected){if(sel)sel.innerHTML='<option value="">Connect kit first</option>';return setText('wifiMessage','Connect kit first.')}if(sel)sel.innerHTML='<option value="">Scanning…</option>';setText('wifiMessage','Scanning Wi-Fi…');try{const r=await client.scanWifi();if(sel){sel.innerHTML='';(r.networks||[]).forEach(n=>{const o=document.createElement('option');o.value=n.ssid;o.textContent=`${n.ssid} (${n.rssi} dBm)${n.secure?' 🔒':''}`;sel.appendChild(o)});if(!sel.options.length)sel.innerHTML='<option value="">No networks found</option>'}setText('wifiMessage',`${(r.networks||[]).length} network(s) found.`)}catch(e){setText('wifiMessage','Wi-Fi scan failed: '+e.message)}}
async function saveWifi(){if(!canControl())return setText('wifiMessage','Take Control first.');const ssid=$('#wifiSelect')?.value||'',password=$('#wifiPassword')?.value||'';if(!ssid)return setText('wifiMessage','Select a Wi-Fi network first.');try{const r=await client.setWifi(ssid,password);if($('#wifiPassword'))$('#wifiPassword').value='';setText('wifiMessage',r.message||`Saved ${ssid}; kit restarting.`);disconnectKit(false)}catch(e){setText('wifiMessage','Wi-Fi change failed: '+e.message)}}
async function refreshSavedWifi(){const sel=$('#savedWifiSelect');if(!sel)return;if(!client?.connected){sel.innerHTML='<option value="">Connect kit first</option>';return}try{const r=await client.savedWifi();sel.innerHTML='';(r.profiles||[]).forEach(n=>{const o=document.createElement('option');o.value=n.ssid;const f=[n.current?'current':'',n.preferred?'preferred':''].filter(Boolean).join(', ');o.textContent=n.ssid+(f?` — ${f}`:'')+(n.passwordSaved?' 🔒':'');sel.appendChild(o)});if(!sel.options.length)sel.innerHTML='<option value="">No saved networks</option>'}catch(e){sel.innerHTML='<option value="">Could not read saved networks</option>';setText('wifiMessage','Saved Wi-Fi read failed: '+e.message)}}
async function useSavedWifi(){if(!canControl())return setText('wifiMessage','Take Control first.');const ssid=$('#savedWifiSelect')?.value||'';if(!ssid)return setText('wifiMessage','Select a saved network first.');try{const r=await client.useWifi(ssid);setText('wifiMessage',r.message||`Switching to ${ssid}.`);disconnectKit(false)}catch(e){setText('wifiMessage','Could not switch Wi-Fi: '+e.message)}}
async function forgetSavedWifi(){if(!canControl())return setText('wifiMessage','Take Control first.');const ssid=$('#savedWifiSelect')?.value||'';if(!ssid)return setText('wifiMessage','Select a saved network first.');try{const r=await client.forgetWifi(ssid);setText('wifiMessage',r.message||`Forgot ${ssid}.`);await refreshSavedWifi()}catch(e){setText('wifiMessage','Could not forget Wi-Fi: '+e.message)}}
async function resetWifi(){if(!canControl())return setText('wifiMessage','Take Control first.');if(!confirm('Forget all saved Wi-Fi networks on this kit?'))return;try{const r=await client.resetWifi();setText('wifiMessage',r.message||'Saved Wi-Fi cleared; kit restarting in setup mode.');disconnectKit(false)}catch(e){setText('wifiMessage','Wi-Fi reset failed: '+e.message)}}
function initUi(){
 loadPrefs();initJoystick();const q=$('#kitSearchInput');if(q){q.value=st.query;q.addEventListener('keydown',e=>{if(e.key==='Enter')searchModules()})}const demo=$('#demoMode');if(demo){demo.checked=st.demoMode;demo.onchange=()=>{st.demoMode=demo.checked;savePrefs();if(st.demoMode)api()?.setFcConnected?.(false);statusUi()}}
 $('#kitSearchBtn')?.addEventListener('click',searchModules);$('#refreshModulesBtn')?.addEventListener('click',scanKitsUi);$('#disconnectKitBtn')?.addEventListener('click',()=>disconnectKit(true));$('#renameDeviceBtn')?.addEventListener('click',renameDevice);$('#resetKitNameBtn')?.addEventListener('click',resetKitName);$('#pingSelectedDeviceBtn')?.addEventListener('click',()=>sendDeviceCommand({type:'ping',time:Date.now()}));$('#takeControlBtn')?.addEventListener('click',()=>acquireLock(false));$('#releaseControlBtn')?.addEventListener('click',()=>releaseLock(false));$('#scanWifiBtn')?.addEventListener('click',scanWifi);$('#saveWifiBtn')?.addEventListener('click',saveWifi);$('#resetWifiBtn')?.addEventListener('click',resetWifi);$('#refreshSavedWifiBtn')?.addEventListener('click',refreshSavedWifi);$('#useSavedWifiBtn')?.addEventListener('click',useSavedWifi);$('#forgetSavedWifiBtn')?.addEventListener('click',forgetSavedWifi);$('#kitSelect')?.addEventListener('change',e=>{const o=e.target.selectedOptions?.[0];if(!o?.value)return;if(q)q.value=o.value;const ip=$('#kitCachedIp');if(ip)ip.value=o.dataset.ip||'';st.query=o.value;savePrefs();setText('kitNameMessage',`${o.value} selected from automatic discovery.`);connectExact(o.value,true).then(refreshSavedWifi).catch(err=>simpleError(err.message))});
 window.addEventListener('pagehide',()=>{if(ownsLock())client.release({keepalive:true}).catch(()=>{})});statusUi();
 if(st.preferredDeviceName||st.query){connectExact(st.preferredDeviceName||st.query,st.autoAcquire).then(refreshSavedWifi).catch(e=>{log('Auto-connect: '+e.message);scanKitsUi()})}else scanKitsUi();
}
function loop(t){joystickTick(t);joystickWatchdogTick();telemetryTick(t);lockTick(t);updateHealthUi();requestAnimationFrame(loop)}
function start(){if(st.booted)return;st.booted=true;window.__zebjusSchoolReady=true;initUi();requestAnimationFrame(loop);setInterval(()=>{refreshLastSeenText();healthRefresh();reconnectTick();requestModules(false)},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden){healthRefresh(true);reconnectTick(true)}});window.addEventListener('online',()=>{healthRefresh(true);reconnectTick(true)});window.zebjusSchool={sendDeviceCommand,i2cScan,imuRead,isViewOnly,isCloudActive:()=>!!selected()?.online,isKitActive:()=>!!selected()?.online,getSelectedDevice:selected,canControl,ownsLock,requestModules,acquireLock,releaseLock,state:st,client,markOffline:markSelectedOffline,refreshNow:async()=>{await healthRefresh(true);return selected()},reconnectNow:async()=>{const d=selected();if(!d)return null;if(d.online&&client?.connected){await healthRefresh(true);return selected()}if(d.online)markSelectedOffline('Reconnect requested');await reconnectTick(true);return selected()}}}
window.addEventListener('zebjus-app-ready',start,{once:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0));else setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0);
})();
