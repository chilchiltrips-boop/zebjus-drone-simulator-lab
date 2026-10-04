'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='http://localhost:8928',ID='ZFC-001122334455',pause=ms=>new Promise(r=>setTimeout(r,ms));let server,browser,page;
const fc={owner:'',active:false,session:'',airframe:'QUAD_X',calls:[],acquires:0,ends:0};
function status(cid=''){return {ok:true,kit:'ZEBJUS_FLIGHTCORE',deviceId:ID,name:'zebjus_drone_1',boardId:'ZFC-A2',boardName:'Aerion F1',firmware:'18.3.65',mode:'AP / DIRECT',ip:'192.168.4.1',armed:false,benchMode:0,locked:!!fc.owner,lockMine:!!cid&&cid===fc.owner,controlRole:fc.owner?'WEB':'',webRc:true,flightCoreIntegrated:true,flightReady:true,rcTimeoutMs:1000,receiverHealth:'NOT_FOUND'};}
function setup(){return {...status(),supported:true,active:fc.active,session:fc.active?fc.session:'',airframe:fc.airframe,input:'WEB',job:0,samples:0,total:0,pulse:1000,receiver:{armMode:'YAW_RIGHT'},raw:[1500,1500,1000,1500,1000,1000],channels:[1500,1500,1000,1500,1000,1000]};}
(async()=>{
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port','8928'],{cwd:root});
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Lab server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(timer);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1100,height:800},serviceWorkers:'block'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
  const req=route.request(),url=new URL(req.url()),f=Object.fromEntries(new URLSearchParams(req.postData()||'')),cid=url.searchParams.get('clientId')||f.clientId||'';
  if(!['192.168.4.1','zebjus-drone-1.local'].includes(url.hostname))return route.fulfill({status:404,body:'not found'});
  const reply=(data,code=200)=>route.fulfill({status:code,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(data)});
  if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'}});
  if(url.pathname==='/api/status')return reply(status(cid));
  if(url.pathname==='/api/telemetry')return reply({...status(cid),type:'telemetry',viewOnly:cid!==fc.owner,rcSource:'NONE',rcAgeMs:999999,roll:0,pitch:0,yaw:0,gyroX:0,gyroY:0,gyroZ:0,sensors:{imu:{fresh:true,usedInFlight:true}}});
  if(url.pathname==='/api/control/acquire'){if(fc.owner&&fc.owner!==cid)return reply({message:'Another controller owns this kit'},423);fc.owner=cid;fc.acquires++;return reply({ok:true,lockMine:true,lockTimeoutMs:15000});}
  if(url.pathname==='/api/control/ping')return reply(cid===fc.owner?{ok:true}:{message:'Control lost'},cid===fc.owner?200:423);
  if(url.pathname==='/api/control/release'){if(cid===fc.owner){fc.owner='';fc.active=false;}return reply({ok:true});}
  if(url.pathname==='/api/wifi/saved')return reply({ok:true,profiles:[]});
  if(url.pathname==='/api/command'){
   fc.calls.push({...f});
   if(f.type==='setup_status')return reply(setup());
   if(f.type==='setup_end'){if(f.session===fc.session&&cid===fc.owner){fc.active=false;fc.ends++;}return reply({ok:true,stopped:true});}
   if(cid!==fc.owner)return reply({message:'Control lost'},423);
   if(f.type==='setup_begin'){fc.active=true;fc.session=f.session;return reply(setup());}
   if(f.type==='setup_ping')return reply(setup());
   if(f.type==='airframe_set'){assert(fc.active&&f.session===fc.session);fc.airframe=f.airframe;return reply(setup());}
   if(f.type==='rc_frame')return reply({ok:true});
   return reply({message:'Unexpected command '+f.type},400);
  }
  return reply({ok:true});
 });
 await page.goto(origin);await page.waitForFunction(()=>window.__zebjusAppLoaded&&window.AerionWorkflow&&window.zebjusSchool);
 await page.click('[data-tab="firmware"]');await page.fill('#kitSearchInput','zebjus_drone_1');await page.fill('#kitCachedIp','192.168.4.1');await page.click('#kitSearchBtn');await page.waitForFunction(()=>zebjusSchool.canControl());
 await page.click('[data-tab="setup"]');const wizard=page.locator('#setupWizardRoot'),click=n=>wizard.locator(`[data-fs="${n}"]`).click(),message=t=>page.waitForFunction(t=>document.querySelector('#setupWizardRoot .fs-status').textContent.includes(t),t);
 await wizard.locator('[data-fs=props]').check();await click('detect');await message('Arming is inhibited');await click('next');await page.waitForFunction(()=>document.querySelector('#setupWizardRoot .fs-title').textContent==='2. Airframe');
 const session=fc.session,acquires=fc.acquires;
 // These real discovery requests omit clientId; their lockMine=false is not this tab's ownership.
 await page.evaluate(()=>zebjusSchool.requestModules(true));
 assert(await page.evaluate(()=>zebjusSchool.canControl()),'anonymous kit discovery must keep this browser\'s verified control ownership');
 await pause(700);assert(await page.evaluate(()=>AerionWorkflow.full.active),'background scan must not stop setup');assert.equal(fc.session,session);assert.equal(fc.acquires,acquires,'scan must not silently reacquire control');
 await wizard.locator('[data-fs=airframe]').selectOption('QUAD_H');await click('saveFrame');await message('Airframe saved: QUAD_H');await click('back');assert.equal(await wizard.locator('.fs-title').textContent(),'1. Board');await click('next');assert.equal(await wizard.locator('.fs-title').textContent(),'2. Airframe');
 // A verified owner loss must stop output commands and leave a reachable restart action.
 fc.owner='';fc.active=false;await page.evaluate(()=>zebjusSchool.refreshNow());await page.waitForFunction(()=>!AerionWorkflow.full.active);
 assert(await wizard.locator('[data-fs=restart]').isVisible(),'lost-session screen needs Restart setup');assert(await wizard.locator('[data-fs=next]').isDisabled());assert(!(await wizard.locator('[data-fs=back]').isDisabled()),'Airframe Back must still reach Board after losing the session');
 assert.equal(fc.acquires,acquires,'stopping an expired setup must never acquire a new control lease');
 await click('back');assert.equal(await wizard.locator('.fs-title').textContent(),'1. Board');
 await click('restart');assert(await wizard.locator('[data-fs=detect]').isVisible());assert(!(await wizard.locator('[data-fs=props]').isChecked()),'restart requires a fresh props confirmation');
 const begins=fc.calls.filter(x=>x.type==='setup_begin').length;await click('detect');await message('Remove every propeller');assert.equal(fc.calls.filter(x=>x.type==='setup_begin').length,begins);
 await wizard.locator('[data-fs=props]').check();await click('detect');await message('Arming is inhibited');assert.notEqual(fc.session,session);await click('next');await click('stop');await page.waitForFunction(()=>!AerionWorkflow.full.active);await click('restart');assert.equal(await wizard.locator('.fs-title').textContent(),'1. Board');
 // Actual mobile ownership stays authoritative even when another anonymous scan finishes.
 fc.owner='MOBILE-OTHER';await page.evaluate(()=>zebjusSchool.refreshNow());await page.evaluate(()=>zebjusSchool.requestModules(true));assert(!(await page.evaluate(()=>zebjusSchool.canControl())));
 assert.deepEqual(errors,[]);assert(fc.ends>0);console.log('PASS: actual Lab + kit discovery/control APIs + Wizard; scan preserves session, Airframe Back/Next, real ownership loss STOP without reacquire, reachable restart with fresh props and nonce, foreign controller stays view-only');
 await context.close();
})().catch(async e=>{console.error(e);if(page)console.error(await page.evaluate(()=>({note:document.querySelector('#setupWizardRoot .fs-status')?.textContent,step:document.querySelector('#setupWizardRoot .fs-title')?.textContent,active:window.AerionWorkflow?.full.active,kit:window.zebjusSchool?.getSelectedDevice()})).catch(()=>null));process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM')});
