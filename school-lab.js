(function(){
'use strict';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowText=()=>new Date().toLocaleTimeString();
const DEFAULT_CH=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];

const st={
 ws:null,connected:false,hello:false,clientId:'',role:'instructor',userName:'Instructor',schoolId:'SCHOOL-01',labId:'F450-LAB',sessionId:'CLASS-A',cloudUrl:'',
 devices:[],participants:[],selectedDeviceId:'',selectedLockOwner:'',follow:true,remoteBenchRc:false,activity:[],joy:[...DEFAULT_CH],joySeq:0,lastJoySent:0,lastSimSent:0,lastPresentationSent:'',lastPresentationAt:0,
 remoteJoy:[...DEFAULT_CH],booted:false
};

function api(){return window.zebjusLabAPI||null}
function wsOpen(){return st.ws&&st.ws.readyState===WebSocket.OPEN&&st.hello}
function selected(){return st.devices.find(d=>d.deviceId===st.selectedDeviceId)||null}
function isMineLocked(d=selected()){return !!(d&&d.lockOwnerClientId&&d.lockOwnerClientId===st.clientId)}
function canControl(){return st.role==='instructor'&&wsOpen()&&isMineLocked()}
function send(obj){if(!st.ws||st.ws.readyState!==WebSocket.OPEN)return false;st.ws.send(JSON.stringify(obj));return true}
function defaultCloudUrl(){
 const saved=localStorage.getItem('zebjusV18CloudUrl');if(saved)return saved;
 if(location.protocol==='https:')return `wss://${location.host}/ws`;
 if(location.protocol==='http:')return `ws://${location.host}/ws`;
 return 'ws://localhost:8787/ws';
}
function log(t){const e=$('#schoolLog');if(e)e.textContent=`${nowText()} ${t}\n${e.textContent}`.slice(0,10000)}
function feed(t,remote=false){
 const item={time:nowText(),text:String(t),remote};st.activity.unshift(item);st.activity=st.activity.slice(0,18);renderActivity();
 const joy=$('#joyEventFeed');if(joy)joy.innerHTML=st.activity.slice(0,8).map(x=>`<div><small>${esc(x.time)}</small><span>${esc(x.text)}</span></div>`).join('')||'No classroom events yet.';
}
function renderActivity(){const e=$('#classActivity');if(e)e.innerHTML=st.activity.map(x=>`<div><small>${esc(x.time)}</small><span>${esc(x.text)}</span></div>`).join('')||'Waiting for classroom activity.'}
function savePrefs(){
 const data={role:st.role,userName:st.userName,schoolId:st.schoolId,labId:st.labId,sessionId:st.sessionId,cloudUrl:st.cloudUrl};
 localStorage.setItem('zebjusV18SchoolPrefs',JSON.stringify(data));localStorage.setItem('zebjusV18CloudUrl',st.cloudUrl||'');
}
function loadPrefs(){
 try{const p=JSON.parse(localStorage.getItem('zebjusV18SchoolPrefs')||'null');if(p)Object.assign(st,p)}catch{}
 st.cloudUrl=st.cloudUrl||defaultCloudUrl();
}
function syncInputs(){
 const map={schoolRole:'role',schoolUserName:'userName',schoolId:'schoolId',labId:'labId',sessionId:'sessionId',cloudWsUrl:'cloudUrl'};
 Object.entries(map).forEach(([id,k])=>{const e=$('#'+id);if(e)e.value=st[k]||''});
 const f=$('#followInstructor');if(f)f.checked=st.follow;
 roleUi();
}
function readInputs(){
 st.role=$('#schoolRole')?.value||'instructor';st.userName=$('#schoolUserName')?.value.trim()||'User';st.schoolId=$('#schoolId')?.value.trim()||'SCHOOL-01';st.labId=$('#labId')?.value.trim()||'F450-LAB';st.sessionId=$('#sessionId')?.value.trim()||'CLASS-A';st.cloudUrl=$('#cloudWsUrl')?.value.trim()||defaultCloudUrl();st.follow=!!$('#followInstructor')?.checked;savePrefs()
}
function roleUi(){
 document.body.classList.toggle('classroom-student',st.role==='student');document.body.classList.toggle('classroom-instructor',st.role==='instructor');
 const pin=$('#instructorPinLabel');if(pin)pin.hidden=st.role!=='instructor';
 api()?.setViewOnly(st.role==='student');
 const rb=$('#classRoleBadge');if(rb){rb.textContent=st.role==='student'?'STUDENT • VIEW ONLY':'INSTRUCTOR';rb.className='role-badge '+st.role}
 const wr=$('#webJoyRoleBadge');if(wr){wr.textContent=st.role==='student'?'VIEW ONLY':(wsOpen()?'INSTRUCTOR':'LOCAL');wr.className='status '+(st.role==='student'?'':'good')}
 const jr=$('#joyClassRole');if(jr)jr.textContent=st.role==='student'?'Student view only':'Instructor';
}
function statusUi(){
 const b=$('#schoolCloudBadge');if(b){b.textContent=wsOpen()?'Online':'Offline';b.className='status '+(wsOpen()?'good':'')}
 const sb=$('#classSessionBadge');if(sb)sb.textContent=wsOpen()?`${st.schoolId} / ${st.labId} / ${st.sessionId}`:'No session';
 const sh=$('#classShareBadge');if(sh){sh.textContent=wsOpen()&&st.role==='instructor'?'Sharing live':'Share off';sh.className='status '+(wsOpen()&&st.role==='instructor'?'good':'')}
 const js=$('#joySession');if(js)js.textContent=wsOpen()?st.sessionId:'--';
 const ss=$('#shareStateBadge');if(ss){ss.textContent=wsOpen()?(st.role==='instructor'?'Sharing':'Following'):'Offline';ss.className='status '+(wsOpen()?'good':'')}
 roleUi();const devOpt=$('#webJoyTarget option[value="device"]');if(devOpt){devOpt.disabled=wsOpen()&&!st.remoteBenchRc;devOpt.textContent=st.remoteBenchRc?'Selected Module • Bench':'Selected Module • Bench (server disabled)'}renderSelected();renderParticipants();renderModules();
}

function connectSchool(){
 readInputs();disconnectSchool(true);
 let ws;try{ws=new WebSocket(st.cloudUrl)}catch(e){log('Cloud URL error: '+e.message);return}
 st.ws=ws;log('Connecting '+st.cloudUrl+' …');
 ws.onopen=()=>{
   const hello={type:'hello',clientType:'browser',role:st.role,userName:st.userName,schoolId:st.schoolId,labId:st.labId,sessionId:st.sessionId};
   if(st.role==='instructor')hello.instructorPin=$('#instructorPin')?.value||'';
   send(hello)
 };
 ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return}handleMessage(m)};
 ws.onerror=()=>log('WebSocket error');
 ws.onclose=e=>{st.connected=false;st.hello=false;st.clientId='';api()?.setFcConnected(false);api()?.setRemoteFollower(false);log(`Cloud disconnected (${e.code})`);statusUi()}
}
function disconnectSchool(close=true){
 if(close&&st.ws)try{st.ws.close(1000,'User left')}catch{}st.ws=null;st.connected=false;st.hello=false;st.clientId='';st.devices=[];st.participants=[];st.selectedDeviceId='';api()?.setFcConnected(false);api()?.setRemoteFollower(false);statusUi()
}
function handleMessage(m){
 switch(m.type){
  case 'hello_ack':
   if(!m.ok){log('Join rejected: '+(m.error||'Unknown'));try{st.ws.close()}catch{};return}
   st.hello=true;st.connected=true;st.clientId=m.clientId||'';st.remoteBenchRc=!!m.remoteBenchRc;log(`Joined as ${st.role} • ${st.sessionId}`);feed(`${st.userName} joined classroom`);statusUi();requestModules();break;
  case 'error': log('ERROR: '+(m.error||'Request failed'));feed(m.error||'Request failed',true);break;
  case 'device_list': st.devices=Array.isArray(m.devices)?m.devices:[];if(st.selectedDeviceId&&!selected())st.selectedDeviceId='';renderModules();renderSelected();break;
  case 'participant_list': st.participants=Array.isArray(m.participants)?m.participants:[];renderParticipants();break;
  case 'device_locked': case 'device_released': case 'device_meta': requestModules();feed(m.message||`${m.deviceId} updated`,true);break;
  case 'device_packet':
   if(m.deviceId===st.selectedDeviceId){api()?.receiveDevicePacket(m.packet||{});api()?.setFcConnected(true)}
   if(m.packet?.type==='ack'||m.packet?.type==='event')feed(`${m.deviceId}: ${m.packet.message||m.packet.type}`,true);
   break;
  case 'device_offline': requestModules();if(m.deviceId===st.selectedDeviceId)api()?.setFcConnected(false);feed(`${m.deviceId} offline`,true);break;
  case 'sim_state':
   if(st.role==='student'&&st.follow){api()?.setRemoteFollower(true);api()?.applyRemoteSimState(m.state||{});if(m.state?.pid)api()?.applyPid(m.state.pid)}
   break;
  case 'joystick_state':
   if(st.role==='student'&&st.follow&&Array.isArray(m.channels)){st.remoteJoy=m.channels.slice(0,10);st.joy=[...st.remoteJoy];renderJoy();}
   break;
  case 'presentation_state':
   if(st.role==='student'&&st.follow){if(m.state?.tab)api()?.setActiveTab(m.state.tab);if(m.state?.pid)api()?.applyPid(m.state.pid);if(m.state?.selectedDeviceId){st.selectedDeviceId=m.state.selectedDeviceId;renderModules();renderSelected()}}
   break;
  case 'activity': feed(`${m.userName||'Instructor'}: ${m.message||''}`,true);break;
  case 'lock_denied': log(m.error||'Device already locked');feed(m.error||'Lock denied',true);requestModules();break;
 }
}
function requestModules(){send({type:'list_devices'})}

