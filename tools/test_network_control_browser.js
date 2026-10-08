'use strict';
// Installed APK UI and WebApp with simulated native Wi-Fi and controller APIs.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),port=18793,origin=`http://localhost:${port}`,ID='ZFC-001122334455';
let server,browser,mode='AP / DIRECT',owner='',role='',source='NONE',rc=[1500,1500,1000,1500,1000,1000,1000,1000,1500,1000];
const calls=[],errors=[];
const wait=async(p,f)=>{try{return await p.waitForFunction(f,null,{timeout:25000})}catch(e){console.error('UI:',await p.evaluate(()=>({hint:document.getElementById('controlHint')?.textContent,network:document.getElementById('networkLabel')?.textContent,notice:document.getElementById('notice')?.textContent})));console.error('Recent calls:',calls.filter(c=>c.actor==='phone').slice(-12));throw e}};
const status=cid=>({ok:true,securityRequired:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,name:'zebjus_drone_1',ip:mode.startsWith('AP')?'192.168.4.1':'10.0.0.20',mode,boardId:'ZFC-A2',firmware:'18.3.62',flightReady:true,flightCoreIntegrated:true,webRc:true,armed:false,benchMode:0,locked:!!owner,lockMine:owner===cid,controlRole:role,mobileReserved:role==='MOBILE',viewOnly:!!owner&&owner!==cid,flightMode:'ANGLE',rcSource:source,receiverHealth:source==='PPM'?'OK':'NOT_FOUND',capabilities:{angle:true,rate:true,altitude:false}});
async function api(address,form='',actor='phone'){
 const u=new URL(address),d=Object.fromEntries(new URLSearchParams(form)),cid=d.clientId||u.searchParams.get('clientId');calls.push({actor,path:u.pathname,...d});let code=200,body={ok:true};
 const fail=(c,m)=>{code=c;body={ok:false,message:m}};
 const reachable=mode.startsWith('AP')?u.hostname==='192.168.4.1':['10.0.0.20','zebjus-drone-1.local'].includes(u.hostname);
 if(!reachable)fail(503,'Kit address is not on this network');
 else if(d.expectedDeviceId&&d.expectedDeviceId!==ID)fail(409,'Different Device ID');
 else if(u.pathname==='/api/status')body=status(cid);
 else if(u.pathname==='/api/telemetry')body={...status(cid),rc:[...rc],rcAgeMs:source==='NONE'?999999:10,ppmFrameHz:source==='PPM'?50:0,webRcFrameHz:0,flightLoopHz:250};
 else if(u.pathname==='/api/control/acquire'){if(owner&&owner!==cid)fail(423,'Kit owned by another session');else{owner=cid;role=d.clientRole||'WEB';body={ok:true,deviceId:ID,lockMine:true,controlRole:role,lockTimeoutMs:10000}}}
 else if(u.pathname==='/api/control/ping'){if(owner!==cid)fail(423,'View only')}
 else if(u.pathname==='/api/control/release'){if(owner===cid)owner=role=''}
 else if(u.pathname==='/api/wifi/saved')body={ok:true,profiles:[{ssid:'School',preferred:true}]};
 else if(u.pathname==='/api/wifi/use'){if(owner!==cid)fail(423,'View only');else{mode='STA / LOCAL';owner=role=''}}
 else if(u.pathname==='/api/command'&&d.type==='network_mode_set'){if(owner!==cid)fail(423,'View only');else{mode='AP / DIRECT';owner=role=''}}
 else if(u.pathname==='/api/command'&&d.type==='rc_frame'){if(owner!==cid)fail(423,'View only');else{rc=d.channels.split(',').map(Number);source=mode.startsWith('AP')?'WEB_AP':'WEB_STA'}}
 else if(u.pathname==='/api/command')body=status(cid);
 else fail(404,'API only');
 return {code,body:JSON.stringify(body)};
}
(async()=>{
 const ino=fs.readFileSync(path.join(root,'FlightCore_Firmware/ZEBJUS_FLIGHTCORE.ino'),'utf8');
 assert(ino.includes('server.on("/",HTTP_GET,wifiSetupPage)'));assert(ino.includes('server.on("/setup",HTTP_GET,wifiSetupPage)'));assert(ino.includes('server.send(204)'));assert(fs.readFileSync(path.join(root,'FlightCore_Firmware/WIFI_SETUP_PAGE.h'),'utf8').includes('/api/setup/test'));
 for(const rel of ['tools/ap_portal_source.html','tools/ap_io_source.html','tools/ap_fly_source.html','FlightCore_Firmware/AP_ASSETS.h'])assert(!fs.existsSync(path.join(root,rel)),'removed AP asset '+rel);
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(t);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--enable-unsafe-swiftshader','--disable-web-security']});
 const phoneCtx=await browser.newContext({viewport:{width:1000,height:560},hasTouch:true,serviceWorkers:'block'}),phone=await phoneCtx.newPage();await phone.exposeFunction('__api',(a,b)=>api(a,b));
 await require('./browser_pairing_double').install(phoneCtx);await phoneCtx.addInitScript(()=>{window.__aerionToken='test';window.__networkCalls={router:0,ap:0};window.NativeAerion={offerInput(){},request(token,id,address,method,form){window.__api(address,form).then(r=>window.AerionAndroid.deliver(id,r.code,r.body))},cancel(){},saveFile(){},openWifi(){},useRouterWifi(key,ssid,fromAp){window.__routerChoice={ssid,fromAp};window.__networkCalls.router++;setTimeout(()=>window.AerionAndroid.routerReady(),0)},joinWifi(){window.__networkCalls.ap++;setTimeout(()=>window.AerionAndroid.wifiReady(),0)}}});
 phone.on('pageerror',e=>errors.push(e.message));await phone.goto(origin+'/android-app/app/src/main/assets/flight/index.html');await wait(phone,()=>document.getElementById('controlHint').textContent==='MOBILE SESSION');assert.equal(role,'MOBILE');assert.equal(calls.filter(x=>x.type==='rc_frame').length,0);
 const laptopCtx=await browser.newContext({viewport:{width:1374,height:801},serviceWorkers:'block'});await require('./browser_pairing_double').install(laptopCtx);await laptopCtx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.hostname==='localhost')return route.continue();const r=await api(u.href,route.request().postData()||'','laptop');return route.fulfill({status:r.code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:r.body})});
 const laptop=await laptopCtx.newPage();laptop.on('pageerror',e=>errors.push(e.message));await laptop.goto(origin+'/');await wait(laptop,()=>window.zebjusSchool?.isKitActive?.()&&window.__zebjusMobileViewOnly);
 await laptop.exposeFunction('__observer',()=>({...status('observer'),type:'rc_live',controllerMs:Date.now(),trainingRunId:0,trainingActive:false,outputsBlocked:false,trainingTarget:'NONE',rc:[...rc],rcAgeMs:10,rcSource:source}));
 await laptop.evaluate(()=>{window.__observerTimer=setInterval(async()=>{const t=await window.__observer();zebjusSchool.rcMonitor.packet(t);},100);});
 assert.equal(await laptop.locator('#webTxPowerText').textContent(),'ON');assert.equal(await laptop.evaluate(()=>zebjusSchool.state.txOn),false);assert(await laptop.locator('#topControlToggle').isDisabled(),'mobile ownership makes laptop observer-only');
 await phone.click('#networkMode');await wait(phone,()=>document.getElementById('networkLabel').textContent.includes('STA')&&document.getElementById('controlHint').textContent==='MOBILE SESSION');assert.equal(mode,'STA / LOCAL');assert.equal(await phone.evaluate(()=>__networkCalls.router),1);assert.deepEqual(await phone.evaluate(()=>__routerChoice),{ssid:'School',fromAp:true});assert((await phone.locator('#identityHint').textContent()).includes(ID));assert(await phone.locator('#arm').isDisabled());
 await phone.click('#networkMode');await wait(phone,()=>document.getElementById('networkLabel').textContent.includes('AP')&&document.getElementById('controlHint').textContent==='MOBILE SESSION');assert.equal(mode,'AP / DIRECT');assert.equal(await phone.evaluate(()=>__networkCalls.ap),1);assert.equal(calls.filter(x=>x.type==='rc_frame').length,0);
 source='PPM';rc=[1720,1370,1450,1600,1000,1000,1000,1000,1500,1000];await phone.click('#kill');await wait(laptop,()=>zebjusSchool.state.remoteTxSource==='PPM'&&!window.__zebjusMobileViewOnly);
 assert.equal(await laptop.locator('#webTxPowerText').textContent(),'ON');assert.equal(await laptop.evaluate(()=>zebjusSchool.state.joy[2]),1450);assert.equal(await laptop.evaluate(()=>zebjusLabAPI.getSimInputOwner()),'receiver');assert.equal(await laptop.evaluate(()=>zebjusSchool.state.txOn),false);assert.equal(calls.filter(x=>x.type==='rc_frame').length,0);
 await laptop.click('#topControlToggle');await wait(laptop,()=>zebjusSchool.ownsLock());assert.equal(await laptop.locator('#topControlToggle').getAttribute('aria-checked'),'true');await laptop.click('#topControlToggle');await wait(laptop,()=>!zebjusSchool.ownsLock());assert.deepEqual(rc.slice(0,4),[1720,1370,1450,1600]);assert.equal(calls.filter(x=>x.actor==='laptop'&&x.type==='rc_frame').length,0);assert(!calls.some(x=>['/','/fly','/setup','/io'].includes(x.path)));assert.deepEqual(errors,[]);
 console.log('PASS: AP Wi-Fi recovery page / auto observation / mobile TX indicator / actual APK AP↔STA / same-ID STA reconnect / no auto RC / PPM live sticks / release preserves PPM / top ownership ON-OFF');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
