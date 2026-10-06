'use strict';
// Actual updater functions and compiled images; USB/XHR transport is simulated.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'firmware-updater.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'firmware-catalog.json'))),nodes=new Map(),writes=[],posts=[];
function node(){return{textContent:'',value:'app',checked:false,style:{},classList:{toggle(){}},setAttribute(){}}}
for(const s of ['#fwImageType','#fwEraseUsb','#fwLog','#fwOverallBadge','#fwProgressBar'])nodes.set(s,node());
const ID='ZFC-001122334455';let selected=null,readVersion="18.3.60",resetFailure=false;
const client={base:'http://192.168.4.1',deviceId:ID,clientId:'WEB-TEST',connected:true,uploadFirmware:async(bytes,name,boardId)=>{const form=new FormData();form.append('firmware',new Blob([bytes]),name);posts.push({url:`http://192.168.4.1/api/firmware/update?clientId=WEB-TEST&expectedDeviceId=${ID}&boardId=${boardId}`,form});return{ok:true};},firmwareInfo:async()=>({boardId:'ZFC-A2',firmware:readVersion,freeSketchBytes:1310720,armed:selected?.armed})};
const school={client,getSelectedDevice:()=>selected,canControl:()=>true,markOffline(){},reconnectAfterFirmware:async()=>selected,refreshNow:async()=>selected};
class XHR{constructor(){this.upload={}}open(method,url){this.method=method;this.url=url}send(form){posts.push({url:this.url,form});this.status=200;this.responseText='{"ok":true}';this.onload()}}
const sandbox={window:{zebjusSchool:school,addEventListener(){}},document:{querySelector:s=>nodes.get(s)||null,readyState:'loading',addEventListener(){}},console,Uint8Array,Blob,FormData,XMLHttpRequest:XHR,setTimeout:f=>{queueMicrotask(f)},setInterval:()=>1,clearInterval(){},confirm:()=>true,Date};
vm.createContext(sandbox);vm.runInContext(source.replace(/\}\)\(\);\s*$/,`window.test={mapHardwareSignature,validateEspImage,usbFlash,wifiFlash,set:(f,id)=>{fw=f;catalog=globalThis.cat;usbBoardId=id;loader={writeFlash:async options=>globalThis.writes.push(options),after:async()=>{if(globalThis.resetFailure)throw Error('Reset unavailable')}}},busy:()=>busy};})();`),Object.assign(sandbox,{cat:catalog,writes,resetFailure:false}));
const api=sandbox.window.test;
function image(board,kind){return new Uint8Array(fs.readFileSync(path.join(root,'FlightCore_Firmware',board.latest[kind].file)))}
(async()=>{
 api.set({},'');
 for(const [signature,expected] of [['ESP32-C6 (revision 0)','ZFC-A2'],['ESP32C6','ZFC-A2'],['ESP32-C3 (revision v0.4)','ZFC-A1'],['ESP32-C61 (revision v0.0)',''],['unknown ESP32-C6','']])assert.equal(api.mapHardwareSignature(signature),expected);
 for(const b of catalog.boards){
  for(const kind of ['app','factory']){
   const bytes=image(b,kind);api.set({bytes,name:b.latest[kind].file,type:kind,boardId:b.id,version:catalog.version},b.id);assert.equal(api.validateEspImage(bytes,b.id,kind).chipId,b.imageChipIds[0]);
   selected=null;nodes.get('#fwImageType').value=kind;await api.usbFlash();assert.equal(writes.at(-1).fileArray[0].address,kind==='factory'?0:65536);assert.equal(writes.at(-1).fileArray[0].data.length,bytes.length);assert.equal(writes.at(-1).flashMode,'keep');assert.equal(writes.at(-1).flashFreq,'keep');assert.equal(writes.at(-1).flashSize,'keep');assert.equal(typeof writes.at(-1).calculateMD5Hash,'function');assert.match(nodes.get('#fwOverallBadge').textContent,/PENDING/,'writing bytes alone does not confirm boot');
  }
  const other=catalog.boards.find(x=>x.id!==b.id);assert.throws(()=>api.validateEspImage(image(b,'app'),other.id,'app'),/chip ID/);
  assert.throws(()=>api.validateEspImage(image(b,'factory'),b.id,'app'),/descriptor/,'factory cannot be relabelled as OTA APP');
 }
 const b=catalog.boards.find(b=>b.id==='ZFC-A2'),bytes=image(b,'app');
 const current={bytes,name:b.latest.app.file,type:'app',boardId:b.id,version:catalog.version};
 sandbox.resetFailure=true;api.set(current,b.id);await api.usbFlash();assert.match(nodes.get('#fwOverallBadge').textContent,/PENDING/,'reset failure after write remains a boot recovery state');sandbox.resetFailure=false;
 selected={deviceId:ID,online:true,armed:false};school.reconnectNow=async()=>selected;readVersion=catalog.version;api.set(current,b.id);await api.usbFlash();assert.equal(nodes.get('#fwOverallBadge').textContent,'COMPLETE');
 readVersion='18.3.60';api.set(current,b.id);await api.usbFlash();assert.match(nodes.get('#fwOverallBadge').textContent,/PENDING/,'old firmware readback is not a successful update');
 selected={deviceId:ID,deviceName:'Kit',online:true,armed:false};
 api.set({bytes,name:b.latest.app.file,type:'app',boardId:b.id,version:catalog.version},'');await api.wifiFlash();assert.equal(posts.length,1);const url=new URL(posts[0].url);assert.equal(url.searchParams.get('expectedDeviceId'),ID);assert.equal(url.searchParams.get('boardId'),'ZFC-A2');assert.equal(posts[0].form.get('firmware').size,bytes.length);
 selected.armed=true;await api.wifiFlash();assert.equal(posts.length,1,'ARM blocks OTA');selected.armed=false;api.set({bytes:image(b,'factory'),name:'factory.bin',type:'factory',boardId:b.id},'');await api.wifiFlash();assert.equal(posts.length,1,'FACTORY blocks OTA');
 api.set({bytes,name:'app.bin',type:'app',boardId:b.id},'ZFC-A1');const before=writes.length;await api.usbFlash();assert.equal(writes.length,before,'wrong USB profile blocks flash');
 const localWindow={},network=[];vm.runInNewContext(fs.readFileSync(path.join(root,'kit-local.js'),'utf8'),{window:localWindow,console,performance,AbortController,setTimeout,clearTimeout,URLSearchParams,FormData,Blob,fetch:async(url,options)=>{network.push({url,options});return{ok:true,status:200,text:async()=>'{"ok":true,"bytes":1287184}'};}});
 const localClient=new localWindow.ZebjusDroneKit.LocalKitClient();localClient.base='http://192.168.4.1';localClient.deviceId=ID;await localClient.uploadFirmware(bytes,b.latest.app.file,'ZFC-A2');assert.equal(network.length,1);assert.equal(network[0].options.targetAddressSpace,'local');assert.equal(network[0].options.method,'POST');assert.equal(network[0].options.body.get('firmware').size,bytes.length);assert(!('Content-Type' in network[0].options.headers),'browser supplies multipart boundary');assert.equal(new URL(network[0].url).searchParams.get('expectedDeviceId'),ID);
 console.log('PASS: compiled APP/FACTORY headers / USB 0x10000 and 0x0 / OTA APP upload / identity / wrong profile / armed block. No physical flashing performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
