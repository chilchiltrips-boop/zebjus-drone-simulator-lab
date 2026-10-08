/* PPM channel discovery uses received frames. Guide motion never drives an output. */
(()=>{'use strict';
 const roles=['Roll','Pitch','Throttle','Yaw','ARM switch','Flight mode switch','AUX 1','AUX 2'],order=[2,0,1,3,4,5,6,7];
 const modes={1:{left:[3,1],right:[0,2]},2:{left:[3,2],right:[0,1]},3:{left:[0,1],right:[3,2]},4:{left:[0,2],right:[3,1]}};
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function create(){return{mode:2,stage:'map',cursor:0,map:Array(8).fill(null),reverse:Array(4).fill(false),minimum:Array(8).fill(2250),maximum:Array(8).fill(750),centre:Array(8).fill(1500),baseline:null,low:[],high:[],candidate:-1,hits:0,stable:0,last:null,saved:false};}
 function required(s){return [0,1,2,3].every(i=>Number.isInteger(s.map[i]));}
 function endpointReady(s,i){return s.map[i]===null||s.maximum[i]-s.minimum[i]>=400&&(![0,1,3].includes(i)||s.centre[i]-s.minimum[i]>=150&&s.maximum[i]-s.centre[i]>=150);}
 function fields(s,armMode='YAW_RIGHT'){if(!required(s)||![0,1,2,3].every(i=>endpointReady(s,i)))throw Error('Detect and sweep all four stick axes first.');const f={txMode:s.mode,armMode};for(let i=0;i<8;i++){f['map'+i]=s.map[i]===null?0:s.map[i]+1;if(s.map[i]!==null){if(!endpointReady(s,i))throw Error(roles[i]+' still needs its minimum and maximum.');f['min'+i]=s.minimum[i];f['max'+i]=s.maximum[i];f['centre'+i]=s.centre[i];}if(i<4)f['reverse'+i]=Number(s.reverse[i]);}return f;}
 function mount(root,a,draft=create()){
  const s=draft;let packet=null,freshAt=0,destroyed=false,saving=false,frame=0;const $=q=>root.querySelector(q),changed=()=>a.changed?.(s);
  root.innerHTML=`<div class="rx-wizard"><label>Transmitter stick mode<select data-rx-mode>${[1,2,3,4].map(v=>`<option value="${v}">Mode ${v}${v===2?' · usual throttle / yaw left':''}</option>`).join('')}</select></label><div class="rx-stage" data-rx-stage></div><p class="rx-instruction" data-rx-instruction></p><div class="rx-radio" role="img" aria-label="Transmitter with live left and right sticks">
   <svg viewBox="0 0 440 310" aria-hidden="true"><path d="M170 34V12h100v22M152 34h136l45 24 42 73 10 137-34 20H89l-34-20 10-137 42-73Z" fill="#b8c1cc" stroke="#536575" stroke-width="5"/><path d="M115 65h210l30 75-8 113H93l-8-113Z" fill="#dbe1e6" stroke="#8e9ca8" stroke-width="3"/><path d="M178 42h84l-8 53h-68Z" fill="#596975"/><path d="M203 49v37m-13-18h60" stroke="#adc1ce" stroke-width="5"/>
   ${[128,312].map((x,i)=>`<circle cx="${x}" cy="143" r="57" fill="#263541" stroke="#8298a6" stroke-width="6"/><circle cx="${x}" cy="143" r="46" fill="#102936"/><path d="M${x-42} 143h84m-42-42v84" stroke="#496572" stroke-width="2"/><circle data-rx-guide="${i?'right':'left'}" cx="${x}" cy="143" r="13" fill="none" stroke="#ffcb69" stroke-width="3" stroke-dasharray="5 4"/><g data-rx-stick="${i?'right':'left'}"><circle cx="${x}" cy="143" r="12" fill="#65dbc2" stroke="#d8fff5" stroke-width="2"/><circle cx="${x}" cy="143" r="4" fill="#284e57"/></g>`).join('')}
   <rect x="154" y="215" width="132" height="51" rx="6" fill="#092e4a" stroke="#647d91" stroke-width="4"/><text x="220" y="236" text-anchor="middle" fill="#8ce6ff" font-size="13">ZEBJUS AERION</text><text data-rx-lcd x="220" y="255" text-anchor="middle" fill="#c5f3e6" font-size="12">PPM INPUT</text><path d="M100 50l-10-22m32 16V20m198 30 10-22m-32 16V20" stroke="#526977" stroke-width="7"/>
   <text data-rx-label="left" x="128" y="207" text-anchor="middle" fill="#142c3d" font-size="11"></text><text data-rx-label="right" x="312" y="207" text-anchor="middle" fill="#142c3d" font-size="11"></text></svg></div><p class="rx-legend">Green: received PPM · Yellow: move this control</p><div class="rx-channels" data-rx-channels></div><div class="fs-actions"><button data-rx-action="skip">Skip optional channel</button><button data-rx-action="advance">Continue to centres</button><button data-rx-action="capture">Capture centres / Next</button><button data-rx-action="save">Save receiver / Next</button><button data-rx-action="restart">Restart receiver detection</button></div><p data-rx-note role="status"></p></div>`;
  $('[data-rx-mode]').value=s.mode;
  const note=message=>{$('[data-rx-note]').textContent=message;a.note?.(message);};
  function live(){return packet?.ppmFresh===true&&performance.now()-freshAt<1800;}
  function current(){return order[s.cursor]??null;}
  function beginCentres(){if(!required(s))throw Error('Throttle, roll, pitch and yaw must all be detected.');s.stage='centre';s.stable=0;s.last=null;s.baseline=null;changed();render();}
  function render(){
   if(destroyed)return;const i=current(),mapping=s.stage==='map',sweeping=s.stage==='endpoints';
   $('[data-rx-stage]').textContent=({map:'1. Detect controls one at a time',centre:'2. Centre sticks / throttle minimum',endpoints:'3. Sweep minimum and maximum',done:'Receiver saved'})[s.stage];
   const where=i<4?Object.entries(modes[s.mode]).flatMap(([side,pair])=>pair.map((role,axis)=>({side,role,axis}))).find(x=>x.role===i):null;
   $('[data-rx-instruction]').textContent=mapping?i<4?`Move only ${roles[i]} (${where.side} stick, ${where.axis?'up / down':'left / right'}). Keep moving until its PPM channel is detected.`:`Move ${roles[i]}, or skip it if it is not installed.`:s.stage==='centre'?'Centre roll, pitch and yaw. Set throttle to minimum and ARM switch to OFF. Hold them still, then capture centres.':sweeping?i===null?'Required travel is received. Save the receiver.':`Move ${roles[i]} fully to both limits. Green sticks follow received PPM; the guide moves until full travel is received.`:'Mapping and travel are saved. Continue to ARM settings.';
   for(const [side,pair] of Object.entries(modes[s.mode]))$(`[data-rx-label="${side}"]`).textContent=pair.map(role=>roles[role]).join(' / ');
   $('[data-rx-lcd]').textContent=live()?`MODE ${s.mode} · ${mapping&&i!==null?roles[i].toUpperCase():'LIVE PPM'}`:'WAITING FOR PPM';
   $('[data-rx-channels]').replaceChildren(...roles.map((name,role)=>{const row=document.createElement('div');row.className='rx-channel '+(role===i?'current ':'')+(s.map[role]!==null?'detected':'');const b=document.createElement('b');b.textContent=name;const value=document.createElement('span');value.textContent=s.map[role]===null?'Not assigned':`CH${s.map[role]+1} · ${live()?packet.raw[s.map[role]]+' µs':'stale'}${sweeping||s.stage==='done'?` · ${s.minimum[role]} / ${s.centre[role]} / ${s.maximum[role]}`:''}`;row.append(b,value);if(role<4){const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';box.checked=s.reverse[role];box.disabled=saving;box.onchange=()=>{s.reverse[role]=box.checked;s.saved=false;changed();};label.append(box,'Reverse');row.append(label);}return row;}));
   $('[data-rx-action=skip]').hidden=!mapping||i===null||i<4;
   $('[data-rx-action=advance]').hidden=!mapping||!required(s);
   $('[data-rx-action=capture]').hidden=s.stage!=='centre';$('[data-rx-action=capture]').disabled=!live()||s.stable<3||saving;
   $('[data-rx-action=save]').hidden=!sweeping;$('[data-rx-action=save]').disabled=!live()||!required(s)||s.map.some((ch,role)=>ch!==null&&!endpointReady(s,role))||saving;
   $('[data-rx-mode]').disabled=saving||s.stage!=='map'||s.cursor>0;
   root.querySelectorAll('[data-rx-action]').forEach(b=>{if(!['capture','save'].includes(b.dataset.rxAction))b.disabled=saving;});
  }
  function update(d){
   packet=d;if(d.ppmFresh!==true||!Array.isArray(d.raw)){s.stable=0;render();return;}freshAt=performance.now();const raw=d.raw.map(v=>Number(v));
   if(s.stage==='map'&&!saving){
    if(!s.baseline){s.baseline=[...raw];s.low=[...raw];s.high=[...raw];s.last=[...raw];s.stable=0;s.hits=0;}
    else{raw.forEach((v,ch)=>{s.low[ch]=Math.min(s.low[ch],v);s.high[ch]=Math.max(s.high[ch],v)});const choices=raw.map((v,ch)=>({ch,span:s.high[ch]-s.low[ch]})).filter(x=>!s.map.includes(x.ch)).sort((a,b)=>b.span-a.span),best=choices[0];
     if(best?.span>=250&&(!choices[1]||choices[1].span<100)){s.hits=s.candidate===best.ch?s.hits+1:1;s.candidate=best.ch;if(s.hits>=3){const role=current();s.map[role]=best.ch;s.minimum[role]=s.low[best.ch];s.maximum[role]=s.high[best.ch];s.cursor++;s.baseline=null;s.candidate=-1;s.hits=0;s.saved=false;note(`${roles[role]} detected on CH${best.ch+1}.`);changed();if(s.cursor===order.length)beginCentres();}}
     else if(choices[1]?.span>=100){s.hits=0;s.candidate=-1;const still=s.last&&choices.every(({ch})=>Math.abs(raw[ch]-s.last[ch])<=25);s.stable=still?s.stable+1:0;s.last=[...raw];if(s.stable>=3){s.baseline=null;note('More than one control moved. Hold the other controls still, then move only '+roles[current()]+'.');}}
    }
   }else if(s.stage==='centre'){
    const still=s.last&&[0,1,2,3].every(i=>Math.abs(raw[s.map[i]]-s.last[s.map[i]])<=25);s.stable=still?s.stable+1:0;s.last=[...raw];
   }else if(s.stage==='endpoints'){
    s.map.forEach((ch,i)=>{if(ch!==null){s.minimum[i]=Math.min(s.minimum[i],raw[ch]);s.maximum[i]=Math.max(s.maximum[i],raw[ch]);}});
    while(s.cursor<order.length&&endpointReady(s,order[s.cursor]))s.cursor++;
   }
   render();
  }
  async function save(){if(saving)return;try{const f=fields(s,a.armMode?.()||'YAW_RIGHT');saving=true;render();await a.command('input_set',{source:'PPM'});await a.command('receiver_setup_set',f);const d=await a.command('receiver_setup_get');if(d.receiver?.calibrated!==true||Number(d.receiver.txMode)!==f.txMode||d.receiver.armMode!==f.armMode||s.reverse.some((value,i)=>!!d.receiver.reverse?.[i]!==value))throw Error('Receiver mode / reverse / ARM readback differs.');for(let i=0;i<8;i++){if(Number(d.receiver.map[i]||0)!==f['map'+i])throw Error('Receiver mapping readback differs.');if(f['map'+i]&&['minimum','centre','maximum'].some((key,j)=>Math.abs(d.receiver[key]?.[i]-f[['min','centre','max'][j]+i])>.1))throw Error('Receiver travel readback differs.');}s.saved=true;s.stage='done';changed();a.complete?.(d.receiver);note('Four required axes and optional channels saved and verified.');}catch(e){s.saved=false;a.error?.(e.message);note(e.message);}finally{saving=false;render();}}
  $('[data-rx-action=advance]').onclick=()=>{try{beginCentres()}catch(e){note(e.message)}};
  $('[data-rx-action=skip]').onclick=()=>{if(s.stage!=='map'||current()<4)return;s.map[current()]=null;s.cursor++;s.baseline=null;s.hits=0;changed();if(s.cursor===order.length)beginCentres();render();};
  $('[data-rx-action=capture]').onclick=()=>{if(!live()||s.stable<3)return;for(let i=0;i<8;i++)if(s.map[i]!==null)s.centre[i]=packet.raw[s.map[i]];if([0,1,3].some(i=>s.centre[i]<1100||s.centre[i]>1900)){note('Centre roll, pitch and yaw before continuing.');return;}const throttle=packet.raw[s.map[2]],atLow=s.reverse[2]?throttle>=s.maximum[2]-60:throttle<=s.minimum[2]+60;if(!atLow){note('Set throttle to minimum before continuing.');return;}s.minimum.fill(2250);s.maximum.fill(750);s.cursor=0;s.stage='endpoints';changed();render();};
  $('[data-rx-action=save]').onclick=save;
  $('[data-rx-action=restart]').onclick=()=>{Object.assign(s,create(),{mode:s.mode});changed();render();};
  $('[data-rx-mode]').onchange=e=>{s.mode=Number(e.target.value);changed();render();};
  function animate(now){if(destroyed||!root.isConnected)return;const layout=modes[s.mode],i=current(),guide=s.stage==='map'||s.stage==='endpoints';for(const [side,pair] of Object.entries(layout)){
    const values=pair.map(role=>{const ch=s.map[role];if(ch===null||!live())return 0;const raw=packet.raw[ch],min=s.stage==='endpoints'||s.stage==='done'?s.minimum[role]:1000,max=s.stage==='endpoints'||s.stage==='done'?s.maximum[role]:2000,centre=[0,1,3].includes(role)?s.centre[role]:(min+max)/2;const v=raw<centre?(raw-centre)/Math.max(1,centre-min):(raw-centre)/Math.max(1,max-centre);return clamp(v*(s.reverse[role]?-1:1),-1,1);});
    $(`[data-rx-stick="${side}"]`).setAttribute('transform',`translate(${values[0]*38} ${-values[1]*38})`);const ghost=$(`[data-rx-guide="${side}"]`),axis=pair.indexOf(i);ghost.style.opacity=guide&&axis>=0?'1':'0';const motion=Math.sin(now/450)*38;ghost.setAttribute('transform',`translate(${axis===0?motion:0} ${axis===1?motion:0})`);
   }frame=requestAnimationFrame(animate);
  }
  render();frame=requestAnimationFrame(animate);
  return{update,save,state:s,fields:()=>fields(s,a.armMode?.()||'YAW_RIGHT'),get requiredDetected(){return required(s)},destroy(){destroyed=true;cancelAnimationFrame(frame);}};
 }
 window.AerionReceiverWizard={mount,create,fields,required,endpointReady,modes};
})();