function renderModules(){
 const box=$('#moduleList'),count=$('#moduleCountBadge');if(count)count.textContent=`${st.devices.length} module${st.devices.length===1?'':'s'}`;if(!box)return;
 if(!wsOpen()){box.innerHTML='<div class="empty-module">Join a classroom to discover modules.</div>';return}
 if(!st.devices.length){box.innerHTML='<div class="empty-module">No online modules registered for this School / Lab.</div>';return}
 box.innerHTML=st.devices.map(d=>{
   const sel=d.deviceId===st.selectedDeviceId,locked=d.lockOwnerName?`Locked: ${esc(d.lockOwnerName)}`:'Available';
   return `<button class="module-card viewer-allowed ${sel?'selected':''}" data-device="${esc(d.deviceId)}"><span class="module-online-dot ${d.online?'on':''}"></span><div><b>${esc(d.deviceName||d.deviceId)}</b><small>${esc(d.deviceId)}</small><em>${esc(d.mode||'STA')} • ${Number.isFinite(+d.rssi)?d.rssi+' dBm':'RSSI --'} • ${locked}</em></div><i>${d.online?'ONLINE':'OFFLINE'}</i></button>`
 }).join('');
 $$('.module-card').forEach(b=>b.onclick=()=>{st.selectedDeviceId=b.dataset.device;renderModules();renderSelected();if(st.role==='instructor')broadcastPresentation(true)})
}
function renderSelected(){
 const d=selected();
 const set=(id,v)=>{const e=$('#'+id);if(e)e.textContent=v};
 set('selectedDeviceName',d?.deviceName||'No module selected');set('selectedDeviceId',d?.deviceId||'--');set('selectedDeviceSchool',d?`${d.schoolId||st.schoolId} / ${d.labId||st.labId}`:'--');set('selectedDeviceMode',d?.mode||'--');set('selectedDeviceNetwork',d?.network||d?.ssid||'--');set('selectedDeviceRssi',Number.isFinite(+d?.rssi)?`${d.rssi} dBm`:'--');set('selectedDeviceFirmware',d?.firmware||'--');set('selectedDeviceLastSeen',d?.lastSeenText||'--');set('selectedDeviceLock',d?(d.lockOwnerName||'Available'):'--');set('apModeIndicator',d?(String(d.mode||'').toUpperCase().includes('AP')?'ACTIVE':'OFF'):'--');set('staModeIndicator',d?(String(d.mode||'').toUpperCase().includes('STA')||String(d.mode||'').toUpperCase().includes('INTERNET')?'ACTIVE':'OFF'):'--');
 const online=$('#selectedDeviceOnline');if(online){online.textContent=d?.online?'Online':'Offline';online.className='status '+(d?.online?'good':'')}
 const rename=$('#deviceRenameInput');if(rename&&d&&!rename.matches(':focus'))rename.value=d.deviceName||'';
 const lock=$('#lockDeviceBtn');if(lock){lock.disabled=!d||!d.online||st.role!=='instructor';lock.textContent=isMineLocked(d)?'Connected / Locked':'Lock & Connect'}
 const rel=$('#releaseDeviceBtn');if(rel)rel.disabled=!isMineLocked(d);
 const ping=$('#pingSelectedDeviceBtn');if(ping)ping.disabled=!isMineLocked(d);
 const jm=$('#joySelectedModule');if(jm)jm.textContent=d?.deviceName||'None';const jl=$('#joyLock');if(jl)jl.textContent=d?(isMineLocked(d)?'Instructor':(d.lockOwnerName||'Available')):'--';
 api()?.setFcConnected(!!(d&&d.online));
}
function renderParticipants(){
 const box=$('#participantList'),count=$('#participantCount');if(count)count.textContent=String(st.participants.length);if(!box)return;
 if(!st.participants.length){box.innerHTML='<div class="empty-module">No participants.</div>';return}
 box.innerHTML=st.participants.map(p=>`<div class="participant-row"><span class="participant-dot ${p.role==='instructor'?'teacher':''}"></span><div><b>${esc(p.userName)}</b><small>${p.role==='instructor'?'Instructor':'Student • View only'}</small></div><i>${p.clientId===st.clientId?'YOU':''}</i></div>`).join('')
}
function lockDevice(){const d=selected();if(!d||st.role!=='instructor')return;send({type:'lock_device',deviceId:d.deviceId})}
function releaseDevice(){const d=selected();if(!d||st.role!=='instructor')return;send({type:'release_device',deviceId:d.deviceId})}
function renameDevice(){const d=selected(),name=$('#deviceRenameInput')?.value.trim();if(!d||!name||!canControl())return log('Lock the module before renaming.');sendDeviceCommand({type:'set_identity',deviceName:name});feed(`Rename requested: ${name}`);sendActivity(`Renamed / configured module ${d.deviceId} as ${name}`)}
function sendDeviceCommand(command){
 const d=selected();if(!d||!canControl())return false;
 send({type:'device_command',deviceId:d.deviceId,command});if(command?.type&&command.type!=='rc_frame'&&command.type!=='ping')sendActivity(`${command.type} → ${d.deviceName||d.deviceId}`);return true
}
function sendActivity(message){if(wsOpen()&&st.role==='instructor')send({type:'activity',message:String(message)})}

