(()=>{'use strict';
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const defaults={floating:true,sensitivity:1,deadband:.04,expo:.2,throttleSpeed:400};
 const key='aerion-stick-settings-v1';
 const settings=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...defaults}}};
 const save=value=>{const s={...settings(),...value};s.sensitivity=clamp(Number(s.sensitivity)||1,.2,1);s.deadband=clamp(Number(s.deadband)||0,0,.2);s.expo=clamp(Number(s.expo)||0,0,.8);s.throttleSpeed=clamp(Number(s.throttleSpeed)||400,100,600);try{localStorage.setItem(key,JSON.stringify(s))}catch{}dispatchEvent(new CustomEvent('aerion-stick-settings',{detail:s}));return s};
 function shape(value,p=settings()){const a=Math.abs(value);if(a<=p.deadband)return 0;const n=(a-p.deadband)/(1-p.deadband);return Math.sign(value)*((1-p.expo)*n+p.expo*n*n*n)*p.sensitivity}
 function bind(el,{knob,enabled=()=>true,change=()=>{},start=()=>{},finish=()=>{},floating=()=>settings().floating}={}){
  if(!el)return;el.classList.add('aerion-stick-zone');knob=knob||el.querySelector('i,.knob');
  let base=el.querySelector('.aerion-stick-base');if(!base){base=document.createElement('span');base.className='aerion-stick-base';el.append(base);if(knob)base.append(knob)}
  const state={pointer:null,x:0,y:0,anchor:null,last:0,frame:0};
  function draw(){el.classList.toggle('touching',state.pointer!==null);if(knob){knob.style.left=(50+state.x*30)+'%';knob.style.top=(50+state.y*30)+'%'}}
  function release(e){if(state.pointer===null||e&&e.pointerId!==undefined&&e.pointerId!==state.pointer)return;const id=state.pointer;state.pointer=null;cancelAnimationFrame(state.frame);state.x=state.y=0;state.anchor=null;try{el.releasePointerCapture(id)}catch{}base.style.left=base.style.top='50%';draw();change(0,0,0,true);finish()}
  function move(e){const r=base.getBoundingClientRect(),radius=r.width*.3;let x=(e.clientX-(state.anchor?.x??r.left+r.width/2))/radius,y=(e.clientY-(state.anchor?.y??r.top+r.height/2))/radius;const length=Math.hypot(x,y);if(length>1){x/=length;y/=length}state.x=x;state.y=y;draw();change(shape(x),shape(y),0,false)}
  function frame(t){if(state.pointer===null)return;if(!enabled()){release();return}const dt=clamp((t-state.last)/1000,0,.08);state.last=t;change(shape(state.x),shape(state.y),dt,false);state.frame=requestAnimationFrame(frame)}
  el.onpointerdown=e=>{if(!enabled()||state.pointer!==null||e.button>0)return;e.preventDefault();start();state.pointer=e.pointerId;const r=el.getBoundingClientRect(),b=base.getBoundingClientRect(),half=b.width/2;if(floating()){const x=clamp(e.clientX-r.left,half,Math.max(half,r.width-half)),y=clamp(e.clientY-r.top,half,Math.max(half,r.height-half));base.style.left=x+'px';base.style.top=y+'px';state.anchor={x:r.left+x,y:r.top+y}}else state.anchor=null;try{el.setPointerCapture(e.pointerId)}catch{}move(e);state.last=performance.now();state.frame=requestAnimationFrame(frame)};
  el.onpointermove=e=>{if(e.pointerId===state.pointer)move(e)};el.onpointerup=release;el.onpointercancel=release;el.onpointerleave=null;el.addEventListener('lostpointercapture',release);addEventListener('blur',()=>release());addEventListener('pagehide',()=>release());document.addEventListener('visibilitychange',()=>{if(document.hidden)release()});
  return {release,draw:(x,y)=>{if(state.pointer!==null)return;state.x=x;state.y=y;draw()},state};
 }
 const style=document.createElement('style');style.textContent=`
.aerion-stick-zone{position:relative!important;touch-action:none!important;background:none!important;border:0!important;border-radius:12px!important;overflow:hidden;isolation:isolate;min-height:200px;aspect-ratio:1.15;box-shadow:none!important}
.aerion-stick-base{display:block;position:absolute;left:50%;top:50%;width:82%;max-width:240px;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;pointer-events:none;background:radial-gradient(circle,#243e51 0 40%,#36596f 41% 63%,#75b8d3 64% 66%,#1e394c 67% 78%,#80b9d0 79% 80%);border:2px solid #9eddf1;box-shadow:inset 0 0 0 9px #28485b,0 0 20px #43b8e820}
.aerion-stick-base:before,.aerion-stick-base:after{content:'';position:absolute;background:#b9dfef66;pointer-events:none}.aerion-stick-base:before{left:50%;top:13%;bottom:13%;width:1px}.aerion-stick-base:after{top:50%;left:13%;right:13%;height:1px}
.aerion-stick-base>i{position:absolute!important;z-index:1;width:30%!important;height:30%!important;left:50%;top:50%;border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle at 36% 28%,#fff,#e6f5fc 40%,#89b8d0 74%,#4a7d9a)!important;border:3px solid #fff!important;box-shadow:0 5px 14px #06162399,0 0 0 5px #50d4ff66!important}
.aerion-stick-zone.touching .aerion-stick-base{border-color:#6cf2ff;box-shadow:inset 0 0 0 9px #28485b,0 0 22px #38d7ff66}.aerion-stick-zone.touching .aerion-stick-base>i{box-shadow:0 5px 14px #06162399,0 0 0 6px #38d7ff99!important}
.aerion-stick-zone.disabled{opacity:1;filter:none}.aerion-stick-zone.disabled .aerion-stick-base{opacity:.78}.web-gimbal-card,.gimbal-card{min-width:0}.web-gimbal-card>small,.gimbal-card>small{display:block;min-height:22px;color:#c2e9f6}.stick-hint{min-height:28px;color:#a6cedf}.mobile-mirror-banner{padding:12px 16px;background:#102536;border:1px solid #1c83a6;border-radius:12px;color:#9ce3ff;margin:10px 0}`;document.head.append(style);
 window.AerionSticks={bind,shape,settings,save,defaults};
})();
