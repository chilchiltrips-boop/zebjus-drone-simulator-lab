const CACHE='zebjus-flightcore-v18-3-22';
const CORE=['./','./index.html','./styles.css','./app.js','./kit-local.js','./school-lab.js','./ui-runtime.js','./firmware-updater.js','./three.module.min.js','./fc_top_layout.png','./fc_board_reference.png','./icon-192.png','./icon-512.png'];
const OPTIONAL=['./FlightCore_Firmware/catalog.json','./FlightCore_Firmware/latest.json','./firmware-catalog.json','./firmware-latest.json'];
const CODE_RE=/\.(?:html|js|css|json|webmanifest)$/i;
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
  return cached || network || Response.error();
}
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(event.request.mode==='navigate'||CODE_RE.test(url.pathname)||url.pathname.endsWith('/service-worker.js')) event.respondWith(networkFirst(event.request));
  else event.respondWith(staleWhileRevalidate(event.request));
});
