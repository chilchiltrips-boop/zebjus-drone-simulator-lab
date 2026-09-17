(function(){
'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DEFAULT_CH=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];

const st={
 ws:null,hello:false,clientId:'',cloudUrl:'',networkGroup:'',remoteBenchRc:false,lockTimeoutMs:10000,
 devices:[],selectedDeviceId:'',query:'',preferredDeviceId:'',preferredDeviceName:'',autoAcquire:false,
 joy:[...DEFAULT_CH],joySeq:0,lastJoySent:0,booted:false,lastListAt:0,lastLockBeat:0,lastAcquireAttempt:'',lastError:'',
};

function api(){return window.zebjusLabAPI||null}
function wsOpen(){return !!(st.ws&&st.ws.readyState===WebSocket.OPEN&&st.hello)}
function selected(){return st.devices.find(d=>d.deviceId===st.selectedDeviceId)||null}
function ownsLock(){const d=selected();return !!(d&&d.online&&d.lockMine)}
function isViewOnly(){const d=selected();return !!(d&&d.online&&!d.lockMine)}
function canControl(){return !!(wsOpen()&&ownsLock())}
function send(obj){if(!st.ws||st.ws.readyState!==WebSocket.OPEN)return false;st.ws.send(JSON.stringify(obj));return true}
function defaultCloudUrl(){if(location.protocol==='https:')return `wss://${location.host}/ws`;if(location.protocol==='http:')return `ws://${location.host}/ws`;return 'ws://localhost:8787/ws'}
function log(t){const e=$('#schoolLog');if(e)e.textContent=`${new Date().toLocaleTimeString()} ${t}\n${e.textContent}`.slice(0,9000)}
function savePrefs(){try{localStorage.setItem('zebjusV182KitQuery',st.query||'');if(st.selectedDeviceId)localStorage.setItem('zebjusV182LastKit',st.selectedDeviceId)}catch{}}
function loadPrefs(){
 st.query=localStorage.getItem('zebjusV182KitQuery')||'';st.cloudUrl=defaultCloudUrl();
 const p=new URLSearchParams(location.search),urlKit=(p.get('kit')||'').trim();st.preferredDeviceId=urlKit;st.preferredDeviceName=(p.get('kitName')||'').trim();st.autoAcquire=p.get('autoconnect')==='1'||!!urlKit;
 if(urlKit){st.query=urlKit;try{localStorage.setItem('zebjusV182KitQuery',urlKit)}catch{}}
 if(!st.preferredDeviceId)st.preferredDeviceId=localStorage.getItem('zebjusV182LastKit')||'';
 if(urlKit&&p.get('autoconnect')==='1')log(`Setup complete. Looking for ${st.preferredDeviceName||st.preferredDeviceId}…`);
}

function setText(id,v){const e=$('#'+id);if(e)e.textContent=v}
function signalText(rssi){if(!Number.isFinite(+rssi))return 'Unknown';rssi=+rssi;if(rssi>=-55)return 'Excellent';if(rssi>=-67)return 'Good';if(rssi>=-75)return 'Weak';return 'Very weak'}
function serviceStatus(){
 const e=$('#simpleServiceStatus');if(e){e.textContent=wsOpen()?'READY':'CONNECTING';e.className=wsOpen()?'good':''}
 const d=selected();const k=$('#simpleKitStatus');if(k){k.textContent=d?(d.online?'ONLINE':'OFFLINE'):'NOT SELECTED';k.className=d?.online?'good':''}
 const c=$('#simpleControlStatus');if(c){c.textContent=!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';c.className=d?.lockMine?'good':d?.locked?'warn':''}
 const n=$('#simpleNetworkStatus');if(n){n.textContent=d?(d.network||d.ssid||'Wi-Fi'):'--'}
}
function targetUi(){
 const devOpt=$('#webJoyTarget option[value="device"]');
 if(devOpt){devOpt.disabled=!(st.remoteBenchRc&&ownsLock());devOpt.textContent=st.remoteBenchRc?(ownsLock()?'REAL KIT • PROP-OFF BENCH':'REAL KIT • TAKE CONTROL FIRST'):'REAL KIT • BENCH DISABLED'}
 const target=$('#webJoyTarget')?.value||'sim';const tb=$('#joyTargetBadge');if(tb){tb.textContent=target==='sim'?'SIMULATOR':'REAL HARDWARE';tb.className='target-mode-badge '+(target==='sim'?'sim':'real')}
 const tn=$('#joyTargetNote');if(tn)tn.textContent=target==='sim'?'Safe local simulation. No real kit commands are sent.':ownsLock()?'Supervised prop-off bench only. You currently hold the kit control lock.':'Real kit is view-only until you take control.';
}
function statusUi(){
 const b=$('#schoolCloudBadge');if(b){b.textContent=wsOpen()?'READY':'CONNECTING';b.className='status '+(wsOpen()?'good':'')}
 const q=$('#kitSearchInput');if(q&&document.activeElement!==q)q.value=st.query;
 const ng=$('#networkGroupBadge');if(ng)ng.textContent=st.networkGroup||'Same network';
 const wr=$('#webJoyRoleBadge');if(wr){wr.textContent='OPEN ACCESS';wr.className='status good'}
 const ss=$('#shareStateBadge');if(ss){const d=selected();ss.textContent=d?.lockMine?'CONTROL':d?.online?'VIEW ONLY':wsOpen()?'READY':'OFFLINE';ss.className='status '+(d?.lockMine?'good':'')}
 targetUi();renderModules();renderSelected();serviceStatus();
}

function connectCloud(){
 if(st.ws)try{st.ws.close()}catch{}
 st.hello=false;st.devices=[];let ws;try{ws=new WebSocket(st.cloudUrl)}catch(e){simpleError('Cannot open kit service.');return}
 st.ws=ws;statusUi();log('Connecting automatically…');
 ws.onopen=()=>send({type:'hello',clientType:'browser'});
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}handleMessage(m)};
 ws.onerror=()=>simpleError('Kit service connection error.');
 ws.onclose=()=>{st.hello=false;st.clientId='';api()?.setFcConnected(false);statusUi();setTimeout(()=>{if(!st.hello)connectCloud()},2200)};
}
function simpleError(msg){st.lastError=msg;log('ERROR: '+msg);const e=$('#simpleErrorStatus');if(e){e.textContent=msg;e.hidden=false}}
function clearError(){st.lastError='';const e=$('#simpleErrorStatus');if(e){e.textContent='';e.hidden=true}}

function handleMessage(m){
 switch(m.type){
  case 'hello_ack':
   if(!m.ok){simpleError(m.error||'Kit service rejected connection.');return}
   st.hello=true;st.clientId=m.clientId||'';st.networkGroup=m.networkGroup||'';st.remoteBenchRc=!!m.remoteBenchRc;st.lockTimeoutMs=+m.lockTimeoutMs||10000;
   clearError();log('Ready. Kits on this network will appear automatically.');statusUi();requestModules();break;
  case 'device_list':
   st.devices=Array.isArray(m.devices)?m.devices:[];st.lockTimeoutMs=+m.lockTimeoutMs||st.lockTimeoutMs;
   reconcileSelection();renderModules();renderSelected();clearError();break;
  case 'lock_result':
   if(m.deviceId===st.selectedDeviceId){
    if(m.ok){log('Control acquired for '+(selected()?.deviceName||m.deviceId));st.lastAcquireAttempt=''}
    else{log(m.error||'Kit is in use. View-only mode active.');st.lastAcquireAttempt=m.deviceId}
    requestModules();
   }
   break;
  case 'lock_heartbeat_ack': if(m.deviceId===st.selectedDeviceId&&!m.ok)requestModules();break;
  case 'lock_released': if(m.deviceId===st.selectedDeviceId){log('Control released: '+(m.reason||'available'));requestModules()}break;
  case 'device_packet':
   if(m.deviceId===st.selectedDeviceId){api()?.receiveDevicePacket(m.packet||{});api()?.setFcConnected(true)}
   if(m.packet?.type==='ack')log(`${m.deviceId}: ${m.packet.message||m.packet.command||'ACK'}`);break;
  case 'error': simpleError(m.error||'Request failed');requestModules();break;
 }
}

function requestModules(){if(wsOpen()){send({type:'list_devices',query:st.query||''});st.lastListAt=performance.now()}}
function searchModules(){st.query=$('#kitSearchInput')?.value.trim()||'';savePrefs();send({type:'search_devices',query:st.query})}
function reconcileSelection(){
 if(st.selectedDeviceId&&!selected())st.selectedDeviceId='';
 if(!st.selectedDeviceId){
  let d=null;
  if(st.preferredDeviceId)d=st.devices.find(x=>x.deviceId===st.preferredDeviceId)||null;
  if(!d&&st.preferredDeviceName)d=st.devices.find(x=>String(x.deviceName).toLowerCase()===st.preferredDeviceName.toLowerCase())||null;
  if(!d&&st.devices.filter(x=>x.online).length===1)d=st.devices.find(x=>x.online)||null;
  if(d){st.selectedDeviceId=d.deviceId;savePrefs();if(st.autoAcquire||st.preferredDeviceId)acquireLock(true)}
 }
 const d=selected();
 if(d?.lockMine)st.lastAcquireAttempt='';
}
function selectDevice(deviceId){
 const old=selected();if(old?.lockMine)releaseLock(false);
 st.selectedDeviceId=deviceId;st.preferredDeviceId=deviceId;st.autoAcquire=true;st.lastAcquireAttempt='';savePrefs();renderModules();renderSelected();
 const d=selected();log('Selected '+(d?.deviceName||deviceId));if(d?.online)acquireLock(true);
}
function acquireLock(auto=false){
 const d=selected();if(!d||!d.online)return false;if(d.lockMine)return true;
 if(auto&&st.lastAcquireAttempt===d.deviceId&&d.locked)return false;
 st.lastAcquireAttempt=d.deviceId;send({type:'acquire_lock',deviceId:d.deviceId});return true;
}
function releaseLock(clearSelection=false){
 const d=selected();if(d?.lockMine)send({type:'release_lock',deviceId:d.deviceId});
 if(clearSelection)st.selectedDeviceId='';st.lastAcquireAttempt='';requestModules();
}

function renderModules(){
 const box=$('#moduleList'),count=$('#moduleCountBadge');if(count)count.textContent=`${st.devices.length} kit${st.devices.length===1?'':'s'}`;if(!box)return;
 if(!wsOpen()){box.innerHTML='<div class="empty-module">Connecting to ZEBJUS kit service…</div>';return}
 if(!st.devices.length){box.innerHTML='<div class="empty-module">No kit found on this network yet. Power the kit, confirm STA Wi-Fi, or clear the search box.</div>';return}
 box.innerHTML=st.devices.map(d=>{
  const sel=d.deviceId===st.selectedDeviceId,ctl=d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';
  return `<button class="module-card ${sel?'selected':''}" data-device="${esc(d.deviceId)}"><span class="module-online-dot ${d.online?'on':''}"></span><div><b>${esc(d.deviceName||d.deviceId)}</b><small>${esc(d.deviceId)}</small><em>${esc(d.network||d.ssid||'Wi-Fi')} • ${Number.isFinite(+d.rssi)?d.rssi+' dBm / '+signalText(d.rssi):'RSSI --'}</em></div><i class="${d.lockMine?'mine':d.locked?'busy':''}">${d.online?ctl:'OFFLINE'}</i></button>`;
 }).join('');
 $$('.module-card').forEach(b=>b.onclick=()=>selectDevice(b.dataset.device));
}

function renderSelected(){
 const d=selected();setText('selectedDeviceName',d?.deviceName||'No kit selected');setText('selectedDeviceId',d?.deviceId||'--');
 setText('selectedDeviceSchool','Open access');setText('selectedDeviceMode',d?.mode||'--');setText('selectedDeviceNetwork',d?.network||d?.ssid||'--');
 setText('selectedDeviceRssi',Number.isFinite(+d?.rssi)?`${d.rssi} dBm • ${signalText(d.rssi)}`:'--');setText('selectedDeviceFirmware',d?.firmware||'--');setText('selectedDeviceLastSeen',d?.lastSeenText||'--');
 setText('selectedDeviceLock',!d?'--':d.lockMine?'YOU CONTROL':d.locked?'VIEW ONLY • IN USE':'AVAILABLE');
 setText('apModeIndicator',d?(String(d.mode||'').toUpperCase().includes('AP')?'ACTIVE':'OFF'):'--');setText('staModeIndicator',d?(String(d.mode||'').toUpperCase().includes('STA')||String(d.mode||'').toUpperCase().includes('INTERNET')?'ACTIVE':'OFF'):'--');
 const online=$('#selectedDeviceOnline');if(online){online.textContent=d?.online?'Online':'Offline';online.className='status '+(d?.online?'good':'')}
 const rename=$('#deviceRenameInput');if(rename&&d&&!rename.matches(':focus'))rename.value=d.deviceName||'';
 const ping=$('#pingSelectedDeviceBtn');if(ping)ping.disabled=!(d&&d.online);
 const renameBtn=$('#renameDeviceBtn');if(renameBtn)renameBtn.disabled=!canControl();
 const take=$('#takeControlBtn');if(take){take.disabled=!(d&&d.online&&!d.lockMine&&!d.locked);take.hidden=!!d?.lockMine;take.textContent=d?.locked?'Kit In Use • View Only':'Take Control'}
 const rel=$('#releaseControlBtn');if(rel){rel.hidden=!d?.lockMine;rel.disabled=!d?.lockMine}
 const jm=$('#joySelectedModule');if(jm)jm.textContent=d?.deviceName||'None';const jl=$('#joyLock');if(jl)jl.textContent=!d?'--':d.lockMine?'CONTROL':d.locked?'VIEW ONLY':'AVAILABLE';
 const jt=$('#webJoyTarget');if(jt&&jt.value==='device'&&!d?.lockMine){jt.value='sim';centerJoy()}
 // Keep simulator fully usable for every student. Hardware commands are blocked by isViewOnly() + server lock.
 api()?.setFcConnected(!!(d&&d.online));statusUiLite();targetUi();
}
function statusUiLite(){serviceStatus();const d=selected();const note=$('#selectedControlNote');if(note)note.textContent=!d?'Select a kit.':d.lockMine?'This browser controls the real kit. Other browsers are view-only.':d.locked?'Another browser controls this kit. You can still view telemetry and use your own simulator.':'Kit is available. Take Control to edit real hardware.'}

function renameDevice(){const d=selected(),name=$('#deviceRenameInput')?.value.trim();if(!d||!name)return log('Select a kit and enter a name.');if(!canControl())return log('View only. Take Control first.');sendDeviceCommand({type:'set_identity',deviceName:name});log(`Kit rename requested: ${name}`)}
function sendDeviceCommand(command){
 const d=selected();if(!d||!d.online)return false;
 if(command?.type!=='ping'&&!d.lockMine){log('VIEW ONLY • Take Control before changing the real kit.');return false}
 send({type:'device_command',deviceId:d.deviceId,command});return true;
}

function setJoyKnob(which,x,y){const k=$(which==='left'?'#webLeftKnob':'#webRightKnob');if(k){k.style.left=`${50+x*31}%`;k.style.top=`${50+y*31}%`}}
function renderJoy(){
 const c=st.joy;setJoyKnob('left',(c[3]-1500)/500,(1500-c[2])/500);setJoyKnob('right',(c[0]-1500)/500,(1500-c[1])/500);
 const l=$('#webLeftRead'),r=$('#webRightRead');if(l)l.textContent=`T ${c[2]} • Y ${Math.round((c[3]-1500)/5)}%`;if(r)r.textContent=`P ${Math.round((c[1]-1500)/5)}% • R ${Math.round((c[0]-1500)/5)}%`;
 const arm=$('#webArmBtn');if(arm){arm.textContent=c[4]>1500?'CH5 ARMED':'CH5 DISARMED';arm.className='btn full '+(c[4]>1500?'danger':'ghost')}
 const m=$('#webMode');if(m)m.value=String(c[5]);const ah=$('#webAltHold');if(ah)ah.checked=c[6]>1500;const bp=$('#webBeeper');if(bp)bp.checked=c[7]>1500;const ch9=$('#webCh9');if(ch9)ch9.value=c[8];const o=$('#webCh9Out');if(o)o.textContent=c[8];const led=$('#webLed');if(led)led.checked=c[9]>1500;
 const g=$('#webChannelGrid');if(g)g.innerHTML=c.map((v,i)=>`<div><span>CH${i+1}</span><b>${v}</b><i style="--p:${(v-1000)/10}%"></i></div>`).join('');targetUi();
}
function bindWebStick(el,which){
 if(!el)return;let drag=false;
 const update=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(e.clientX-cx)/(r.width*.39),dy=(e.clientY-cy)/(r.height*.39),mag=Math.hypot(dx,dy),sc=mag>1?1/mag:1,x=clamp(dx*sc,-1,1),y=clamp(dy*sc,-1,1);if(which==='left'){st.joy[3]=Math.round(1500+x*500);st.joy[2]=Math.round(clamp(1500-y*500,1000,2000))}else{st.joy[0]=Math.round(1500+x*500);st.joy[1]=Math.round(1500-y*500)}renderJoy()};
 el.onpointerdown=e=>{drag=true;try{el.setPointerCapture(e.pointerId)}catch{}update(e)};el.onpointermove=e=>{if(drag)update(e)};
 const up=()=>{if(!drag)return;drag=false;if(which==='left')st.joy[3]=1500;else{st.joy[0]=1500;st.joy[1]=1500}renderJoy()};el.onpointerup=up;el.onpointercancel=up;
}
function centerJoy(){st.joy=[...DEFAULT_CH];renderJoy()}
function initJoystick(){
 bindWebStick($('#webLeftStick'),'left');bindWebStick($('#webRightStick'),'right');renderJoy();
 $('#webArmBtn')?.addEventListener('click',()=>{const target=$('#webJoyTarget')?.value;if(st.joy[4]<1500&&target==='device'){if(!ownsLock()){log('Real kit is view-only. Take Control first.');return}if(!confirm('Real hardware joystick is for supervised PROP-OFF bench testing only. Continue?'))return}st.joy[4]=st.joy[4]>1500?1000:2000;renderJoy()});
 $('#webMode')?.addEventListener('change',e=>{st.joy[5]=+e.target.value;renderJoy()});$('#webAltHold')?.addEventListener('change',e=>{st.joy[6]=e.target.checked?2000:1000;renderJoy()});$('#webBeeper')?.addEventListener('change',e=>{st.joy[7]=e.target.checked?2000:1000;renderJoy()});$('#webCh9')?.addEventListener('input',e=>{st.joy[8]=+e.target.value;renderJoy()});$('#webLed')?.addEventListener('change',e=>{st.joy[9]=e.target.checked?2000:1000;renderJoy()});$('#webJoyCenterBtn')?.addEventListener('click',centerJoy);
 $('#webJoyTarget')?.addEventListener('change',e=>{if(e.target.value==='device'&&!ownsLock()){e.target.value='sim';log('Real kit target requires Take Control. Simulator remains available.')}statusUi()});
}
function joystickTick(now){
 if(api()?.getActiveTab?.()!=='joystick')return;const rate=+($('#webJoyRate')?.value||20),period=1000/Math.max(1,rate);if(now-st.lastJoySent<period)return;st.lastJoySent=now;
 const c=st.joy,target=$('#webJoyTarget')?.value||'sim';
 if(target==='sim'){api()?.controlSim?.({roll:(c[0]-1500)/500,pitch:(c[1]-1500)/500,throttle:c[2],yaw:(c[3]-1500)/500});api()?.setSimRunning?.(true)}
 else if(canControl()&&st.remoteBenchRc)sendDeviceCommand({type:'rc_frame',source:'web-bench',sequence:++st.joySeq,timestamp:Date.now(),channels:[...c]});
}

