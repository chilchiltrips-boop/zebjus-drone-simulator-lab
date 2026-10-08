'use strict';
// Actual UI + Pyodide + camera + RPC. Kit HTTP and hand landmarks are synthetic.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),port=18788,url=`http://localhost:${port}/`,ID='ZFC-001122334455',OTHER='ZFC-FFEEDDCCBBAA';
let server,browser,owner='',armed=false,reachable=true,id=ID,mode='AP SETUP',ip='192.168.4.1';const frames=[],errors=[];
const status=cid=>({ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:id,name:'zebjus_drone_1',ip,mode,boardId:'ZFC-A2',boardName:'ZEBJUS Aerion F1',firmware:'18.3.60',armed,benchMode:0,flightCoreIntegrated:true,webRc:true,flightReady:true,locked:!!owner,lockMine:!!owner&&owner===cid,receiverHealth:'NOT_FOUND'});
const syntheticWorker=`let stale=false;self.onmessage=e=>{const m=e.data;if(m.type==='test-stale'){stale=true;return}if(m.type==='init'){postMessage({type:'ready'});return}if(m.type==='frame'){m.bitmap.close();if(!stale)postMessage({type:'hands',data:{landmarks:[Array.from({length:21},(_,i)=>({x:.25+i*.01,y:.3+i*.01,z:0}))],handedness:['Right'],timestampMs:m.capturedAt}})}};`;
async function wait(page,predicate,arg){await page.waitForFunction(predicate,arg,{timeout:150000})}
(async()=>{
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(timer);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--enable-unsafe-swiftshader','--disable-web-security']});
 const context=await browser.newContext({permissions:['camera'],serviceWorkers:'block'});
 await context.addInitScript(()=>{const Native=window.Worker;window.Worker=class extends Native{constructor(url,options){super(url,options);if(String(url).includes('hand-worker.js'))window.__testHandWorker=this}}});
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());if(u.hostname==='localhost'){
   if(u.pathname==='/hand-worker.js')return route.fulfill({contentType:'text/javascript',body:syntheticWorker});return route.continue();
  }
  if(!['192.168.4.1','10.0.0.20','zebjus-drone-1.local'].includes(u.hostname)||!reachable)return route.abort();
  if(mode.startsWith('AP')&&u.hostname!=='192.168.4.1'||mode.startsWith('STA')&&u.hostname==='192.168.4.1')return route.abort();
  const d=Object.fromEntries(new URLSearchParams(route.request().postData()||''));let response={ok:true},code=200;
  if(d.expectedDeviceId&&d.expectedDeviceId!==id){code=409;response={ok:false,message:'Device ID mismatch'}}
  else if(u.pathname==='/api/status')response=status(u.searchParams.get('clientId'));
  else if(u.pathname==='/api/telemetry')response={ok:true,rcSource:'NONE',rcAgeMs:999999};
  else if(u.pathname==='/api/control/acquire'){owner=d.clientId;response={ok:true}}
  else if(u.pathname==='/api/control/ping'){if(owner!==d.clientId){code=423;response={message:'lock lost'}}}
  else if(u.pathname==='/api/control/release'){owner='';armed=false}
  else if(u.pathname==='/api/command'&&d.type==='rc_frame'){
   if(owner!==d.clientId){code=423;response={message:'lock lost'}}else{const ch=d.channels.split(',').map(Number);frames.push(ch);armed=ch[4]>=1500;response={ok:true,activeSource:'WEB_AP'}}
  }else if(u.pathname==='/api/wifi/saved')response={profiles:[]};
  return route.fulfill({status:code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(response)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await wait(page,()=>window.__zebjusAppLoaded&&window.zebjusSchool);
 // Use the real connection form, then reload from the saved physical identity.
 await page.click('.tab[data-tab="firmware"]');await page.locator('#kitSearchInput').fill('zebjus_drone_1');await page.locator('#kitCachedIp').fill('192.168.4.1');await page.locator('#kitSearchBtn').evaluate(e=>e.click());
 await wait(page,()=>window.zebjusSchool.isKitActive());await page.reload();await wait(page,()=>window.zebjusSchool?.isKitActive());
 assert.equal(await page.evaluate(()=>window.zebjusSchool.state.selectedDeviceId),ID);assert.equal(await page.evaluate(()=>window.zebjusSchool.state.txOn),false);assert.equal(await page.locator('#runPythonBtn').isDisabled(),false);
 // Software mode change / restart on the transport without resuming a program.
 await page.evaluate(()=>window.zebjusSchool.markOffline('test switch'));mode='STA / LOCAL';ip='10.0.0.20';owner='';await page.evaluate(()=>window.zebjusSchool.reconnectNow());await wait(page,()=>window.zebjusSchool.isKitActive());assert.equal(await page.evaluate(()=>window.zebjusSchool.client.deviceId),ID);
 await page.click('.tab[data-tab="python"]');await wait(page,()=>window.monaco?.editor.getModels().length);await page.selectOption('#pythonTarget','real');
 const code=`from zebjus_simple import Drone
from cvzone.HandTrackingModule import HandDetector
import cv2
drone = Drone()
cap = cv2.VideoCapture(0)
detector = HandDetector()
drone.rc(arm=False)
count = 0
while True:
    ok, img = cap.read()
    if ok:
        hands, img = detector.findHands(img)
        if hands:
            drone.rc(throttle=1000, arm=True)
            assert len(drone.camera_frame()) > 100
            assert len(drone.hands()['landmarks']) == 1
            cv2.imshow('Real target hand control', img)
            count += 1
            if count == 20: print('ARMED_HAND_FLOW_OK')
    cv2.waitkey(50)`;
 await page.evaluate(code=>window.monaco.editor.getModels()[0].setValue(code),code);await page.click('#runPythonBtn');await wait(page,()=>document.querySelector('#pythonTerminal').textContent.includes('ARMED_HAND_FLOW_OK')||document.querySelector('#pythonTerminal').textContent.includes('[CONTROL STOP]'));
 const terminal=await page.locator('#pythonTerminal').textContent();assert(terminal.includes('ARMED_HAND_FLOW_OK'),terminal);assert(frames.filter(ch=>ch[4]>=1500).length>=20);assert(armed);assert(await page.locator('#runPythonBtn').isDisabled());
 console.log('PASS: real-target armed camera / hand RPC / cvzone / continuous RC using synthetic hands and kit transport');
 await page.evaluate(()=>window.__testHandWorker.postMessage({type:'test-stale'}));await wait(page,()=>!document.querySelector('#runPythonBtn').disabled);await wait(page,()=>window.zebjusSchool.state.pythonRcActive===false);
 await new Promise(r=>setTimeout(r,150));assert.equal(frames.at(-1)[4],1000);assert.equal(frames.at(-1)[2],1000);const stoppedText=await page.locator('#pythonTerminal').textContent();assert(/\[HAND STOP\]|\[CONTROL STOP\].*fresh detected hand/.test(stoppedText),stoppedText);assert(!(await page.locator('#pythonOutputImage').getAttribute('src')));
 // Wrong AP kit with the same name must remain disconnected after refresh.
 await page.evaluate(()=>window.zebjusSchool.markOffline('test Wi-Fi loss'));mode='AP SETUP';ip='192.168.4.1';id=OTHER;owner='';await page.reload();await wait(page,()=>window.__zebjusAppLoaded&&window.zebjusSchool);await page.evaluate(()=>window.zebjusSchool.reconnectNow());assert.equal(await page.evaluate(()=>window.zebjusSchool.isKitActive()),false);assert.equal(await page.evaluate(()=>window.zebjusSchool.state.selectedDeviceId),ID);
 id=ID;await page.evaluate(()=>window.zebjusSchool.reconnectNow());await wait(page,()=>window.zebjusSchool.isKitActive());const count=frames.length;await new Promise(r=>setTimeout(r,1200));assert.equal(frames.length,count,'reconnect must not resume RC');assert.equal(await page.locator('#runPythonBtn').isDisabled(),false);assert.equal(await page.evaluate(()=>window.zebjusSchool.state.txOn),false);
 assert.deepEqual(errors,[]);console.log('PASS: stale hand DISARM / camera cleanup / refresh / AP↔STA / wrong physical kit / no automatic Python or flight restart');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();server?.kill()});
