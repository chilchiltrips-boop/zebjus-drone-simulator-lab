'use strict';
// Real browser/touch events against a simulated controller HTTP transport.
// No physical radio, ESC, IMU or flight verification is implied by this test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),port=18789,url=`http://localhost:${port}/flight/`,ID='ZFC-001122334455',OTHER='ZFC-FFEEDDCCBBAA';
let server,browser,owner='',armed=false,reachable=false,id=ID,name='zebjus_drone_1',mode='AP SETUP',ip='192.168.4.1',delayAcquire=0,delayFrame=0,refuseFrames=false;
const frames=[],calls=[],errors=[];
const status=cid=>({ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:id,name,ip,mode,flightReady:true,webRc:true,armed,locked:!!owner,lockMine:!!owner&&cid===owner,flightMode:'ANGLE'});
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(page,f,arg){await page.waitForFunction(f,arg,{timeout:10000})}
async function touch(cdp,type,points){await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(p=>({id:p.id,x:p.x,y:p.y,radiusX:3,radiusY:3,force:1}))})}
async function centers(page){return page.evaluate(()=>Object.fromEntries(['left','right'].map(id=>{const r=document.querySelector('#'+id+' .base').getBoundingClientRect();return[id,{x:r.x+r.width/2,y:r.y+r.height/2,r:r.width*.3}]})))}
async function take(page){await page.click('#heroAction');await wait(page,()=>document.getElementById('hero').hidden);await pause(120)}
async function lastFrame(predicate){const start=Date.now();while(Date.now()-start<3000){const found=frames.slice(-5).find(predicate);if(found)return found;await pause(30)}throw Error('Expected RC frame not received: '+JSON.stringify(frames.slice(-3)))}
(async()=>{
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--flight','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(timer);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM});
 const context=await browser.newContext({viewport:{width:1000,height:560},hasTouch:true,serviceWorkers:'block'});
 const routing=async route=>{
  const u=new URL(route.request().url());calls.push(u.href);
  if(u.hostname==='localhost')return route.continue();
  if(!['192.168.4.1','10.0.0.20','zebjus-drone-1.local'].includes(u.hostname)||!reachable)return route.abort();
  if(u.pathname==='/'||u.pathname==='/fly')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(root,'tools/ap_fly_source.html'),'utf8')});
  if(mode.startsWith('STA')&&u.hostname==='192.168.4.1')return route.abort();
  const d=Object.fromEntries(new URLSearchParams(route.request().postData()||''));let response={ok:true},code=200;
  if(d.expectedDeviceId&&d.expectedDeviceId!==id){code=409;response={ok:false,message:'Device ID mismatch'}}
  else if(u.pathname==='/api/status')response=status(u.searchParams.get('clientId'));
  else if(u.pathname==='/api/telemetry')response={ok:true,roll:1.5,pitch:-2,ppmFrameHz:0,webRcFrameHz:25,flightLoopHz:250,battery:null,batteryValid:false};
  else if(u.pathname==='/api/control/acquire'){if(delayAcquire)await pause(delayAcquire);if(owner&&owner!==d.clientId){code=423;response={message:'Kit in use'}}else owner=d.clientId}
  else if(u.pathname==='/api/control/ping'){if(owner!==d.clientId){code=423;response={message:'lock lost'}}}
  else if(u.pathname==='/api/control/release'){if(owner===d.clientId){owner='';armed=false}}
  else if(u.pathname==='/api/command'&&d.type==='rc_frame'){
   if(delayFrame)await pause(delayFrame);
   if(refuseFrames)return route.abort();
   if(owner!==d.clientId){code=423;response={message:'lock lost'}}else{const ch=d.channels.split(',').map(Number);frames.push(ch);armed=ch[4]>1500;response={ok:true}}
  }else{code=404;response={message:'Unknown mock route'}}
  try{return await route.fulfill({status:code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(response)})}catch{}
 };
 await context.route('**/*',routing);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
 await wait(page,()=>!document.getElementById('heroAction').disabled);assert.equal(await page.locator('#heroTitle').textContent(),'Connect your drone');assert(await page.locator('#arm').isDisabled());
 assert(!await page.locator('body').textContent().then(t=>/Python|PyCharm/.test(t)));assert.equal(await page.locator('#battery').isVisible(),false);
 await page.click('#heroAction');assert(await page.locator('#connectDialog').isVisible());await page.screenshot({path:path.join(path.dirname(root),'Aerion_Connection_Help.png')});
 reachable=true;await page.fill('#kitAddress','192.168.4.1');await page.fill('#expectedId',ID);await page.click('#checkConnection');await wait(page,()=>document.getElementById('hero').hidden);
 assert.equal(await page.locator('#connectionLabel').textContent(),name);assert.match(await page.locator('#networkLabel').textContent(),/AP/);await lastFrame(c=>c[2]===1000&&c[4]===1000);
 const cdp=await context.newCDPSession(page);let c=await centers(page);
 // Floating touch starts at zero, including near a zone edge: no throttle jump.
 await touch(cdp,'touchStart',[{id:1,x:c.left.x+30,y:c.left.y+15}]);await pause(150);assert.equal(frames.at(-1)[2],1000);await touch(cdp,'touchEnd',[]);
 await page.click('#arm');await lastFrame(c=>c[4]===2000&&c[2]===1000);
 // Simultaneous left yaw/throttle and right roll/pitch. Both are real touch pointers.
 c=await centers(page);const p1={id:1,x:c.left.x,y:c.left.y},p2={id:2,x:c.right.x,y:c.right.y};
 await touch(cdp,'touchStart',[p1,p2]);await touch(cdp,'touchMove',[{...p1,x:p1.x+30,y:p1.y-32},{...p2,x:p2.x+32,y:p2.y-30}]);await pause(260);
 const moving=await lastFrame(v=>v[0]>1650&&v[1]>1650&&v[3]>1650&&v[2]>1020);assert(moving[2]<1200,'throttle must ramp gradually');await touch(cdp,'touchEnd',[]);await pause(120);const heldThrottle=frames.at(-1)[2];assert.deepEqual([frames.at(-1)[0],frames.at(-1)[1],frames.at(-1)[3]],[1500,1500,1500]);await pause(120);assert.equal(frames.at(-1)[2],heldThrottle,'throttle holds on release');assert(await page.locator('#mode').isDisabled());
 // STOP releases control and clears all outputs; reopening never auto-arms.
 await page.click('#kill');await lastFrame(v=>v[4]===1000&&v[2]===1000);await wait(page,()=>!document.getElementById('hero').hidden);await pause(250);assert.equal(owner,'');await take(page);assert.equal(armed,false);
 await page.keyboard.down('w');await pause(240);await page.keyboard.up('w');assert(frames.at(-1)[2]>1050);await page.click('#arm');await pause(100);assert.equal(armed,false);assert.match(await page.locator('#notice').textContent(),/Lower throttle/);
 await page.click('#kill');await take(page);await page.keyboard.down('ArrowLeft');await lastFrame(v=>v[0]===1000);await page.keyboard.up('ArrowLeft');await lastFrame(v=>v[0]===1500);
 // Old in-flight ARM frames must be rejected after taking a new control session.
 await page.click('#arm');await lastFrame(v=>v[4]===2000);const priorSession=owner;delayFrame=600;await pause(70);delayFrame=0;await page.click('#kill');await take(page);assert.notEqual(owner,priorSession);const freshFrames=frames.length;await pause(700);assert(frames.slice(freshFrames).every(c=>c[4]===1000),'old session briefly re-armed the new control session');assert.equal(armed,false);
 // A long name never changes the location of either stick.
 const before=await centers(page);name='ZEBJUS Aerion classroom flight controller with a very long name';await pause(1100);assert.deepEqual(await centers(page),before);name='zebjus_drone_1';
 await page.click('#settings');await wait(page,()=>!document.getElementById('hero').hidden);await page.uncheck('#floating');await page.click('[data-close="settingsDialog"]');await take(page);c=await centers(page);
 await touch(cdp,'touchStart',[{id:1,x:c.right.x+20,y:c.right.y}]);assert.deepEqual(await centers(page),c);await lastFrame(v=>v[0]>1500);await touch(cdp,'touchCancel',[]);await lastFrame(v=>v[0]===1500);
 // Refresh obtains telemetry only and uses a fresh controller session.
 const reloadFrames=frames.length;await page.reload();await wait(page,()=>document.getElementById('connectionLabel').textContent==='zebjus_drone_1');await pause(400);assert.equal(await page.locator('#hero').isVisible(),true);assert.equal(await page.locator('#arm').isDisabled(),true);assert.equal(armed,false);assert(frames.slice(reloadFrames).every(c=>c[2]===1000&&c[4]===1000));assert(!calls.slice(calls.lastIndexOf(url)).some(u=>u.includes('/api/control/acquire')));owner='';/* emulate the old session's 10 s lock expiry when navigation discards its beacon */await take(page);
 // Loss of transport or lock latches the transmitter off; recovery never resumes it.
 refuseFrames=true;await wait(page,()=>!document.getElementById('hero').hidden);refuseFrames=false;await pause(1300);assert.equal(await page.locator('#arm').isDisabled(),true);await take(page);owner='OTHER-SESSION';await pause(1200);assert.equal(await page.locator('#arm').isDisabled(),true);owner='';
 // Wrong physical kit at the same AP address is rejected even after refresh.
 id=OTHER;await page.reload();await pause(1600);assert.equal(await page.locator('#heroTitle').textContent(),'Connect your drone');assert.equal(await page.locator('#arm').isDisabled(),true);await page.goto(url+'?kitId='+OTHER+'&kitName=zebjus_drone_1&kitIp=192.168.4.1');await wait(page,()=>document.getElementById('connectionLabel').textContent==='zebjus_drone_1');assert(await page.locator('#arm').isDisabled(),'explicit kit handoff must remain read-only');id=ID;await page.goto(url+'?kitId='+ID+'&kitName=zebjus_drone_1&kitIp=192.168.4.1');await wait(page,()=>document.getElementById('connectionLabel').textContent==='zebjus_drone_1');
 // Cancel an in-progress grant: late acquire response cannot start RC/ARM.
 delayAcquire=450;const beforeGrant=frames.length;await page.click('#heroAction');await pause(100);await page.click('#kill');await pause(800);assert.equal(frames.length,beforeGrant);assert.equal(owner,'');assert.equal(await page.locator('#arm').isDisabled(),true);delayAcquire=0;
 // A cancelled grant's late rejection must not stop a newer manual session.
 delayAcquire=450;await page.click('#heroAction');await pause(80);await page.click('#kill');delayAcquire=0;await take(page);await pause(650);assert(await page.locator('#hero').isHidden(),'late failure from an old grant stopped the new session');await page.click('#kill');await pause(250);
 // STA transition accepts only the saved physical identity; no auto-control.
 mode='STA / LOCAL';ip='10.0.0.20';await page.click('#connect');await page.fill('#kitAddress',ip);await page.click('#checkConnection');await wait(page,()=>document.getElementById('hero').hidden);assert.match(await page.locator('#networkLabel').textContent(),/STA/);await page.click('#kill');
 await page.setViewportSize({width:1600,height:720});await take(page);await page.evaluate(()=>document.getElementById('notice').hidden=true);await page.screenshot({path:path.join(path.dirname(root),'Aerion_Flight_App_Landscape.png')});await page.setViewportSize({width:390,height:844});await pause(200);await page.screenshot({path:path.join(path.dirname(root),'Aerion_Flight_App_Portrait.png')});
 for(const selector of ['#left','#right','#heroAction','#connect']){const r=await page.locator(selector).boundingBox();assert(r.x>=0&&r.x+r.width<=390.5&&r.y>=0&&r.y+r.height<=844.5,selector+' overflows viewport')}
 assert.equal(await page.locator('#arm').isDisabled(),true,'rotation must stop control');assert.equal(errors.length,0,errors.join('\n'));assert(!calls.some(u=>/vendor|pyodide|python-worker|app\.js/.test(u)),'flight screen must not load Python or the engineering app');
 await context.close();
 // Embedded AP page is self-contained and connects locally with no installed app.
 mode='AP SETUP';ip='192.168.4.1';const ap=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:'block'});await ap.route('**/*',routing);const apPage=await ap.newPage();await apPage.goto('http://192.168.4.1/');await wait(apPage,()=>document.getElementById('connectionLabel').textContent==='zebjus_drone_1');assert(await apPage.locator('#hero').isVisible());assert.equal(await apPage.locator('#arm').isDisabled(),true);await ap.close();
 // Independently cached Flight App survives a server shutdown and browser offline.
 const offline=await browser.newContext({viewport:{width:1000,height:560}}),offlinePage=await offline.newPage();await offline.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());await offlinePage.goto(url);await offlinePage.evaluate(async()=>{await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}))});server.kill();await pause(200);await offline.setOffline(true);await offlinePage.reload();assert.equal(await offlinePage.locator('#heroTitle').textContent(),'Connect your drone');assert(await offlinePage.locator('#arm').isDisabled());await offline.close();
 console.log('PASS: standalone + embedded flight UI; real multitouch; fixed sides; gradual throttle; keyboard; STOP; refresh; transport/lock loss; physical-ID rejection; late-grant fencing; stale-session rejection; AP/STA; landscape/portrait; offline cache; zero Python runtime');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
