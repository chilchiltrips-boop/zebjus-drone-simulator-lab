/* Execute real local WASM runtimes, then repeat from the service-worker cache. */
const assert=require('node:assert/strict');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const port=18787,url=`http://localhost:${port}/`;
let server,browser;
const timeout=150000;
async function serve(){
 server=spawn(process.env.ZEBJUS_TEST_PYTHON||'python3',[path.join(root,'start_offline.py'),'--no-browser','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:'))resolve()});server.on('error',reject);server.on('exit',code=>reject(Error('Local launcher exited: '+code)));setTimeout(()=>reject(Error('Launcher did not start')),10000)});
}
async function ready(page){
 await page.goto(url);
 await page.waitForFunction(()=>window.__zebjusAppLoaded,null,{timeout:45000});
}
async function pythonTab(page){
 await page.click('.tab[data-tab="python"]');
 await page.waitForFunction(()=>window.monaco?.editor.getModels().length,null,{timeout:45000});
}
async function run(page,code,marker){
 await pythonTab(page);
 await page.evaluate(code=>window.monaco.editor.getModels()[0].setValue(code),code);
 await page.click('#runPythonBtn');
 await page.waitForFunction(marker=>document.querySelector('#pythonTerminal').textContent.includes(marker)||document.querySelector('#pythonTerminal').textContent.includes('PythonError:'),marker,{timeout});
 const terminal=await page.locator('#pythonTerminal').textContent();
 assert(terminal.includes(marker),terminal);
 await page.waitForFunction(()=>!document.querySelector('#runPythonBtn').disabled,null,{timeout});
 assert(!/PythonError:|Traceback \(most recent call last\)/.test(terminal),terminal);
}
const plotCode=`import numpy as np
import cv2
import pandas as pd
from PIL import Image
import matplotlib.pyplot as plt
img=np.zeros((20,20,3),dtype=np.uint8)
assert cv2.cvtColor(img,cv2.COLOR_BGR2GRAY).shape == (20,20)
assert Image.new('RGB',(2,2)).size == (2,2)
assert pd.DataFrame({'x':[1,2]}).x.sum() == 3
plt.plot(np.arange(4),[0,1,4,9])
plt.show()
print("PLOT_OFFLINE_OK")`;
const simpleCode=`from zebjus_simple import Drone
import time
import cv2
drone=Drone()
count=0
while True:
    print("SIMPLE_STATUS",drone.status().get("target"))
    cv2.waitkey(10)
    count += 1
    if count == 3: break
print("SIMPLE_OFFLINE_OK")`;
const handCode=`from zebjus_simple import Drone
from cvzone.HandTrackingModule import HandDetector
import cv2
drone=Drone()
cap=cv2.VideoCapture(0)
detector=HandDetector(maxHands=2)
for i in range(12):
    ok,img=cap.read()
    if ok:
        hands,img=detector.findHands(img)
        cv2.imshow("Offline hands",img)
        print("HAND_FRAME",len(hands))
    cv2.waitKey(80)
cap.release()
print("HAND_OFFLINE_OK")`;
async function exercise(page,label){
 assert.equal(await page.evaluate(async()=>typeof(await import('./vendor/esptool/bundle.mjs')).ESPLoader),'function');
 const images=await page.evaluate(async()=>{
  const cat=await(await fetch('./firmware-catalog.json')).json();const out=[];
  for(const board of cat.boards)for(const kind of ['app','factory']){
   const pkg=board.latest[kind],data=new Uint8Array(await(await fetch('./FlightCore_Firmware/'+pkg.file)).arrayBuffer());
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
   out.push({available:pkg.available,hashOK:hash===pkg.sha256,sizeOK:data.length===pkg.size,chipOK:board.imageChipIds.includes(data[12]|data[13]<<8)});
  }return out;
 });
 assert.equal(images.length,4);assert(images.every(i=>i.available&&i.hashOK&&i.sizeOK&&i.chipOK));
 await page.click('.tab[data-tab="firmware"]');await page.selectOption('#fwBoardProfile','ZFC-A2');
 await page.waitForFunction(()=>document.querySelector('#fwFileName').textContent.includes('A2_APP.bin'));
 await page.selectOption('#fwImageType','factory');await page.waitForFunction(()=>document.querySelector('#fwFileName').textContent.includes('A2_FACTORY.bin'));
 await page.selectOption('#fwImageType','app');await page.waitForFunction(()=>document.querySelector('#fwFileName').textContent.includes('A2_APP.bin'));
 console.log(label+': four compiled images / checksums / profile and APP-FACTORY switching PASS');
 assert(await page.locator('#pythonExample').isHidden(),'Examples must be hidden by default');
 await run(page,plotCode,'PLOT_OFFLINE_OK');
 assert((await page.locator('#pythonOutputImage').getAttribute('src')).startsWith('data:image/png;base64,'));
 console.log(label+': NumPy, OpenCV, Pillow, pandas and rendered Matplotlib plot PASS');
 await run(page,simpleCode,'SIMPLE_OFFLINE_OK');
 console.log(label+': synchronous Drone API, while True and cv2.waitkey PASS');
 await run(page,handCode,'HAND_OFFLINE_OK');
 assert((await page.locator('#pythonTerminal').textContent()).includes('HAND_FRAME'),'cvzone did not read a camera frame');
 assert(!(await page.locator('#pythonOutputImage').getAttribute('src')),'Stopped camera image must clear');
 console.log(label+': local hand model and cvzone inference on synthetic camera frames PASS');
 await pythonTab(page);
 await page.evaluate(()=>window.monaco.editor.getModels()[0].setValue('from zebjus_simple import Drone\nimport time\ndrone=Drone()\nwhile True:\n    print("LOOP_RUNNING")\n    time.sleep(0.05)'));
 await page.click('#runPythonBtn');
 await page.waitForFunction(()=>document.querySelector('#pythonTerminal').textContent.includes('LOOP_RUNNING'),null,{timeout});
 await page.click('#stopPythonBtn');
 await page.waitForFunction(()=>!document.querySelector('#runPythonBtn').disabled);
 await run(page,'print("RERUN_OFFLINE_OK")','RERUN_OFFLINE_OK');
 console.log(label+': Stop and fresh-worker rerun PASS');
}
(async()=>{
 await serve();
 browser=await chromium.launch({executablePath:process.env.ZEBJUS_CHROMIUM||undefined,headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 const disk=await browser.newContext({serviceWorkers:'block',permissions:['camera'],viewport:{width:1440,height:1000}});
 const externalRuntime=[];
 await disk.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(u.protocol.startsWith('http')&&u.hostname!=='localhost'){
   if(['script','stylesheet','font','image','worker'].includes(r.resourceType()))externalRuntime.push(u.href);
   return route.abort();
  }
  return route.continue();
 });
 const p=await disk.newPage();
 const pageErrors=[];p.on('pageerror',e=>pageErrors.push(e.message));
 await ready(p);
 await exercise(p,'Local disk / all external requests blocked');
 assert.deepEqual(externalRuntime,[],'Runtime attempted an external CDN');
 assert.deepEqual(pageErrors,[],'Browser page errors');
 await disk.close();
 const cached=await browser.newContext({permissions:['camera'],viewport:{width:1440,height:1000}});
 const q=await cached.newPage();
 await ready(q);
 await q.waitForFunction(()=>navigator.serviceWorker.controller,null,{timeout:45000});
 await q.click('.tab[data-tab="settings"]');
 await q.click('#offlinePrepareBtn');
 await q.waitForFunction(()=>/Browser offline copy ready|could not finish/.test(document.querySelector('#offlineStatus').textContent),null,{timeout});
 assert((await q.locator('#offlineStatus').textContent()).includes('Browser offline copy ready'),await q.locator('#offlineStatus').textContent());
 console.log('Complete verified browser cache PASS');
 await new Promise(resolve=>{server.once('exit',resolve);server.kill()});server=null;
 await cached.setOffline(true);
 await q.reload();
 await q.waitForFunction(()=>window.__zebjusAppLoaded,null,{timeout:45000});
 await exercise(q,'Browser offline / local server stopped');
 await q.click('.tab[data-tab="settings"]');
 await q.click('#offlineCheckBtn');
 await q.waitForFunction(()=>document.querySelector('#offlineStatus').textContent.includes('Browser offline copy ready'),null,{timeout:45000});
 await q.screenshot({path:process.env.ZEBJUS_OFFLINE_SCREENSHOT||'/tmp/zebjus-offline-settings.png',fullPage:false});
 // Cache eviction must not continue reporting a complete copy.
 await q.evaluate(async()=>{const name=(await caches.keys()).find(n=>n.startsWith('zebjus-flightcore-'));const cache=await caches.open(name);await cache.delete('./vendor/mediapipe/hand_landmarker.task')});
 await q.click('#offlineCheckBtn');
 await q.waitForFunction(()=>document.querySelector('#offlineStatus').textContent.includes('incomplete'),null,{timeout:45000});
 console.log('Incomplete cache detected PASS');
 await cached.close();
 console.log('OFFLINE BROWSER TESTS PASS');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