function presentationState(){return{tab:api()?.getActiveTab?.()||'assembly',selectedDeviceId:st.selectedDeviceId,pid:api()?.getPid?.()||null}}
function broadcastPresentation(force=false){
 if(!wsOpen()||st.role!=='instructor')return;const p=presentationState(),key=JSON.stringify(p);if(force||key!==st.lastPresentationSent){st.lastPresentationSent=key;send({type:'presentation_state',state:p})}
}
function broadcastSim(now){
 if(!wsOpen()||st.role!=='instructor'||now-st.lastSimSent<100)return;st.lastSimSent=now;const sim=api()?.getSimState?.();if(sim){sim.pid=api()?.getPid?.();send({type:'sim_state',state:sim})}
}

function setJoyKnob(which,x,y){const k=$(which==='left'?'#webLeftKnob':'#webRightKnob');if(k){k.style.left=`${50+x*31}%`;k.style.top=`${50+y*31}%`}}
function renderJoy(){
 const c=st.joy;setJoyKnob('left',(c[3]-1500)/500,(1500-c[2])/500);setJoyKnob('right',(c[0]-1500)/500,(1500-c[1])/500);
 const l=$('#webLeftRead'),r=$('#webRightRead');if(l)l.textContent=`T ${c[2]} • Y ${Math.round((c[3]-1500)/5)}%`;if(r)r.textContent=`P ${Math.round((c[1]-1500)/5)}% • R ${Math.round((c[0]-1500)/5)}%`;
 const arm=$('#webArmBtn');if(arm){arm.textContent=c[4]>1500?'CH5 ARMED':'CH5 DISARMED';arm.className='btn full '+(c[4]>1500?'danger':'ghost')}
 const m=$('#webMode');if(m)m.value=String(c[5]);const ah=$('#webAltHold');if(ah)ah.checked=c[6]>1500;const bp=$('#webBeeper');if(bp)bp.checked=c[7]>1500;const ch9=$('#webCh9');if(ch9)ch9.value=c[8];const o=$('#webCh9Out');if(o)o.textContent=c[8];const led=$('#webLed');if(led)led.checked=c[9]>1500;
 const g=$('#webChannelGrid');if(g)g.innerHTML=c.map((v,i)=>`<div><span>CH${i+1}</span><b>${v}</b><i style="--p:${(v-1000)/10}%"></i></div>`).join('')
}
function bindWebStick(el,which){if(!el)return;let drag=false;const update=e=>{if(st.role==='student')return;const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(e.clientX-cx)/(r.width*.39),dy=(e.clientY-cy)/(r.height*.39),mag=Math.hypot(dx,dy),sc=mag>1?1/mag:1,x=clamp(dx*sc,-1,1),y=clamp(dy*sc,-1,1);if(which==='left'){st.joy[3]=Math.round(1500+x*500);st.joy[2]=Math.round(clamp(1500-y*500,1000,2000));}else{st.joy[0]=Math.round(1500+x*500);st.joy[1]=Math.round(1500-y*500)}renderJoy()};el.onpointerdown=e=>{if(st.role==='student')return;drag=true;try{el.setPointerCapture(e.pointerId)}catch{}update(e)};el.onpointermove=e=>{if(drag)update(e)};const up=()=>{if(!drag)return;drag=false;if(which==='left')st.joy[3]=1500;else{st.joy[0]=1500;st.joy[1]=1500}renderJoy()};el.onpointerup=up;el.onpointercancel=up}
function centerJoy(){st.joy=[...DEFAULT_CH];renderJoy()}
function initJoystick(){
 bindWebStick($('#webLeftStick'),'left');bindWebStick($('#webRightStick'),'right');renderJoy();
 $('#webArmBtn')?.addEventListener('click',()=>{if(st.role==='student')return;const target=$('#webJoyTarget')?.value;if(st.joy[4]<1500&&target==='device'){if(!confirm('Remote Internet joystick is for supervised BENCH use only. Props must be removed. Continue with ARM channel?'))return}st.joy[4]=st.joy[4]>1500?1000:2000;renderJoy()});
 $('#webMode')?.addEventListener('change',e=>{st.joy[5]=+e.target.value;renderJoy()});$('#webAltHold')?.addEventListener('change',e=>{st.joy[6]=e.target.checked?2000:1000;renderJoy()});$('#webBeeper')?.addEventListener('change',e=>{st.joy[7]=e.target.checked?2000:1000;renderJoy()});$('#webCh9')?.addEventListener('input',e=>{st.joy[8]=+e.target.value;renderJoy()});$('#webLed')?.addEventListener('change',e=>{st.joy[9]=e.target.checked?2000:1000;renderJoy()});$('#webJoyCenterBtn')?.addEventListener('click',centerJoy);
}
function joystickTick(now){
 if(st.role==='student'||api()?.getActiveTab?.()!=='joystick')return;const rate=+( $('#webJoyRate')?.value||20),period=1000/Math.max(1,rate);if(now-st.lastJoySent<period)return;st.lastJoySent=now;
 const c=st.joy,target=$('#webJoyTarget')?.value||'sim';
 if(target==='sim'){
  api()?.controlSim?.({roll:(c[0]-1500)/500,pitch:(c[1]-1500)/500,throttle:c[2],yaw:(c[3]-1500)/500});api()?.setSimRunning?.(true)
 }else if(canControl()&&st.remoteBenchRc)sendDeviceCommand({type:'rc_frame',source:'web-bench',sequence:++st.joySeq,timestamp:Date.now(),channels:[...c]});
 if(wsOpen())send({type:'joystick_state',channels:[...c],target})
}

