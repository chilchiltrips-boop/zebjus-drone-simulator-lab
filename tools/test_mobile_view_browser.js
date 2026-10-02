'use strict';
// Real APK/WebApp documents; shared simulated controller. No phone/radio/flight test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),port=18790,origin=`http://localhost:${port}`,ID='ZFC-001122334455';
let server,browser,owner='',role='',armed=false,flightMode='ANGLE',pref='AUTO',rc=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];
const calls=[],errors=[],fileExports=[];let writes=0,failTelemetry=0;const output=process.env.ZEBJUS_TEST_OUTPUT||path.join(path.dirname(root),'aerion_r2_checks');
const capabilities={angle:true,rate:true,altitude:false,position:false,inflightModeSwitch:true,inflightHandover:true};
const config={schema:1,maxTilt:50,maxRate:75,gyroHz:60,dtermHz:30,orientation:0,idleUs:1152,maxMotorUs:1952,maxThrottle:1800,modeSwitch:true,handover:true,batteryKind:0,batteryAddress:64,cells:3,batteryFactor:1,lowCell:3.5,criticalCell:3.3};
const pid=Object.fromEntries(['rateRoll','ratePitch','rateYaw','angleRateRoll','angleRatePitch','angleRateYaw','angleRoll','anglePitch'].map(k=>[k,{P:1,I:0,D:0}]));
const calibration={accelOffset:{x:0,y:0,z:0},levelTrim:{roll:0,pitch:0}};
const sensors={imu:{model:'MPU6050',detected:true,fresh:true,gyroCalibrated:true,sixFaceCalibrated:false,usedInFlight:true},barometer:{addressPresent:true,modelVerified:false,fresh:false,usedInFlight:false}};
const status=cid=>({ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,name:'zebjus_drone_1',ip:'192.168.4.1',mode:'AP SETUP',firmware:'18.3.61',boardId:'ZFC-A2',flightCoreIntegrated:true,flightReady:true,webRc:true,armed,benchMode:0,locked:!!owner,lockMine:!!owner&&owner===cid,viewOnly:!!owner&&owner!==cid,controlRole:role,mobileReserved:role==='MOBILE',flightMode,rcSource:'WEB_AP',capabilities,flightSettings:config,sensors});
async function api(address,form='',actor='browser'){
 const u=new URL(address),d=Object.fromEntries(new URLSearchParams(form)),cid=d.clientId||u.searchParams.get('clientId');calls.push({path:u.pathname,type:d.type,actor,...d});let body={ok:true},code=200;
 const reject=(c,m)=>{code=c;body={ok:false,message:m}};
 if(d.expectedDeviceId&&d.expectedDeviceId!==ID)reject(409,'Different Device ID');
 else if(u.pathname==='/api/status')body=status(cid);
 else if(u.pathname==='/api/telemetry'&&failTelemetry>0){failTelemetry--;reject(503,'Transient telemetry failure');}
 else if(u.pathname==='/api/telemetry')body={...status(cid),rc:[...rc],rcAgeMs:10,roll:2,pitch:3,yaw:4,gyroX:5,gyroY:6,gyroZ:7,targetAngle:[10,20],targetRate:[30,40,50],motors:[1200,1201,1202,1203],flightLoopHz:250,loopPeriodUs:4000,maxLoopGapUs:4100,loopOverruns:0,webRcFrameHz:25,ppmFrameHz:50,lastDisarmReason:'CH5 low',batteryValid:true,battery:10.6,batteryLow:true};
 else if(u.pathname==='/api/control/acquire'){if(owner&&owner!==cid&&!(d.clientRole==='MOBILE'&&role!=='MOBILE'&&!armed))reject(423,'Mobile app owns this kit');else{owner=cid;role=d.clientRole||'WEB'}}
 else if(u.pathname==='/api/control/ping'){if(owner!==cid)reject(423,'View only')}
 else if(u.pathname==='/api/control/release'){if(owner===cid){owner=role='';armed=false}}
 else if(u.pathname==='/api/wifi/saved')body={ok:true,profiles:[{ssid:'School',preferred:true},{ssid:'Workshop'}]};
 else if(u.pathname==='/api/wifi/scan')body={ok:true,networks:[{ssid:'School',rssi:-55}]};
 else if(u.pathname==='/api/command'){
  if(['snapshot_get','pid_get','flight_settings_get','diagnostics_get'].includes(d.type))body={...status(cid),pid,calibration,accelScale:[1,1,1],sixFaceValid:false,sixFaceMask:0};
  else if(owner!==cid)reject(423,'VIEW ONLY');
  else if(d.type==='rc_frame'){rc=d.channels.split(',').map(Number);armed=rc[4]>1500;flightMode=rc[5]>=1500?'RATE':'ANGLE';}
  else if(d.type==='rc_source_set'){pref=d.source;}
  else if(armed)reject(423,'Configuration blocked while motors operate');
  else{writes++;if(d.type==='flight_settings_set')for(const key of Object.keys(config))if(key in d)config[key]=Number(d[key]);}
 }else reject(404,'Unknown mock route');
 return {code,body:JSON.stringify(body)};
}
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=(page,f,arg)=>page.waitForFunction(f,arg,{timeout:30000});
(async()=>{
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(timer);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--enable-unsafe-swiftshader','--disable-web-security']});
 const phoneCtx=await browser.newContext({viewport:{width:1000,height:560},hasTouch:true,serviceWorkers:'block'}),phone=await phoneCtx.newPage();
 await phone.exposeFunction('__api',(address,form)=>api(address,form,'mobile'));
 await phone.exposeFunction('__export',(name,body,mime)=>fileExports.push({name,body,mime}));
 await phoneCtx.addInitScript(()=>{window.__aerionToken='test';window.NativeAerion={request(token,id,address,method,form){window.__api(address,form).then(r=>window.AerionAndroid.deliver(id,r.code,r.body))},cancel(){},openWifi(){},joinWifi(){},saveFile(token,name,body,mime){window.__export(name,body,mime)}}});
 phone.on('pageerror',e=>errors.push(e.message));await phone.goto(origin+'/android-app/app/src/main/assets/flight/index.html');
 await phone.screenshot({path:path.join(output,'branding.png')});assert.equal(await phone.locator('#brandSplash').count(),1,'opening brand animation exists');
 await wait(phone,()=>!document.getElementById('heroAction').disabled);await phone.click('#connect');await phone.fill('#expectedId',ID);await phone.fill('#kitAddress','192.168.4.1');await phone.click('#checkConnection');
 await wait(phone,()=>document.getElementById('controlHint').textContent==='MOBILE SESSION');assert.equal(role,'MOBILE');assert(!calls.some(c=>c.type==='rc_frame'),'connect must not start flight frames');assert(!armed);
 const laptopCtx=await browser.newContext({viewport:{width:1374,height:801},serviceWorkers:'block'});
 await laptopCtx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='localhost')return route.continue();if(!['192.168.4.1','zebjus-drone-1.local'].includes(u.hostname))return route.abort();const r=await api(u.href,route.request().postData()||'','laptop');return route.fulfill({status:r.code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:r.body})});
 const laptop=await laptopCtx.newPage();laptop.on('pageerror',e=>errors.push(e.message));await laptop.goto(origin+'/');await wait(laptop,()=>window.zebjusSchool&&window.__zebjusAppLoaded);
 await laptop.click('.tab[data-tab="connect"]');await laptop.fill('#kitSearchInput','zebjus_drone_1');await laptop.fill('#kitCachedIp','192.168.4.1');await laptop.locator('#kitSearchBtn').evaluate(e=>e.click());await wait(laptop,()=>window.__zebjusMobileViewOnly);
 assert(await laptop.locator('#takeControlBtn').isDisabled());await laptop.click('.tab[data-tab="joystick"]');assert(await laptop.locator('#mobileMirrorBanner').isVisible());
 await laptop.locator('#webTxPowerBtn').evaluate(e=>e.click());assert.equal(await laptop.evaluate(()=>window.zebjusSchool.state.txOn),false);
 await phone.click('#heroAction');await wait(phone,()=>document.getElementById('hero').hidden);await phone.click('#arm');await pause(120);assert(armed);const retainedOwner=owner;failTelemetry=1;await phone.keyboard.down('w');await pause(900);await phone.keyboard.up('w');assert(armed);assert.equal(owner,retainedOwner,'one telemetry failure cannot release active control');assert((await phone.locator('#identityHint').textContent()).includes(ID));await phone.keyboard.down('ArrowRight');await pause(150);
 await wait(laptop,()=>window.zebjusSchool.state.joy[0]>1500);assert.equal(await laptop.evaluate(()=>window.zebjusLabAPI.getSimInputOwner()),'receiver');await phone.screenshot({path:path.join(output,'mobile_control.png')});await laptop.screenshot({path:path.join(output,'laptop_mirror.png')});await phone.keyboard.up('ArrowRight');
 await laptop.selectOption('#webJoyTarget','sim');assert(armed,'changing a view target cannot disarm the phone');await laptop.selectOption('#webJoyTarget','device');assert.equal(calls.filter(c=>c.actor==='laptop'&&c.type==='rc_frame').length,0,'laptop cannot publish control frames');
 await phone.click('#kitSettings');assert(armed,'opening settings must keep flight state');await wait(phone,()=>document.querySelector('[data-kc="savePid"]')?.disabled);assert(await phone.locator('[data-kc="saveSettings"]').isDisabled());
 const n=writes;await phone.locator('[data-kc="savePid"]').evaluate(e=>e.click());assert.equal(writes,n,'armed UI cannot mutate PID');
 await phone.locator('[data-close="kitDialog"]').click();await phone.click('#kill');await pause(220);assert(!armed);assert.equal(owner,'');
 // Reconnect is observation only, then explicitly reserve mobile ownership.
 await phone.reload();await pause(600);assert.equal(role,'MOBILE');assert(!armed);await phone.click('#connect');await phone.click('#checkConnection');await wait(phone,()=>document.getElementById('controlHint').textContent==='MOBILE SESSION');
 await phone.click('#kitSettings');await phone.click('[data-kc-tab="0"]');await phone.click('[data-kc="saved"]');await wait(phone,()=>document.querySelector('[data-kc="savedSsid"]').options.length===2);assert.equal(await phone.locator('[data-kc="savedSsid"]').inputValue(),'School');
 await phone.click('[data-kc-tab="1"]');await phone.fill('[data-setting="maxTilt"]','35');await phone.click('[data-kc="saveSettings"]');await pause(250);assert.equal(config.maxTilt,35);
 await phone.screenshot({path:path.join(output,'controls_settings.png')});await phone.click('[data-kc="handover"]');await pause(100);assert.equal(pref,'AUTO');
 await phone.click('[data-kc-tab="3"]');await phone.click('[data-kc="backup"]');await wait(phone,()=>true);await pause(150);const backup=fileExports.find(x=>x.name.endsWith('_settings.json'));assert(backup);const saved=JSON.parse(backup.body);assert.equal(saved.deviceId,ID);assert.equal(saved.flightSettings.maxTilt,35);
 await phone.click('[data-kc-tab="4"]');await pause(700);await phone.click('[data-kc="csv"]');await pause(150);const csv=fileExports.find(x=>x.name.endsWith('_flight.csv'));assert(csv);const lines=csv.body.split('\n');assert(lines.length>1);assert(lines.every(line=>line.split(',').length===lines[0].split(',').length),'CSV preserves column positions');assert(csv.body.includes('targetRate2'));assert((await phone.locator('[data-kc="sensors"]').textContent()).includes('not used in flight'));
 // Bad identity backup must not publish a restore, and refresh stays read-only.
 const invalid={...saved,deviceId:'ZFC-FFEEDDCCBBAA'},beforeRestore=writes;await phone.locator('[data-kc="restoreFile"]').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(invalid))});await wait(phone,()=>document.querySelector('[data-kc="message"]').textContent.includes('match'));assert.equal(writes,beforeRestore);phone.on('dialog',d=>d.accept());await phone.locator('[data-kc="restoreFile"]').setInputFiles({name:'correct.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});await pause(200);assert.equal(writes,beforeRestore+1,'matching complete backup can restore');
 await laptop.reload();await wait(laptop,()=>window.__zebjusMobileViewOnly);assert.equal(await laptop.evaluate(()=>window.zebjusSchool.state.txOn),false);assert(!calls.some(c=>c.actor==='laptop'&&c.path==='/api/control/acquire'),'reload cannot steal mobile lease');
 await phone.evaluate(()=>window.AerionAndroid.pause());await pause(180);assert.equal(owner,'');await phone.evaluate(()=>window.AerionAndroid.resume());await pause(300);assert.equal(owner,'');assert(await phone.locator('#arm').isDisabled());
 // Shared WebApp stick implementation: floating center, ramp and release hold.
 await wait(laptop,()=>!window.__zebjusMobileViewOnly);await laptop.click('.tab[data-tab="joystick"]');await laptop.selectOption('#webJoyTarget','sim');await laptop.locator('#webTxPowerBtn').evaluate(e=>e.click());
 const beforeT=await laptop.evaluate(()=>window.zebjusSchool.state.joy[2]);const box=await laptop.locator('#webLeftStick').boundingBox();await laptop.mouse.move(box.x+box.width/2,box.y+box.height/2);await laptop.mouse.down();await pause(60);assert.equal(await laptop.evaluate(()=>window.zebjusSchool.state.joy[2]),beforeT,'first touch must not jump throttle');await laptop.mouse.move(box.x+box.width/2,box.y+box.height/2-60);await pause(320);const raised=await laptop.evaluate(()=>window.zebjusSchool.state.joy[2]);assert(raised>beforeT&&raised<beforeT+250,'throttle ramps gradually');await laptop.mouse.up();const releasedThrottle=await laptop.evaluate(()=>window.zebjusSchool.state.joy[2]);await pause(100);assert.equal(await laptop.evaluate(()=>window.zebjusSchool.state.joy[2]),releasedThrottle,'release holds throttle');
 await laptop.click('.tab[data-tab="sim"]');assert.equal(await laptop.locator('.aerion-stick-zone').count(),4,'WebApp and Tripod share floating controls');
 assert.deepEqual(errors,[]);console.log('PASS: branding / mobile reservation without ARM / laptop view-only / live stick and Tripod mirror / armed settings blocked / configuration preserves ARM / saved Wi-Fi / limits readback / backup identity / CSV columns / sensor truth / read-only reload and native resume');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM')});
