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
  const timeout=Math.max(150,Math.min(8000,Number(options.aerionTimeout)||1500)),timer=setTimeout(abort,timeout+100);pending.set(id,{resolve,reject,timer,remove});signal?.addEventListener('abort',abort,{once:true});
  try{native.request(token,id,String(address),method,options.body?String(options.body):'',timeout)}catch(e){pending.delete(id);clearTimeout(timer);remove();reject(e)}
 });
 navigator.sendBeacon=(address,body)=>{window.fetch(String(address),{method:'POST',body}).catch(()=>{});return true};
 android.pauseStream=(base,id,client)=>native.pauseStream?.(token,base,id,client);
 android.saveFile=(name,body,mime)=>native.saveFile(token,name,body,mime);
 android.openWifi=()=>native.openWifi(token);
 android.useRouterWifi=()=>native.useRouterWifi(token);android.routerReady=()=>android.connectedRouter?.();
 android.joinWifi=()=>native.joinWifi(token,document.getElementById('expectedId').value.trim());
 const wifiUi=(message,busy=false)=>{document.getElementById('pairMessage').textContent=message;document.getElementById('androidWifi').disabled=busy;document.getElementById('checkConnection').disabled=busy;};
 android.wifiProgress=message=>wifiUi(message,true);
 android.wifiError=message=>wifiUi(message);
 android.wifiReady=()=>{wifiUi('Kit Wi-Fi connected. Checking its Device ID…');android.connectedWifi?.()};
 android.pause=()=>{};android.resume=()=>{};android.networkLost=()=>{};android.stopped=()=>{};
 addEventListener('DOMContentLoaded',()=>{
  const button=document.createElement('button');button.id='androidWifi';button.className='primary';button.textContent='Connect kit Wi-Fi';button.onclick=android.joinWifi;
  document.querySelector('#connectDialog .dialog-head').after(button);
  const settings=document.createElement('button');settings.id='androidWifiSettings';settings.className='secondary';settings.textContent='Phone Wi-Fi settings (STA / Android 8–9)';settings.onclick=android.openWifi;button.after(settings);
  document.getElementById('pairMessage').textContent='Connect kit Wi-Fi here; Android asks you to choose the kit. AP password: 12345678.';
  document.querySelector('#settingsDialog .links').hidden=true;
  document.getElementById('fullscreen').hidden=true;
 });
})();
