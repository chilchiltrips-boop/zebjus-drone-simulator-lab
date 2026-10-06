'use strict';
// Exercise production updater and bundled flasher; no real port or motor is touched.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto'),zlib=require('node:zlib');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'firmware-updater.js'),'utf8'),catalog=JSON.parse(fs.readFileSync(path.join(root,'firmware-catalog.json')));
const nodes=new Map();for(const name of ['#fwUsbBaud','#fwUsbManualBoot','#fwUsbState','#fwUsbChip','#fwSerialBadge','#fwOverallBadge','#fwLog'])nodes.set(name,{value:'115200',checked:false,textContent:'',style:{},classList:{toggle(){}}});
let requests=0,scenario='normal',mainCalls=[],attachments=0,disconnects=0;
const port={getInfo:()=>({usbVendorId:0x303a,usbProductId:0x1001})};
class Transport{constructor(p){assert.equal(p,port)}async disconnect(){disconnects++}}
class Loader{
 constructor(options){this.baudrate=options.baudrate;this.DETECTED_FLASH_SIZES={22:'4MB'};this.chip=null;this.IS_STUB=false;this.syncStubDetected=false}
 async detectChip(){this.chip={CHIP_NAME:'ESP32-C6',IMAGE_CHIP_ID:13,SPI_REG_BASE:0x60002000,EFUSE_BASE:0x600b0800,getChipDescription:async()=> 'unknown ESP32-C6'}}
 async readReg(address){return address===0x600b0850?(1<<24)|(1<<22)|(9<<18):1}
 async runStub(){if(!this.syncStubDetected)this.IS_STUB=true;return this.chip}
 async readFlashId(){return scenario==='bad-flash'?0xffffff:0x1640ef}
 async flashSpiAttach(value){assert.equal(value,0);attachments++}
 flashSizeBytes(size){return parseInt(size)*1048576}
 async main(mode){mainCalls.push({baud:this.baudrate,mode});await this.detectChip(mode);if(scenario==='unsupported'){this.chip.IMAGE_CHIP_ID=20;this.chip.CHIP_NAME='ESP32-C61';return 'ESP32-C61 (revision v0.0)'}if(scenario==='fast-fails'&&this.baudrate!==115200)throw Error('Serial handshake timeout');await this.runStub();await this.readFlashId();return this.chip.getChipDescription(this)}
}
const sandbox={Uint8Array,DataView,console,Date,Blob,FormData,window:{addEventListener(){}},document:{querySelector:s=>nodes.get(s)||null,readyState:'loading',addEventListener(){}},navigator:{serial:{requestPort:async()=>{requests++;return port}}},setTimeout:fn=>queueMicrotask(fn),clearTimeout(){},setInterval:()=>1,clearInterval(){},confirm:()=>true,usbModule:{Transport,ESPLoader:Loader},cat:catalog};
vm.createContext(sandbox);
let testSource=source.replace(/async function loadUsbFlasher\(\).*\n/, 'async function loadUsbFlasher(){return globalThis.usbModule}\n');
testSource=testSource.replace(/\}\)\(\);\s*$/,`window.test={usbMd5Hex,mapHardwareSignature,installUsbCompatibility,probeUsbFlash,connectUsb,disconnectUsb,setCatalog:()=>{catalog=globalThis.cat},state:()=>({loader,usbBoardId,busy})};})();`);
vm.runInContext(testSource,sandbox);const api=sandbox.window.test;api.setCatalog();
const md5=bytes=>crypto.createHash('md5').update(bytes).digest('hex');
(async()=>{
 for(const text of ['', 'a','abc','message digest','abcdefghijklmnopqrstuvwxyz','ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789','1234567890'.repeat(8)]){const bytes=new Uint8Array(Buffer.from(text));assert.equal(api.usbMd5Hex(bytes),md5(bytes))}
 for(const size of [55,56,63,64,65,127,128,1000,8192]){const bytes=new Uint8Array(crypto.randomBytes(size));assert.equal(api.usbMd5Hex(bytes),md5(bytes))}
 for(const file of ['ZEBJUS_FLIGHTCORE_A2_APP.bin','ZEBJUS_FLIGHTCORE_A2_FACTORY.bin']){const bytes=new Uint8Array(fs.readFileSync(path.join(root,'FlightCore_Firmware',file)));assert.equal(api.usbMd5Hex(bytes),md5(bytes))}
 assert.equal(api.mapHardwareSignature('ESP32-C6FH4 (QFN32) (revision v1.9)'),'ZFC-A2');assert.equal(api.mapHardwareSignature('ESP32-C61 (revision v0.0)'),'');
 await api.connectUsb();assert.equal(requests,1);assert.equal(api.state().usbBoardId,'ZFC-A2');assert.equal(mainCalls[0].baud,115200);assert.match(nodes.get('#fwUsbState').textContent,/flash verified/);assert.match(await api.state().loader.chip.getChipDescription(api.state().loader),/C6FH4.*v1.9/);await api.disconnectUsb(false);
 scenario='fast-fails';nodes.get('#fwUsbBaud').value='460800';mainCalls=[];const before=requests;await api.connectUsb();assert.equal(requests,before+1,'Fallback reuses the same selected port');assert.equal(mainCalls.length,2);assert.equal(mainCalls[1].baud,115200);assert.equal(nodes.get('#fwUsbBaud').value,'115200');await api.disconnectUsb(false);
 scenario='normal';nodes.get('#fwUsbManualBoot').checked=true;mainCalls=[];await api.connectUsb();assert.equal(mainCalls[0].mode,'no_reset');await api.disconnectUsb(false);nodes.get('#fwUsbManualBoot').checked=false;
 scenario='bad-flash';const attached=attachments;await api.connectUsb();assert.ok(attachments>attached);assert.equal(api.state().loader,null,'Invalid flash ID cannot leave USB READY');assert.match(nodes.get('#fwOverallBadge').textContent,/FAILED/);assert.equal(api.state().busy,false);
 scenario='unsupported';mainCalls=[];nodes.get('#fwUsbBaud').value='460800';await api.connectUsb();assert.equal(mainCalls.length,1,'Unsupported chips do not receive a fallback attempt');assert.equal(api.state().loader,null);
 scenario='normal';const liveStub=new Loader({baudrate:115200});liveStub.syncStubDetected=true;api.installUsbCompatibility(liveStub);await liveStub.runStub();assert.equal(liveStub.IS_STUB,true,'Existing stub must stay in stub protocol mode');
 const a2=catalog.boards.find(b=>b.id==='ZFC-A2');await assert.rejects(()=>api.probeUsbFlash({readFlashId:async()=>0x1540ef,flashSizeBytes:Loader.prototype.flashSizeBytes},a2),/smaller than/);
 // Run the actual vendor write/MD5 verification path with a memory flash transport.
 const {ESPLoader}=await import(path.join(root,'vendor/esptool/bundle.mjs'));
 // Exercise the bundled production SPI transaction, not a canned flash-ID result.
 const bundle=fs.readFileSync(path.join(root,'vendor/esptool/bundle.mjs'),'utf8'),start=bundle.indexOf('class Ws extends vs{'),end=bundle.indexOf('var Zs=',start);
 assert(start>=0&&end>start);const C6=Function('vs',bundle.slice(start,end)+';return Ws;')(class{}),spi=Object.create(ESPLoader.prototype);spi.chip=new C6();assert.equal(spi.chip.SPI_REG_BASE,0x60003000);
 let triggered=false;const registerWrites=[];spi.readReg=async address=>address===0x60003058&&triggered?0x1640ef:0;spi.writeReg=async(address,value)=>{registerWrites.push(address);if(address===0x60003000&&value===(1<<18))triggered=true};
 assert.equal(await spi.readFlashId(),0x1640ef);assert(registerWrites.includes(0x60003000));assert(!registerWrites.includes(0x60002000));
 const cached=new Loader({baudrate:115200});api.installUsbCompatibility(cached);await cached.detectChip();assert.equal(cached.chip.SPI_REG_BASE,0x60003000,'Patch cached bundles before the first flash-ID probe');
 const headerLoader=Object.create(ESPLoader.prototype);Object.assign(headerLoader,{chip:{BOOTLOADER_FLASH_OFFSET:0,CHIP_NAME:'ESP32-C6'},debug(){}});const factory=new Uint8Array(fs.readFileSync(path.join(root,'FlightCore_Firmware/ZEBJUS_FLIGHTCORE_A2_FACTORY.bin')));assert.equal(factory[3],0x20,'Compiled C6 boot frequency encoding');assert.equal(await headerLoader._updateImageFlashParams(factory,0,'keep','keep','keep'),factory,'Do not mutate the factory boot header or appended SHA');
 for(const compressed of [false,true]){
  const flasher=Object.create(ESPLoader.prototype),chunks=[];flasher.transport={trace(){}};let written=null,resets=0,mismatch=false;
  Object.assign(flasher,{IS_STUB:true,FLASH_WRITE_SIZE:1024,ERASE_WRITE_TIMEOUT_PER_MB:40000,chip:{BOOTLOADER_FLASH_OFFSET:0},info(){},debug(){},_updateImageFlashParams:async image=>image,flashBegin:async size=>Math.ceil(size/1024),flashDeflBegin:async(size,compressedSize)=>Math.ceil(compressedSize/1024),flashBlock:async bytes=>chunks.push(Buffer.from(bytes)),flashDeflBlock:async bytes=>chunks.push(Buffer.from(bytes)),flashFinish:async()=>{written=Buffer.concat(chunks)},flashDeflFinish:async()=>{written=zlib.inflateSync(Buffer.concat(chunks))},flashMd5sum:async(address,length)=>mismatch?'0'.repeat(32):md5(written.subarray(0,length)),after:async()=>{resets++}});
  const bytes=new Uint8Array(crypto.randomBytes(8200)),options={fileArray:[{data:bytes,address:65536}],flashMode:'keep',flashFreq:'keep',flashSize:'4MB',compress:compressed,eraseAll:false,calculateMD5Hash:api.usbMd5Hex};
  await flasher.writeFlash(options);assert.equal(md5(written.subarray(0,bytes.length)),md5(bytes));assert.equal(resets,0);chunks.length=0;mismatch=true;await assert.rejects(()=>flasher.writeFlash(options),/MD5.*does not match/);
 }
 // AP credentials are tested before the UI disconnects or clears the password.
 const schoolSource=fs.readFileSync(path.join(root,'school-lab.js'),'utf8'),wifiSource=schoolSource.slice(schoolSource.indexOf('async function saveWifi(){'),schoolSource.indexOf('async function refreshSavedWifi(){'));
 const wifiNodes=new Map([['#wifiSsidManual',{value:'keralvision binu'}],['#wifiSelect',{value:'other-network'}],['#wifiPassword',{value:'test-secret'}],['#saveWifiBtn',{disabled:false}]]);let wifiMode='AP / DIRECT',wifiResult='success',wifiDisconnects=0,testCalls=0,setCalls=0,armed=false,messages=[];
 const wifiSandbox={$:s=>wifiNodes.get(s),canControl:()=>true,selected:()=>({mode:wifiMode,deviceName:'zebjus_drone_1',armed}),setText:(id,msg)=>messages.push(msg),setTimeout:fn=>queueMicrotask(fn),disconnectKit:()=>{wifiDisconnects++},client:{testWifi:async(ssid,password,name)=>{assert.equal(ssid,'keralvision binu');assert.equal(password,'test-secret');assert.equal(name,'zebjus_drone_1');testCalls++},wifiTestStatus:async()=>({status:wifiResult,message:'Wrong Wi-Fi password',name:'zebjus_drone_1'}),setWifi:async()=>{setCalls++;return{}}}};
 vm.createContext(wifiSandbox);vm.runInContext(wifiSource,wifiSandbox);await wifiSandbox.saveWifi();assert.equal(testCalls,1);assert.equal(setCalls,0);assert.equal(wifiDisconnects,1);assert.equal(wifiNodes.get('#wifiPassword').value,'');assert.ok(!messages.some(m=>m.includes('test-secret')));
 wifiNodes.get('#wifiPassword').value='test-secret';wifiResult='failed';await wifiSandbox.saveWifi();assert.equal(wifiDisconnects,1,'Failed AP Wi-Fi test keeps the connection');assert.equal(wifiNodes.get('#wifiPassword').value,'test-secret');assert.equal(wifiNodes.get('#saveWifiBtn').disabled,false);
 wifiMode='STA / LOCAL';await wifiSandbox.saveWifi();assert.equal(setCalls,1);armed=true;await wifiSandbox.saveWifi();assert.equal(setCalls,1,'Armed kit cannot start a network change');
 assert.ok(disconnects>0);console.log('PASS: USB pairing/identity/flash probes, 115200 retry, manual BOOT, chip/size blocks, compiled C6 header preserved, actual compressed/raw MD5 verification, AP test-before-save/failed-password recovery and STA network changes. No physical USB flashing performed.');
})().catch(e=>{console.error(e);process.exitCode=1});
