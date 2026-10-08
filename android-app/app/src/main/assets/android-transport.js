(()=>{'use strict';
 const token=window.__aerionToken,native=window.NativeAerion;
 if(!native||!token)throw Error('Android connection layer is unavailable.');
 const pending=new Map(),prefix='N-'+Math.random().toString(36).slice(2)+'-'+Date.now().toString(36)+'-';let sequence=0;
 const android=window.AerionAndroid={};
 android.deliver=(id,status,body)=>{const item=pending.get(id);if(!item)return;pending.delete(id);clearTimeout(item.timer);item.remove();if(status===0)item.reject(Error(body||'Kit not reachable.'));else item.resolve(new Response(body,{status,headers:{'Content-Type':'application/json'}}));};
 window.fetch=(address,options={})=>new Promise((resolve,reject)=>{
  const id=prefix+(++sequence),method=String(options.method||'GET').toUpperCase(),signal=options.signal;
  if(signal?.aborted){reject(new DOMException('Request cancelled.','AbortError'));return}
  const abort=()=>{const item=pending.get(id);if(!item)return;pending.delete(id);clearTimeout(item.timer);item.remove();native.cancel(token,id);reject(new DOMException('Request cancelled.','AbortError'));};
  const remove=()=>signal?.removeEventListener('abort',abort);
  const pairing=/^\/api\/security\/(hello|proof)$/.test(new URL(String(address),location.href).pathname),limit=pairing?15000:8000;
  const timeout=Math.max(150,Math.min(limit,Number(options.aerionTimeout)||1500)),timer=setTimeout(abort,timeout+100);pending.set(id,{resolve,reject,timer,remove});signal?.addEventListener('abort',abort,{once:true});
  try{native.request(token,id,String(address),method,options.body?String(options.body):'',timeout)}catch(e){pending.delete(id);clearTimeout(timer);remove();reject(e)}
 });
 navigator.sendBeacon=(address,body)=>{window.fetch(String(address),{method:'POST',body}).catch(()=>{});return true};
 android.offerInput=(base,id,cid,ch,run)=>native.offerInput(token,base,id,cid,ch.join(','),run);
 android.installSecure=(base,id,cid,sid,keys)=>native.installSecure(token,base,id,cid,sid,JSON.stringify(keys));
 android.monitorTicket=(base,id)=>native.monitorTicket(token,base,id);
 android.pairCode=id=>native.pairCode(token,id);android.savePairCode=(id,code)=>native.savePairCode(token,id,code);
 android.rcDiagnostics=()=>{try{return JSON.parse(native.rcDiagnostics?.(token)||'{}')}catch{return{}}};
 android.pauseStream=(base,id,client)=>native.pauseStream?.(token,base,id,client);
 android.saveFile=(name,body,mime)=>native.saveFile(token,name,body,mime);
 android.openWifi=()=>native.openWifi(token);
 android.useRouterWifi=(ssid='',fromAp=false)=>native.useRouterWifi(token,ssid,fromAp);android.routerReady=()=>{wifiUi('Router Wi-Fi connected. Checking the kit…');android.connectedRouter?.()};
 android.joinWifi=()=>{android.selectNetwork?.('AP');native.joinWifi(token,document.getElementById('expectedId').value.trim())};
 android.joinRouter=()=>{android.selectNetwork?.('STA');wifiUi('Join the same router as the STA kit and WebApp. Enter the kit router IP, then Check connection.');android.useRouterWifi('',false)};
 const wifiUi=(message,busy=false)=>{document.getElementById('pairMessage').textContent=message;document.getElementById('androidWifi').disabled=busy;document.getElementById('androidRouterWifi').disabled=busy;document.getElementById('checkConnection').disabled=busy;};
 android.wifiProgress=message=>wifiUi(message,true);
 android.wifiError=message=>wifiUi(message);
 android.wifiReady=()=>{wifiUi('Kit Wi-Fi connected. Checking its Device ID…');android.connectedWifi?.()};
 android.pause=()=>{};android.resume=()=>{};android.networkLost=()=>{};android.stopped=()=>{};
 addEventListener('DOMContentLoaded',()=>{
  const button=document.createElement('button');button.id='androidWifi';button.className='primary';button.textContent='Real flight · Kit AP';button.onclick=android.joinWifi;
  const choices=document.createElement('div');choices.className='connection-choices';document.querySelector('#connectDialog .dialog-head').after(choices);choices.append(button);
  const router=document.createElement('button');router.id='androidRouterWifi';router.className='primary';router.textContent='Training · Router Wi-Fi';router.onclick=android.joinRouter;choices.append(router);
  const version=document.createElement('p');version.id='androidAppVersion';version.className='note';version.textContent='Android 18.3.79-android.2 · Saved pairing and IDs are kept on update.';choices.before(version);
  const settings=document.createElement('button');settings.id='androidWifiSettings';settings.className='secondary';settings.textContent='Phone Wi-Fi settings (STA / Android 8–9)';settings.onclick=android.openWifi;choices.after(settings);
  document.getElementById('pairMessage').textContent='Choose Kit AP for real flight or Router Wi-Fi for training. Training uses the same router as the paired STA kit and WebApp, with its six-digit ID on app home. Use Phone Wi-Fi settings if the router is not connected.';
  document.querySelector('#settingsDialog .links').hidden=true;
  document.getElementById('fullscreen').hidden=true;
 });
})();
