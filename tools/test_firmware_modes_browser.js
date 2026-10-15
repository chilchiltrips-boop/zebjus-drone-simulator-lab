'use strict';
// Checks the served WebApp at desktop/tablet/phone widths; no real flashing.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const ROOT=path.resolve(__dirname,'..'),PORT=18947,URL='http://127.0.0.1:'+PORT;
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){for(let n=0;n<80;n++){try{const r=await fetch(URL+'/health');if(r.ok)return}catch{}await pause(125)}throw Error('Firmware test server not ready')}
(async()=>{
 const server=spawn(process.execPath,['server.js'],{cwd:ROOT,env:{...process.env,PORT:String(PORT)},stdio:'ignore'});let browser;
 try{
  await ready();browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL+'/',{waitUntil:'domcontentloaded'});
  await page.locator('button[data-tab="firmware"]').click();
  await page.waitForFunction(()=>document.querySelector('#fwModeWifiBtn')?.getAttribute('aria-pressed')==='true');
  await page.waitForFunction(()=>!document.querySelector('#fwModeUsbBtn')?.disabled,null,{timeout:30000});
  assert.equal(await page.locator('#fwWifiModePanel').isVisible(),true);
  assert.equal(await page.locator('#fwUsbModePanel').isVisible(),false);
  const type=await page.locator('#fwImageType').inputValue(),firmwareName=await page.locator('#fwFileName').innerText();
  await page.locator('#fwModeUsbBtn').click();
  assert.equal(await page.locator('#fwUsbModePanel').isVisible(),true);
  assert.equal(await page.locator('#fwWifiModePanel').isVisible(),false);
  assert.equal(await page.locator('#fwModeUsbBtn').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('#fwModeWifiBtn').getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('#fwImageType').inputValue(),type,'mode switching must not change image type');
  assert.equal(await page.locator('#fwFileName').innerText(),firmwareName,'mode switching must not load new firmware');
  if(type==='app')assert.equal(await page.locator('#fwEraseUsb').isDisabled(),true,'APP cannot erase');
  await page.locator('#fwModeWifiBtn').click();
  assert.equal(await page.locator('#fwUpgradeEraseBtn').isVisible(),false,'erase requires USB mode');
  for(const width of [1440,1024,820,620,390,320]){
   await page.setViewportSize({width,height:900});
   await page.locator('#fwModeUsbBtn').click();
   const l=await page.evaluate(()=>{
    const r=s=>document.querySelector(s).getBoundingClientRect();
    const grid=r('#tab-firmware .firmware-grid'),source=r('.firmware-source-card'),target=r('.firmware-target-card'),monitor=r('.firmware-control-card'),mode=document.querySelector('.firmware-mode-switch');
    return{grid:{left:grid.left,right:grid.right},source:{bottom:source.bottom},target:{bottom:target.bottom},monitor:{left:monitor.left,right:monitor.right,top:monitor.top},overflow:mode.scrollWidth-mode.clientWidth};
   });
   assert(Math.abs(l.monitor.left-l.grid.left)<3,'Step 3 left edge: '+width);
   assert(Math.abs(l.monitor.right-l.grid.right)<3,'Step 3 full width: '+width);
   assert(l.monitor.top>=Math.max(l.source.bottom,l.target.bottom)-3,'Step 3 overlap: '+width);
   assert(l.overflow<=2,'mode tabs overflow: '+width);
   await page.locator('#fwModeWifiBtn').click();
  }
  assert.equal(errors.filter(e=>/firmware-updater|syncUpdateMode|selectUpdateMode/.test(e)).length,0,'firmware script error');
  console.log('PASS: mode isolation, safety and full-width responsive firmware UI at 320–1440px');
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
