(function(){
'use strict';
function confirmInLab(message){return window.AerionDialogs?.confirm(message)??Promise.resolve(confirm(message))}

const $=s=>document.querySelector(s),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const VERSION='18.4.0',BASE=location.pathname.includes('/flight/')?'../FlightCore_Firmware':'./FlightCore_Firmware',DB='zebjus-flightcore-firmware',STORE='images';
let catalog=null,fw=null,serialPort=null,transport=null,loader=null,usbSignature='',usbBoardId='',busy=false,loading=false,criticalBusy=false,usbConnecting=false,loadEpoch=0,catalogSource='',liveFirmwareBuiltAt='',postFlashWatchTimer=null;
const EMBEDDED_CATALOG={"schema":2,"product":"ZEBJUS_FLIGHTCORE","version":"18.4.0","defaultBoardId":"ZFC-A1","boards":[{"id":"ZFC-A1","name":"ZEBJUS FlightCore A1 \u2022 ESP32-C3","appAddress":"0x10000","flashMode":"dio","flashFreq":"80m","flashSize":"4MB","latest":{"version":"18.4.0","app":{"available":false,"file":"ZEBJUS_FLIGHTCORE_A1_APP.bin","sha256":"","size":0,"builtAt":"","buildId":""},"factory":{"available":false,"file":"ZEBJUS_FLIGHTCORE_A1_FACTORY.bin","sha256":"","size":0,"builtAt":"","buildId":""}},"usbMatch":["ESP32-C3","ESP32C3"],"flasher":"serial-loader-v1","build":{"builder":"arduino-cli","fqbn":"esp32:esp32:esp32c3"},"imageChipIds":[5],"supportedSensors":["LSM6DS3","MPU6050"],"recommendedSensor":"LSM6DS3"},{"id":"ZFC-A2","name":"ZEBJUS FlightCore A2 \u2022 ZEBJUS Aerion F1","appAddress":"0x10000","flashMode":"dio","flashFreq":"80m","flashSize":"4MB","latest":{"version":"18.4.0","app":{"available":false,"file":"ZEBJUS_FLIGHTCORE_A2_APP.bin","sha256":"","size":0,"builtAt":"","buildId":""},"factory":{"available":false,"file":"ZEBJUS_FLIGHTCORE_A2_FACTORY.bin","sha256":"","size":0,"builtAt":"","buildId":""}},"usbMatch":["ZEBJUS Aerion F1","ESP32C6"],"flasher":"serial-loader-v1","build":{"builder":"arduino-cli","fqbn":"esp32:esp32:XIAO_ESP32C6"},"imageChipIds":[13],"supportedSensors":["MPU6050","LSM6DS3"],"recommendedSensor":"MPU6050"}]};
function school(){return window.zebjusSchool||null}
function log(msg){const e=$('#fwLog');if(e)e.textContent=`${new Date().toLocaleTimeString()}  ${msg}\n${e.textContent}`.slice(0,16000)}
function text(id,v){const e=$(id);if(e)e.textContent=v}
function textTitle(id,v){const e=$(id);if(e){e.textContent=v;e.title=String(v||'')}}
function badge(id,label,cls=''){const e=$(id);if(e){e.textContent=label;e.className='status '+cls}}
function prettyBytes(n){n=+n||0;if(n<1024)return n+' B';if(n<1048576)return(n/1024).toFixed(1)+' KB';return(n/1048576).toFixed(2)+' MB'}
function formatBuildTime(v){if(!v)return'--';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString([], {year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:true})}
function stage(name,state){const e=$('#fwStage'+name);if(e)e.className=state||''}
function resetStages(){['Prepare','Flash','Verify','Reboot','Reconnect'].forEach(x=>stage(x,''))}
function progress(p,title){p=Math.max(0,Math.min(100,Math.round(p)));const b=$('#fwProgressBar');if(b)b.style.width=p+'%';text('#fwProgressPct',p+'%');if(title)text('#fwProgressTitle',title)}
function setBusy(on,kind='critical'){if(kind==='load')loading=!!on;else criticalBusy=!!on;busy=loading||criticalBusy;['#fwAutoLoadBtn','#fwWifiFlashBtn','#fwUsbFlashBtn','#fwDisconnectUsbBtn','#fwBoardProfile','#fwImageType','#fwFileInput','#fwUsbBaud','#fwEraseUsb'].forEach(s=>{const e=$(s);if(e)e.disabled=busy});const usb=$('#fwConnectUsbBtn');if(usb)usb.disabled=criticalBusy||usbConnecting;const erase=$('#fwEraseUsb');if(erase&&$('#fwImageType')?.value==='app'){erase.disabled=true;erase.checked=false}const page=$('#tab-firmware'),label=$('.firmware-file-label');if(page)page.classList.toggle('firmware-busy',busy);if(label)label.setAttribute('aria-disabled',busy?'true':'false')}
async function download(url,type='json',timeout=10000){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{const r=await fetch(url,{cache:'no-store',signal:ctl.signal});if(!r.ok)throw Error('HTTP '+r.status);return type==='json'?await r.json():new Uint8Array(await r.arrayBuffer())}finally{clearTimeout(timer)}}
async function sha256(bytes){try{const h=await crypto.subtle.digest('SHA-256',bytes);return[...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,'0')).join('')}catch{return''}}
function inferType(name){return/factory|merged|merge\.bin/i.test(String(name||''))?'factory':'app'}
function inferVersion(name){const m=String(name||'').match(/(?:v|_)(\d+)[._-](\d+)[._-](\d+)/i);return m?`${m[1]}.${m[2]}.${m[3]}`:'Custom'}
function boardById(id){return catalog?.boards?.find(b=>b.id===id)||null}
function mapHardwareSignature(raw){const s=String(raw||'').toUpperCase();for(const b of catalog?.boards||[])for(const m of b.usbMatch||[])if(s.includes(String(m).toUpperCase()))return b.id;return''}
function boardName(id){return boardById(id)?.name||id||'Unknown board'}
function cleanHardwareText(v){return String(v||'').replace(/ESP32[- ]?C[36]/ig,'controller').replace(/ESP32C[36]/ig,'controller').replace(/ESP-ROM[^\n]*/ig,'FlightCore bootloader').replace(/Espressif/ig,'ZEBJUS controller')}
function validateEspImage(bytes,boardId,type='app'){if(!(bytes instanceof Uint8Array)||bytes.length<32768)throw new Error('Firmware file is too small to be a valid controller image.');if(bytes[0]!==0xE9)throw new Error('Invalid firmware image: ESP image magic 0xE9 is missing.');const segments=bytes[1];if(segments<1||segments>16)throw new Error('Invalid firmware image: segment table is not plausible.');let nonZero=0,nonFF=0;const step=Math.max(1,Math.floor(bytes.length/8192));for(let i=0;i<bytes.length;i+=step){if(bytes[i]!==0)nonZero++;if(bytes[i]!==0xFF)nonFF++}if(nonZero<64||nonFF<64)throw new Error('Invalid firmware image: file contains mostly empty/zero data.');const board=boardById(boardId),chipId=bytes.length>13?(bytes[12]|(bytes[13]<<8)):null,allowed=board?.imageChipIds||[];if(allowed.length&&chipId!=null&&!allowed.includes(chipId))throw new Error(`Firmware chip ID ${chipId} does not match ${boardName(boardId)}.`);const appOffset=type==='factory'?parseInt(board?.appAddress||'0x10000'):0;
if(bytes.length<appOffset+32768||bytes[appOffset]!==0xE9)throw new Error('Application image is missing at the required flash offset.');
const appChip=bytes[appOffset+12]|(bytes[appOffset+13]<<8);
if(allowed.length&&!allowed.includes(appChip))throw new Error('Factory application belongs to a different controller profile.');
const descriptor=(bytes[appOffset+32]|(bytes[appOffset+33]<<8)|(bytes[appOffset+34]<<16)|(bytes[appOffset+35]<<24))>>>0;
if(descriptor!==0xABCD5432)throw new Error('Application descriptor missing. Select the correct APP or FACTORY image.');
return{segments,chipId,type,appOffset}}
async function loadCatalog(){
 if(catalog)return catalog;
 const urls=window.AerionAndroid?[]:[`${BASE}/catalog.json?v=${VERSION}`,`${BASE}/../firmware-catalog.json?v=${VERSION}`];
 for(const url of urls){
   try{
     const j=await download(url,'json',2500);
     if(!j?.boards?.length)continue;
     catalog=j;catalogSource=url;break;
   }catch(_){}
 }
 if(!catalog){
   catalog=JSON.parse(JSON.stringify(EMBEDDED_CATALOG));
   catalogSource='embedded';
   log('Firmware catalog file unavailable • using built-in board catalog.');
 }
 const sel=$('#fwBoardProfile');
 if(sel){for(const b of catalog.boards||[]){if(!sel.querySelector(`option[value="${b.id}"]`)){const o=document.createElement('option');o.value=b.id;o.textContent=b.name;sel.appendChild(o)}}}
 return catalog;
}
async function fetchBundledFirmware(file,version){
 const paths=[`${BASE}/${file}?v=${encodeURIComponent(version||VERSION)}`,`./${file}?v=${encodeURIComponent(version||VERSION)}`];
 let last='';
 for(const src of paths){try{return{bytes:await download(src,'bytes',15000),src}}catch(e){last=e?.message||String(e)}}
 throw new Error(`Firmware package file is not present (${last||'not found'}).`);
}
async function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function cacheKey(boardId,type){return`${boardId||'unknown'}:${type||'app'}`}
async function cacheFirmware(){if(!fw)return;try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({...fw,bytes:fw.bytes.buffer},cacheKey(fw.boardId,fw.type));tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){log('Could not cache firmware: '+e.message)}}
async function loadCached(boardId,type='app'){try{const db=await openDb(),v=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(cacheKey(boardId,type));r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});db.close();if(v?.bytes){await setFirmware(new Uint8Array(v.bytes),v.name||'cached.bin',{type:v.type,version:v.version,boardId:v.boardId,builtAt:v.builtAt,buildId:v.buildId,cache:false,source:'Browser cache'});return true}}catch{}return false}
async function clearCached(){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch{}fw=null;renderFirmware();log('Cached firmware cleared.')}
async function setFirmware(bytes,name,opt={}){if(!(bytes instanceof Uint8Array))bytes=new Uint8Array(bytes);const type=opt.type||inferType(name),boardId=opt.boardId||await targetBoardId(false);const imageInfo=validateEspImage(bytes,boardId,type),hash=await sha256(bytes);fw={bytes,name,type,version:opt.version||inferVersion(name),builtAt:opt.builtAt||'',buildId:opt.buildId||'',boardId,hash,imageInfo,source:opt.source||'Imported file'};renderFirmware();if(opt.cache!==false)await cacheFirmware();log(`Firmware verified: ${name} • ${boardName(boardId)} • chip ${imageInfo.chipId??'--'} • ${prettyBytes(bytes.length)} • ${type}`)}
function renderFirmware(){const has=!!fw;textTitle('#fwFileName',has?fw.name:'No firmware loaded');text('#fwFileVersion',has?fw.version:'--');textTitle('#fwBuildTime',has?formatBuildTime(fw.builtAt):'--');textTitle('#fwBuildId',has?(fw.buildId||'Imported / custom'):'--');text('#fwFileSize',has?prettyBytes(fw.bytes.length):'--');textTitle('#fwFileHash',has?(fw.hash?fw.hash.slice(0,18)+'…':'Unavailable'):'--');badge('#fwSourceBadge',has?'LOADED':'NO FILE',has?'good':'');const t=$('#fwImageType');if(t&&has)t.value=fw.type;const erase=$('#fwEraseUsb');if(erase){erase.disabled=(t?.value||fw?.type)==='app';if(erase.disabled)erase.checked=false}}
async function onlineBoardInfo(){const s=school(),d=s?.getSelectedDevice?.();if(!d?.online||!s?.client?.connected)return null;try{const i=await s.client.firmwareInfo();liveFirmwareBuiltAt=i.firmwareBuiltAt||i.buildDateTime||i.buildTime||liveFirmwareBuiltAt;return{...i,boardId:i.boardId||mapHardwareSignature(i.chip),boardName:i.boardName||boardName(i.boardId||mapHardwareSignature(i.chip))}}catch{return null}}
async function targetBoardId(updateUi=true){await loadCatalog();const manual=$('#fwBoardProfile')?.value||'auto';let id='',source='';if(manual!=='auto'){id=manual;source='Manual selection'}else if(usbBoardId){id=usbBoardId;source='USB auto-detect'}else{const info=await onlineBoardInfo();if(info?.boardId){id=info.boardId;source='Online kit auto-detect'}}if(!id){id=catalog.defaultBoardId;source='Default profile'}if(updateUi){text('#fwDetectedBoard',boardName(id));text('#fwBoardSource',source);const p=boardById(id)?.latest?.[$('#fwImageType')?.value||'app'];text('#fwPackageState',p?.available?`Bundled ${boardById(id).latest.version}`:'Build not bundled')}return id}
async function autoLoad(){
 if(window.AerionAndroid){log('Choose a matching .bin downloaded from the firmware links.');text('#fwSourceMessage','Choose the matching APP .bin to update this controller over Wi-Fi.');return;}
 const epoch=++loadEpoch;setBusy(true,'load');resetStages();stage('Prepare','active');progress(5,'Checking matching firmware…');
 try{const id=await targetBoardId(true),type=$('#fwImageType')?.value||'app',b=boardById(id),pkg=b?.latest?.[type];
  if(!pkg?.available||!pkg.file)throw Error('The matching firmware build is not published yet.');
  const bytes=pkg.url?await download(pkg.url,'bytes',15000):(await fetchBundledFirmware(pkg.file,b.latest.version||VERSION)).bytes;
  const hash=await sha256(bytes);if(pkg.sha256&&hash.toLowerCase()!==String(pkg.sha256).toLowerCase())throw Error('Bundled firmware checksum mismatch.');
  if(epoch!==loadEpoch)return;await setFirmware(bytes,pkg.file,{type,version:b.latest.version,builtAt:pkg.builtAt||b.latest.builtAt,buildId:pkg.buildId||'',boardId:id,source:'Published package'});
  text('#fwSourceMessage','Matching firmware loaded.');text('#fwPackageState','READY · '+b.latest.version);progress(100,'Firmware ready');stage('Prepare','done');
 }catch(e){if(epoch===loadEpoch){log('Load firmware: '+e.message);progress(0,'Choose a matching .bin or retry');stage('Prepare','error');}}
 finally{if(epoch===loadEpoch)setBusy(false,'load');}
}
async function importFile(file){if(!file)return;if(!/\.bin$/i.test(file.name))throw new Error('Select a compiled .bin firmware file.');const id=await targetBoardId(true);await setFirmware(new Uint8Array(await file.arrayBuffer()),file.name,{boardId:id});text('#fwSourceMessage',`Imported firmware assigned to ${boardName(id)} and cached in this browser.`);text('#fwPackageState','IMPORTED');progress(100,'Firmware ready');stage('Prepare','done')}
function kitStatus(){const s=school(),d=s?.getSelectedDevice?.(),online=!!d?.online;text('#fwCurrentVersion',online?(d.firmware||d.version||'--'):'--');textTitle('#fwCurrentBuildTime',online?formatBuildTime(d.firmwareBuiltAt||d.buildDateTime||d.buildTime||liveFirmwareBuiltAt):'--');text('#fwDeviceId',online?(d.deviceId||'--'):'--');text('#fwKitState',online?(d.armed?'ARMED':'ONLINE • DISARMED'):'OFFLINE');text('#fwLiveBoard',online?(d.boardName||boardName(d.boardId)||'Detecting…'):'--');const kb=$('#fwKitBadge');if(kb){kb.textContent=online?'KIT ONLINE':'KIT OFFLINE';kb.className='firmware-badge '+(online?'online':'offline')}return{s,d,online}}
async function refreshKit(){const{s}=kitStatus();try{await s?.refreshNow?.();const info=await onlineBoardInfo();if(info?.boardId){text('#fwLiveBoard',info.boardName||boardName(info.boardId));text('#fwCurrentVersion',info.firmware||info.version||'--');textTitle('#fwCurrentBuildTime',formatBuildTime(info.firmwareBuiltAt||info.buildDateTime||info.buildTime||''));if(!usbBoardId)await targetBoardId(true)}kitStatus();log('Kit status refreshed.')}catch(e){log('Kit check: '+e.message)}}
function ensureWifiReady(){const{s,d,online}=kitStatus();if(!fw)throw new Error('Load firmware first.');if(fw.type!=='app')throw new Error('Wi-Fi OTA accepts an application image only. Use USB for Factory/Merged images.');if(!online||!s?.client?.connected)throw new Error('Connect the kit first.');if(d.armed)throw new Error('DISARM the flight controller before firmware update.');if(!s.canControl?.())throw new Error('Take Control of the kit before firmware update.');return s}
async function verifyPostFlashFirmware(s,expectedVersion=''){
 try{
   const info=await s?.client?.firmwareInfo?.();if(!info)return null;
   liveFirmwareBuiltAt=info.firmwareBuiltAt||info.buildDateTime||info.buildTime||liveFirmwareBuiltAt;
   text('#fwCurrentVersion',info.firmware||info.version||'--');textTitle('#fwCurrentBuildTime',formatBuildTime(liveFirmwareBuiltAt));text('#fwLiveBoard',info.boardName||boardName(info.boardId)||'--');
   const actual=String(info.firmware||info.version||'').trim();
   return{info,actual,matches:!expectedVersion||actual===String(expectedVersion)};
 }catch{return null}
}
function stopPostFlashWatch(){if(postFlashWatchTimer){clearInterval(postFlashWatchTimer);postFlashWatchTimer=null}}
function startPostFlashWatch(expectedVersion=''){
 stopPostFlashWatch();const deadline=Date.now()+300000;let checking=false;
 postFlashWatchTimer=setInterval(async()=>{
   if(checking)return;checking=true;
   try{
     const s=school(),d=s?.getSelectedDevice?.();
     if(d?.online&&s?.client?.connected){
       const v=await verifyPostFlashFirmware(s,expectedVersion);
       if(v){stage('Reconnect','done');progress(100,v.matches?'Update complete • kit reconnected & firmware verified':'Kit reconnected • verify firmware version');badge('#fwOverallBadge',v.matches?'COMPLETE':'RECONNECTED','good');log(v.matches?`Kit reconnected in background • firmware ${v.actual} verified.`:`Kit reconnected in background • reports firmware ${v.actual||'unknown'}; expected ${expectedVersion}.`);stopPostFlashWatch();await refreshKit();}
     }else if(Date.now()<deadline){try{await s?.reconnectNow?.()}catch{}}
     if(Date.now()>=deadline){stopPostFlashWatch();log('Background reconnect watch ended after 5 minutes. Firmware flash had already completed successfully.');}
   }finally{checking=false}
 },4500)
}
async function wifiFlash(){
 if(busy)return;stopPostFlashWatch();let s;
 try{await window.AerionController?.prepareConfiguration()}catch(e){log(e.message);return;}
 try{
   s=ensureWifiReady();const info=await s.client.firmwareInfo(),target=fw.boardId||await targetBoardId(false),actual=info.boardId||mapHardwareSignature(info.chip);
   if(info?.armed)throw new Error('DISARM the flight controller before firmware update.');
   if(actual&&target&&actual!==target)throw new Error(`Firmware is for ${boardName(target)}, but the connected controller is ${info.boardName||boardName(actual)}.`);
   if(info?.freeSketchBytes&&fw.bytes.length>+info.freeSketchBytes)throw new Error(`Firmware is ${prettyBytes(fw.bytes.length)}, larger than the available application space ${prettyBytes(info.freeSketchBytes)}.`);
   log(`OTA target verified: ${info.boardName||boardName(actual)} • current ${info.firmware||'--'}`)
 }catch(e){log(e.message);badge('#fwOverallBadge','BLOCKED','warn');return}
 if(!await confirmInLab(`Flash ${fw.name} to ${s.getSelectedDevice().deviceName||'selected kit'} over Wi-Fi?\n\nKeep the drone DISARMED and powered until reboot completes.`))return;
 setBusy(true);resetStages();stage('Prepare','done');stage('Flash','active');progress(2,'Uploading firmware to kit…');badge('#fwOverallBadge','UPDATING','warn');
 const c=s.client,url=`${c.base}/api/firmware/update?clientId=${encodeURIComponent(c.clientId)}&boardId=${encodeURIComponent(fw.boardId||'')}&expectedDeviceId=${encodeURIComponent(c.deviceId)}`;
 try{
   const result=window.AerionAndroid?.uploadFirmware?await window.AerionAndroid.uploadFirmware(url,fw.bytes,{clientId:c.clientId,expectedDeviceId:c.deviceId,boardId:fw.boardId}):await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('POST',url,true);x.timeout=120000;x.upload.onprogress=e=>{if(e.lengthComputable)progress(5+(e.loaded/e.total)*78,`Uploading ${prettyBytes(e.loaded)} / ${prettyBytes(e.total)}`)};x.onerror=()=>reject(new Error('Firmware upload connection failed.'));x.ontimeout=()=>reject(new Error('Firmware upload timed out.'));x.onload=()=>{let r={};try{r=JSON.parse(x.responseText||'{}')}catch{}if(x.status>=200&&x.status<300&&r.ok!==false)resolve(r);else reject(new Error(r.message||`Kit returned HTTP ${x.status}`))};const f=new FormData();f.append('firmware',new Blob([fw.bytes],{type:'application/octet-stream'}),fw.name);x.send(f)});
   stage('Flash','done');stage('Verify','done');progress(88,'Firmware verified • rebooting…');stage('Reboot','active');log(result.message||'Firmware written successfully.');
   await sleep(1900);stage('Reboot','done');stage('Reconnect','active');progress(92,'Firmware flashed • waiting for Wi-Fi reboot…');badge('#fwOverallBadge','FLASHED • RECONNECTING','warn');s.markOffline?.('Firmware reboot');
   const totalMs=120000,reconnectStart=Date.now();let d=null;
   if(s.reconnectAfterFirmware){
     d=await s.reconnectAfterFirmware({totalMs,onProgress:x=>{const pct=92+Math.min(1,x.elapsedMs/totalMs)*7;const labels={cached:'Trying previous IP…',mdns:'Waiting for kit-name.local…',discovery:'Scanning same Wi-Fi for the kit…',timeout:'Reconnect window elapsed'};progress(Math.min(99,pct),`${labels[x.phase]||'Reconnecting…'} ${Math.round(x.elapsedMs/1000)}s / 120s`)}})
   }else{
     for(let i=0;i<60;i++){await sleep(1900);try{d=await s.reconnectNow?.();if(d?.online)break}catch{}progress(Math.min(99,92+(Date.now()-reconnectStart)/totalMs*7),`Reconnecting… ${Math.round((Date.now()-reconnectStart)/1000)}s / 120s`)}
   }
   if(d?.online){
     const v=await verifyPostFlashFirmware(s,fw.version==='Custom'?'':fw.version);stage('Reconnect','done');progress(100,v?.matches?'Update complete • kit reconnected & firmware verified':'Kit reconnected • verify firmware version');badge('#fwOverallBadge',v?.matches?'COMPLETE':'RECONNECTED','good');log(v?.matches?`Automatic reconnect complete • firmware ${v.actual} verified.`:`Kit reconnected, but firmware reports ${v?.actual||'unknown'} (expected ${fw.version}).`);await refreshKit()
   }else{
     progress(99,'Flash successful • reconnect still pending');badge('#fwOverallBadge','FLASH SUCCESS • RECONNECT PENDING','warn');log('Firmware flash succeeded. The kit has not reappeared yet; background reconnect will continue for up to 5 minutes.');startPostFlashWatch(fw.version)
   }
 }catch(e){stage('Flash','error');badge('#fwOverallBadge','FAILED','danger');progress(0,'Update failed');log('Wi-Fi update failed: '+e.message)}finally{setBusy(false)}
}
async function loadUsbFlasher(){try{return await import(location.pathname.includes('/flight/')?'../vendor/esptool/bundle.mjs':'./vendor/esptool/bundle.mjs')}catch(e){throw Error('USB loader could not load. Refresh the page or use the direct USB link.')}}
async function connectUsb(){
 if(usbConnecting||criticalBusy)return;
 if(window.isSecureContext===false){log('USB requires HTTPS or localhost. Open the direct USB page.');text('#fwUsbState','Open HTTPS USB page');return;}
 if(!navigator.serial?.requestPort){log('USB port selection requires desktop Chrome / Edge. Use Wi-Fi update on the Android app.');text('#fwUsbState','Desktop Chrome / Edge required');return;}
 const policy=document.permissionsPolicy||document.featurePolicy;
 if(policy?.allowsFeature&&!policy.allowsFeature('serial')){log('This embedded page blocks USB. Click Open USB page directly.');text('#fwUsbState','Open USB page directly');return;}
 usbConnecting=true;setBusy(true);badge('#fwOverallBadge','SELECT USB PORT','warn');text('#fwUsbState','Choose the controller in the browser port picker');
 try{
  // Call the chooser directly in the click event, before any await or download.
  const selected=navigator.serial.requestPort();serialPort=await selected;++loadEpoch;setBusy(false,'load');
  text('#fwUsbState','Port selected · connecting bootloader…');await loadCatalog();const mod=await loadUsbFlasher();
  transport=new mod.Transport(serialPort,true);loader=new mod.ESPLoader({transport,baudrate:+($('#fwUsbBaud')?.value||115200),terminal:{clean(){},writeLine(v){if(String(v).trim())log('[USB] '+String(v))},write(v){if(String(v).trim())log('[USB] '+String(v))}}});
  usbSignature=await loader.main();usbBoardId=mapHardwareSignature(usbSignature);if(!usbBoardId)throw Error('Selected USB device is not a supported FlightCore A1 / A2.');
  text('#fwUsbChip',boardName(usbBoardId));text('#fwUsbState','Bootloader connected');const badgeNode=$('#fwSerialBadge');if(badgeNode){badgeNode.textContent='USB CONNECTED';badgeNode.className='online'}badge('#fwOverallBadge','USB READY','good');
  await targetBoardId(true);log('USB connected: '+boardName(usbBoardId));
 }catch(e){await disconnectUsb(false);if(e.name==='NotFoundError'){text('#fwUsbState','No port selected · retry Select USB port');badge('#fwOverallBadge','SELECT PORT','warn');log('Port selection cancelled. Click Select USB port to retry.');}else if(e.name==='SecurityError'){text('#fwUsbState','USB permission blocked · open direct page');log('USB permission blocked. Open the USB page directly and allow the controller port.');}else{badge('#fwOverallBadge','USB CONNECT FAILED','danger');text('#fwUsbState',e.message);log('USB: '+e.message+' Close Arduino Serial Monitor and reconnect the USB cable before retrying.');}}
 finally{usbConnecting=false;setBusy(false);}
}
async function usbFlash(){if(busy)return;if(!fw)return log('Load firmware first.');if(!loader)return log('Connect USB first.');const type=fw.type,target=fw.boardId||await targetBoardId(false);if(usbBoardId&&target!==usbBoardId)return log(`Blocked: firmware is for ${boardName(target)}, USB controller is ${boardName(usbBoardId)}.`);const erase=!!$('#fwEraseUsb')?.checked;if(erase&&type!=='factory')return log('Erase is blocked for application-only images because it would remove the bootloader/partition table.');const bp=boardById(target);if(!bp)return log('Selected board profile is not available.');if(!await confirmInLab(`USB flash ${fw.name}\nType: ${type==='factory'?'Factory/Merged':'Application'}\nBoard: ${boardName(target)}\n\nContinue?`))return;setBusy(true);resetStages();stage('Prepare','done');stage('Flash','active');progress(2,'Preparing USB flash…');badge('#fwOverallBadge','FLASHING','warn');try{if(erase){progress(4,'Erasing flash…');await loader.eraseFlash()}const address=type==='factory'?0:parseInt(bp.appAddress||'0x10000');await loader.writeFlash({fileArray:[{data:fw.bytes,address}],flashMode:bp.flashMode||'dio',flashFreq:bp.flashFreq||'80m',flashSize:bp.flashSize||'4MB',eraseAll:false,compress:true,reportProgress:(i,w,t)=>progress(5+(w/t)*80,`USB flash ${prettyBytes(w)} / ${prettyBytes(t)}`)});stage('Flash','done');stage('Verify','done');stage('Reboot','active');progress(90,'Flash complete • restarting controller…');await loader.after('hard_reset');stage('Reboot','done');progress(94,'Controller restarted');log('USB firmware flash completed.');await disconnectUsb(false);stage('Reconnect','active');const s=school();if(s?.getSelectedDevice?.()){s.markOffline?.('Firmware reboot');for(let i=0;i<18;i++){await sleep(1100);try{const d=await s.reconnectNow?.();if(d?.online){stage('Reconnect','done');progress(100,'Update complete • kit online');badge('#fwOverallBadge','COMPLETE','good');return}}catch{}}}stage('Reconnect','');progress(100,'USB flash complete');badge('#fwOverallBadge','FLASHED','good')}catch(e){stage('Flash','error');badge('#fwOverallBadge','FAILED','danger');progress(0,'USB flash failed');log('USB flash failed: '+e.message)}finally{setBusy(false)}}
async function disconnectUsb(update=true){try{if(transport)await transport.disconnect()}catch{}loader=null;transport=null;serialPort=null;usbSignature='';usbBoardId='';text('#fwUsbChip','--');text('#fwUsbState','Not connected');const b=$('#fwSerialBadge');if(b){b.textContent='USB NOT CONNECTED';b.className='firmware-badge offline'}if(update){log('USB disconnected.');await targetBoardId(true)}}
async function rebootKit(){const{s,d,online}=kitStatus();if(!online)return log('Kit is offline.');if(d.armed)return log('Reboot blocked: DISARM the kit first.');if(!s?.canControl?.())return log('Take Control before reboot.');if(!await confirmInLab('Reboot the selected flight controller now?'))return;try{badge('#fwOverallBadge','REBOOTING','warn');resetStages();stage('Reboot','active');progress(45,'Sending reboot command…');const j=await s.client.reboot();if(j?.ok===false)throw new Error(j.message||'Reboot failed');s.markOffline?.('Manual reboot');stage('Reboot','done');stage('Reconnect','active');progress(65,'Waiting for kit…');for(let i=0;i<20;i++){await sleep(1000);const d2=await s.reconnectNow?.().catch(()=>null);if(d2?.online){stage('Reconnect','done');progress(100,'Kit rebooted and reconnected');badge('#fwOverallBadge','ONLINE','good');return}}throw new Error('Reconnect timed out')}catch(e){badge('#fwOverallBadge','RECONNECT','warn');log(e.message)}}
async function reconnectKit(){const s=school();if(!s)return;stage('Reconnect','active');progress(60,'Reconnecting to kit…');try{const d=await s.reconnectNow?.(true);if(d?.online){stage('Reconnect','done');progress(100,'Kit online');badge('#fwOverallBadge','ONLINE','good');await refreshKit()}else throw new Error('Kit not found yet.')}catch(e){badge('#fwOverallBadge','OFFLINE','warn');log('Reconnect: '+e.message)}}
async function upgrade(erase=false){if(busy)return;try{if(erase){if(!loader)throw Error('Upgrade & Erase requires a connected USB controller.');$('#fwImageType').value='factory';await autoLoad();if(!fw||fw.type!=='factory')throw Error('Matching complete factory image is required.');$('#fwEraseUsb').checked=true;try{await usbFlash()}finally{$('#fwEraseUsb').checked=false}}else{if(!fw)await autoLoad();if(!fw)throw Error('Load a matching firmware image first.');if(loader)await usbFlash();else await wifiFlash()}}catch(e){log(e.message)}}
function bind(){$('#fwUpgradeBtn')?.addEventListener('click',()=>upgrade(false));$('#fwUpgradeEraseBtn')?.addEventListener('click',()=>upgrade(true));const fi=$('#fwFileInput');if(fi)fi.onchange=()=>importFile(fi.files?.[0]).catch(e=>log(e.message));$('#fwAutoLoadBtn')?.addEventListener('click',autoLoad);$('#fwForgetBtn')?.addEventListener('click',clearCached);$('#fwRefreshKitBtn')?.addEventListener('click',refreshKit);$('#fwConnectUsbBtn')?.addEventListener('click',connectUsb);$('#fwDisconnectUsbBtn')?.addEventListener('click',()=>disconnectUsb());$('#fwWifiFlashBtn')?.addEventListener('click',wifiFlash);$('#fwUsbFlashBtn')?.addEventListener('click',usbFlash);$('#fwRebootBtn')?.addEventListener('click',rebootKit);$('#fwReconnectBtn')?.addEventListener('click',reconnectKit);$('#fwImageType')?.addEventListener('change',async()=>{fw=null;renderFirmware();await autoLoad()});$('#fwBoardProfile')?.addEventListener('change',async()=>{fw=null;renderFirmware();await autoLoad()});const dz=$('#fwDropZone');if(dz){['dragenter','dragover'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.add('drag')}));['dragleave','drop'].forEach(n=>dz.addEventListener(n,e=>{e.preventDefault();dz.classList.remove('drag')}));dz.addEventListener('drop',e=>importFile(e.dataTransfer?.files?.[0]).catch(er=>log(er.message)))}window.addEventListener('beforeunload',()=>{try{transport?.disconnect()}catch{}})}
async function init(){if(!$('#tab-firmware'))return;bind();resetStages();renderFirmware();kitStatus();setInterval(kitStatus,1000);try{await loadCatalog();await targetBoardId(true)}catch(e){log(e.message)}text('#fwSourceMessage','Choose a .bin or click Load latest. USB port selection is ready.');}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));else setTimeout(init,100);
})();
