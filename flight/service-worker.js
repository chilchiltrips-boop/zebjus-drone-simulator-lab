const CACHE='zebjus-aerion-flight-v18-3-67-r1';
const CORE=['./index.html','./app.webmanifest','../icon-192.png','../icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('zebjus-aerion-flight-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 const path=url.pathname.endsWith('/flight/')?new URL('./index.html',self.location).pathname:url.pathname;
 if(!CORE.some(p=>new URL(p,self.location).pathname===path))return;
 event.respondWith(fetch(event.request).then(response=>{
  if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(path,copy)))}return response;
 }).catch(()=>caches.open(CACHE).then(cache=>cache.match(path,{ignoreSearch:true})).then(response=>response||Response.error())));
});
