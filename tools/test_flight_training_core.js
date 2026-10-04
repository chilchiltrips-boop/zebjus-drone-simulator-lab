'use strict';
const assert=require('node:assert/strict'),{FlightTraining,lessons,neutral}=require('../flight-training-core.js');
assert.equal(lessons.length,10);assert.equal(new Set(lessons.map(l=>l.title)).size,10);
const tick=(m,c,n=1,extra={})=>{for(let i=0;i<n;i++)m.tick(.025,c,extra)};
let m=new FlightTraining().start(),ch=[...neutral];ch[4]=2000;tick(m,ch,10);assert(!m.armed,'high ARM without low observation is rejected');ch[4]=1000;tick(m,ch);ch[4]=2000;tick(m,ch);assert(m.armed);
// Closed-loop pilot flies the whole first lesson using only channel frames.
let landed=false;for(let i=0;i<5000&&m.result==='running';i++){const target=m.hold>=m.lesson.hold?.15:1.9;ch[2]=Math.max(1000,Math.min(2000,1500+(target-m.y)*220-m.vy*230));tick(m,ch);if(m.result==='complete')landed=true;}assert(landed,'takeoff, hold and soft landing complete via RC input');assert(m.landingQuality<.8);
// Stick direction, yaw and deliberate PPM dwell/release are meaningful.
m=new FlightTraining(3).start();ch=[...neutral];tick(m,ch);ch[4]=2000;tick(m,ch);ch[2]=1700;ch[1]=2000;tick(m,ch,60);assert(m.z<0);assert(m.y>.65);
m=new FlightTraining().start();ch=[...neutral];ch[3]=1000;tick(m,ch,41,{ppm:true,armMode:'YAW_LEFT'});assert(m.armed);ch[3]=1500;tick(m,ch,2,{ppm:true,armMode:'YAW_LEFT'});ch[3]=2000;tick(m,ch,41,{ppm:true,armMode:'YAW_LEFT'});assert(!m.armed);
// A gentle input error cannot silently bypass collision or hard-landing failure.
m=new FlightTraining(5).start();m.x=0;m.z=-4;m.y=2;tick(m,neutral);assert.equal(m.result,'failed');assert.match(m.reason,/collision/);
m=new FlightTraining().start();m.y=.23;m.vy=-3;m.airborne=true;tick(m,neutral);assert.equal(m.result,'failed');assert.match(m.reason,/Hard landing/);
m=new FlightTraining(6).start();m.time=4.5;tick(m,neutral);assert(Math.hypot(m.windX,m.windZ)>.1,'gusts change the flight dynamics');
// Mission actions require location, altitude, speed and exact LED message.
m=new FlightTraining(7).start();assert.match(m.action('signal',lessons[7].pattern),/Hover near/);m.z=-5;m.y=2;assert.match(m.action('signal',Array(8).fill(0)),/differs/);assert(!m.signalSent);assert.match(m.action('signal',lessons[7].pattern),/received/);assert(m.signalSent);
m=new FlightTraining(8).start();assert.match(m.action('pickup'),/Reach/);m.x=-5;m.z=-4;m.y=.6;assert.match(m.action('pickup'),/secured/);assert(m.payload);assert.match(m.action('drop'),/Reach/);m.x=5;m.z=-5;assert.match(m.action('drop'),/delivered/);assert(m.delivered&&!m.payload);
m=new FlightTraining(9).start();m.x=-4;m.z=-8;m.y=.6;m.action('pickup');m.x=4;assert.match(m.action('drop'),/signal/);m.y=2;m.action('signal',lessons[9].pattern);m.y=.6;assert.match(m.action('drop'),/delivered/);assert(m.obstacles().some(o=>o.moving));
m=new FlightTraining().start();tick(m,[NaN,1500,1000,1500,1000,1000]);assert.equal(m.result,'failed');
// Forward/backward and right/left stay in the aircraft's body axes at every cardinal heading.
for(const heading of[0,90,180,270])for(const [axis,sign]of[[1,1],[1,-1],[0,1],[0,-1]]){m=new FlightTraining(3).start();ch=[...neutral];m.tick(0,ch);ch[4]=2000;m.tick(0,ch);m.y=2;m.yaw=heading;ch[2]=1500;ch[axis]=1500+sign*350;tick(m,ch,24);const a=heading*Math.PI/180,expectedX=axis===1?Math.sin(a):Math.cos(a),expectedZ=axis===1?-Math.cos(a):Math.sin(a);assert((m.x*expectedX+m.z*expectedZ)*sign>.03,'movement follows the nose/right axis');assert(Math.abs(m.x*expectedZ-m.z*expectedX)<.001,'no unexplained sideways drift');assert.equal(m.result,'running');}
// An armed aircraft on its skids does not slide, bank or turn from full stick inputs.
m=new FlightTraining(3).start();ch=[...neutral];m.tick(0,ch);ch[4]=2000;m.tick(0,ch);ch[0]=ch[1]=ch[3]=2000;tick(m,ch,80);assert.deepEqual([m.x,m.z,m.yaw,m.pitch,m.roll],[0,0,0,0,0]);
// Physics remains close across tick sizes, including tilt and acceleration response.
const trajectory=hz=>{const m=new FlightTraining(3).start(),c=[...neutral];m.tick(0,c);c[4]=2000;m.tick(0,c);m.y=2;c[2]=1500;c[0]=1660;c[1]=1720;c[3]=1560;for(let n=0;n<hz*2;n++)m.tick(1/hz,c);return m};const coarse=trajectory(30),fine=trajectory(120);assert(Math.hypot(coarse.x-fine.x,coarse.z-fine.z)<.09);assert(Math.abs(coarse.yaw-fine.yaw)<.3);
console.log('PASS: 10 lesson curriculum; actual RC takeoff/hover/soft landing, yaw-left PPM, pitch direction, collision/hard landing/gust dynamics, LED message and payload mission gates');
