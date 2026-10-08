(function(){
'use strict';
const base=new URL('./',document.currentScript.src);
let manifest=null,busy=false;
const $=id=>document.getElementById(id);
function note(text){if($('offlineStatus'))$('offlineStatus').textContent=text}
async function getManifest(){
 if(manifest)return manifest;
 const r=await fetch(new URL('offline-manifest.json',base));
 if(!r.ok)throw Error('Offline manifest is missing. Extract the full ZIP.');
 manifest=await r.json();return manifest;
}
async function workerMessage(type,progress){
 if(!navigator.serviceWorker||!window.isSecureContext)throw Error('Open this app on localhost or HTTPS to save a browser offline copy.');
 const registration=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(Error('Offline worker is not ready. Reload this app.')),15000))]);
 return new Promise((resolve,reject)=>{
  const channel=new MessageChannel();let timer;
  const resetTimer=()=>{clearTimeout(timer);timer=setTimeout(()=>finish(Error('Offline saving timed out. Keep this tab open and retry.')),120000)};
  const finish=(error,data)=>{clearTimeout(timer);channel.port1.close();error?reject(error):resolve(data)};
  channel.port1.onmessage=event=>{const d=event.data||{};resetTimer();if(d.type==='progress')progress?.(d);else if(d.type==='done')finish(null,d);else if(d.type==='error')finish(Error(d.error))};
  resetTimer();registration.active.postMessage({type,version:manifest?.version},[channel.port2]);
 });
}
async function check(){
 if(busy)return;
 note('Checking local offline files…');
 try{
  const m=await getManifest();
  const [status,assets]=await Promise.allSettled([
   workerMessage('offline-status'),
   Promise.all(['vendor/pyodide/pyodide.asm.wasm','vendor/pyodide/pyodide-lock.json','vendor/monaco/min/vs/loader.js','vendor/mediapipe/vision_bundle.mjs','vendor/mediapipe/hand_landmarker.task'].map(async path=>{const r=await fetch(new URL(path,base),{method:'HEAD',cache:'no-store'});if(!r.ok)throw Error(path)}))
  ]);
  if(status.status==='fulfilled'&&status.value.ready&&status.value.version===m.version){$('offlineProgress').value=1;note(`Browser offline copy ready • V${m.version}. Use this same browser and address. Camera permission is still required.`)}
  else if(assets.status==='fulfilled'){note(`Local bundle available • Python, OpenCV, plots and hands. ${location.hostname==='localhost'||location.hostname==='127.0.0.1'?'Internet is not required while Start_Offline is running.':'Save a browser copy before leaving this network.'}`)}
  else{$('offlineProgress').value=0;note('Offline files are incomplete here. Extract the full offline ZIP and use Start_Offline.')}
  if($('offlineSize'))$('offlineSize').textContent=`${Math.ceil(m.totalBytes/1048576)} MB browser copy • includes local Python packages and hand model`;
 }catch(e){note(e.message)}
}
async function prepare(){
 if(busy)return;
 const kit=window.zebjusSchool?.getSelectedDevice?.();
 if(kit?.armed||kit?.benchActive||$('runPythonBtn')?.disabled){note('Stop Python and disarm the kit before saving offline files.');return}
 busy=true;$('offlinePrepareBtn').disabled=true;
 try{
  await getManifest();
  note('Saving browser offline copy. Keep this tab open…');
  if(navigator.storage?.persist)await navigator.storage.persist().catch(()=>false);
  const result=await workerMessage('offline-prepare',d=>{note(`Saving ${Math.round(d.bytes/d.totalBytes*100)}% • ${d.completed}/${d.total} files`);$('offlineProgress').value=d.bytes/d.totalBytes});
  $('offlineProgress').value=1;
  note(`Browser offline copy ready • V${result.version}. Reopen this same address in this browser without internet. Browser data must be retained.`);
 }catch(e){note('Offline copy could not finish: '+e.message)}
 finally{busy=false;$('offlinePrepareBtn').disabled=false}
}
function init(){
 $('offlinePrepareBtn')?.addEventListener('click',prepare);
 $('offlineCheckBtn')?.addEventListener('click',check);
 document.querySelector('.tab[data-tab="settings"]')?.addEventListener('click',()=>{if(!busy)check()});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
