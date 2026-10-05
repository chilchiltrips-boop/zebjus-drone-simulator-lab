'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{chromium}=require('playwright');
const pause=ms=>new Promise(r=>setTimeout(r,ms));let browser;
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://setup-start.test/**',r=>r.fulfill({contentType:'text/html',body:'<meta charset="UTF-8"><div id="wizard"></div>'}));
 await page.goto('http://setup-start.test/');await page.addScriptTag({path:path.resolve(__dirname,'../fc-setup.js')});
 await page.evaluate(()=>{
  const s=window.mock={id:'ZFC-001122334455',owned:true,active:false,session:'',expires:0,beginDelay:750,replyDelay:0,statusDelay:0,beginPending:false,earlyPolls:0,cancelled:[],calls:[],endCount:0,staleGrant:false};
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  function status(){if(s.active&&performance.now()>=s.expires)s.active=false;return {ok:true,deviceId:s.id,boardId:'ZFC-A2',firmware:'18.3.67',supported:true,active:s.active,session:s.active?s.session:'',armed:false,flightReady:false,airframe:'QUAD_X',input:'WEB',job:0,samples:0,total:0,benchMode:0,pulse:1000,receiver:{armMode:'YAW_RIGHT'},raw:[1500,1500,1000,1500,1000,1000],channels:[1500,1500,1000,1500,1000,1000]};}
  window.wizard=AerionFcSetup.mount(document.getElementById('wizard'),{
   kit:()=>({deviceId:s.id,boardId:'ZFC-A2',armed:false}),owned:()=>s.owned,ensureControl:async()=>{s.owned=true},command:async d=>{
    s.calls.push({...d});
    if(d.type==='setup_status'){if(s.beginPending)s.earlyPolls++;const reply=status();if(d.session&&s.statusDelay)await wait(s.statusDelay);return reply;}
    if(d.type==='setup_begin'){
     s.beginPending=true;await wait(s.beginDelay);
     if(s.cancelled.includes(d.session)){s.beginPending=false;throw Error('Setup session already cancelled');}
     s.active=true;s.session=d.session;s.expires=performance.now()+5000;const reply=status();
     if(s.staleGrant)reply.session='SETUP-another-session';await wait(s.replyDelay);s.beginPending=false;return reply;
    }
    if(d.type==='setup_end'){s.cancelled.push(d.session);if(d.session===s.session){s.active=false;s.endCount++;}return {ok:true,stopped:true};}
    if(d.type==='setup_ping'){
     if(s.beginPending)s.earlyPolls++;status();
     if(!s.active||d.session!==s.session)throw Object.assign(Error('Setup lease expired or wrong session'),{status:409});
     s.expires=performance.now()+5000;return status();
    }
    throw Error('Unexpected setup command: '+d.type);
   }
  });
 });
 const click=n=>page.locator(`[data-fs="${n}"]`).click(),note=()=>page.locator('.fs-status').textContent();
 const ready=()=>page.waitForFunction(()=>document.querySelector('.fs-status').textContent.includes('Arming is inhibited'),null,{timeout:6000});
 await page.check('[data-fs=props]');await click('detect');await ready();
 assert.equal(await page.evaluate(()=>mock.earlyPolls),0,'setup must not be polled until the begin grant is verified');
 assert(await page.evaluate(()=>wizard.active&&mock.active),'a slow setup begin must keep the new session active');
 await click('next');assert.equal(await page.locator('.fs-title').textContent(),'2. Airframe');
 // A slow passive status reply must not consume the 5 s lease: every active poll renews it.
 await page.evaluate(()=>{mock.statusDelay=4200});await pause(5800);
 assert(await page.evaluate(()=>wizard.active&&mock.active),await note());
 const polls=await page.evaluate(()=>mock.calls.filter(d=>d.session&&['setup_ping','setup_status'].includes(d.type)));
 assert(polls.length>=5&&polls.every(d=>d.type==='setup_ping'),'active polling should read status and renew the lease in one request');
 // An actual expiry is still a STOP and must not replay setup or output commands.
 const begins=await page.evaluate(()=>mock.calls.filter(d=>d.type==='setup_begin').length);
 await page.evaluate(()=>{mock.active=false});await page.waitForFunction(()=>!wizard.active);
 assert.equal(await page.evaluate(()=>mock.calls.filter(d=>d.type==='setup_begin').length),begins);
 assert(await page.locator('[data-fs=restart]').isVisible());await click('restart');
 assert(!(await page.locator('[data-fs=props]').isChecked()),'a fresh hardware setup needs fresh props confirmation');
 // STOP during a pending begin cancels that nonce, without late polling or reactivation.
 await page.check('[data-fs=props]');await click('detect');await pause(100);await click('stop');await pause(1000);
 assert(!(await page.evaluate(()=>wizard.active||mock.active)));assert.equal(await page.evaluate(()=>mock.earlyPolls),0);
 await click('restart');await page.evaluate(()=>{mock.beginDelay=0;mock.replyDelay=600;mock.staleGrant=true});
 await page.check('[data-fs=props]');await click('detect');
 await page.waitForFunction(()=>document.querySelector('.fs-status').textContent.includes('Start again'));
 assert(!(await page.evaluate(()=>wizard.active||mock.active)),'a wrong setup nonce must never be accepted as a start grant');
 assert.deepEqual(errors,[]);
 console.log('PASS: delayed begin / no early polls, verified nonce, renewing status polls through slow links, actual lease expiry STOP, fresh restart and STOP during pending begin');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close()});
