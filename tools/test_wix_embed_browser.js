'use strict';
const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),fs=require('node:fs'),{spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),origin='http://localhost:8926',out=process.env.ZEBJUS_WIX_SCREENSHOTS||path.resolve(root,'../wix_screenshots'),pause=ms=>new Promise(r=>setTimeout(r,ms));
let server,parent,browser,page;
const order=['assembly','wiring','setup','io','python','sim','joystick','training','firmware','telemetry','settings'];
const allowed='camera; fullscreen; autoplay; serial; usb; local-network; loopback-network; local-network-access';
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 server=spawn('python3',[path.join(root,'start_offline.py'),'--no-browser','--port','8926'],{cwd:root});
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('Lab server timeout')),10000);server.stdout.on('data',d=>{if(String(d).includes('offline WebApp:')){clearTimeout(t);resolve()}});server.on('error',reject)});
 parent=http.createServer((req,res)=>{
  const nested=req.url.startsWith('/nested'),denied=req.url.startsWith('/denied'),child=nested?'http://localhost:8927/inner':origin+'/';
  res.writeHead(200,{'content-type':'text/html',...(denied?{'Permissions-Policy':'camera=(), fullscreen=(), serial=(), usb=()'}:{})});
  res.end(`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;overflow:hidden;background:#07111b}iframe{width:100%;height:100%;border:0;display:block}</style></head><body><iframe title="Lab" src="${child}" allow="${allowed}" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox" allowfullscreen></iframe></body></html>`);
 });await new Promise(r=>parent.listen(8927,'0.0.0.0',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.ZEBJUS_CHROMIUM,args:['--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>window.__zebjusAppLoaded);
 assert.equal(await page.evaluate(()=>AerionEmbed.enabled),false,'top-level layout stays full');
 assert.deepEqual(await page.locator('.tabs .tab').evaluateAll(e=>e.map(x=>x.dataset.tab)),order);
 await page.goto(origin+'/?embed=wix&tab=python');await page.waitForFunction(()=>window.__zebjusAppLoaded&&document.getElementById('tab-python').classList.contains('active'));
 assert.equal(await page.evaluate(()=>AerionEmbed.enabled),true);
 // A cold, sandboxed cross-origin iframe must run the actual bundled Python runtime.
 await page.goto('http://127.0.0.1:8927/');let frame=await waitLab(page);
 assert.equal(await frame.evaluate(()=>AerionEmbed.enabled&&AerionEmbed.framed),true,'automatic frame detection');
 const networkPolicies=await frame.evaluate(()=>['local-network','loopback-network'].filter(x=>document.featurePolicy?.features().includes(x)).map(x=>({feature:x,allowed:document.featurePolicy.allowsFeature(x)})));assert(networkPolicies.every(x=>x.allowed),'delegate current local and loopback network policies');
 assert.deepEqual(await frame.locator('.tabs .tab').evaluateAll(e=>e.map(x=>x.dataset.tab)),order);
 await frame.locator('[data-tab="python"]').click();await frame.waitForFunction(()=>window.monaco?.editor.getModels().length||document.getElementById('pythonEditor').offsetHeight>0);
 await frame.locator('#pythonNewFileBtn').click();await frame.locator('.embed-dialog input').fill('wix_lesson.py');await frame.locator('.embed-dialog input').press('Enter');await frame.waitForFunction(()=>document.getElementById('pythonEditorTitle').textContent==='wix_lesson.py');
 await frame.locator('#pythonDeleteFileBtn').click();await frame.locator('.embed-dialog button[value="cancel"]').click();assert(await frame.locator('[data-py-file="wix_lesson.py"]').isVisible(),'Cancel keeps the Python file');
 await frame.locator('#pythonDeleteFileBtn').click();await frame.locator('.embed-dialog button[value="ok"]').click();await frame.waitForFunction(()=>!document.querySelector('[data-py-file="wix_lesson.py"]'));
 await frame.evaluate(()=>{const code='print("WIX_PYTHON_OK", sum(range(11)))',model=window.monaco?.editor.getModels()[0];if(model)model.setValue(code);else{const e=document.getElementById('pythonEditor');e.value=code;e.dispatchEvent(new Event('input',{bubbles:true}))}});
 await frame.locator('#runPythonBtn').click();await frame.waitForFunction(()=>document.getElementById('pythonTerminal').textContent.includes('WIX_PYTHON_OK 55'),null,{timeout:90000});
 assert.match(await frame.locator('.embed-open').getAttribute('href'),/embed=0.*tab=python/);
 const sizes=[[1280,800],[980,700],[640,740],[390,780],[320,740]];
 for(const [width,height] of sizes){
  await page.setViewportSize({width,height});
  for(const tab of order){
   await frame.locator(`[data-tab="${tab}"]`).click();await pause(130);
   const sizing=await frame.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
   assert(sizing.scroll<=sizing.width+2,`${width}px ${tab} overflow: ${JSON.stringify(sizing)}`);
   assert(await frame.locator('#tab-'+tab).isVisible());
  }
  await frame.locator('[data-tab="python"]').click();await pause(250);await page.screenshot({path:path.join(out,`python_${width}.png`)});
  const editor=await frame.locator('.python-editor-card').boundingBox();assert(editor.width<=width&&editor.width>width*.35,'editor usable in frame');
 }
 // Wix Embed HTML has another enclosing frame; test the nested route too.
 await page.setViewportSize({width:980,height:740});await page.goto('http://127.0.0.1:8927/nested');frame=await waitLab(page);
 assert.equal(await frame.evaluate(()=>AerionEmbed.framed),true);await frame.locator('[data-tab="setup"]').click();assert(await frame.locator('#setupWizardRoot').isVisible());await page.screenshot({path:path.join(out,'nested_setup.png')});
 // A denied parent policy cannot be bypassed; the full-lab escape remains usable.
 await page.goto('http://127.0.0.1:8927/denied');frame=await waitLab(page);
 assert.equal(await frame.evaluate(()=>document.fullscreenEnabled),false);assert(await frame.locator('.embed-open').isVisible());
 const popupPromise=page.waitForEvent('popup');await frame.locator('.embed-expand').click();const popup=await popupPromise;await popup.waitForLoadState();assert.match(popup.url(),/embed=0/);await popup.waitForFunction(()=>window.__zebjusAppLoaded);assert.equal(await popup.evaluate(()=>AerionEmbed.enabled),false);await popup.close();
 assert.deepEqual(errors,[]);console.log('PASS: fifth-position Python Lab, full/compact deep links, sandboxed Python file create/cancel/delete and execution, all 11 pages at five widths, nested Wix frames and permission-denied full-lab fallback');
 await context.close();
})().catch(async e=>{console.error(e);if(page)await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill('SIGTERM');if(parent)parent.close()});
async function waitLab(p){await p.waitForFunction(()=>true);for(let i=0;i<150;i++){const f=p.frames().find(x=>x.url().startsWith(origin+'/'));if(f){await f.waitForFunction(()=>window.__zebjusAppLoaded&&window.AerionWorkflow&&window.AerionTraining);return f}await pause(100)}throw Error('Embedded lab did not load')}
