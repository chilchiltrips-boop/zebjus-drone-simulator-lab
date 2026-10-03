const CACHE='zebjus-flightcore-v18-3-63-r2';
const CORE=['./flight/index.html','./flight/app.webmanifest','./flight/service-worker.js','./','./index.html','./styles.css','./app.js','./kit-local.js','./school-lab.js','./control-sticks.js','./kit-console.js','./flight-diagnostics.js','./hardware-io.js','./ui-runtime.js','./firmware-updater.js','./python-worker.js','./hand-worker.js','./offline-support.js','./offline-manifest.json','./monaco-worker.js','./manifest.webmanifest','./python_companion/browser_cv2.py','./python_companion/browser_cvzone.py','./python_companion/simple_syntax.py','./three.module.min.js','./glb-loader.js','./fc_top_layout.png','./fc_board_reference.png','./icon-192.png','./icon-512.png'];
const OPTIONAL=['./FlightCore_Firmware/catalog.json','./FlightCore_Firmware/latest.json','./firmware-catalog.json','./firmware-latest.json','./a2212_1000kv_motor.glb','./battery_strap.glb','./esc_30a.glb','./f450_arm_red.glb','./f450_arm_white.glb','./f450_bottom_pdb.glb','./f450_prop_guard.glb','./f450_top_plate.glb','./frame_screw_m25.glb','./lipo_2200_3s.glb','./motor_screw_m3.glb','./prop_1045_ccw.glb','./prop_1045_cw.glb','./receiver_module.glb','./zebjus_flight_controller.glb','./thumb_armRed.png','./thumb_armWhite.png','./thumb_battery.png','./thumb_batteryStrap.png','./thumb_bottomPlate.png','./thumb_esc.png','./thumb_fc.png','./thumb_frameScrew.png','./thumb_guard.png','./thumb_matrix.png','./thumb_motor.png','./thumb_motorScrew.png','./thumb_prop.png','./thumb_receiver.png','./thumb_topPlate.png'];
const CODE_RE=/\.(?:html|js|mjs|css|json|webmanifest)$/i;
const READY_KEY='./__offline_ready__';
let preparingOffline=false;

async function offlineStatus(){
 const cache=await caches.open(CACHE),marker=await cache.match(READY_KEY);
 if(!marker)return{ready:false,version:null};
 const info=await marker.json(),manifestResponse=await cache.match('./offline-manifest.json');
 if(!manifestResponse)return{ready:false,version:info.version};
 const manifest=await manifestResponse.json();
 for(const file of manifest.files)if(!await cache.match('./'+file.path,{ignoreSearch:true}))return{ready:false,version:info.version};
 return{...info,ready:true};
}

self.addEventListener('message',event=>{
 const port=event.ports[0],msg=event.data||{};
 if(!port)return;
 if(msg.type==='offline-status'){
  event.waitUntil(offlineStatus().then(data=>port.postMessage({type:'done',...data})).catch(e=>port.postMessage({type:'error',error:e.message})));
 }else if(msg.type==='offline-prepare'){
  event.waitUntil((async()=>{
   if(preparingOffline){port.postMessage({type:'error',error:'Offline saving is already running in another tab.'});return}
   preparingOffline=true;
   try{
    const cache=await caches.open(CACHE),response=await fetch('./offline-manifest.json',{cache:'no-store'});
    if(!response.ok)throw Error('Offline manifest is missing. Extract the full ZIP.');
    const manifest=await response.json();
    if(manifest.version!==msg.version||CACHE.replace(/-r[1-9][0-9]*$/,'')!==`zebjus-flightcore-v${manifest.version.replaceAll('.','-')}`)throw Error('App update is pending. Reload before saving offline.');
    await cache.delete(READY_KEY);
    let completed=0,bytes=0;
    for(const file of manifest.files){
     const asset=await fetch('./'+file.path,{cache:'no-store'});
     if(!asset.ok)throw Error(`Missing offline file: ${file.path}`);
     const data=await asset.clone().arrayBuffer();
     if(data.byteLength!==file.bytes)throw Error(`Incomplete offline file: ${file.path}`);
     const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',data)),b=>b.toString(16).padStart(2,'0')).join('');
     if(hash!==file.sha256)throw Error(`File changed during offline saving: ${file.path}. Reload and retry.`);
     await cache.put('./'+file.path,asset);
     bytes+=file.bytes;
     port.postMessage({type:'progress',completed:++completed,total:manifest.files.length,bytes,totalBytes:manifest.totalBytes});
    }
    await cache.put('./offline-manifest.json',new Response(JSON.stringify(manifest),{headers:{'content-type':'application/json'}}));
    const info={ready:true,version:manifest.version,files:completed,bytes,savedAt:Date.now()};
    await cache.put(READY_KEY,new Response(JSON.stringify(info),{headers:{'content-type':'application/json'}}));
    port.postMessage({type:'done',...info});
   }catch(e){port.postMessage({type:'error',error:e.message||String(e)})}
   finally{preparingOffline=false}
  })());
 }
});
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(CORE);
    await Promise.allSettled(OPTIONAL.map(async u=>{try{const r=await fetch(u,{cache:'no-store'});if(r.ok)await cache.put(u,r.clone())}catch(_){}}));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE&&(k.startsWith('zebjus-f450-')||k.startsWith('zebjus-flightcore-'))).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request,{cache:'no-store'});
    if(response&&response.ok)cache.put(request,response.clone());
    return response;
  }catch(err){
    return (await cache.match(request,{ignoreSearch:true})) || (request.mode==='navigate' ? cache.match('./index.html',{ignoreSearch:true}) : Promise.reject(err));
  }
}
async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE),cached=await cache.match(request,{ignoreSearch:true});
  const network=fetch(request).then(response=>{if(response&&response.ok)cache.put(request,response.clone());return response}).catch(()=>null);
  return cached || await network || Response.error();
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes('/api/')||url.pathname.endsWith('/health'))return;
  if(url.pathname.includes('/vendor/'))event.respondWith((async()=>{const cache=await caches.open(CACHE);return await cache.match(event.request,{ignoreSearch:true})||await networkFirst(event.request)})());
  else if(event.request.mode==='navigate'||CODE_RE.test(url.pathname)||url.pathname.endsWith('/service-worker.js')) event.respondWith(networkFirst(event.request));
  else event.respondWith(staleWhileRevalidate(event.request));
});
