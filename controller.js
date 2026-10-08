(()=>{'use strict';
const $=id=>document.getElementById(id),clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),now=()=>performance.now(),neutral=()=>[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];
let saved={};try{saved=JSON.parse(localStorage.getItem('aerion-simple-kit')||'{}')}catch{}
const params=new URLSearchParams(location.search),state={base:'',id:params.get('kitId')||saved.deviceId||'',name:'',online:false,own:false,tx:false,busy:false,manual:true,epoch:0,pending:null,cleanup:Promise.resolve(),status:{},channels:neutral(),ack:0,statusAt:0,failures:0,latency:0,timeout:1000,client:'',telemetry:{},setup:null,ackSent:0,armAt:0,wasArmed:false,pidLoaded:false};
let polling=false,pinging=false,lastTick=now();const held=new Set(),axes={left:{x:0,y:0,pointer:null},right:{x:0,y:0,pointer:null}};
function message(text){$('message').textContent=text;}
function origin(value){const u=new URL(value.includes('://')?value:'http://'+value);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Enter the controller IP address or .local name.');return u.origin;}
async function request(base,path,data,timeout=1600,expected=state.id){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{const body=data?new URLSearchParams({...data,...(expected?{expectedDeviceId:expected}:{})}):undefined;
  const r=await fetch(base+path,{method:body?'POST':'GET',body,headers:body?{'Content-Type':'application/x-www-form-urlencoded'}:undefined,cache:'no-store',signal:ctl.signal,aerionTimeout:timeout});
  const j=await r.json();if(!r.ok||j.ok===false){const e=Error(j.message||'Controller request failed.');e.status=r.status;throw e;}if(j.deviceId&&expected&&j.deviceId!==expected){const e=Error('Different controller at this address. Reconnect and verify the kit.');e.status=409;throw e;}return j;
 }catch(e){if(e.name==='AbortError')throw Error('Controller response timed out.');throw e}finally{clearTimeout(timer)}
}
const api=(path,data,timeout)=>request(state.base,path,data?{clientId:state.client,...data}:null,timeout);
function validate(j){if(j.kit!=='ZEBJUS_FLIGHTCORE'||!/^ZFC-[A-Fa-f0-9]{12}$/.test(j.deviceId||''))throw Error('This address is not a ZEBJUS controller.');if(state.id&&j.deviceId!==state.id)throw Error('A different controller was found. Choose Forget kit to connect it.');return j;}
function safe(){state.channels[0]=state.channels[1]=state.channels[3]=1500;state.channels[2]=state.channels[4]=1000;state.armAt=0;state.wasArmed=false;held.clear();for(const side of ['left','right']){axes[side].x=axes[side].y=0;axes[side].pointer=null;draw(side);}render();}
function render(){
 const s=state.status,t=state.telemetry,active=state.own&&state.tx,armed=!!s.armed||state.channels[4]>1500;
 $('linkState').textContent=state.online?'CONNECTED':state.manual?'DISCONNECTED':'RECONNECTING';$('linkState').className=state.online?'online':'offline';
 $('kitName').textContent=state.online?state.name:'Connect your controller';$('kitIdentity').textContent=state.online?state.id+' · '+new URL(state.base).hostname:'AP Wi-Fi or the same local Wi-Fi';
 $('connectionHealth').textContent=!state.online?'Join the controller Wi-Fi, then connect.':s.flightReady?'Controller ready · '+(String(s.mode).startsWith('AP')?'Direct AP Wi-Fi':'Local Wi-Fi'):s.webRc===false?'Sensor bridge connected · motor control unavailable on this board':'Controller connected · IMU / flight setup needs attention';
 $('control').textContent=active?'Release control':'Take control';$('control').disabled=state.busy||!state.online||!!state.setup||s.webRc===false||!!(s.locked&&!s.lockMine&&!state.own);
 $('arm').textContent=armed?'DISARM':'ARM';$('arm').classList.toggle('active',armed);$('arm').disabled=!active||!s.flightReady; $('mode').textContent=state.channels[5]>=1500?'RATE':'ANGLE';$('mode').disabled=!active||armed&&!s.capabilities?.inflightModeSwitch;
 $('throttle').value=state.channels[2];$('throttleValue').textContent=Math.round((state.channels[2]-1000)/10)+'%';$('throttle').disabled=!active||state.channels[4]<1500;
 for(const side of ['left','right'])$(side).setAttribute('aria-disabled',String(!active));
 $('imuValue').textContent=(s.imuModel||t.imu?.model||'--')+' · '+(s.flightReady?'ready':'check');$('angleValue').textContent=Number(t.roll||0).toFixed(1)+'° / '+Number(t.pitch||0).toFixed(1)+'°';$('linkValue').textContent=state.online?Math.round(state.latency)+' ms':'--';$('rateValue').textContent=Number(t.webRcFrameHz||0)+' / '+Number(t.flightLoopHz||0)+' Hz';
 $('flightState').textContent=armed?'ARMED':active?'CONTROL ON':'DISARMED';$('flightState').className=armed?'danger':'online';$('sourceValue').textContent=t.rcSource||s.rcSource||'NONE';$('batteryValue').textContent=t.batteryValid?Number(t.battery).toFixed(2)+' V':'--';
 $('readSettings').disabled=state.busy||!state.online;for(const id of ['gyro','level','savePid','saveWifi','switchAp'])$(id).disabled=state.busy||!state.online||armed||!!state.setup;
 $('stop').disabled=!state.own;$('savePid').disabled=state.busy||!state.online||armed||!!state.setup||!state.pidLoaded||s.pidWritable===false;$('disconnect').disabled=!state.online;$('checkConnection').disabled=state.busy;
}
async function connect(){
 if(state.busy)return;state.busy=true;state.manual=false;const epoch=++state.epoch;render();$('pairMessage').textContent='Connecting…';
 try{await state.cleanup;const typed=$('kitAddress').value.trim(),candidates=[typed&&origin(typed),params.get('kitIp')&&origin(params.get('kitIp')),saved.base,'http://192.168.4.1'].filter(Boolean);let found,last;
  for(const base of [...new Set(candidates)]){try{const j=validate(await request(base,'/api/status',null,1500));if(epoch!==state.epoch)return;found={base,j};break}catch(e){last=e}}
  if(!found)throw last||Error('Controller not found. Join its Wi-Fi and check the IP.');const {base,j}=found;
  state.base=base;state.id=j.deviceId;state.name=j.name||j.deviceName||'FlightCore';state.status=j;state.online=true;state.statusAt=now();state.failures=0;state.channels=neutral();state.channels[5]=j.flightMode==='RATE'?1500:1000;state.timeout=Number(j.rcTimeoutMs)||1000;
  saved={deviceId:state.id,base};try{localStorage.setItem('aerion-simple-kit',JSON.stringify(saved))}catch{}$('expectedId').value=state.id;$('kitAddress').value=base;$('pairMessage').textContent='Connected to '+state.name;if($('connectDialog').open)$('connectDialog').close();message('Connected. Take control to enable sticks. ARM remains manual.');
 }catch(e){if(epoch===state.epoch){state.online=false;$('pairMessage').textContent=e.message;message(e.message)}}finally{if(epoch===state.epoch){state.busy=false;render()}}
}
async function acquire(){
 if(state.own)return;if(!state.online)throw Error('Connect the controller first.');
 const epoch=state.epoch,base=state.base,id=state.id,client='FLY-'+crypto.randomUUID();await state.cleanup;
 const fresh=validate(await request(base,'/api/status',null,1500,id));if(epoch!==state.epoch)throw Error('Connection changed. Connect again.');state.status={...state.status,...fresh};if(fresh.armed)throw Error('Disarm before taking app or browser control.');
 const grant=await request(base,'/api/control/acquire',{clientId:client,clientRole:window.AerionAndroid?'MOBILE':'WEB'},1800,id);
 if(epoch!==state.epoch||!state.online){await request(base,'/api/control/release',{clientId:client},600,id).catch(()=>{});throw Error('Connection changed. Connect again.');}
 state.client=client;state.own=true;state.status.locked=state.status.lockMine=true;state.timeout=Number(grant.rcTimeoutMs)||state.timeout;state.ack=now();safe();
}
function stop(text='Controls stopped. ARM manually after taking control.',offline=false){
 const base=state.base,id=state.id,client=state.client,owned=state.own,pending=state.pending,setup=state.setup;
 state.epoch++;state.busy=false;state.own=state.tx=false;state.pending=null;state.setup=null;if(offline)state.online=false;safe();const safeChannels=state.channels.join(',');
 if(owned)state.cleanup=Promise.allSettled([state.cleanup,pending]).then(async()=>{
  if(setup)await request(base,'/api/command',{clientId:client,type:'setup_end',session:setup.token},650,id).catch(()=>{});
  window.AerionAndroid?.pauseStream?.(base,id,client);
  await request(base,'/api/command',{clientId:client,type:'rc_frame',channels:safeChannels},650,id).catch(()=>{});
  await request(base,'/api/control/release',{clientId:client},650,id).catch(()=>{});
 });message(text);render();
}
async function takeControl(){
 if(state.busy)return;if(state.tx){stop('Control released.');return;}state.busy=true;render();
 try{if(state.own){stop('Preparing stick control.');state.busy=true;}await acquire();const epoch=state.epoch;await api('/api/command',{type:'rc_source_set',source:'WEB'});if(epoch!==state.epoch)return;state.tx=true;state.ack=now();await sendFrame();if(state.tx)message(state.status.flightReady?'Sticks enabled. ARM at minimum throttle.':'Connected and control acquired. Complete IMU setup before ARM.');}catch(e){stop(e.message)}finally{state.busy=false;render()}
}
async function sendFrame(){
 if(!state.tx||!state.own||state.pending)return;const epoch=state.epoch,sent=now(),p=api('/api/command',{type:'rc_frame',channels:state.channels.map(v=>clamp(Math.round(v),1000,2000)).join(',')},350);state.pending=p;
 try{const j=await p;if(epoch!==state.epoch)return;state.ack=now()-(j.rcQueued?Number(j.rcAckAgeMs)||0:0);state.latency=now()-sent;state.ackSent=sent;if(typeof j.flightReady==='boolean')state.status.flightReady=j.flightReady;if(typeof j.armed==='boolean'){if(state.channels[4]>1500&&!j.armed&&(state.wasArmed||now()-state.armAt>1500)){safe();message('Controller disarmed: '+(j.lastDisarmReason||'failsafe')+'. ARM manually.');}state.status.armed=j.armed;if(j.armed)state.wasArmed=true;}render();
 }catch(e){if(epoch===state.epoch&&[400,403,409,423].includes(e.status))stop(e.message,e.status===409)}finally{if(state.pending===p)state.pending=null}
}
function draw(side){const a=axes[side],k=$(side).querySelector('.knob');k.style.left=(50+a.x*32)+'%';k.style.top=(50+a.y*32)+'%';}
function updateAxes(){state.channels[0]=Math.round(1500+axes.right.x*500);state.channels[1]=Math.round(1500-axes.right.y*500);state.channels[3]=Math.round(1500+axes.left.x*500);}
for(const side of ['left','right']){
 const el=$(side),a=axes[side];const move=e=>{const r=el.getBoundingClientRect(),radius=r.width*.32;let x=(e.clientX-r.left-r.width/2)/radius,y=(e.clientY-r.top-r.height/2)/radius,n=Math.hypot(x,y);if(n>1){x/=n;y/=n;}a.x=x;a.y=y;draw(side);updateAxes();};
 el.onpointerdown=e=>{if(!state.tx||a.pointer!==null||e.button>0)return;e.preventDefault();a.pointer=e.pointerId;el.setPointerCapture(e.pointerId);move(e)};el.onpointermove=e=>{if(a.pointer===e.pointerId)move(e)};
 const release=e=>{if(a.pointer!==e.pointerId)return;a.pointer=null;a.x=a.y=0;draw(side);updateAxes();};for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,release);
}
setInterval(()=>{
 const t=now(),dt=clamp((t-lastTick)/1000,0,.08);lastTick=t;if(!state.tx)return;
 if(t-state.ack>clamp(state.timeout-150,250,850)){stop('Control signal lost. Reconnect, then ARM manually.');return;}
 if(axes.right.pointer===null){axes.right.x=(held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0);axes.right.y=(held.has('ArrowDown')?1:0)-(held.has('ArrowUp')?1:0);draw('right');}
 if(axes.left.pointer===null){axes.left.x=(held.has('d')?1:0)-(held.has('a')?1:0);draw('left');}updateAxes();
 let throttle=axes.left.pointer!==null?-axes.left.y:(held.has('w')?1:0)-(held.has('s')?1:0);if(t-state.ack>300&&throttle>0)throttle=0;if(state.channels[4]>1500)state.channels[2]=clamp(state.channels[2]+throttle*250*dt,1000,2000);sendFrame();render();
},40);
async function refresh(){
 if(polling||state.busy||state.manual||document.hidden)return;if(!state.online){if(!state.base)return;polling=true;try{const j=validate(await request(state.base,'/api/status',null,1200));state.status=j;state.online=true;state.failures=0;state.statusAt=now();message('Controller reconnected. Take control, then ARM manually.');render();}catch{}finally{polling=false}return;}
 polling=true;const epoch=state.epoch,sent=now();try{const j=await api('/api/telemetry?clientId='+encodeURIComponent(state.client),null,1500);validate(j);if(epoch!==state.epoch)return;state.telemetry=j;const newerRc=state.tx&&sent<state.ackSent;state.status={...state.status,...j,...(newerRc?{armed:state.status.armed,flightReady:state.status.flightReady,lockMine:true}:{})};state.statusAt=now();state.failures=0;if(!state.tx)state.latency=now()-sent;if(state.own&&!newerRc&&!j.lockMine){stop('Control released by the controller. Take control again.');return;}render();}
 catch(e){if(epoch===state.epoch){if(e.status===409)stop(e.message,true);else if(++state.failures>=5&&now()-state.statusAt>4500)stop('Controller Wi-Fi unavailable. Reconnecting…',true)}}finally{polling=false}
}
setInterval(refresh,1000);
setInterval(async()=>{if(!state.own||state.tx||pinging||document.hidden)return;pinging=true;const epoch=state.epoch;try{await api('/api/control/ping',{},1200)}catch(e){if(epoch===state.epoch&&[403,409,423].includes(e.status))stop(e.message)}finally{pinging=false}},1000);
async function prepareConfiguration(){if(state.status.armed||state.channels[4]>1500)throw Error('Disarm before configuration or firmware update.');if(state.tx){safe();await Promise.resolve(state.pending).catch(()=>{});await sendFrame();state.tx=false;window.AerionAndroid?.pauseStream?.(state.base,state.id,state.client);}await acquire();render();}
const pidNames=['rateRoll','ratePitch','rateYaw','angleRateRoll','angleRatePitch','angleRateYaw','angleRoll','anglePitch'];
for(const name of pidNames){const title=document.createElement('small');title.textContent=name;$('pidFields').append(title);for(const term of ['P','I','D']){const input=document.createElement('input');input.type='number';input.step='any';input.min='0';input.max=term==='I'?'100':'50';input.id='pid-'+name+term;input.setAttribute('aria-label',name+' '+term);$('pidFields').append(input)}}
async function readSettings(){const j=await api('/api/command',{type:'snapshot_get'},3000);for(const name of pidNames)for(const term of ['P','I','D'])$('pid-'+name+term).value=j.pid?.[name]?.[term]??state.status.pid?.[name]?.[term]??0;$('settingsResult').textContent=JSON.stringify({deviceId:state.id,sensors:j.sensors||state.status.sensors,flightSettings:j.flightSettings||state.status.flightSettings},null,2);state.pidLoaded=pidNames.every(name=>['P','I','D'].every(term=>Number.isFinite(Number(j.pid?.[name]?.[term]??state.status.pid?.[name]?.[term]))));message('Controller settings read.');render();}
async function action(fn){if(state.busy)return;state.busy=true;render();try{await fn()}catch(e){message(e.message)}finally{state.busy=false;render()}}
async function calibrate(kind){
 if(!$('props').checked)throw Error('Remove all propellers and tick the confirmation.');await prepareConfiguration();const setup={token:'SETUP-'+crypto.randomUUID(),epoch:state.epoch};state.setup=setup;
 try{const begin=await api('/api/command',{type:'setup_begin',session:setup.token,confirm:'PROPS_REMOVED'},2000);if(!begin.active)throw Error('Controller setup was not confirmed.');await api('/api/command',{type:'setup_calibrate',session:setup.token,kind},2000);
  for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,250));if(state.setup!==setup||state.epoch!==setup.epoch)throw Error('Calibration stopped because the connection changed.');const j=await api('/api/command',{type:'setup_ping',session:setup.token},1800);message('Calibrating '+kind+' · '+(j.samples||0)+' / '+(j.total||0));if(j.job===3)throw Error('Calibration failed. Check IMU wiring and keep the frame still.');if(j.job===2){message(kind+' calibration completed. ARM manually after taking control.');return;}}
  throw Error('Calibration timed out.');
 }finally{if(state.setup===setup){await api('/api/command',{type:'setup_end',session:setup.token},1200).catch(()=>{});state.setup=null;}}
}
function showTab(name){document.querySelectorAll('[data-page]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.page===name)));document.querySelectorAll('main>section').forEach(s=>s.hidden=s.id!=='tab-'+name);if(name!=='fly'&&state.tx)stop('Control paused for settings.');}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>showTab(b.dataset.page));
$('connect').onclick=()=>{if(state.own)stop('Control paused while connecting.');$('kitAddress').value=state.base||saved.base||'192.168.4.1';$('expectedId').value=state.id;$('connectDialog').showModal()};$('closeConnect').onclick=()=>$('connectDialog').close();$('checkConnection').onclick=connect;$('control').onclick=takeControl;$('stop').onclick=()=>stop('STOP requested · controls reset.');
$('arm').onclick=()=>{if(!state.tx)return;if(state.channels[4]>1500||state.status.armed){safe();sendFrame();return;}if(state.channels[2]>1050){message('Lower throttle before ARM.');return;}if(!state.status.flightReady)return;safe();state.channels[4]=2000;state.armAt=now();message('ARM requested. Raise throttle gently after confirmation.');sendFrame();render()};
$('mode').onclick=()=>{state.channels[5]=state.channels[5]>=1500?1000:1500;sendFrame();render()};$('throttle').oninput=e=>{if(state.tx&&state.channels[4]>1500)state.channels[2]=Number(e.target.value);render()};
$('disconnect').onclick=()=>{state.manual=true;stop('Disconnected.',true)};$('forget').onclick=()=>{state.manual=true;stop('Kit forgotten.',true);state.id=state.base='';saved={};try{localStorage.removeItem('aerion-simple-kit')}catch{}$('expectedId').value='';$('kitAddress').value='192.168.4.1';render()};
$('readSettings').onclick=()=>action(readSettings);$('gyro').onclick=()=>action(()=>calibrate('gyro'));$('level').onclick=()=>action(()=>calibrate('level'));
$('savePid').onclick=()=>action(async()=>{await prepareConfiguration();const values={};for(const name of pidNames)for(const term of ['P','I','D']){const v=Number($('pid-'+name+term).value);if(!Number.isFinite(v)||v<0)throw Error('Enter valid PID values.');values[name+term]=v;}await api('/api/command',{type:'pid_set',...values},3000);message('PID saved.');});
$('saveWifi').onclick=()=>action(async()=>{await prepareConfiguration();const ssid=$('wifiSsid').value.trim();if(!ssid)throw Error('Enter the Wi-Fi name.');await api('/api/wifi/set',{ssid,password:$('wifiPassword').value},3000);$('wifiPassword').value='';stop('Wi-Fi saved. Join that network and reconnect.',true);state.manual=true;});
$('switchAp').onclick=()=>action(async()=>{await prepareConfiguration();await api('/api/command',{type:'network_mode_set',mode:'AP'},2500);stop('Direct AP selected. Join the controller Wi-Fi (password 12345678), then reconnect.',true);state.manual=true;});
addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('connectDialog').open){stop('STOP requested · controls reset.');return;}if(!state.tx||e.target.matches('input,textarea,select')||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.length===1?e.key.toLowerCase():e.key;if(['w','s','a','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(k)){e.preventDefault();held.add(k);}if(k==='x')stop('STOP requested · controls reset.');});addEventListener('keyup',e=>held.delete(e.key.length===1?e.key.toLowerCase():e.key));
function leave(){state.manual=true;if(state.own){const base=state.base,id=state.id,client=state.client;stop('Controls paused. Take control and ARM manually.');try{navigator.sendBeacon(base+'/api/command',new URLSearchParams({type:'rc_frame',clientId:client,expectedDeviceId:id,channels:neutral().join(',')}));navigator.sendBeacon(base+'/api/control/release',new URLSearchParams({clientId:client,expectedDeviceId:id}));}catch{}}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)leave()});addEventListener('pagehide',leave);addEventListener('blur',()=>{held.clear();if(!window.AerionAndroid)leave()});
if(window.AerionAndroid){const a=window.AerionAndroid;a.pause=leave;a.stopped=()=>stop('Control signal stopped. Take control again.');a.networkLost=()=>{state.manual=false;stop('Controller Wi-Fi lost. Reconnecting…',true)};a.resume=()=>{state.manual=false;refresh()};a.connectedWifi=()=>{state.manual=false;$('kitAddress').value='192.168.4.1';connect()};a.connectedRouter=()=>{state.manual=false;message('Phone Wi-Fi selected. Enter the controller IP and connect.');};a.openKit=(id,base)=>{if(state.own)leave();state.id=id;$('kitAddress').value=base;connect();};}
window.zebjusSchool={getSelectedDevice:()=>state.online?{...state.status,deviceId:state.id,deviceName:state.name,online:true}:null,canControl:()=>state.own,markOffline:()=>stop('Controller restarting. Reconnecting…',true),refreshNow:refresh,reconnectNow:async()=>{state.manual=false;await refresh();return window.zebjusSchool.getSelectedDevice()},client:{get base(){return state.base},get deviceId(){return state.id},get clientId(){return state.client},get connected(){return state.online},firmwareInfo:()=>api('/api/firmware/info',null,1800),reboot:()=>api('/api/reboot',{},1800)}};
if(window.AerionRelease?.apkAvailable===false){$('apkDownload').hidden=true;const pending=document.createElement('span');pending.textContent='Android APK build pending';$('apkDownload').after(pending);}
window.AerionController={state,connect,takeControl,stop,refresh,prepareConfiguration,request,showTab};$('kitAddress').value=saved.base||'192.168.4.1';$('expectedId').value=state.id;showTab(['setup','firmware'].includes(params.get('tab'))?params.get('tab'):'fly');render();
if(!window.AerionAndroid&&'serviceWorker'in navigator)navigator.serviceWorker.register(location.pathname.includes('/flight/')?'../service-worker.js':'./service-worker.js').catch(()=>{});
})();
