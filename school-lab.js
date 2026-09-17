(function(){
'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_CH=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];
const FAILURE_LIMIT=5;

const client=window.ZebjusDroneKit?new window.ZebjusDroneKit.LocalKitClient():null;
const st={devices:[],selectedDeviceId:'',query:'',preferredDeviceId:'',preferredDeviceName:'',autoAcquire:false,joy:[...DEFAULT_CH],joySeq:0,lastJoySent:0,booted:false,lastDiscoverAt:0,lastHealthAt:0,lastTelemetryAt:0,lastLockBeat:0,failures:0,reconnectBusy:false,lastError:'',remoteBenchRc:false};

function api(){return window.zebjusLabAPI||null}
function ready(){return !!client}
function selected(){return st.devices.find(d=>d.deviceId===st.selectedDeviceId)||null}
function ownsLock(){const d=selected();return !!(d&&d.online&&d.lockMine)}
function isViewOnly(){const d=selected();return !!(d&&d.online&&!d.lockMine)}
function canControl(){return !!(client?.connected&&ownsLock())}
function log(t){const e=$('#schoolLog');if(e)e.textContent=`${new Date().toLocaleTimeString()} ${t}\n${e.textContent}`.slice(0,9000)}
function signalText(rssi){rssi=+rssi;if(!Number.isFinite(rssi))return 'Unknown';if(rssi>=-55)return 'Excellent';if(rssi>=-67)return 'Good';if(rssi>=-75)return 'Weak';return 'Very weak'}
function setText(id,v){const e=$('#'+id);if(e)e.textContent=v}
function savePrefs(){try{localStorage.setItem('zebjusV183KitQuery',st.query||'');if(st.selectedDeviceId)localStorage.setItem('zebjusV183LastKit',st.selectedDeviceId)}catch{}}
function loadPrefs(){
 st.query=localStorage.getItem('zebjusV183KitQuery')||'';
 const p=new URLSearchParams(location.search),urlId=(p.get('kitId')||p.get('kit')||'').trim(),urlName=(p.get('kitName')||'').trim();
 st.preferredDeviceId=urlId||localStorage.getItem('zebjusV183LastKit')||'';st.preferredDeviceName=urlName;st.autoAcquire=p.get('autoconnect')==='1';
 if(urlName)st.query=urlName;else if(urlId)st.query=urlId;
 if(urlName||urlId)log(`Setup handoff received: ${urlName||urlId}. Connecting on local Wi-Fi…`);
}
function simpleError(msg){st.lastError=msg;log('ERROR: '+msg);const e=$('#simpleErrorStatus');if(e){e.textContent=msg;e.hidden=false}}
function clearError(){st.lastError='';const e=$('#simpleErrorStatus');if(e){e.textContent='';e.hidden=true}}
function upsertStatus(s,base=''){
 if(!s?.deviceId)return null;const i=st.devices.findIndex(x=>x.deviceId===s.deviceId),prev=i>=0?st.devices[i]:null,d={...(prev||{}),...s,deviceName:s.name||s.deviceName||s.deviceId,online:true,lastSeen:Date.now(),lastSeenText:'Now',base:base||s.base||''};if(prev?.lockMine&&client?.deviceId===s.deviceId&&client?.status?.lockMine)d.lockMine=true;
 if(i>=0)st.devices[i]=d;else st.devices.push(d);st.devices.sort((a,b)=>String(a.deviceName).localeCompare(String(b.deviceName),undefined,{numeric:true}));return d;
}
function serviceStatus(){
 const e=$('#simpleServiceStatus');if(e){e.textContent=ready()?'LOCAL READY':'UNAVAILABLE';e.className=ready()?'good':''}
 const d=selected(),k=$('#simpleKitStatus');if(k){k.textContent=d?(d.online?'ONLINE':'OFFLINE'):'NOT SELECTED';k.className=d?.online?'good':''}
 const c=$('#simpleControlStatus');if(c){c.textContent=!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';c.className=d?.lockMine?'good':d?.locked?'warn':''}
 const n=$('#simpleNetworkStatus');if(n)n.textContent=d?(d.ssid||'Same Wi-Fi'):'--';
}
function targetUi(){
 const devOpt=$('#webJoyTarget option[value="device"]');if(devOpt){devOpt.disabled=!(st.remoteBenchRc&&ownsLock());devOpt.textContent=st.remoteBenchRc?(ownsLock()?'REAL KIT • PROP-OFF BENCH':'REAL KIT • TAKE CONTROL FIRST'):'REAL KIT • BENCH DISABLED'}
 const target=$('#webJoyTarget')?.value||'sim',tb=$('#joyTargetBadge');if(tb){tb.textContent=target==='sim'?'SIMULATOR':'REAL HARDWARE';tb.className='target-mode-badge '+(target==='sim'?'sim':'real')}
 const tn=$('#joyTargetNote');if(tn)tn.textContent=target==='sim'?'Safe local simulation. No real kit commands are sent.':ownsLock()?'Supervised prop-off bench only. You hold the local kit lock.':'Real kit is view-only until you take control.';
}
function statusUi(){
 const b=$('#schoolCloudBadge');if(b){b.textContent=ready()?'LOCAL LINK':'UNAVAILABLE';b.className='status '+(ready()?'good':'')}
 const q=$('#kitSearchInput');if(q&&document.activeElement!==q)q.value=st.query;
 const ng=$('#networkGroupBadge');if(ng)ng.textContent='Same Wi-Fi • mDNS';
 const wr=$('#webJoyRoleBadge');if(wr){wr.textContent='OPEN ACCESS';wr.className='status good'}
 const ss=$('#shareStateBadge');if(ss){const d=selected();ss.textContent=d?.lockMine?'CONTROL':d?.online?'VIEW ONLY':ready()?'READY':'OFFLINE';ss.className='status '+(d?.lockMine?'good':'')}
 renderModules();renderSelected();serviceStatus();targetUi();
}
function renderModules(){
 const box=$('#moduleList'),list=st.query?st.devices.filter(d=>String(d.deviceName||'').toLowerCase().includes(st.query.toLowerCase())||String(d.deviceId||'').toLowerCase().includes(st.query.toLowerCase())):st.devices;
 const count=$('#moduleCountBadge');if(count)count.textContent=`${list.length} kit${list.length===1?'':'s'}`;if(!box)return;
 if(!ready()){box.innerHTML='<div class="empty-module">Local kit connector did not load.</div>';return}
 if(!list.length){box.innerHTML='<div class="empty-module">No kit saved on this browser yet. Enter the exact Kit Name above and press CONNECT KIT. After the first connection it will appear automatically.</div>';return}
 box.innerHTML=list.map(d=>{const sel=d.deviceId===st.selectedDeviceId,ctl=d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';return `<button class="module-card ${sel?'selected':''}" data-device="${esc(d.deviceId)}"><span class="module-online-dot ${d.online?'on':''}"></span><div><b>${esc(d.deviceName||d.deviceId)}</b><small>${esc(d.deviceId)}</small><em>${esc(d.ssid||'Same Wi-Fi')} • ${Number.isFinite(+d.rssi)?d.rssi+' dBm / '+signalText(d.rssi):'RSSI --'}</em></div><i class="${d.lockMine?'mine':d.locked?'busy':''}">${d.online?ctl:'OFFLINE'}</i></button>`}).join('');
 $$('.module-card').forEach(b=>b.onclick=()=>selectDevice(b.dataset.device));
}
function renderSelected(){
 const d=selected();setText('selectedDeviceName',d?.deviceName||'No kit selected');setText('selectedDeviceId',d?.deviceId||'--');setText('selectedDeviceSchool','Open access');setText('selectedDeviceMode',d?.mode||'--');setText('selectedDeviceNetwork',d?.ssid||'--');setText('selectedDeviceRssi',Number.isFinite(+d?.rssi)?`${d.rssi} dBm • ${signalText(d.rssi)}`:'--');setText('selectedDeviceFirmware',d?.firmware||d?.version||'--');setText('selectedDeviceLastSeen',d?.lastSeenText||'--');setText('selectedDeviceLock',!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY • IN USE':'AVAILABLE');
 setText('apModeIndicator',d?(String(d.mode||'').toUpperCase().includes('AP')?'ACTIVE':'OFF'):'--');setText('staModeIndicator',d?(String(d.mode||'').toUpperCase().includes('STA')?'ACTIVE':'OFF'):'--');
 const online=$('#selectedDeviceOnline');if(online){online.textContent=d?.online?'Online':'Offline';online.className='status '+(d?.online?'good':'')}
 const rename=$('#deviceRenameInput');if(rename&&d&&!rename.matches(':focus'))rename.value=d.deviceName||'';
 const ping=$('#pingSelectedDeviceBtn');if(ping)ping.disabled=!(d&&d.online);const renameBtn=$('#renameDeviceBtn');if(renameBtn)renameBtn.disabled=!canControl();
 const take=$('#takeControlBtn');if(take){take.disabled=!(d&&d.online&&!d.lockMine&&!d.locked);take.hidden=!!d?.lockMine;take.textContent=d?.locked?'Kit In Use • View Only':'Take Control'}
 const rel=$('#releaseControlBtn');if(rel){rel.hidden=!d?.lockMine;rel.disabled=!d?.lockMine}
 const jm=$('#joySelectedModule');if(jm)jm.textContent=d?.deviceName||'None';const jl=$('#joyLock');if(jl)jl.textContent=!d?'--':d.lockMine?'CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';
 const jt=$('#webJoyTarget');if(jt&&jt.value==='device'&&!d?.lockMine){jt.value='sim';centerJoy()}
 api()?.setFcConnected(!!(d&&d.online));const note=$('#selectedControlNote');if(note)note.textContent=!d?'Enter the Kit Name used in AP setup, then Connect Kit.':d.lockMine?'This browser controls the real kit. Other browsers are view-only until your heartbeat stops.':d.locked?'Another browser controls this kit. Telemetry and simulator remain available.':'Kit is available. Take Control for real-hardware changes.';serviceStatus();targetUi();
}
async function connectExact(query,autoAcquire=true){
 query=String(query||'').trim();if(!query)throw new Error('Enter the Kit Name used during AP setup.');
 clearError();log('Looking for '+query+' on the same Wi-Fi…');
 const samePreferredName=st.preferredDeviceName&&window.ZebjusDroneKit.normalizeKitName(st.preferredDeviceName)===window.ZebjusDroneKit.normalizeKitName(query);const expected=/^ZJ-DRONE-/i.test(query)?query:(samePreferredName?st.preferredDeviceId:'');
 const status=await client.connect(query,'',expected);const d=upsertStatus(status,client.base);st.selectedDeviceId=d.deviceId;st.preferredDeviceId=d.deviceId;st.preferredDeviceName=d.deviceName;st.query=d.deviceName;st.remoteBenchRc=!!status.benchRc;st.failures=0;savePrefs();log(`Connected locally: ${d.deviceName} • ${d.deviceId} • ${status.ip||''}`);statusUi();if(autoAcquire)await acquireLock(true);return d;
}
async function searchModules(){const q=$('#kitSearchInput')?.value.trim()||st.query;st.query=q;savePrefs();if(q){try{await connectExact(q,true)}catch(e){simpleError(e.message)}}else await requestModules(true)}
async function requestModules(force=false){
 if(!ready()||st.reconnectBusy)return;if(!force&&client?.connected&&selected()?.online)return;const now=performance.now();if(!force&&now-st.lastDiscoverAt<15000)return;st.lastDiscoverAt=now;
 const extras=[st.preferredDeviceName,st.query].filter(x=>x&&!/^ZJ-DRONE-/i.test(x));
 try{const found=await window.ZebjusDroneKit.scanDefaultKits({max:12,extraNames:extras});found.forEach(r=>upsertStatus(r.status,r.base));reconcileSelection();clearError();statusUi()}catch(e){log('Background discovery: '+e.message)}
}
function reconcileSelection(){if(st.selectedDeviceId&&!selected())st.selectedDeviceId='';if(!st.selectedDeviceId){let d=null;if(st.preferredDeviceId)d=st.devices.find(x=>x.deviceId===st.preferredDeviceId)||null;if(!d&&st.preferredDeviceName)d=st.devices.find(x=>String(x.deviceName).toLowerCase()===st.preferredDeviceName.toLowerCase())||null;if(!d&&st.devices.length===1)d=st.devices[0];if(d)st.selectedDeviceId=d.deviceId}savePrefs()}
async function selectDevice(id){const d=st.devices.find(x=>x.deviceId===id);if(!d)return;try{if(ownsLock())await releaseLock(false);const s=await client.connect(d.deviceName,d.ip,d.deviceId);upsertStatus(s,client.base);st.selectedDeviceId=id;st.query=d.deviceName;savePrefs();await acquireLock(true);statusUi()}catch(e){simpleError(e.message)}}
async function acquireLock(auto=false){const d=selected();if(!d?.online||!client?.connected)return false;if(d.lockMine)return true;if(auto&&d.locked)return false;try{const r=await client.acquire();const s=await client.refresh();upsertStatus(s,client.base);if(r.ok)log('Control acquired for '+(s.name||d.deviceName));clearError();statusUi();return !!r.ok}catch(e){log(e.message||'Kit is in use. View-only mode active.');try{upsertStatus(await client.refresh(),client.base)}catch{}statusUi();return false}}
async function releaseLock(clearSelection=false){try{if(client?.connected&&ownsLock())await client.release()}catch{}if(selected())selected().lockMine=false;if(clearSelection)st.selectedDeviceId='';statusUi()}
async function renameDevice(){const d=selected(),name=$('#deviceRenameInput')?.value.trim();if(!d||!name)return log('Select a kit and enter a name.');if(!canControl())return log('VIEW ONLY • Take Control first.');try{const s=await client.rename(name);upsertStatus(s,client.base);st.query=s.name;st.preferredDeviceName=s.name;savePrefs();log('Kit renamed: '+s.name);statusUi()}catch(e){simpleError(e.message)}}
function sendDeviceCommand(command){const d=selected();if(!d?.online||!client?.connected)return false;if(command?.type!=='ping'&&!d.lockMine){log('VIEW ONLY • Take Control before changing the real kit.');return false}client.command(command).then(r=>{if(r?.packet)api()?.receiveDevicePacket(r.packet);else if(r)api()?.receiveDevicePacket(r);if(r?.message)log(r.message)}).catch(e=>{simpleError(e.message);if(e.status===423||e.status===409)healthRefresh(true)});return true}
async function healthRefresh(force=false){
 if(!client?.connected)return;const now=performance.now();if(!force&&now-st.lastHealthAt<1000)return;st.lastHealthAt=now;
 try{const s=await client.refresh();st.failures=0;upsertStatus(s,client.base);st.remoteBenchRc=!!s.benchRc;clearError();statusUi()}
 catch(e){st.failures++;log(`Kit health miss ${st.failures}/${FAILURE_LIMIT}`);if(st.failures<FAILURE_LIMIT)return;const d=selected();if(d){d.online=false;d.lastSeenText='Connection lost'}api()?.setFcConnected(false);statusUi();if(!st.reconnectBusy){st.reconnectBusy=true;client.reconnect(4).then(s=>{st.failures=0;upsertStatus(s,client.base);log('Kit reconnected automatically.');clearError();statusUi()}).catch(()=>simpleError('Kit connection lost. Check that this device and the kit are on the same Wi-Fi.')).finally(()=>st.reconnectBusy=false)}}
}
async function telemetryTick(now){if(!client?.connected||now-st.lastTelemetryAt<150)return;st.lastTelemetryAt=now;try{const t=await client.telemetry();api()?.receiveDevicePacket(t);api()?.setFcConnected(true)}catch(_){}}
async function lockTick(now){if(!ownsLock()||now-st.lastLockBeat<2500)return;st.lastLockBeat=now;try{await client.heartbeat()}catch(_){healthRefresh(true)}}

function setJoyKnob(which,x,y){const k=$(which==='left'?'#webLeftKnob':'#webRightKnob');if(k){k.style.left=`${50+x*31}%`;k.style.top=`${50+y*31}%`}}
function renderJoy(){const c=st.joy;setJoyKnob('left',(c[3]-1500)/500,(1500-c[2])/500);setJoyKnob('right',(c[0]-1500)/500,(1500-c[1])/500);const l=$('#webLeftRead'),r=$('#webRightRead');if(l)l.textContent=`T ${c[2]} • Y ${Math.round((c[3]-1500)/5)}%`;if(r)r.textContent=`P ${Math.round((c[1]-1500)/5)}% • R ${Math.round((c[0]-1500)/5)}%`;const arm=$('#webArmBtn');if(arm){arm.textContent=c[4]>1500?'CH5 ARMED':'CH5 DISARMED';arm.className='btn full '+(c[4]>1500?'danger':'ghost')}const m=$('#webMode');if(m)m.value=String(c[5]);const ah=$('#webAltHold');if(ah)ah.checked=c[6]>1500;const bp=$('#webBeeper');if(bp)bp.checked=c[7]>1500;const ch9=$('#webCh9');if(ch9)ch9.value=c[8];const o=$('#webCh9Out');if(o)o.textContent=c[8];const led=$('#webLed');if(led)led.checked=c[9]>1500;const g=$('#webChannelGrid');if(g)g.innerHTML=c.map((v,i)=>`<div><span>CH${i+1}</span><b>${v}</b><i style="--p:${(v-1000)/10}%"></i></div>`).join('');targetUi()}
function bindWebStick(el,which){if(!el)return;let drag=false;const update=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(e.clientX-cx)/(r.width*.39),dy=(e.clientY-cy)/(r.height*.39),mag=Math.hypot(dx,dy),sc=mag>1?1/mag:1,x=clamp(dx*sc,-1,1),y=clamp(dy*sc,-1,1);if(which==='left'){st.joy[3]=Math.round(1500+x*500);st.joy[2]=Math.round(clamp(1500-y*500,1000,2000))}else{st.joy[0]=Math.round(1500+x*500);st.joy[1]=Math.round(1500-y*500)}renderJoy()};el.onpointerdown=e=>{drag=true;try{el.setPointerCapture(e.pointerId)}catch{}update(e)};el.onpointermove=e=>{if(drag)update(e)};const up=()=>{if(!drag)return;drag=false;if(which==='left')st.joy[3]=1500;else{st.joy[0]=1500;st.joy[1]=1500}renderJoy()};el.onpointerup=up;el.onpointercancel=up}
function centerJoy(){st.joy=[...DEFAULT_CH];renderJoy()}
function initJoystick(){bindWebStick($('#webLeftStick'),'left');bindWebStick($('#webRightStick'),'right');renderJoy();$('#webArmBtn')?.addEventListener('click',()=>{const target=$('#webJoyTarget')?.value;if(st.joy[4]<1500&&target==='device'){if(!ownsLock()){log('Real kit is view-only. Take Control first.');return}if(!confirm('Real hardware joystick is for supervised PROP-OFF bench testing only. Continue?'))return}st.joy[4]=st.joy[4]>1500?1000:2000;renderJoy()});$('#webMode')?.addEventListener('change',e=>{st.joy[5]=+e.target.value;renderJoy()});$('#webAltHold')?.addEventListener('change',e=>{st.joy[6]=e.target.checked?2000:1000;renderJoy()});$('#webBeeper')?.addEventListener('change',e=>{st.joy[7]=e.target.checked?2000:1000;renderJoy()});$('#webCh9')?.addEventListener('input',e=>{st.joy[8]=+e.target.value;renderJoy()});$('#webLed')?.addEventListener('change',e=>{st.joy[9]=e.target.checked?2000:1000;renderJoy()});$('#webJoyCenterBtn')?.addEventListener('click',centerJoy);$('#webJoyTarget')?.addEventListener('change',e=>{if(e.target.value==='device'&&!ownsLock()){e.target.value='sim';log('Real kit target requires Take Control.')}statusUi()})}
function joystickTick(now){if(api()?.getActiveTab?.()!=='joystick')return;const rate=+($('#webJoyRate')?.value||20),period=1000/Math.max(1,rate);if(now-st.lastJoySent<period)return;st.lastJoySent=now;const c=st.joy,target=$('#webJoyTarget')?.value||'sim';if(target==='sim'){api()?.controlSim?.({roll:(c[0]-1500)/500,pitch:(c[1]-1500)/500,throttle:c[2],yaw:(c[3]-1500)/500});api()?.setSimRunning?.(true)}else if(canControl()&&st.remoteBenchRc)sendDeviceCommand({type:'rc_frame',sequence:++st.joySeq,timestamp:Date.now(),channels:[...c]})}
function initUi(){
 loadPrefs();initJoystick();const q=$('#kitSearchInput');if(q){q.value=st.query;q.addEventListener('keydown',e=>{if(e.key==='Enter')searchModules()})}
 $('#kitSearchBtn')?.addEventListener('click',searchModules);$('#refreshModulesBtn')?.addEventListener('click',()=>requestModules(true));$('#renameDeviceBtn')?.addEventListener('click',renameDevice);$('#pingSelectedDeviceBtn')?.addEventListener('click',()=>sendDeviceCommand({type:'ping',time:Date.now()}));$('#takeControlBtn')?.addEventListener('click',()=>acquireLock(false));$('#releaseControlBtn')?.addEventListener('click',()=>releaseLock(false));
 window.addEventListener('pagehide',()=>{if(ownsLock())client.release({keepalive:true}).catch(()=>{})});statusUi();
 if(st.preferredDeviceName||st.query){connectExact(st.preferredDeviceName||st.query,st.autoAcquire).catch(e=>{log('Auto-connect: '+e.message);requestModules(true)})}else requestModules(true);
}
function loop(t){joystickTick(t);telemetryTick(t);lockTick(t);healthRefresh();requestModules(false);requestAnimationFrame(loop)}
function start(){if(st.booted)return;st.booted=true;initUi();requestAnimationFrame(loop);window.zebjusSchool={sendDeviceCommand,isViewOnly,isCloudActive:()=>!!client?.connected,isKitActive:()=>!!client?.connected,getSelectedDevice:selected,canControl,ownsLock,requestModules,acquireLock,releaseLock,state:st,client}}
window.addEventListener('zebjus-app-ready',start,{once:true});if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0));else setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0);
})();
