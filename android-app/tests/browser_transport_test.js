'use strict';
// Executes the bundled Android UI and JS bridge in a real browser.
// Native Android API calls and controller radio are simulated here.
const assert=require('node:assert/strict'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),assets=path.join(root,'app/src/main/assets'),ID='ZFC-001122334455';
let server,browser,reachable=false,owner='',armed=false,wifiOpened=0,wifiJoins=[],wrong=false,slow=0;
const frames=[],requests=[],cancelled=[],browserRequests=[],errors=[];
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function wait(page,f){await page.waitForFunction(f,null,{timeout:10000})}
(async()=>{
 server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),rel=u.pathname.replace(/^\/assets\//,'');if(!['flight/index.html','android-transport.js'].includes(rel)){res.writeHead(404).end();return}res.writeHead(200,{'Content-Type':rel.endsWith('.js')?'text/javascript':'text/html','Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'none'; frame-src 'none'; object-src 'none'"});res.end(fs.readFileSync(path.join(assets,rel)))});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://localhost:${server.address().port}/assets/flight/index.html`;
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM});const context=await browser.newContext({viewport:{width:1000,height:560},hasTouch:true});
 await context.addInitScript(()=>{window.__aerionToken='test-token';window.NativeAerion={request(key,id,address,method,form,timeout){window.__request(id,address,method,form,timeout).then(r=>window.AerionAndroid.deliver(id,r.code,r.body))},cancel(key,id){window.__cancel(id)},openWifi(){window.__wifi()},joinWifi(key,id){window.__join(id)}}});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>browserRequests.push(r.url()));
 await page.exposeFunction('__wifi',()=>{wifiOpened++});await page.exposeFunction('__join',id=>wifiJoins.push(id));await page.exposeFunction('__cancel',id=>cancelled.push(id));
 await page.exposeFunction('__request',async(id,address,method,form,timeout)=>{
  requests.push({id,address,method,form,timeout});if(!reachable)return{code:0,body:'Join the kit Wi-Fi.'};const u=new URL(address),d=Object.fromEntries(new URLSearchParams(form));let code=200,body={ok:true};
  if(d.expectedDeviceId&&d.expectedDeviceId!==(wrong?'ZFC-FFEEDDCCBBAA':ID))return{code:409,body:JSON.stringify({ok:false,message:'Wrong Device ID'})};
  if(u.pathname==='/api/status')body={ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:wrong?'ZFC-FFEEDDCCBBAA':ID,name:'zebjus_drone_1',ip:'192.168.4.1',mode:'AP SETUP',flightReady:true,flightMode:'ANGLE',armed,lockMine:owner===u.searchParams.get('clientId')};
  else if(u.pathname==='/api/telemetry')body={ok:true,roll:1,pitch:2,webRcFrameHz:25,flightLoopHz:250};
  else if(u.pathname==='/api/control/acquire'){owner=d.clientId}
  else if(u.pathname==='/api/control/release'){if(owner===d.clientId){owner='';armed=false}}
  else if(u.pathname==='/api/control/ping'){if(owner!==d.clientId){code=423;body={ok:false,message:'Lock lost'}}}
  else if(u.pathname==='/api/command'){
   if(slow)await pause(slow);if(owner!==d.clientId){code=423;body={ok:false,message:'Take control again'}}else{const c=d.channels.split(',').map(Number);frames.push(c);armed=c[4]>1500}
  }else{code=404;body={ok:false,message:'Unknown route'}}
  return {code,body:JSON.stringify(body)};
 });
 await page.goto(url);await wait(page,()=>!document.getElementById('heroAction').disabled);assert(await page.locator('#arm').isDisabled());assert.equal(await page.locator('#heroTitle').textContent(),'Connect your drone');assert.equal(await page.locator('#fullscreen').isVisible(),false);
 await page.click('#heroAction');await page.fill('#expectedId',ID);await page.click('#androidWifi');assert.deepEqual(wifiJoins,[ID]);await page.click('#androidWifiSettings');assert.equal(wifiOpened,1);assert((await page.locator('#connectDialog .connect-grid').textContent()).includes('12345678'));assert.equal(await page.locator('#settingsDialog .links').isVisible(),false);reachable=true;await page.fill('#expectedId',ID);await page.click('#checkConnection');await wait(page,()=>document.getElementById('hero').hidden);assert.equal(await page.locator('#connectionLabel').textContent(),'zebjus_drone_1');
 await page.click('#arm');await pause(100);assert(armed);await page.keyboard.down('ArrowRight');await pause(100);assert(frames.at(-1)[0]>1500);await page.keyboard.up('ArrowRight');
 // Native lifecycle event, not just browser visibility: native callbacks force stopped output.
 await page.evaluate(()=>window.AerionAndroid.pause());await pause(220);assert.equal(armed,false);assert.equal(owner,'');assert(await page.locator('#arm').isDisabled());await page.evaluate(()=>window.AerionAndroid.resume());await pause(250);assert(await page.locator('#hero').isVisible());assert.equal(owner,'');
 await page.click('#heroAction');await wait(page,()=>document.getElementById('hero').hidden);await page.evaluate(()=>window.AerionAndroid.stopped());await pause(200);assert.equal(owner,'');assert(await page.locator('#arm').isDisabled());
 await page.click('#heroAction');await wait(page,()=>document.getElementById('hero').hidden);slow=500;await pause(450);slow=0;await wait(page,()=>!document.getElementById('hero').hidden);assert(cancelled.length>0,'AbortSignal must cancel native request');await pause(800);assert(await page.locator('#arm').isDisabled());
 const preJoin=requests.length;await page.evaluate(()=>window.AerionAndroid.wifiReady());await pause(350);assert(requests.slice(preJoin).every(r=>!r.address.includes('/api/control/acquire')),'native Wi-Fi connection must not acquire control');assert(await page.locator('#arm').isDisabled());
 const preLink=requests.length;await page.evaluate(id=>window.AerionAndroid.openKit(id,'http://192.168.4.1'),ID);await pause(350);assert(requests.slice(preLink).every(r=>!r.address.includes('/api/control/acquire')),'app link is read-only');assert(await page.locator('#arm').isDisabled());
 await page.evaluate(()=>window.AerionAndroid.openKit('ZFC-FFEEDDCCBBAA','http://192.168.4.1'));await pause(150);assert.equal(await page.locator('#expectedId').inputValue(),ID,'app link cannot change an existing kit identity');
 const before=requests.length;await page.reload();await pause(300);assert(await page.locator('#arm').isDisabled());assert(requests.slice(before).every(r=>!r.address.includes('/api/control/acquire')),'reload must not acquire');assert.notEqual(requests[0].id,requests.at(-1).id,'document request IDs cannot collide after reload');
 wrong=true;await page.reload();await pause(500);assert.equal(await page.locator('#heroTitle').textContent(),'Connect your drone');assert(await page.locator('#arm').isDisabled());
 assert.equal(errors.length,0,errors.join('\n'));assert(browserRequests.every(u=>u.startsWith('http://localhost:')),'native flight UI leaked browser HTTP requests');assert(!browserRequests.some(u=>/python|vendor|service-worker/.test(u)));assert(requests.some(r=>r.address.includes('/api/command')&&r.method==='POST'&&r.form.includes('expectedDeviceId='+ID)));
 console.log('PASS: actual bundled UI / Android transport adapter / native in-app Wi-Fi selection / read-only app links and Wi-Fi reconnect / form-encoded RC / lifecycle stop / read-only resume and reload / timeout cancellation / unique reply IDs / wrong-kit rejection / zero external runtimes');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.close()});
