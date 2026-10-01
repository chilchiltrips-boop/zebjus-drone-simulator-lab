'use strict';
// Actual updater functions and compiled images; USB/XHR transport is simulated.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'firmware-updater.js'),'utf8');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'firmware-catalog.json'))),nodes=new Map(),writes=[],posts=[];
function node(){return{textContent:'',value:'app',checked:false,style:{},classList:{toggle(){}},setAttribute(){}}}
for(const s of ['#fwImageType','#fwEraseUsb','#fwLog','#fwOverallBadge','#fwProgressBar'])nodes.set(s,node());
const ID='ZFC-001122334455';let selected=null;
const client={base:'http://192.168.4.1',deviceId:ID,clientId:'WEB-TEST',connected:true,firmwareInfo:async()=>({boardId:'ZFC-A2',firmware:'18.3.60',freeSketchBytes:1310720,armed:selected?.armed})};
const school={client,getSelectedDevice:()=>selected,canControl:()=>true,markOffline(){},reconnectAfterFirmware:async()=>selected,refreshNow:async()=>selected};
class XHR{constructor(){this.upload={}}open(method,url){this.method=method;this.url=url}send(form){posts.push({url:this.url,form});this.status=200;this.responseText='{"ok":true}';this.onload()}}
const sandbox={window:{zebjusSchool:school,addEventListener(){}},document:{querySelector:s=>nodes.get(s)||null,readyState:'loading',addEventListener(){}},console,Uint8Array,Blob,FormData,XMLHttpRequest:XHR,setTimeout:f=>{queueMicrotask(f)},setInterval:()=>1,clearInterval(){},confirm:()=>true,Date};
vm.createContext(sandbox);vm.runInContext(source.replace(/\}\)\(\);\s*$/,`window.test={validateEspImage,usbFlash,wifiFlash,set:(f,id)=>{fw=f;catalog=globalThis.cat;usbBoardId=id;loader={writeFlash:async options=>globalThis.writes.push(options),after:async()=>{}}},busy:()=>busy};})();`),Object.assign(sandbox,{cat:catalog,writes}));
const api=sandbox.window.test;
function image(board,kind){return new Uint8Array(fs.readFileSync(path.join(root,'FlightCore_Firmware',board.latest[kind].file)))}
(async()=>{
 for(const b of catalog.boards){
  for(const kind of ['app','factory']){
   const bytes=image(b,kind);api.set({bytes,name:b.latest[kind].file,type:kind,boardId:b.id,version:catalog.version},b.id);assert.equal(api.validateEspImage(bytes,b.id,kind).chipId,b.imageChipIds[0]);
   selected=null;nodes.get('#fwImageType').value=kind;await api.usbFlash();assert.equal(writes.at(-1).fileArray[0].address,kind==='factory'?0:65536);assert.equal(writes.at(-1).fileArray[0].data.length,bytes.length);
  }
  const other=catalog.boards.find(x=>x.id!==b.id);assert.throws(()=>api.validateEspImage(image(b,'app'),other.id,'app'),/chip ID/);
  assert.throws(()=>api.validateEspImage(image(b,'factory'),b.id,'app'),/descriptor/,'factory cannot be relabelled as OTA APP');
 }
 const b=catalog.boards.find(b=>b.id==='ZFC-A2'),bytes=image(b,'app');selected={deviceId:ID,deviceName:'Kit',online:true,armed:false};
 api.set({bytes,name:b.latest.app.file,type:'app',boardId:b.id,version:catalog.version},'');await api.wifiFlash();assert.equal(posts.length,1);const url=new URL(posts[0].url);assert.equal(url.searchParams.get('expectedDeviceId'),ID);assert.equal(url.searchParams.get('boardId'),'ZFC-A2');assert.equal(posts[0].form.get('firmware').size,bytes.length);
 selected.armed=true;await api.wifiFlash();assert.equal(posts.length,1,'ARM blocks OTA');selected.armed=false;api.set({bytes:image(b,'factory'),name:'factory.bin',type:'factory',boardId:b.id},'');await api.wifiFlash();assert.equal(posts.length,1,'FACTORY blocks OTA');
 api.set({bytes,name:'app.bin',type:'app',boardId:b.id},'ZFC-A1');const before=writes.length;await api.usbFlash();assert.equal(writes.length,before,'wrong USB profile blocks flash');
 console.log('PASS: compiled APP/FACTORY headers / USB 0x10000 and 0x0 / OTA APP upload / identity / wrong profile / armed block. No physical flashing performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
