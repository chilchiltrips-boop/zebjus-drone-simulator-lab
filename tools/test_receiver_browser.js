'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
const pause=ms=>new Promise(r=>setTimeout(r,ms));let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM});const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://receiver.test/**',r=>r.fulfill({contentType:'text/html',body:'<meta charset="UTF-8"><div id="receiver"></div>'}));await page.goto('http://receiver.test/');await page.addScriptTag({path:path.resolve(__dirname,'../receiver-wizard.js')});
 await page.evaluate(()=>{
  const model=window.rxModel={raw:Array(10).fill(1500),calls:[],saved:null,completions:0,errors:[],corrupt:false};
  model.raw[4]=1000;
  window.rx=AerionReceiverWizard.mount(document.getElementById('receiver'),{command:async(type,fields)=>{
   model.calls.push({type,...fields});
   if(type==='receiver_setup_set')model.saved={calibrated:true,map:Array.from({length:8},(_,i)=>fields['map'+i]),minimum:Array.from({length:8},(_,i)=>fields['min'+i]??1000),centre:Array.from({length:8},(_,i)=>fields['centre'+i]??1500),maximum:Array.from({length:8},(_,i)=>fields['max'+i]??2000),reverse:Array.from({length:4},(_,i)=>!!fields['reverse'+i]),txMode:fields.txMode,armMode:fields.armMode};
   if(type==='receiver_setup_get'){const receiver=structuredClone(model.saved);if(model.corrupt)receiver.reverse[0]=!receiver.reverse[0];return{receiver};}
   return{ok:true};
  },error:message=>model.errors.push(message),complete:()=>model.completions++});
  window.feed=(changes={},count=1)=>{Object.entries(changes).forEach(([ch,value])=>model.raw[ch]=value);for(let i=0;i<count;i++)rx.update({ppmFresh:true,raw:[...model.raw]});};
  feed();
 });
 assert.equal(await page.locator('[data-rx-mode]').inputValue(),'2');
 for(const [mode,left,right] of [[1,'Yaw / Pitch','Roll / Throttle'],[2,'Yaw / Throttle','Roll / Pitch'],[3,'Roll / Pitch','Yaw / Throttle'],[4,'Roll / Throttle','Yaw / Pitch']]){await page.selectOption('[data-rx-mode]',String(mode));assert.equal(await page.locator('[data-rx-label=left]').textContent(),left);assert.equal(await page.locator('[data-rx-label=right]').textContent(),right);}
 await page.selectOption('[data-rx-mode]','2');assert(await page.locator('[data-rx-action=advance]').isHidden());assert(await page.locator('[data-rx-action=skip]').isHidden());assert.equal(await page.evaluate(()=>{try{rx.fields();return false}catch{return true}}),true);
 // Mixed axes must not map the wrong control or permanently stall discovery.
 await page.evaluate(()=>{feed({4:2000,2:2000},5);feed({},2);});assert.equal(await page.evaluate(()=>rx.state.cursor),0);assert((await page.locator('[data-rx-note]').textContent()).includes('More than one'));
 for(const [cursor,ch] of [4,2,7,0].entries()){
  await page.evaluate(ch=>{feed({},1);feed({[ch]:1000},4);feed({[ch]:2000},4);},ch);
  assert.equal(await page.evaluate(()=>rx.state.cursor),cursor+1);assert.equal(await page.evaluate(cursor=>rx.state.map[[2,0,1,3][cursor]],cursor),ch);
 }
 assert(await page.locator('[data-rx-action=skip]').isVisible());assert(await page.locator('[data-rx-action=advance]').isVisible());await page.click('[data-rx-action=advance]');
 await page.evaluate(()=>feed({0:1500,2:1500,4:1500,7:1500},5));await page.click('[data-rx-action=capture]');assert.equal(await page.evaluate(()=>rx.state.stage),'centre');assert((await page.locator('[data-rx-note]').textContent()).includes('throttle to minimum'));
 await page.evaluate(()=>feed({4:1000},5));await page.click('[data-rx-action=capture]');assert.equal(await page.evaluate(()=>rx.state.stage),'endpoints');assert(await page.locator('[data-rx-action=save]').isDisabled());
 await page.evaluate(()=>rx.update({ppmFresh:false,raw:[...rxModel.raw]}));assert(await page.locator('[data-rx-action=save]').isDisabled());
 await page.evaluate(()=>{feed({0:1000,2:1000,4:1000,7:1000},2);feed({0:2000,2:2000,4:2000,7:2000},2);feed({0:1500,2:1000,4:1000,7:1500},2);});await pause(70);
 assert.equal(await page.locator('[data-rx-stick=right]').getAttribute('transform'),'translate(-38 0)','live mapped roll follows its measured minimum');
 assert.equal(await page.locator('[data-rx-stick=left]').getAttribute('transform'),'translate(0 38)','live mapped throttle follows its measured minimum');
 assert(!(await page.locator('[data-rx-action=save]').isDisabled()));
 const fields=await page.evaluate(()=>rx.fields());assert.deepEqual([fields.map0,fields.map1,fields.map2,fields.map3,fields.map4,fields.map5,fields.map6,fields.map7],[3,8,5,1,0,0,0,0]);assert.equal(fields.txMode,2);
 await page.evaluate(()=>rxModel.corrupt=true);await page.click('[data-rx-action=save]');await page.waitForFunction(()=>rxModel.errors.length===1);assert.equal(await page.evaluate(()=>rxModel.completions),0);assert.equal(await page.evaluate(()=>rx.state.saved),false);
 await page.evaluate(()=>rxModel.corrupt=false);await page.click('[data-rx-action=save]');await page.waitForFunction(()=>rxModel.completions===1);assert.equal(await page.evaluate(()=>rx.state.stage),'done');assert.equal(await page.evaluate(()=>rx.state.saved),true);
 assert.deepEqual(errors,[]);console.log('PASS: actual PPM wizard modes 1–4, mixed-movement recovery, any-channel discovery, four mandatory axes / optional skip, centre/throttle gates, measured endpoints, real-time sticks, stale PPM gate and reverse/mode/travel readback');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