function initUi(){
 loadPrefs();syncInputs();initJoystick();
 $('#schoolRole')?.addEventListener('change',e=>{st.role=e.target.value;roleUi();savePrefs()});
 $('#followInstructor')?.addEventListener('change',e=>{st.follow=e.target.checked;if(!st.follow)api()?.setRemoteFollower(false)});
 $('#schoolConnectBtn')?.addEventListener('click',connectSchool);$('#schoolDisconnectBtn')?.addEventListener('click',()=>disconnectSchool(true));$('#refreshModulesBtn')?.addEventListener('click',requestModules);
 $('#lockDeviceBtn')?.addEventListener('click',lockDevice);$('#releaseDeviceBtn')?.addEventListener('click',releaseDevice);$('#renameDeviceBtn')?.addEventListener('click',renameDevice);$('#pingSelectedDeviceBtn')?.addEventListener('click',()=>sendDeviceCommand({type:'ping',time:Date.now()}));
 document.querySelector('.tabs')?.addEventListener('click',e=>{const b=e.target.closest('.tab');if(!b)return;if(st.role==='instructor'&&wsOpen()){broadcastPresentation(true);sendActivity(`Opened ${b.textContent.trim()}`)}});
 statusUi();
}
function loop(t){
 if(st.booted){broadcastSim(t);joystickTick(t);if(t-st.lastPresentationAt>650){st.lastPresentationAt=t;broadcastPresentation(false)}}requestAnimationFrame(loop)
}
function start(){if(st.booted)return;st.booted=true;initUi();requestAnimationFrame(loop);window.zebjusSchool={sendDeviceCommand,isViewOnly:()=>st.role==='student',isCloudActive:()=>wsOpen(),getSelectedDevice:selected,canControl,requestModules,state:st};}

window.addEventListener('zebjus-app-ready',start,{once:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0));else setTimeout(()=>{if(window.__zebjusAppLoaded)start()},0);
})();
