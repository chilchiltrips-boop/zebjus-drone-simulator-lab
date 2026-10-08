'use strict';
// Actual native selects, mouse/touch sticks and responsive header. No flight test.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),port=18791,origin=`http://localhost:${port}`,out=process.env.ZEBJUS_TEST_OUTPUT||path.join(path.dirname(root),'aerion_r2_checks');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
let browser,server;const errors=[];
async function nativeTarget(page,value){
 await page.click('#webJoyTarget');
 await page.keyboard.press(value==='sim'?'Home':'End');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#webJoyTarget').inputValue(),value);
 await page.click('#webMode');await page.keyboard.press('Home');await page.keyboard.press('Enter');
 assert.equal(await page.locator('#webMode').inputValue(),'1000','other controls remain clickable');
}
async function layout(page,width,height){
 await page.setViewportSize({width,height});await pause(150);
 const boxes=await page.locator('.topbar-main > *').evaluateAll(nodes=>nodes.filter(n=>getComputedStyle(n).display!=='none').map(n=>{const r=n.getBoundingClientRect();return {name:n.id||n.className,x:r.x,y:r.y,right:r.right,bottom:r.bottom}}));
 for(const b of boxes){assert(b.x>=0&&b.right<=width+1,`${b.name} exceeds ${width}px`)}
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(!(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1),`${a.name} overlaps ${b.name}`)}
 await page.evaluate(()=>scrollTo({top:120,behavior:'instant'}));await pause(60);
 const pos=await page.evaluate(()=>({headerTop:document.querySelector('.topbar').getBoundingClientRect().top,header:document.querySelector('.topbar').getBoundingClientRect().bottom,tabs:document.querySelector('.tabs').getBoundingClientRect().top}));
 assert(pos.headerTop>=-1,'header remains visible on mobile scroll');assert(pos.tabs>=pos.header-1,'navigation cannot overlap the header');await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await pause(100);
 await page.screenshot({path:path.join(out,`aerion_${width}x${height}.png`)});
}
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port',String(port)],{cwd:root});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(t);resolve()}});server.on('error',reject)});
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1374,height:801},serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).hostname==='localhost'?r.continue():r.abort());
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(origin);
 await page.waitForFunction(()=>window.__zebjusAppLoaded&&window.zebjusSchool);
 assert.equal(await page.title(),'ZEBJUS Aerion');await layout(page,1374,801);
 await page.click('.tab[data-tab="joystick"]');
 await page.evaluate(()=>{window.__targetMutations=0;new MutationObserver(m=>window.__targetMutations+=m.length).observe(document.getElementById('webJoyTarget'),{subtree:true,childList:true,characterData:true})});
 for(let i=0;i<3;i++){await nativeTarget(page,'device');await nativeTarget(page,'sim')}
 await page.click('#webTxPowerBtn');
 await page.evaluate(()=>AerionSticks.save({floating:false,throttleSpeed:100,deadband:.04,expo:.2}));
 const box=await page.locator('#webLeftStick').boundingBox(),cx=box.x+box.width/2,cy=box.y+box.height/2;
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx,cy-15);await pause(850);
 const raised=await page.evaluate(()=>zebjusSchool.state.joy[2]);assert(raised>1000&&raised<1150,'small movement accumulates fractional throttle');
 assert(parseFloat(await page.locator('#webLeftKnob').evaluate(e=>e.style.top))<45,'throttle knob stays at the dragged position');
 await page.mouse.up();const released=await page.evaluate(()=>zebjusSchool.state.joy[2]);await pause(100);assert.equal(await page.evaluate(()=>zebjusSchool.state.joy[2]),released,'release holds throttle');
 assert.equal(await page.locator('#webLeftKnob').evaluate(e=>e.style.top),'50%','released rate stick returns to center');
 assert.equal(await page.evaluate(()=>window.__targetMutations),0,'controller refresh cannot rewrite native dropdown options');
 // Target changes stop transmission; neither offline target blocks the UI.
 await nativeTarget(page,'device');assert(!await page.evaluate(()=>zebjusSchool.state.txOn));await page.click('#webTxPowerBtn');assert(!await page.evaluate(()=>zebjusSchool.state.txOn));await nativeTarget(page,'sim');
 await page.click('#webTxPowerBtn');await page.keyboard.down('w');await pause(180);await page.keyboard.up('w');assert(await page.evaluate(()=>zebjusSchool.state.joy[2])>1000);await page.keyboard.press('x');assert.equal(await page.evaluate(()=>zebjusSchool.state.joy[2]),1000);
 await page.click('.tab[data-tab="sim"]');const simThrottle=await page.evaluate(()=>zebjusLabAPI.getSimState().throttle);const simBox=await page.locator('#leftStick').boundingBox();await page.mouse.move(simBox.x+simBox.width/2,simBox.y+simBox.height/2);await page.mouse.down();await page.mouse.move(simBox.x+simBox.width/2,simBox.y+simBox.height/2-15);await pause(800);
 assert(parseFloat(await page.locator('#leftStickKnob').evaluate(e=>e.style.top))<45,'Tripod knob stays at the dragged position');const simRaised=await page.evaluate(()=>zebjusLabAPI.getSimState().throttle);assert(simRaised>simThrottle,'Tripod small throttle movement accumulates');await page.mouse.up();const simReleased=await page.evaluate(()=>zebjusLabAPI.getSimState().throttle);await pause(100);assert.equal(await page.evaluate(()=>zebjusLabAPI.getSimState().throttle),simReleased,'Tripod release holds throttle');
 await page.click('.tab[data-tab="joystick"]');await page.click('#webTxPowerBtn');
 await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx,cy-30);await pause(100);await page.locator('.tab[data-tab="settings"]').evaluate(e=>e.click());await pause(100);const stopped=await page.evaluate(()=>zebjusSchool.state.joy[2]);await pause(150);assert.equal(await page.evaluate(()=>zebjusSchool.state.joy[2]),stopped,'leaving the page cancels held-stick input');await page.mouse.up();
 // Two simultaneous touch pointers must operate throttle and roll independently.
 await page.click('.tab[data-tab="joystick"]');await page.click('#webTxPowerBtn');await page.locator('#webLeftStick').scrollIntoViewIfNeeded();
 const l=await page.locator('#webLeftStick').boundingBox(),r=await page.locator('#webRightStick').boundingBox(),cdp=await context.newCDPSession(page);
 const points=[{id:1,x:l.x+l.width/2,y:l.y+l.height/2},{id:2,x:r.x+r.width/2,y:r.y+r.height/2}];
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
 points[0].y-=35;points[1].x+=40;await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:points});await pause(450);
 const touchChannels=await page.evaluate(()=>[...zebjusSchool.state.joy]);assert(touchChannels[2]>1000&&touchChannels[0]>1500,'two-finger throttle and roll both respond');
 await page.screenshot({path:path.join(out,'aerion_joystick_active.png')});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const touchReleased=await page.evaluate(()=>zebjusSchool.state.joy[2]);await pause(100);assert.equal(await page.evaluate(()=>zebjusSchool.state.joy[2]),touchReleased);assert.equal(await page.evaluate(()=>zebjusSchool.state.joy[0]),1500);await cdp.detach();
 for(const [w,h] of [[1024,768],[760,700],[390,844]])await layout(page,w,h);
 assert.deepEqual(errors,[]);console.log('PASS: native target changes / other controls usable / no option rewrites / small throttle movements / held knob / release hold / keyboard SAFE / Tripod knob / page-exit cancellation / two-finger throttle and roll / header alignment at 1374, 1024, 760 and 390 px');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM')});