function periodic(now){
 if(wsOpen()&&now-st.lastListAt>3000)requestModules();
 const d=selected();if(wsOpen()&&d?.lockMine&&now-st.lastLockBeat>3000){st.lastLockBeat=now;send({type:'lock_heartbeat',deviceId:d.deviceId})}
}
function initUi(){
 loadPrefs();initJoystick();
 const q=$('#kitSearchInput');if(q){q.value=st.query;q.addEventListener('keydown',e=>{if(e.key==='Enter')searchModules()});let timer;q.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(searchModules,250)})}
 $('#kitSearchBtn')?.addEventListener('click',searchModules);$('#refreshModulesBtn')?.addEventListener('click',requestModules);
 $('#renameDeviceBtn')?.addEventListener('click',renameDevice);$('#pingSelectedDeviceBtn')?.addEventListener('click',()=>sendDeviceCommand({type:'ping',time:Date.now()}));
 $('#takeControlBtn')?.addEventListener('click',()=>acquireLock(false));$('#releaseControlBtn')?.addEventListener('click',()=>releaseLock(false));
 window.addEventListener('pagehide',()=>{const d=selected();if(d?.lockMine)send({type:'release_lock',deviceId:d.deviceId})});
 statusUi();connectCloud();
}
function loop(t){joystickTick(t);periodic(t);requestAnimationFrame(loop)}
function start(){if(st.booted)return;st.booted=true;initUi();requestAnimationFrame(loop);window.zebjusSchool={sendDeviceCommand,isViewOnly,isCloudActive:()=>wsOpen(),getSelectedDevice:selected,canControl,ownsLock,requestModules,acquireLock,releaseLock,state:st}}

window.addEventListener('zebjus-app-ready',start,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0));else setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0);
})();
