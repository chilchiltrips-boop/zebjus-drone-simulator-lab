/* Local simulator controls: rate throttle, soft axes and persistent throttle on release. */
(function(scope){'use strict';
 const {neutral,clamp}=scope.AerionTrainingCore||(typeof require==='function'?require('./flight-training-core.js'):{});
 const shape=v=>{const a=Math.abs(v);if(a<=.04)return 0;const n=clamp((a-.04)/.96,0,1);return Math.sign(v)*(.72*n+.28*n*n*n)};
 class TrainingInput{
  constructor(){this.channels=[...neutral];this.reset()}
  reset(){this.channels.splice(0,6,...neutral);this.throttleTarget=1000;this.sticks={left:{x:0,y:0},right:{x:0,y:0}};return this}
  centre(){for(const s of Object.values(this.sticks))s.x=s.y=0;this.channels[0]=this.channels[1]=this.channels[3]=1500;return this}
  setStick(side,x,y){if(!this.sticks[side])return;const length=Math.max(1,Math.hypot(x,y));this.sticks[side]={x:clamp(x/length,-1,1),y:clamp(y/length,-1,1)}}
  setThrottle(value){this.throttleTarget=clamp(Number(value)||1000,1000,2000)}
  advance(dt,keys=new Set()){
   dt=clamp(dt,0,.05);const pair=(positive,negative,fallback)=>keys.has(positive)||keys.has(negative)?Number(keys.has(positive))-Number(keys.has(negative)):fallback;
   const roll=pair('ArrowRight','ArrowLeft',shape(this.sticks.right.x)),pitch=pair('ArrowUp','ArrowDown',shape(this.sticks.right.y)),yaw=pair('KeyD','KeyA',shape(this.sticks.left.x)),rate=pair('KeyW','KeyS',shape(this.sticks.left.y));
   this.throttleTarget=clamp(this.throttleTarget+rate*320*dt,1000,2000);const axisMix=1-Math.exp(-dt/ .12),throttleMix=1-Math.exp(-dt/ .085);
   for(const [index,value]of[[0,roll],[1,pitch],[3,yaw]])this.channels[index]+=(1500+value*500-this.channels[index])*axisMix;
   this.channels[2]+=(this.throttleTarget-this.channels[2])*throttleMix;return this.channels;
  }
 }
 const api={TrainingInput,shape};scope.AerionTrainingInput=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
