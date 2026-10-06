'use strict';
// Actual installed Android UI; API/radio are simulated. Native UDP has a separate Java test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'android-app/app/src/main/assets'),ID='ZFC-001122334455';
let server,browser,owner='',armed=false,dropUntil=0,wrong=false,forcedDisarm=false;
const frames=[],calls=[],errors=[],cancelled=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const wait=(page,f)=>page.waitForFunction(f,null,{timeout:12000});
const status=cid=>({ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:wrong?'ZFC-FFEEDDCCBBAA':ID,name:'Aerion test kit',mode:'AP / DIRECT',ip:'192.168.4.1',rcTimeoutMs:1000,flightReady:true,flightMode:'ANGLE',armed,locked:!!owner,lockMine:owner===cid,rcSource:'WEB_AP'});
(async()=>{
 server=http.createServer((req,res)=>{const rel=new URL(req.url,'http://localhost').pathname.replace(/^\//,'');if(!['flight/index.html','android-transport.js'].includes(rel))return res.writeHead(404).end();res.writeHead(200,{'Content-Type':rel.endsWith('.js')?'text/javascript':'text/html'});res.end(fs.readFileSync(path.join(assets,rel)))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM});
 const context=await browser.newContext({viewport:{width:1000,height:560},hasTouch:true});
 await context.addInitScript(()=>{localStorage.setItem('zebjus-flight-destination',JSON.stringify('REAL'));window.__aerionToken='test';window.NativeAerion={request(key,id,url,method,body){window.__request(url,body).then(r=>window.AerionAndroid.deliver(id,r.code,r.body))},cancel(key,id){window.__cancel(id)},openWifi(){},joinWifi(){}}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.exposeFunction('__cancel',id=>cancelled.push(id));
 await page.exposeFunction('__request',async(address,form)=>{
  const u=new URL(address),d=Object.fromEntries(new URLSearchParams(form)),cid=d.clientId||u.searchParams.get('clientId');calls.push({path:u.pathname,...d});let code=200,body={ok:true};
  if(d.expectedDeviceId&&d.expectedDeviceId!==(wrong?'ZFC-FFEEDDCCBBAA':ID))return{code:409,body:JSON.stringify({ok:false,message:'Device ID mismatch'})};
  if(u.pathname==='/api/status')body=status(cid);
  else if(u.pathname==='/api/telemetry')body={...status(cid),roll:0,pitch:0,rcAgeMs:10};
  else if(u.pathname==='/api/control/acquire'){if(owner&&owner!==cid){code=423;body={ok:false,message:'View only'}}else{owner=cid;body={ok:true,rcTimeoutMs:1000}}}
  else if(u.pathname==='/api/control/release'){if(owner===cid){owner='';armed=false}}
  else if(u.pathname==='/api/control/ping'){throw Error('Active RC must not send redundant heartbeat')}
  else if(u.pathname==='/api/command'){
   if(Date.now()<dropUntil){await pause(260);return{code:0,body:'Brief packet loss'}}
   if(owner!==cid){code=423;body={ok:false,message:'Control lock lost'}}else{
    const c=d.channels.split(',').map(Number);frames.push(c);armed=!forcedDisarm&&c[4]>1500;body={ok:true,deviceId:ID,armed,flightReady:true,lastDisarmReason:'test failsafe'};
   }
  }
  return{code,body:JSON.stringify(body)};
 });
 await page.goto(`http://localhost:${server.address().port}/flight/index.html`);await wait(page,()=>document.getElementById('controlHint').textContent==='MOBILE SESSION');
 await page.click('#controlToggle');await wait(page,()=>document.getElementById('controlToggle').getAttribute('aria-checked')==='true');await page.click('#arm');await pause(180);
 await page.keyboard.down('w');await pause(500);await page.keyboard.up('w');await pause(100);const throttle=frames.at(-1)[2],client=owner,begin=frames.length;assert(throttle>1050&&armed);
 dropUntil=Date.now()+440;await pause(550);await wait(page,()=>document.getElementById('controlHint').textContent==='YOU CONTROL');
 assert.equal(owner,client,'short loss keeps session');assert(armed,'short loss cannot disarm');assert.equal(frames.at(-1)[2],throttle,'short loss preserves throttle');assert(frames.slice(begin).every(c=>c[4]===2000&&c[2]===throttle));assert(cancelled.length>0,'native requests cancel through body timeout');
 await page.setViewportSize({width:940,height:560});await pause(100);assert.equal(owner,client,'resize retains ownership');assert.equal(frames.at(-1)[2],throttle);
 // Actual FC disarm leaves sticks available, with explicit manual ARM required.
 forcedDisarm=true;await pause(200);assert.equal(frames.at(-1)[4],1000);assert.equal(frames.at(-1)[2],1000);assert.equal(await page.locator('#controlToggle').getAttribute('aria-checked'),'true');forcedDisarm=false;
 await page.click('#arm');await pause(160);assert(armed);
 // A hard gap fences old output and restores a fresh, disarmed low-throttle session.
 const prior=owner;dropUntil=Date.now()+1250;await wait(page,()=>document.getElementById('controlToggle').getAttribute('aria-checked')!=='true');await wait(page,()=>document.getElementById('controlToggle').getAttribute('aria-checked')==='true');await pause(120);
 assert.notEqual(owner,prior);assert(!armed);assert.equal(frames.at(-1)[4],1000);assert.equal(frames.at(-1)[2],1000);
 await page.click('#kill');await pause(200);const count=calls.filter(c=>c.path==='/api/control/acquire').length;await pause(1600);assert.equal(owner,'');assert.equal(calls.filter(c=>c.path==='/api/control/acquire').length,count,'STOP cancels recovery intent');
 await page.click('#controlToggle');await wait(page,()=>document.getElementById('controlToggle').getAttribute('aria-checked')==='true');wrong=true;await wait(page,()=>document.getElementById('controlToggle').getAttribute('aria-checked')!=='true');await pause(1200);assert(await page.locator('#arm').isDisabled(),'wrong physical ID cannot regain control');
 assert.deepEqual(errors,[]);console.log('PASS: Android UI 440 ms loss preserves throttle/ARM/session; no redundant heartbeat; resize continuity; FC disarm keeps safe sticks; hard loss restores fresh disarmed controls; STOP cancels retries; wrong-ID rejection');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
