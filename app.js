import * as THREE from './three.module.min.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=d=>d*Math.PI/180;
const SVG='http://www.w3.org/2000/svg';
window.__zebjusModuleParsed=true;
window.__zebjusAppLoaded=false;
window.__zebjus3DReady=false;
function setBootStatus(text,kind=''){const s=$('#assetStatus');if(s){s.textContent=text;s.className='status'+(kind?' '+kind:'')}}
setBootStatus('V17.3 local module loaded • starting optimized engineering lab…');

/* V9: local camera controls. No network add-on is required for 3D startup. */
class MiniOrbitControls {
 constructor(camera,dom){
  this.object=camera;this.domElement=dom;this.target=new THREE.Vector3();this.enabled=true;this.enableDamping=true;this.minDistance=3;this.maxDistance=30;this.autoRotate=false;this.autoRotateSpeed=1.25;
  this._drag=false;this._moved=0;this._last={x:0,y:0};this._az=0;this._el=.62;this._r=12;this._syncFromCamera();
  dom.style.touchAction='none';
  dom.addEventListener('pointerdown',e=>{if(!this.enabled||e.button!==0)return;this._drag=true;this._moved=0;this._last={x:e.clientX,y:e.clientY};try{dom.setPointerCapture(e.pointerId)}catch{}});
  dom.addEventListener('pointermove',e=>{if(!this.enabled||!this._drag)return;const dx=e.clientX-this._last.x,dy=e.clientY-this._last.y;this._last={x:e.clientX,y:e.clientY};this._moved+=Math.abs(dx)+Math.abs(dy);if(this._moved<4)return;this._az-=dx*.008;this._el=THREE.MathUtils.clamp(this._el+dy*.006,.08,1.48)});
  const up=e=>{this._drag=false};dom.addEventListener('pointerup',up);dom.addEventListener('pointercancel',up);
  dom.addEventListener('wheel',e=>{if(!this.enabled)return;e.preventDefault();this._r=THREE.MathUtils.clamp(this._r+e.deltaY*.010,this.minDistance,this.maxDistance)},{passive:false});
 }
 _syncFromCamera(){const v=this.object.position.clone().sub(this.target);this._r=Math.max(.001,v.length());this._az=Math.atan2(v.x,v.z);this._el=Math.asin(THREE.MathUtils.clamp(v.y/this._r,-1,1))}
 update(){if(this.autoRotate&&!this._drag)this._az+=.0025*this.autoRotateSpeed;this._r=THREE.MathUtils.clamp(this._r,this.minDistance,this.maxDistance);const h=Math.cos(this._el)*this._r;this.object.position.set(this.target.x+Math.sin(this._az)*h,this.target.y+Math.sin(this._el)*this._r,this.target.z+Math.cos(this._az)*h);this.object.lookAt(this.target)}
}
const C={red:0xd23d43,white:0xe8edf2,black:0x3b4853,dark:0x202b34,metal:0xd3dbe2,gold:0xda9a12,pcb:0x0e6c43,orange:0xf59e0b,yellow:0xf6d23b,esc:0x164765,blue:0x2c92ff,pink:0xfb7185,green:0x53efbd,ground:0x4b2f20,brown:0x4b2f20};
// V7: bench top is Y=0; all assembly slots use true world heights.
const ASSEMBLY_Y=0;

const products=[
 {type:'bottomPlate',icon:'▰',name:'F450 Bottom PDB',short:'Main power-distribution plate',max:1,asset:'f450_bottom_pdb.glb',thumb:'ref_f450-plates.png',rating:{Type:'F450 PDB',Pads:'BAT +/− + ESC ×4',Colour:'Black'},detail:'Lower F450 plate with battery and four ESC solder-pad pairs.',pins:[['BAT+/BAT−','Main LiPo input'],['E1–E4','ESC high-current solder pairs']]},
 {type:'armRed',icon:'╱',name:'Red F450 Arm',short:'Front lattice arm + landing leg',max:2,asset:'f450_arm_red.glb',thumb:'ref_f450-arms.png',rating:{Position:'Front pair',Motor:'A2212',Colour:'Red'},detail:'Front F450 lattice arm. The integrated leg must rest on the workbench. Red arms define FRONT.',pins:[['ROOT','Four corner/root mounting zone'],['TIP','Guard + motor mount']]},
 {type:'armWhite',icon:'╲',name:'White F450 Arm',short:'Rear lattice arm + landing leg',max:2,asset:'f450_arm_white.glb',thumb:'ref_f450-arms.png',rating:{Position:'Rear pair',Motor:'A2212',Colour:'White'},detail:'Rear F450 lattice arm with integrated landing leg.',pins:[['ROOT','Four corner/root mounting zone'],['TIP','Guard + motor mount']]},
 {type:'topPlate',icon:'▬',name:'F450 Top Plate',short:'Upper equipment plate',max:1,asset:'f450_top_plate.glb',thumb:'ref_f450-plates.png',rating:{Use:'Frame clamp / electronics deck',Colour:'Black'},detail:'Upper plate clamps all four arm roots while leaving the lower PDB solder area separate.',pins:[['CENTER','Flight-controller case'],['SLOTS','Straps / accessories']]},
 {type:'frameScrew',icon:'•',name:'M2.5 Frame Screw Set',short:'1 drag → all 12 screws',max:12,asset:'frame_screw_m25.glb',thumb:'thumb_frameScrew.png',rating:{Thread:'M2.5',Qty:'12',Install:'ONE DRAG'},detail:'Drag once. All frame screws auto-align around the four real F450 corner/root zones and tighten with a wave effect.',pins:[['SET','12 frame screws'],['EFFECT','Drop + spin + green lock']]},
 {type:'guard',icon:'◯',name:'F450 Arc Prop Guard',short:'Open-arc white safety guard',max:4,asset:'f450_prop_guard.glb',thumb:'ref_propeller-guards.png',rating:{Style:'Open arc',Position:'Between arm & motor',Prop:'10 inch'},detail:'Open-arc F450 guard based on the useful reference project geometry. The opening faces inward toward the frame.',pins:[['CENTER','Sandwiched under motor'],['ARC','Clear of 1045 propeller']]},
 {type:'motor',icon:'◉',name:'A2212 BLDC',short:'1000KV black outrunner',max:4,asset:'a2212_1000kv_motor.glb',thumb:'ref_a2212-motor.png',rating:{KV:'1000KV',Supply:'2S–3S',Prop:'1045',Leads:'U/V/W'},detail:'Black A2212-style 1000KV motor with three phase leads and bullet connectors.',pins:[['U/V/W','Three ESC phases'],['SHAFT','1045 propeller adapter']]},
 {type:'motorScrew',icon:'•',name:'M3 Motor Screw Set',short:'1 drag → all 16 screws',max:16,asset:'motor_screw_m3.glb',thumb:'thumb_motorScrew.png',rating:{Thread:'M3',Qty:'16',Install:'ONE DRAG'},detail:'Drag once. Four screws per motor align and tighten automatically.',pins:[['SET','16 screws'],['EFFECT','4-motor tightening wave']]},
 {type:'esc',icon:'▣',name:'30A ESC',short:'Dark ESC • U/V/W + power + 3-pin FC',max:4,asset:'esc_30a.glb',thumb:'ref_simonk-30a-esc.png',rating:{Current:'30A',Input:'2S–4S',BEC:'+5V',Control:'PWM'},detail:'One ESC per arm. Three motor phase wires, two thick high-current PDB leads, and a 3-wire orange Source / light-red +5V / brown-black GND control lead. The 3-wire lead ends in a 2.54 mm female housing that plugs vertically downward onto the FC male header.',pins:[['U/V/W','Motor phases'],['THICK RED / BROWN-BLACK','PDB +12V / GND'],['ORANGE / LIGHT RED / BROWN-BLACK','Source / +5V / GND → FC female plug']]},
 {type:'fcTape',icon:'▭',name:'FC Double-side Foam Tape',short:'No spacer • vibration-isolating adhesive pad',max:1,rating:{Mount:'Double-side foam tape',Spacer:'None',Use:'FC case mounting'},detail:'The ZEBJUS FC case is fixed directly to the top plate using a thin double-side foam tape pad. No standoffs are used.',pins:[['BOTTOM','Adheres to top plate'],['TOP','Adheres to FC case base']]},
 {type:'fc',icon:'✥',name:'ZEBJUS FC + Case',short:'Actual PCB layout • protected case • exposed I/O',max:1,asset:'zebjus_flight_controller.glb',thumb:'fc_board_reference.png',rating:{ESC:'4 × Source/+5V/GND',GPIO:'3 × Source/+5V/GND',RX:'Optional PPM / GPIO',I2C:'VCC/GND/SCL/SDA'},detail:'Actual FC PCB is enclosed in a graphite case fixed by double-side foam tape. Only user headers remain exposed. All 3-pin groups use upward-projecting 2.54 mm male header pins: Source on the upper row, +5V in the centre row and GND on the lower row. ESC female plugs insert from above.',pins:[['ESC1–ESC4','Top/source row • middle +5V • bottom GND'],['GPIO ×3','Source / +5V / GND'],['RX / PPM','Optional 3-pin; source may be reused as compatible I/O'],['I²C','VCC / GND / SCL / SDA']]},
 {type:'batteryStrap',internal:true,icon:'═',name:'Battery Strap',short:'LiPo retention strap',max:2,asset:'battery_strap.glb',thumb:'thumb_batteryStrap.png',rating:{Qty:'2',Use:'Battery retention'},detail:'Two tight straps wrap around the LiPo mounted underneath the central frame/PDB.',pins:[['ROUTE','Plate slots'],['TENSION','Firm, not crushing']]},
 {type:'battery',icon:'▰',name:'LiPo Battery',short:'2200mAh 3S 11.1V + XT60',max:1,asset:'lipo_2200_3s.glb',thumb:'ref_lipo-2200.png',rating:{Capacity:'2200mAh',Cells:'3S',Voltage:'11.1V',Connector:'XT60'},detail:'Main 2200mAh 3S propulsion battery mounted underneath the central frame and held tightly with two straps. Its XT60 plug mates with the soldered PDB battery connector.',pins:[['XT60 +','PDB BAT+'],['XT60 −','PDB BAT−']]},
 {type:'prop',icon:'✣',name:'1045 Propeller',short:'10×4.5 CW / CCW',max:4,asset:'prop_1045_cw.glb',assetCCW:'prop_1045_ccw.glb',thumb:'thumb_prop.png',rating:{Size:'10×4.5',Pair:'CW / CCW'},detail:'Correct direction asset is chosen automatically for each motor.',pins:[['CW','M1/M3'],['CCW','M2/M4']]},
 {type:'receiver',icon:'⌁',name:'PPM Receiver (Optional)',short:'Optional because Wi‑Fi control is built in',max:1,asset:'receiver_module.glb',thumb:'thumb_receiver.png',optional:true,rating:{Output:'PPM',Wires:'Signal / +5V / GND',Requirement:'Optional'},detail:'Optional PPM-output receiver. A reserved top-deck side area is provided. Use the isolated RX/PPM 3-pin Source/+5V/GND section. Wi‑Fi control can be used without this receiver.',pins:[['PPM','RX source pin'],['+5V','Center row'],['GND','Bottom row']]},
 {type:'gps',icon:'⌖',name:'GPS Module (Optional)',short:'External GPIO / serial learning device',max:1,optional:true,rating:{Use:'Position / navigation',Power:'+5V/GND','I/O':'External GPIO'},detail:'Optional GPS module with an automatic raised mast/stand. The stand lifts the GPS above the top deck and keeps space clear around the FC headers. Connect compatible source/serial pins through external GPIO plus +5V/GND.',pins:[['SOURCE','GPIO source pin(s)'],['+5V','Center row'],['GND','Bottom row']]},
 {type:'servo',icon:'↻',name:'Servo (Optional)',short:'External GPIO output',max:2,optional:true,rating:{Signal:'PWM',Power:'+5V/GND',Header:'External GPIO or spare RX source'},detail:'Optional servo. Use a compatible source pin plus +5V and GND.',pins:[['PWM','Source row'],['+5V','Center row'],['GND','Bottom row']]},
 {type:'matrix',icon:'▦',name:'LED Matrix (Optional)',short:'GPIO data + +5V + GND',max:1,optional:true,thumb:'ref_led-matrix-16x16.png',rating:{Signal:'Data',Power:'+5V/GND',Use:'Learning output'},detail:'Optional LED matrix mounts on the left-side top-deck area so it does not cover the FC headers. Use a compatible GPIO source/data pin with +5V and GND.',pins:[['DATA','GPIO source'],['+5V','Center row'],['GND','Bottom row']]},
 {type:'sensor',icon:'◫',name:'I²C Sensor (Optional)',short:'Use exposed I²C 4-pin header',max:2,optional:true,rating:{Bus:'I²C',Header:'VCC/GND/SCL/SDA'},detail:'Optional I²C sensor. The four-pin I²C header remains exposed through the FC case.',pins:[['VCC','I²C VCC'],['GND','I²C GND'],['SCL','Clock'],['SDA','Data']]},
 {type:'led',icon:'●',name:'LED / Output (Optional)',short:'GPIO source + +5V/GND as required',max:2,optional:true,rating:{Use:'Digital/PWM output',Header:'External GPIO'},detail:'Optional output device for GPIO learning.',pins:[['SOURCE','GPIO output'],['+5V','Center row if required'],['GND','Bottom row']]}
];

const steps=[
 {id:'bottom',title:'Place bottom PDB plate',desc:'Start with the lower PDB. Keep BAT+/BAT− and ESC1–ESC4 solder pads fully visible.',types:['bottomPlate'],need:1,target:'Bench center'},
 {id:'arms',title:'Attach four F450 arms',desc:'Two red FRONT arms and two white REAR arms snap at the four plate edge/corner root zones. Top plate stays OFF.',types:['armRed','armWhite'],need:4,target:'Four PDB edge/corner root zones'},
 {id:'guards',title:'Install four arc prop guards',desc:'Install the open-arc guards at the motor ends before mounting the motors.',types:['guard'],need:4,target:'Four arm motor pads'},
 {id:'motors',title:'Mount four A2212 1000KV motors',desc:'Snap one A2212 motor above each guard/motor pad.',types:['motor'],need:4,target:'Four guard centers'},
 {id:'motorScrews',title:'Install motor screw set',desc:'One drag installs all 16 motor screws. A virtual Allen key tightens them sequentially with visible delay.',types:['motorScrew'],need:16,target:'ONE DRAG → 4 × 4 motor screws'},
 {id:'escs',title:'Attach four 30A ESCs',desc:'One ESC per arm. Retention straps are added automatically.',types:['esc'],need:4,target:'Four arm ESC zones'},
 {id:'motorWire',title:'Connect motor U / V / W',desc:'Connect ESC U/V/W to each motor using the three phase wires and bullet connectors.',types:[],need:12,target:'ESC ↔ Motor U/V/W',action:'motorWire'},
 {id:'powerWire',title:'Solder ESC power to bottom PDB',desc:'With the top plate still OFF, solder each ESC thick red +12V lead and thick brown-black GND lead to E1–E4.',types:[],need:8,target:'Visible PDB ESC solder pads',action:'powerWire'},
 {id:'top',title:'Install top plate',desc:'Only after motor/ESC wiring and PDB soldering are complete, place the top plate. A small visible gap remains above the bottom PDB.',types:['topPlate'],need:1,target:'Frame center • after soldering'},
 {id:'frameScrews',title:'Install frame screw set',desc:'One drag installs all 12 frame screws around the four arm-root zones. Allen-key tightening runs sequentially.',types:['frameScrew'],need:12,target:'ONE DRAG → all frame screws'},
 {id:'fcTape',title:'Apply FC double-side foam tape',desc:'NO spacer/standoff. Place the vibration-isolating double-side foam tape directly on the top plate.',types:['fcTape'],need:1,target:'Top plate center'},
 {id:'fc',title:'Mount ZEBJUS FC case',desc:'Press the FC case onto the double-side tape. FRONT arrow points to red arms. 2.54 mm male headers project upward through the case.',types:['fc'],need:1,target:'Top plate center'},
 {id:'escFc',title:'Plug ESC Source / +5V / GND into FC',desc:'Each ESC 3-pin FEMALE housing moves from above and plugs downward onto the matching FC 2.54 mm MALE header. Orange=Source, light-red=+5V, brown-black=GND.',types:[],need:12,target:'FC ESC1–ESC4 male header block',action:'escFc'},
 {id:'battery',title:'Install LiPo underneath + tighten straps',desc:'Slide the 2200mAh 3S LiPo underneath the center frame. Two battery straps are added and tighten automatically around it.',types:['battery'],need:1,target:'Under-frame battery bay'},
 {id:'xt60',title:'Connect battery XT60',desc:'Plug the LiPo XT60 into the 3D XT60 connector soldered to the bottom PDB. ESC startup tone, FC/ESC LED sequence and power-flow animation begin.',types:[],need:2,target:'PDB XT60 battery connector',action:'xt60'},
 {id:'props',title:'Install four 1045 two-blade propellers',desc:'Install realistic 10×4.5 CW/CCW propellers after electrical checks. If virtual power is ON they idle slowly.',types:['prop'],need:4,target:'Four motor adapters'},
 {id:'inspect',title:'Final inspection',desc:'After XT60 power-up and prop installation, press Complete action to confirm frame, soldering, ESC plugs, FC FRONT direction, battery straps, motor direction and propeller orientation.',types:[],need:1,target:'Complete drone • manual confirmation',action:'inspect'}
];

const state={guided:true,step:0,selectedType:null,selectedInstalledId:null,parts:[],doneActions:new Set(),connections:[],wireMap:false,xray:false,fcCaseXray:false,exploded:false,autoRotate:false,powered:false,powerStage:0,
 pid:{rateRoll:{P:.9,I:15,D:.035},ratePitch:{P:.9,I:15,D:.035},rateYaw:{P:3,I:13,D:0},angleRoll:{P:3,I:0,D:0},anglePitch:{P:3,I:0,D:0}},
 fc:{socket:null,connected:false},telemetry:{roll:0,pitch:0,yaw:0,battery:null,gyroX:0,gyroY:0,gyroZ:0},
 sim:{running:false,flightMode:'angle',roll:0,pitch:0,yaw:0,rollRate:0,pitchRate:0,yawRate:0,rollI:0,pitchI:0,yawI:0,prevRollErr:0,prevPitchErr:0,prevYawErr:0,angleRollI:0,anglePitchI:0,prevAngleRollErr:0,prevAnglePitchErr:0,throttle:1000,cmdRoll:0,cmdPitch:0,cmdYaw:0,vibration:0,liftY:0,disturbMode:false,disturbing:false,lastMix:[0,0,0,0],motorActual:[0,0,0,0],batteryV:12.2,payloadG:0,cgX:0,cgY:0,wind:0,motorLag:.12,teachAxis:'roll',teachLoop:'rate',targetRoll:0,targetPitch:0,targetYawRate:0,levelTrimRoll:0,levelTrimPitch:0,rateHoldRoll:0,rateHoldPitch:0,rateRollStickActive:false,ratePitchStickActive:false,rateHoldGain:5.2,pidLive:{P:0,I:0,D:0,error:0,target:0,actual:0,loop:'RATE'}}};

function normalizePidShape(pid){
 const p=pid||{};
 p.rateRoll=p.rateRoll||{P:.9,I:15,D:.035};p.ratePitch=p.ratePitch||{P:.9,I:15,D:.035};p.rateYaw=p.rateYaw||{P:3,I:13,D:0};
 p.angleRoll=p.angleRoll||{P:3,I:0,D:0};p.anglePitch=p.anglePitch||{P:3,I:0,D:0};delete p[['angle','Yaw'].join('')];
 return p
}
state.pid=normalizePidShape(state.pid);

const requiredWires=[
 ['BAT.+','PDB.BAT+'],['BAT.-','PDB.BAT-'],
 ['PDB.E1+','ESC1.PWR+'],['PDB.E1-','ESC1.PWR-'],['ESC1.SIG','FC.ESC1-S'],['ESC1.5V','FC.ESC1-5V'],['ESC1.GND','FC.ESC1-G'],
 ['PDB.E2+','ESC2.PWR+'],['PDB.E2-','ESC2.PWR-'],['ESC2.SIG','FC.ESC2-S'],['ESC2.5V','FC.ESC2-5V'],['ESC2.GND','FC.ESC2-G'],
 ['PDB.E3+','ESC3.PWR+'],['PDB.E3-','ESC3.PWR-'],['ESC3.SIG','FC.ESC3-S'],['ESC3.5V','FC.ESC3-5V'],['ESC3.GND','FC.ESC3-G'],
 ['PDB.E4+','ESC4.PWR+'],['PDB.E4-','ESC4.PWR-'],['ESC4.SIG','FC.ESC4-S'],['ESC4.5V','FC.ESC4-5V'],['ESC4.GND','FC.ESC4-G'],
 ['ESC1.U','M1.U'],['ESC1.V','M1.V'],['ESC1.W','M1.W'],['ESC2.U','M2.U'],['ESC2.V','M2.V'],['ESC2.W','M2.W'],
 ['ESC3.U','M3.U'],['ESC3.V','M3.V'],['ESC3.W','M3.W'],['ESC4.U','M4.U'],['ESC4.V','M4.V'],['ESC4.W','M4.W']
];

const slots={
 bottomPlate:[{id:'bottom',p:[0,.68,0],r:0}],
 armRed:[{id:'FR',p:[1.04,.75,1.04],r:rad(45)},{id:'FL',p:[-1.04,.75,1.04],r:rad(-45)}],
 armWhite:[{id:'RL',p:[-1.04,.75,-1.04],r:rad(-135)},{id:'RR',p:[1.04,.75,-1.04],r:rad(135)}],
 topPlate:[{id:'top',p:[0,.89,0],r:0}],
 guard:[{id:'M1',p:[2.96,.84,2.96],r:rad(45)},{id:'M2',p:[-2.96,.84,2.96],r:rad(-45)},{id:'M3',p:[-2.96,.84,-2.96],r:rad(-135)},{id:'M4',p:[2.96,.84,-2.96],r:rad(135)}],
 motor:[{id:'M1',p:[2.96,.96,2.96],r:rad(135)},{id:'M2',p:[-2.96,.96,2.96],r:rad(45)},{id:'M3',p:[-2.96,.96,-2.96],r:rad(-45)},{id:'M4',p:[2.96,.96,-2.96],r:rad(-135)}],
 esc:[{id:'ESC1',p:[1.82,.82,1.82],r:rad(-45)},{id:'ESC2',p:[-1.82,.82,1.82],r:rad(-135)},{id:'ESC3',p:[-1.82,.82,-1.82],r:rad(135)},{id:'ESC4',p:[1.82,.82,-1.82],r:rad(45)}],
 fcTape:[{id:'TAPE',p:[0,1.00,0],r:0}],fc:[{id:'FC',p:[0,1.035,0],r:0}],
 receiver:[{id:'RX',p:[1.36,1.08,-.48],r:0}],gps:[{id:'GPS',p:[0,1.96,.82],r:0}],servo:[{id:'SV1',p:[1.58,1.00,-1.10],r:0},{id:'SV2',p:[-1.58,1.00,-1.10],r:0}],matrix:[{id:'MATRIX',p:[-1.52,1.09,-.52],r:rad(90)}],sensor:[{id:'SEN1',p:[-1.30,1.09,.50],r:0},{id:'SEN2',p:[1.30,1.09,.52],r:0}],led:[{id:'LED1',p:[.78,1.09,1.03],r:0},{id:'LED2',p:[-.78,1.09,1.03],r:0}],
 batteryStrap:[{id:'BS1',p:[-.62,.00,0],r:0},{id:'BS2',p:[.62,.00,0],r:0}],battery:[{id:'BAT',p:[0,.00,0],r:0}],
 prop:[{id:'M1',p:[2.96,1.96,2.96]},{id:'M2',p:[-2.96,1.96,2.96]},{id:'M3',p:[-2.96,1.96,-2.96]},{id:'M4',p:[2.96,1.96,-2.96]}],frameScrew:[],motorScrew:[]};
[
 [.78,.95,.90],[1.05,.95,.78],[.95,.95,1.05],[-.78,.95,.90],[-1.05,.95,.78],[-.95,.95,1.05],
 [-.78,.95,-.90],[-1.05,.95,-.78],[-.95,.95,-1.05],[.78,.95,-.90],[1.05,.95,-.78],[.95,.95,-1.05]
].forEach((p,i)=>slots.frameScrew.push({id:'FS'+(i+1),p}));
[['M1',2.96,2.96],['M2',-2.96,2.96],['M3',-2.96,-2.96],['M4',2.96,-2.96]].forEach(([m,x,z])=>{[[-.08,-.095],[.08,-.095],[-.08,.095],[.08,.095]].forEach(([dx,dz],i)=>slots.motorScrew.push({id:`${m}-MS${i+1}`,p:[x+dx,.95,z+dz]}))});

const history={undo:[],redo:[],restoring:false,max:60};
function snapState(){return JSON.stringify({guided:state.guided,step:state.step,parts:state.parts.filter(p=>!p.internal&&p.type!=='batteryStrap').map(p=>({type:p.type,slotId:p.slotId})),actions:[...state.doneActions],connections:state.connections.map(c=>({from:c.from,to:c.to,id:c.id})),pid:state.pid,wireLayout,wireNodeTransforms,optionalWireNodes})}
function historyPush(){if(history.restoring)return;history.undo.push(snapState());if(history.undo.length>history.max)history.undo.shift();history.redo.length=0;historyButtons()}
function historyButtons(){const u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=!history.undo.length;if(r)r.disabled=!history.redo.length}
function clearAssemblyObjects(){state.selectedInstalledId=null;if(partsRoot)partsRoot.clear();if(wiresRoot)wiresRoot.clear();if(guidesRoot)guidesRoot.clear();if(extrasRoot)extrasRoot.clear();if(labelsRoot)labelsRoot.clear();if(typeof solderRoot!=='undefined'&&solderRoot)solderRoot.clear();state.parts=[]}
function restoreHistory(raw){history.restoring=true;const d=JSON.parse(raw);clearAssemblyObjects();state.guided=d.guided;state.step=d.step;state.doneActions=new Set(d.actions||[]);state.connections=(d.connections||[]).map(c=>({...c}));state.pid=normalizePidShape(d.pid||state.pid);wireLayout={...wireDefaultLayout,...(d.wireLayout||{})};wireNodeTransforms=d.wireNodeTransforms||{};optionalWireNodes=d.optionalWireNodes||[];if(d.sim)Object.assign(state.sim,d.sim);(d.parts||[]).filter(p=>p.type!=='fcStandoff'&&p.type!=='batteryStrap').forEach(p=>{const s=(slots[p.type]||[]).find(x=>x.id===p.slotId);if(s)install(p.type,s,false)});renderAssemblyUI();render2D();renderPid();rebuild3DWires();rebuildSolder();setPowerVisual(state.doneActions.has('xt60'),true);persistWireLayout();showGuides();history.restoring=false;historyButtons()}
function undoAction(){if(!history.undo.length)return;history.redo.push(snapState());restoreHistory(history.undo.pop());notify('Undo complete.','good')}
function redoAction(){if(!history.redo.length)return;history.undo.push(snapState());restoreHistory(history.redo.pop());notify('Redo complete.','good')}

/* assets / runtime bootstrap
   V9 intentionally does not block the application on GLB parsing or a CDN.
   The shipped GLB files remain in the package as reference/export assets, while the
   live workshop uses matching procedural geometry so tabs and 3D always start. */
const assetTemplates=new Map();
function tuneLoadedModel(root){return root}
function loadAssets(){
 // Runtime geometry is local/procedural. GLB files remain packaged for export/reference.
 return Promise.resolve({runtime:'procedural',offline:true});
}
function cloneAsset(path){return null}


/* ==================== V13 SOUND / POWER FX ==================== */
let audioCtx=null,powerSequenceToken=0;
let soundEnabled=(()=>{try{return localStorage.getItem('zebjus-v171-sound')!=='off'}catch{return true}})();
let soundVolume=(()=>{try{return clamp(+(localStorage.getItem('zebjus-v171-volume')||.55),0,1)}catch{return .55}})();
function getAudioCtx(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch{return null}}
function tone(freq=440,dur=.08,type='sine',gain=.025,delay=0){
 if(!soundEnabled||soundVolume<=0)return;
 const ac=getAudioCtx();if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter(),t=ac.currentTime+delay;
 o.type=type;o.frequency.setValueAtTime(freq,t);f.type='lowpass';f.frequency.setValueAtTime(1800,t);f.Q.value=.35;
 const level=Math.max(.0004,gain*soundVolume);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(level,t+.012);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
 o.connect(f);f.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+dur+.03)
}
function playFX(kind){
 if(!soundEnabled)return;
 const seq={
  pick:[[470,.04,'sine'],[610,.05,'triangle']],
  plate:[[180,.065,'triangle'],[250,.080,'sine']],
  arm:[[225,.060,'triangle'],[315,.075,'sine']],
  guard:[[290,.060,'triangle'],[380,.070,'sine']],
  motor:[[310,.055,'triangle'],[450,.080,'sine']],
  esc:[[370,.055,'triangle'],[520,.075,'sine']],
  tape:[[155,.055,'triangle'],[125,.070,'sine']],
  fc:[[500,.050,'sine'],[675,.075,'sine']],
  battery:[[190,.070,'triangle'],[150,.080,'sine']],
  strap:[[170,.050,'triangle'],[140,.065,'sine']],
  prop:[[285,.050,'triangle'],[405,.065,'sine']],
  connector:[[500,.045,'sine'],[690,.070,'sine']],
  screw:[[500,.018,'triangle'],[620,.022,'sine']]
 };
 const gainMap={pick:.024,plate:.030,arm:.028,guard:.026,motor:.030,esc:.028,tape:.023,fc:.030,battery:.030,strap:.022,prop:.026,connector:.026,screw:.016};
 const gain=gainMap[kind]??.024;
 (seq[kind]||[[300,.06,'sine']]).forEach((q,i)=>tone(q[0],q[1],q[2],gain,i*.055))
}

const motorAudio={sim:null,wire:null,assembly:null};
function ensureMotorAudio(kind){
 const ac=getAudioCtx();if(!ac)return null;
 if(motorAudio[kind])return motorAudio[kind];
 const g=ac.createGain(),f=ac.createBiquadFilter(),o1=ac.createOscillator(),o2=ac.createOscillator(),o3=ac.createOscillator();
 g.gain.value=.0001;f.type='lowpass';f.frequency.value=1450;f.Q.value=.25;
 o1.type='triangle';o2.type='sine';o3.type='sine';
 o1.frequency.value=70;o2.frequency.value=140;o3.frequency.value=35;
 o2.detune.value=7;o3.detune.value=-6;
 o1.connect(f);o2.connect(f);o3.connect(f);f.connect(g);g.connect(ac.destination);
 o1.start();o2.start();o3.start();
 motorAudio[kind]={ac,g,f,o1,o2,o3,level:0};
 return motorAudio[kind]
}
function updateMotorAudio(kind,level,imbalance=0){
 const a=motorAudio[kind];if(!a)return;
 const t=a.ac.currentTime,l=clamp(level,0,1),imb=clamp(imbalance,0,1);
 if(!soundEnabled||soundVolume<=0){a.g.gain.setTargetAtTime(.0001,t,.06);return}
 const base=(kind==='wire'?72:kind==='assembly'?58:56)+l*(kind==='wire'?350:kind==='assembly'?220:310);
 a.o1.frequency.setTargetAtTime(base,t,.05);a.o2.frequency.setTargetAtTime(base*2.0+imb*18,t,.05);a.o3.frequency.setTargetAtTime(Math.max(28,base*.48),t,.07);
 a.f.frequency.setTargetAtTime(650+l*1900,t,.07);
 const raw=kind==='wire'?.010+l*.020:kind==='assembly'?.004+l*.007:.012+l*.026;
 a.g.gain.setTargetAtTime((raw+imb*.004)*soundVolume,t,.08)
}
function silenceMotorAudio(kind){const a=motorAudio[kind];if(a)a.g.gain.setTargetAtTime(.0001,a.ac.currentTime,.06)}
function escBeep(i){
 const base=[392,415,440,466][i]||440;
 tone(base,.055,'triangle',.020,0);
 tone(base*2,.055,'sine',.012,.006);
 tone(base*1.26,.050,'sine',.016,.072)
}
function escStartupTune(){
 if(!soundEnabled)return;
 // Soft BLHeli-style synthetic sequence: three rising startup tones, cell/ready confirmation.
 [[330,.00],[415,.10],[523,.20],[659,.43],[784,.52]].forEach(([f,d],i)=>{tone(f,i<3?.075:.065,i<3?'triangle':'sine',i<3?.024:.020,d);tone(f*2,.045,'sine',i<3?.008:.006,d+.006)})
}
function powerConnectThunk(){tone(145,.065,'triangle',.028,0);tone(290,.055,'sine',.014,.035)}
function setEscLed(index,on){
 const p=state.parts.filter(x=>x.type==='esc')[index];if(!p)return;
 p.obj.traverse(o=>{if(o.isMesh&&o.name==='ESC_POWER_LED')o.material.emissiveIntensity=on?2.4:0})
}
function setFcLeds(powerOn,statusOn,ready=false){
 const p=state.parts.find(x=>x.type==='fc');if(!p)return;
 p.obj.traverse(o=>{
   if(o.name==='FC_STATUS_LIGHT'){o.color.setHex(ready?0x55ffd0:0xff6b55);o.intensity=powerOn?(ready?.72:.40):0;return}
   if(!o.isMesh||!o.material)return;
   if(o.name==='FC_PWR_LED')o.material.emissiveIntensity=powerOn?8.5:0;
   if(o.name==='FC_STATUS_LED')o.material.emissiveIntensity=powerOn&&statusOn?8.0:0;
   if(o.name==='FC_RGB_LED_R')o.material.emissiveIntensity=powerOn&&!ready?8.5:0;
   if(o.name==='FC_RGB_LED_G')o.material.emissiveIntensity=powerOn&&ready?10.0:0;
   if(o.name==='FC_RGB_LED_B')o.material.emissiveIntensity=powerOn&&ready?4.8:0
 })
}
function updatePowerUi(){
 const st=$('#batteryPowerState'),btn=$('#batteryConnectBtn'),led=$('#fcLedState');
 if(st){st.textContent=!state.powered?'POWER OFF':state.powerStage<3?'POWERING…':'POWER ON';st.className='status '+(state.powered?'good':'')}
 if(btn){btn.textContent=state.powered?'Disconnect battery':'Connect battery XT60';btn.disabled=!installed('battery','BAT')}
 if(led){led.className='fc-led-state '+(!state.powered?'off':state.powerStage<3?'boot':'ready');led.innerHTML=`<i class="pwr"></i>PWR <i class="stat"></i>${!state.powered?'OFF':state.powerStage<3?'BOOT':'READY'}`}
}
function setPowerVisual(on,instant=false){
 powerSequenceToken++;
 state.powered=!!on;state.powerStage=on?(instant?3:0):0;
 for(let i=0;i<4;i++)setEscLed(i,on&&instant);
 setFcLeds(on&&instant,on&&instant,on&&instant);
 if(!on&&powerPulseRoot){powerPulseRoot.clear();powerPulseItems=[]}
 rebuildPowerPulses();updatePowerUi()
}
function runPowerUpSequence(){
 const token=++powerSequenceToken;state.powered=true;state.powerStage=1;
 for(let i=0;i<4;i++)setEscLed(i,false);
 setFcLeds(true,false,false);rebuildPowerPulses();updatePowerUi();escStartupTune();
 [0,1,2,3].forEach(i=>setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setEscLed(i,true);escBeep(i)},245+i*155));
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;state.powerStage=2;setFcLeds(true,true,false);tone(590,.08,'triangle',.020);updatePowerUi();notify('FC PWR LED ON • RGB RED • gyro booting…')},930);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setFcLeds(true,false,false);tone(700,.060,'sine',.014);notify('Gyro initialised • checking control / receiver…')},1160);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setFcLeds(true,true,false)},1280);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setFcLeds(true,false,false)},1400);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;state.powerStage=3;setFcLeds(true,true,true);tone(880,.085,'sine',.020);tone(1175,.095,'sine',.014,.095);updatePowerUi();silenceMotorAudio('assembly');notify('READY TO ARM • PWR + STATUS LEDs active • prop idle visual enabled.','good')},1580)
}
function animateBatteryPlug(connect=true){
 if(!extrasRoot)return;const bottom=installed('bottomPlate','bottom'),bat=installed('battery','BAT');if(!bottom||!bat)return;
 scene.updateMatrixWorld(true);
 const target=wiresRoot.worldToLocal(bottom.localToWorld(new THREE.Vector3(-2.34,.30,0)));
 const start=wiresRoot.worldToLocal(bat.localToWorld(new THREE.Vector3(1.62,.44,.42)));
 const g=new THREE.Group();const plug=B(.34,.20,.28,mat(0xf3c42f,.05,.48),[0,0,0],g);plug.name='BAT_XT60_MOVING';
 curvedLocalCable(g,[[.12,.04,.09],[.40,.10,.14],[.68,.13,.18]],0xef3f48,.045);
 curvedLocalCable(g,[[.12,-.04,-.09],[.40,.03,-.14],[.68,.06,-.18]],0x3a2419,.045);
 g.position.copy(connect?start:target);extrasRoot.add(g);
 animations.push({type:'batteryPlug',obj:g,target:(connect?target:start),removeAtEnd:true})
}

function xt60Spark(){
 if(!extrasRoot)return;const bottom=installed('bottomPlate','bottom');if(!bottom)return;scene.updateMatrixWorld(true);
 const p=bottom.localToWorld(new THREE.Vector3(-2.34,.30,0)),q=extrasRoot.worldToLocal(p.clone());
 const flash=new THREE.Mesh(new THREE.SphereGeometry(.095,16,10),new THREE.MeshBasicMaterial({color:0xfff3b0,transparent:true,opacity:1}));flash.position.copy(q);extrasRoot.add(flash);
 const light=new THREE.PointLight(0xffc84d,6,3.2);light.position.copy(q);extrasRoot.add(light);animations.push({type:'spark',obj:flash,light,t:0});
 for(let j=0;j<2;j++){const ring=new THREE.Mesh(new THREE.RingGeometry(.10,.145,40),new THREE.MeshBasicMaterial({color:j?0x53efbd:0xffcf5b,transparent:true,opacity:.95,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.copy(q);ring.position.y+=.025;extrasRoot.add(ring);animations.push({type:'powerWave',obj:ring,t:0,delay:j*.10})}
}

function connectBatteryPower(fromGuided=false){
 if(!installed('battery','BAT')){notify('Install the LiPo underneath the frame first.','bad');return false}
 if(!installed('bottomPlate','bottom')){notify('Bottom PDB is missing.','bad');return false}
 [['BAT.+','PDB.BAT+'],['BAT.-','PDB.BAT-']].forEach(([from,to])=>{if(!state.connections.some(c=>c.from===from&&c.to===to))state.connections.push({from,to,new:true,id:`bat-${Date.now()}-${from}`})});
 state.doneActions.add('xt60');silenceMotorAudio('assembly');animateBatteryPlug(true);playFX('connector');powerConnectThunk();setTimeout(xt60Spark,340);rebuild3DWires();rebuildSolder();render2D();renderAssemblyUI();validate2D();
 notify('XT60 inserted • power flowing to ESCs and FC…','good');runPowerUpSequence();return true
}
function disconnectBatteryPower(){
 silenceMotorAudio('assembly');
 state.connections=state.connections.filter(c=>!((c.from.startsWith('BAT.')||c.to.startsWith('BAT.'))));
 state.doneActions.delete('xt60');animateBatteryPlug(false);silenceMotorAudio('assembly');setPowerVisual(false,false);renderAssemblyUI();render2D();rebuild3DWires();rebuildSolder();validate2D();notify('Battery disconnected • ESC/FC LEDs OFF • propellers stopped.','good')
}
function toggleBatteryPower(){historyPush();if(state.powered)disconnectBatteryPower();else connectBatteryPower(false)}

/* UI */
function initPageBrandWatermarks(){
 $$('.tab-panel').forEach(p=>{
   if(p.querySelector('.zebjus-page-watermark'))return;
   const a=document.createElement('a');a.className='zebjus-page-watermark';a.href='https://www.zebjus.com';a.target='_blank';a.rel='noopener';a.innerHTML='<b>ZEBJUS</b><span>Drone Engineering Lab</span><em>www.zebjus.com ↗</em>';p.appendChild(a)
 })
}
function initTabs(){$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tab-panel').forEach(x=>x.classList.remove('active'));$('#tab-'+b.dataset.tab)?.classList.add('active');if(b.dataset.tab==='assembly')setTimeout(resize3D,40);if(b.dataset.tab==='sim'){ensureSim();setTimeout(resizeSim,80)}})}
const product=t=>products.find(x=>x.type===t);
function showInspector(title,detail,rating={},pins=[],kind='PRODUCT',asset=''){ $('#inspector').innerHTML=`<div class="type">${kind}</div><h3>${title}</h3><p>${detail}</p><div class="specs">${Object.entries(rating).map(([k,v])=>`<div class="spec"><b>${k}</b><span>${v}</span></div>`).join('')}</div><table class="pin-table">${pins.map(p=>`<tr><td>${p[0]}</td><td>${p[1]}</td></tr>`).join('')}</table>${asset?`<div class="asset-path">3D asset: ${asset}</div>`:''}<a class="inspector-shop" href="https://www.zebjus.com" target="_blank" rel="noopener">ZEBJUS components & learning hardware ↗</a>` }
function notify(t,k='good'){const e=$('#snapMessage');e.textContent=t;e.className='snap-message '+k;clearTimeout(notify.t);notify.t=setTimeout(()=>e.className='snap-message',1800)}
function renderShelf(){
 const b=$('#componentShelf');b.innerHTML='';
 const stepRank=t=>{const i=steps.findIndex(s=>s.types.includes(t));return i<0?999:i};
 const required=products.filter(c=>!c.optional&&!c.internal&&state.parts.filter(p=>p.type===c.type).length<c.max).sort((a,b)=>stepRank(a.type)-stepRank(b.type));
 const optional=products.filter(c=>c.optional&&!c.internal&&state.parts.filter(p=>p.type===c.type).length<c.max);
 const addCard=(c)=>{
   const n=state.parts.filter(p=>p.type===c.type).length,left=c.max-n,e=document.createElement('div');
   e.className='product-card'+(c.optional?' optional-product':'')+(state.selectedType===c.type?' selected':'')+(steps[state.step]?.types.includes(c.type)?' current-part':'');e.setAttribute('role','button');e.tabIndex=0;
   e.draggable=true;const batch=(c.type==='frameScrew'||c.type==='motorScrew');
   const img=c.thumb?`<img class="product-thumb" src="${c.thumb}" alt="${c.name} preview">`:`<div class="product-fallback">${c.icon}</div>`;
   e.innerHTML=`${img}<div><b>${c.name}</b><span>${c.short}</span>${batch?'<small class="one-drag-note">ONE DRAG installs complete set</small>':''}${c.optional?'<em class="optional-badge">OPTIONAL / EXPANSION</em>':''}<a class="shop-mini" href="https://www.zebjus.com" target="_blank" rel="noopener">Find / purchase at ZEBJUS ↗</a></div><i class="count-badge">${left} left</i><em class="model-tag">${c.asset?'3D MODEL':'VIRTUAL PART'}</em>`;
   e.onclick=()=>selectProduct(c.type);e.onkeydown=x=>{if(x.key==='Enter'||x.key===' '){x.preventDefault();selectProduct(c.type)}};e.querySelector('.shop-mini').onclick=x=>x.stopPropagation();e.ondragstart=x=>{x.dataTransfer.setData('text/plain',c.type);state.selectedType=c.type};b.appendChild(e)
 };
 if(required.length){const h=document.createElement('div');h.className='shelf-group-title';h.textContent='REQUIRED • ASSEMBLY ORDER';b.appendChild(h);required.forEach(addCard)}
 else {const h=document.createElement('div');h.className='shelf-complete';h.textContent='✓ Required physical assembly parts installed. Optional expansion devices remain below.';b.appendChild(h)}
 const oh=document.createElement('div');oh.className='shelf-group-title';oh.textContent='OPTIONAL • PPM / GPIO / I²C EXPANSION';b.appendChild(oh);optional.forEach(addCard)
}
function selectProduct(type){
 const c=product(type);if(!c)return;
 if(c.optional&&!state.parts.some(p=>p.type==='fc')){notify('Mount the ZEBJUS FC case first; then optional GPIO / RX / I²C devices become usable.','bad');return}
 if(!c.optional&&state.guided&&!steps[state.step].types.includes(type)){notify(`Current step needs ${steps[state.step].types.map(t=>product(t)?.name).filter(Boolean).join(' / ')||'a connection action'}.`,'bad');return}
 if(state.parts.filter(p=>p.type===type).length>=c.max){notify('Required quantity already installed.','bad');return}
 state.selectedType=type;playFX('pick');renderShelf();showInspector(c.name,c.detail,c.rating,c.pins,c.optional?'OPTIONAL DEVICE':'PRODUCT',c.asset||'')
}
function countStep(s){if(s.action)return state.doneActions.has(s.id)?s.need:0;return state.parts.filter(p=>s.types.includes(p.type)).length}
const stepDone=i=>countStep(steps[i])>=steps[i].need;
const stepTips={
 bottom:{why:'The PDB is the electrical and mechanical base.',correct:'BAT/ESC solder pads face upward and remain visible.',mistake:'Starting with the top plate or covering the BAT pads.',risk:'Wrong polarity or hidden solder joints can damage the power system.',check:'Confirm BAT+, BAT− and E1–E4 pads are readable.'},
 arms:{why:'Arm orientation defines motor geometry and FRONT direction.',correct:'Red arms at FRONT, white arms at REAR; roots begin at plate edges.',mistake:'Swapping front/rear colours or starting rails from the plate centre.',risk:'Wrong orientation reverses flight-control assumptions.',check:'FRONT arrow points between the two red arms.'},
 guards:{why:'Guards protect the 1045 prop disc during training.',correct:'Open arc faces inward and sits below the motor.',mistake:'Mounting the guard above the motor or backwards.',risk:'Prop contact or obstructed motor mounting.',check:'All four arcs are clear of the propeller path.'},
 motors:{why:'Motor position and rotation group must match the mixer.',correct:'One A2212 centered on each arm tip.',mistake:'Offset motor or wrong M1–M4 location.',risk:'Unequal thrust and unstable control.',check:'Motor shafts align with all four arm-tip centres.'},
 motorScrews:{why:'Motor screws transfer thrust into the arm.',correct:'Four screws per motor, tightened evenly.',mistake:'Missing screw or uneven tightening.',risk:'Motor vibration or motor separation.',check:'16 screws are seated and level.'},
 escs:{why:'Each ESC drives one BLDC motor and supplies the control lead.',correct:'One ESC per arm with airflow and wire clearance.',mistake:'Crossing ESC/motor numbering.',risk:'Wrong motor responds to the FC output.',check:'ESC1→M1 through ESC4→M4.'},
 motorWire:{why:'The three phase wires energise the BLDC motor.',correct:'U/V/W all connected; swapping any two reverses direction.',mistake:'Missing or duplicate phase wire.',risk:'Motor will not start correctly.',check:'Each motor has three unique phase connections.'},
 powerWire:{why:'ESCs need high-current battery power from the PDB.',correct:'Thick red to +, thick brown-black to GND.',mistake:'Reversed polarity or using thin signal wire.',risk:'Immediate ESC/PDB damage.',check:'E1–E4 polarity is correct before fitting the top plate.'},
 top:{why:'The upper plate closes the frame after solder inspection.',correct:'Install only after ESC power soldering is complete.',mistake:'Installing it before checking solder joints.',risk:'Hidden shorts or difficult rework.',check:'No exposed strand or solder bridge is trapped inside.'},
 frameScrews:{why:'Frame screws clamp arms and both plates together.',correct:'Tighten progressively around all four arm roots.',mistake:'Fully tightening one corner first.',risk:'Twisted frame geometry.',check:'Top plate is level with a small centre gap.'},
 fcTape:{why:'Foam tape isolates vibration without a spacer.',correct:'Thin double-side foam tape directly on top plate.',mistake:'Using rigid standoffs in this build.',risk:'Higher vibration reaching IMU.',check:'Tape is flat, centered and not covering slots.'},
 fc:{why:'FC orientation defines Roll/Pitch/Yaw axes.',correct:'FRONT arrow points to red arms; headers project upward.',mistake:'Rotating FC 90°/180°.',risk:'Control axes become incorrect.',check:'ESC/GPIO/RX/I²C headers remain accessible.'},
 escFc:{why:'These leads carry ESC Source/PWM, +5V and GND.',correct:'Female 3-pin housing drops vertically onto matching ESC column.',mistake:'Connecting ESC1 lead to ESC2–4 or shifting one row.',risk:'Wrong motor command or rail short.',check:'Orange=Source, light red=+5V, brown-black=GND.'},
 battery:{why:'Under-frame battery lowers CG and leaves the top deck usable.',correct:'Battery centered underneath and both straps tight.',mistake:'Loose strap or off-centre battery.',risk:'CG shift during manoeuvres.',check:'Battery cannot slide forward/backward.'},
 xt60:{why:'XT60 is the final high-current connection.',correct:'BAT+ and BAT− mate with the visible PDB XT60 socket.',mistake:'Connecting before wiring inspection.',risk:'A short becomes live immediately.',check:'Run electrical validation before pressing Connect battery.'},
 props:{why:'Propellers are fitted only after electrical/motor checks.',correct:'1045 CW/CCW pattern matches motor rotation.',mistake:'Installing props before motor-direction test.',risk:'Unexpected thrust during testing.',check:'CW/CCW assignment and nut direction are correct.'},
 inspect:{why:'Final inspection catches assembly and wiring mistakes before flight.',correct:'Review polarity, motor order, FC orientation, props and fasteners.',mistake:'Skipping the checklist after successful power-up.',risk:'A small build error can cause loss of control.',check:'Electrical validator has no critical errors and all guided checks pass.'}
};
function renderSteps(){
 $('#assemblySteps').innerHTML=steps.map((s,i)=>`<div class="build-step ${i===state.step?'active':''} ${stepDone(i)?'done':''}" data-i="${i}"><div class="n">${String(i+1).padStart(2,'0')}</div><div><b>${s.title}</b><span>${s.target}</span></div><i class="state-dot"></i></div>`).join('');
 $$('.build-step').forEach(e=>e.onclick=()=>{const i=+e.dataset.i;if(state.guided&&i>state.step&&!steps.slice(0,i).every((_,j)=>stepDone(j))){notify('Complete earlier guided steps first.','bad');return}historyPush();state.step=i;renderAssemblyUI();showGuides()});
 const s=steps[state.step],tip=stepTips[s.id]||{};$('#currentStepTitle').textContent=s.title;$('#currentStepCard').innerHTML=`<b>${s.title}</b><p>${s.desc}</p><div class="targets">Target: ${s.target} • ${countStep(s)}/${s.need}</div><div class="learning-grid"><div><b>WHY</b><span>${tip.why||'Follow the guided build order.'}</span></div><div><b>CORRECT</b><span>${tip.correct||s.target}</span></div><div><b>COMMON MISTAKE</b><span>${tip.mistake||'Skipping the guided order.'}</span></div><div class="risk"><b>RISK</b><span>${tip.risk||'Incorrect assembly may affect reliability.'}</span></div><div class="checkline"><b>CHECK</b><span>${tip.check||'Verify before continuing.'}</span></div></div>${s.action?'<button id="doStepAction" class="btn primary full">Run guided connection animation</button>':''}`;
 if(s.action)$('#doStepAction').onclick=()=>performAction(s);
 $('#progressPill').textContent=Math.round(steps.filter((_,i)=>stepDone(i)).length/steps.length*100)+'%'
}
function renderChecks(){
 const a=[
  ['Bottom PDB + four edge-root arms',stepDone(1)],
  ['Arc guards + A2212 motors',stepDone(4)],
  ['ESCs installed on arms',stepDone(5)],
  ['Motor U/V/W connected',stepDone(6)],
  ['ESC high-current power soldered',stepDone(7)],
  ['Top plate + 12 frame screws',stepDone(9)],
  ['FC double-side tape — NO spacers',stepDone(10)],
  ['ZEBJUS FC + upward male headers',stepDone(11)],
  ['ESC female 3-pin plugs connected',stepDone(12)],
  ['Under-frame LiPo + straps',stepDone(13)],
  ['XT60 power connected',stepDone(14)],
  ['1045 CW/CCW props',stepDone(15)],
  ['Final inspection',stepDone(16)]
 ]; $('#buildChecks').innerHTML=a.map(([t,o])=>`<div class="check ${o?'ok':'warn'}">${o?'✓':'○'} ${t}</div>`).join('')
}
function renderAssemblyUI(){renderShelf();renderSteps();renderChecks();updatePowerUi?.()}

/* THREE */
let scene,camera,renderer,controls,ray,mouse,bench,partsRoot,wiresRoot,guidesRoot,extrasRoot,labelsRoot,solderRoot,powerPulseRoot,snapPreview,animations=[],powerPulseItems=[],runtimeFps=0,fpsFrames=0,fpsLast=performance.now();
let dragging=null,dragOffset=new THREE.Vector3();
const mat=(c,metal=.1,rough=.55)=>new THREE.MeshStandardMaterial({color:c,metalness:metal,roughness:rough});
function M(g,m,p=[0,0,0],r=[0,0,0],parent=partsRoot){const o=new THREE.Mesh(g,m);o.position.set(...p);o.rotation.set(...r);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
const B=(w,h,d,m,p,parent=partsRoot,r=[0,0,0])=>M(new THREE.BoxGeometry(w,h,d),m,p,r,parent);
function CY(r,h,m,p,parent=partsRoot){return M(new THREE.CylinderGeometry(r,r,h,20),m,p,[0,0,0],parent)}
function tube(points,color,r=.025,parent=wiresRoot){const c=new THREE.CatmullRomCurve3(points),o=new THREE.Mesh(new THREE.TubeGeometry(c,40,r,8,false),new THREE.MeshStandardMaterial({color,roughness:.5}));o.castShadow=true;parent.add(o);return o}
function tag(o,d){o.userData={...o.userData,...d}}
function rodBetween(a,b,r,material,segments=10){
 const delta=new THREE.Vector3().subVectors(b,a),len=delta.length();
 const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,len,segments),material);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize());m.castShadow=true;return m
}
function polyPlate(points,depth,material){
 const s=new THREE.Shape();points.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));s.closePath();
 const geo=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSegments:2,bevelSize:.035,bevelThickness:.025});geo.rotateX(Math.PI/2);geo.center();const m=new THREE.Mesh(geo,material);m.castShadow=true;m.receiveShadow=true;return m
}
function procBottomPlate(){
 const g=new THREE.Group(),pm=mat(0x596975,.28,.31),dark=mat(0x17232c,.18,.58),copper=mat(0xd7a23e,.76,.21);
 pm.emissive=new THREE.Color(0x0d151b);pm.emissiveIntensity=.16;
 const base=polyPlate([[-1.65,-1.05],[-1.05,-1.05],[-.82,-1.30],[.82,-1.30],[1.05,-1.05],[1.65,-1.05],[1.65,-.43],[1.92,-.28],[1.92,.28],[1.65,.43],[1.65,1.05],[1.05,1.05],[.82,1.30],[-.82,1.30],[-1.05,1.05],[-1.65,1.05],[-1.65,.43],[-1.92,.28],[-1.92,-.28],[-1.65,-.43]],.12,pm);base.position.y=.06;g.add(base);
 [[0,0,.32,1.0],[-.70,0,.18,.62],[.70,0,.18,.62],[0,.68,.52,.16],[0,-.68,.52,.16]].forEach(([x,z,w,d])=>B(w,.135,d,dark,[x,.075,z],g));
 const pads=[[-1.18,.17,'BAT+'],[-1.18,-.17,'BAT-'],[1.10,.70,'E1+'],[1.10,.46,'E1-'],[-.58,.84,'E2+'],[-.82,.84,'E2-'],[-.58,-.84,'E3+'],[-.82,-.84,'E3-'],[1.10,-.46,'E4+'],[1.10,-.70,'E4-']];
 pads.forEach(([x,z,n])=>{const p=CY(.115,.035,copper,[x,.15,z],g);p.userData.info={title:`PDB ${n}`,detail:`F450 PDB solder point ${n}.`,rating:{Pad:n},pins:[[n,n.endsWith('+')?'Positive bus':'Ground bus']]}});
 // Large, clearly visible XT60 battery socket soldered at the LEFT EDGE of the bottom PDB.
 const xt=new THREE.Group();xt.name='PDB_XT60_SOCKET';g.add(xt);
 const yellow=mat(0xf6c928,.06,.34),yellowDark=mat(0xd9a812,.08,.42),brass=mat(0xc98d2f,.78,.18);
 B(.64,.34,.52,yellow,[-1.98,.30,0],xt);
 B(.18,.18,.40,yellowDark,[-2.31,.30,0],xt);
 // Two recessed XT60 contact barrels facing outward.
 addLocalCylinder(xt,.072,.20,0x8c641f,[-2.34,.30,.13],[0,0,Math.PI/2],.78,{title:'XT60 BAT+',detail:'Battery positive socket',rating:{Polarity:'+'},pins:[['+12V','BAT+']]});
 addLocalCylinder(xt,.072,.20,0x8c641f,[-2.34,.30,-.13],[0,0,Math.PI/2],.78,{title:'XT60 BAT−',detail:'Battery negative socket',rating:{Polarity:'−'},pins:[['GND','BAT−']]});
 // Visible solder tabs and short heavy-gauge leads to the PDB BAT pads.
 B(.15,.12,.12,brass,[-1.65,.25,.13],xt);B(.15,.12,.12,brass,[-1.65,.25,-.13],xt);
 curvedLocalCable(xt,[[-1.66,.27,.13],[-1.50,.21,.16],[-1.22,.16,.17]],0xef3f48,.058);
 curvedLocalCable(xt,[[-1.66,.19,-.13],[-1.50,.16,-.16],[-1.22,.16,-.17]],0x3a2419,.058);
 const lab=makeCaseDecal('XT60','#1a1a12','rgba(246,201,40,.96)',260,100);lab.position.set(-1.98,.49,0);lab.scale.set(.42,.32,1);xt.add(lab);
 xt.traverse(o=>{if(o.isMesh&&!o.userData.info)o.userData.info={title:'PDB XT60 Battery Connector',detail:'Visible XT60 socket soldered to the bottom PDB edge. Connect the under-frame LiPo here after assembly.',rating:{Voltage:'3S / ~12V',Mount:'Soldered to BAT+/BAT−'},pins:[['THICK RED','BAT+'],['BROWN-BLACK','BAT−']]}});
 return g
}
function procTopPlate(){
 const g=new THREE.Group(),pm=mat(0x52626e,.26,.32),dark=mat(0x17232c,.15,.60);
 pm.emissive=new THREE.Color(0x0b141a);pm.emissiveIntensity=.14;const p=polyPlate([[-1.30,-.95],[-.78,-.95],[-.62,-1.12],[.62,-1.12],[.78,-.95],[1.30,-.95],[1.30,.95],[.78,.95],[.62,1.12],[-.62,1.12],[-.78,.95],[-1.30,.95]],.10,pm);p.position.y=.05;g.add(p);[[0,0,.30,.86],[-.52,0,.16,.48],[.52,0,.16,.48],[0,.60,.48,.14],[0,-.60,.48,.14]].forEach(([x,z,w,d])=>B(w,.115,d,dark,[x,.065,z],g));return g
}
function procArm(color){
 // Local origin is the inner EDGE/root of the bottom plate. +Z points outward.
 const g=new THREE.Group(),am=mat(color,.06,.48),dark=mat(0x25313a,.08,.64),steel=mat(0xb9c4cc,.75,.22);const tip=2.715;
 B(1.02,.16,.62,am,[0,.06,.28],g);
 g.add(rodBetween(new THREE.Vector3(-.43,.08,.05),new THREE.Vector3(-.31,.08,tip-.18),.075,am,8));g.add(rodBetween(new THREE.Vector3(.43,.08,.05),new THREE.Vector3(.31,.08,tip-.18),.075,am,8));
 for(let i=0;i<6;i++){const z=.58+i*.37;const a=i%2?-.72:.72;B(.075,.13,.70,am,[0,.08,z],g,[0,a,0])}
 CY(.57,.16,am,[0,.08,tip],g);CY(.35,.18,dark,[0,.09,tip],g);
 // integrated landing leg: lowest foot sits just above bench when arm group y=.75
 g.add(rodBetween(new THREE.Vector3(-.35,.02,tip-.18),new THREE.Vector3(-.31,-.66,tip-.08),.085,am,8));g.add(rodBetween(new THREE.Vector3(.35,.02,tip-.18),new THREE.Vector3(.31,-.66,tip-.08),.085,am,8));B(.86,.12,.46,am,[0,-.69,tip-.12],g);
 [[-.32,.12,.16],[.32,.12,.16],[-.30,.12,.48],[.30,.12,.48]].forEach(p=>{const s=CY(.055,.28,steel,p,g);s.rotation.x=Math.PI/2});return g
}
function procGuard(){
 const g=new THREE.Group(),gm=mat(0xf1f4f5,.04,.40),steel=mat(0xbcc8cf,.72,.24),R=1.47,pts=[];
 // Open arc: gap is on local -Z (toward frame), matching the useful reference guard.
 for(let i=0;i<=52;i++){const a=THREE.MathUtils.lerp(-2.34,2.34,i/52);pts.push(new THREE.Vector3(Math.sin(a)*R,.11,Math.cos(a)*R))}
 const arc=tube(pts,0xf1f4f5,.055,g);arc.material.roughness=.42;
 const centre=new THREE.Vector3(0,.10,0);[-1.12,0,1.12].forEach(a=>g.add(rodBetween(centre,new THREE.Vector3(Math.sin(a)*R*.98,.10,Math.cos(a)*R*.98),.045,gm,8)));
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.45,.060,10,34),gm);ring.rotation.x=Math.PI/2;ring.position.y=.10;g.add(ring);return g
}
function procMotor(){
 const g=new THREE.Group(),black=mat(0x191d21,.42,.30),gold=mat(0xd48d15,.72,.24),silver=mat(0xb9c6cf,.72,.22);
 CY(.48,.16,gold,[0,.08,0],g);CY(.46,.46,black,[0,.38,0],g);CY(.48,.19,gold,[0,.70,0],g);CY(.09,.62,silver,[0,1.02,0],g);for(let i=0;i<8;i++){const a=i*Math.PI/4;CY(.045,.035,mat(0x222b31),[Math.cos(a)*.29,.81,Math.sin(a)*.29],g)}return g
}
function procEsc(){const g=new THREE.Group(),em=mat(0x174b68,.05,.60),ridge=mat(0x246381,.02,.67);B(1.22,.25,.54,em,[0,.16,0],g);for(let x=-.45;x<=.45;x+=.18)B(.025,.27,.56,ridge,[x,.17,0],g);return g}
function procFC(){const g=new THREE.Group();B(1.78,.10,1.60,mat(0x0e6c43,.20,.48),[0,.05,0],g);B(.48,.11,.48,mat(0x151d24,.42,.34),[0,.15,0],g);B(.22,.09,.22,mat(0x25323b,.35,.40),[-.42,.14,.08],g);return g}
function procBattery(){const g=new THREE.Group();B(2.22,.56,1.00,mat(0xf06b1f,.03,.55),[0,.28,0],g);B(.11,.58,1.02,mat(0x20252a),[-1.10,.29,0],g);B(.11,.58,1.02,mat(0x20252a),[1.10,.29,0],g);B(.38,.22,.31,mat(0xf7d334,.05,.48),[1.62,.44,.42],g);return g}
function procProp(id){
 const g=new THREE.Group(),bladeMat=mat(0x161b20,.18,.40),edgeMat=mat(0x47545e,.12,.42),silver=mat(0xc8d1d7,.78,.18);
 const handed=(id==='M2'||id==='M4')?-1:1;
 function bladeGeometry(){
   const sh=new THREE.Shape();
   sh.moveTo(.10,-.105);
   sh.bezierCurveTo(.36,-.20,.92,-.255,1.36,-.135);
   sh.bezierCurveTo(1.55,-.085,1.61,-.018,1.56,.055);
   sh.bezierCurveTo(1.37,.19,.88,.255,.42,.185);
   sh.bezierCurveTo(.26,.158,.15,.132,.10,.105);
   sh.closePath();
   const geo=new THREE.ExtrudeGeometry(sh,{depth:.042,bevelEnabled:true,bevelThickness:.010,bevelSize:.015,bevelSegments:2});
   geo.rotateX(Math.PI/2);
   return geo
 }
 const geo=bladeGeometry();
 [0,Math.PI].forEach(a=>{
   const holder=new THREE.Group();holder.rotation.y=a;g.add(holder);
   const b=new THREE.Mesh(geo,bladeMat);b.position.y=.11;b.rotation.x=handed*rad(6.5);b.castShadow=true;holder.add(b);
   const tip=B(.24,.045,.15,edgeMat,[1.39,.13,0],holder,[handed*rad(6.5),0,0]);tip.castShadow=true;
 });
 CY(.19,.11,silver,[0,.065,0],g);
 CY(.105,.28,silver,[0,.24,0],g);
 CY(.155,.105,mat(0x303940,.58,.24),[0,.42,0],g);
 const washer=CY(.205,.035,mat(0x838f97,.65,.22),[0,.15,0],g);
 return g
}

function procedural(type,id){
 if(type==='bottomPlate')return procBottomPlate();
 if(type==='topPlate')return procTopPlate();
 if(type==='armRed')return procArm(C.red);
 if(type==='armWhite')return procArm(C.white);
 if(type==='guard')return procGuard();
 if(type==='motor')return procMotor();
 if(type==='esc')return procEsc();
 if(type==='fc')return procFC();
 if(type==='battery')return procBattery();
 if(type==='prop')return procProp(id);
 const g=new THREE.Group();
 if(type==='frameScrew'||type==='motorScrew'){CY(.075,.12,mat(C.metal,.8,.2),[0,.06,0],g);B(.10,.012,.018,mat(C.dark),[0,.125,0],g)}
 else if(type==='receiver'){B(.72,.18,.52,mat(0x285f88,.2,.5),[0,.10,0],g);B(.48,.05,.30,mat(0x0c1115),[0,.22,0],g);curvedLocalCable(g,[[.32,.12,.16],[.55,.22,.28],[.8,.28,.34]],0x93c5fd,.014)}
 else if(type==='gps'){
   const carbon=mat(0x1b252c,.30,.34),silver=mat(0xc0c9cf,.74,.20);
   B(.72,.12,.62,mat(0x184c72,.15,.55),[0,.08,0],g);B(.46,.10,.46,mat(0xe8edf2,.05,.55),[0,.17,0],g);B(.18,.05,.10,mat(0xc8a03c,.7,.25),[.30,.17,-.22],g);
   B(.74,.07,.54,carbon,[0,-.88,0],g);CY(.075,1.73,silver,[0,-.02,0],g);CY(.19,.05,carbon,[0,.84,0],g)
 }
 else if(type==='servo'){B(.58,.42,.32,mat(0x1f5b8d,.12,.56),[0,.22,0],g);CY(.11,.12,mat(0xd4dbe0,.75,.2),[0,.49,0],g);B(.68,.045,.08,mat(0xe5e7eb,.25,.35),[0,.58,0],g)}
 else if(type==='matrix'){B(.86,.08,.86,mat(0x111820,.25,.5),[0,.05,0],g);for(let x=-.30;x<=.30;x+=.20)for(let z=-.30;z<=.30;z+=.20)CY(.035,.035,mat(0x52d273,.05,.4),[x,.11,z],g)}
 else if(type==='sensor'){B(.60,.07,.48,mat(0x13764a,.12,.55),[0,.05,0],g);B(.24,.07,.24,mat(0x182029,.4,.35),[0,.13,0],g)}
 else if(type==='led'){CY(.10,.22,mat(0x36d985,.05,.35),[0,.12,0],g);CY(.025,.28,mat(0xbcc6cc,.8,.2),[-.05,-.08,0],g);CY(.025,.28,mat(0xbcc6cc,.8,.2),[.05,-.08,0],g)}
 else if(type==='batteryStrap'){const sm=mat(0x171b1e,.02,.88);B(.16,.04,1.18,sm,[0,.58,0],g);B(.16,.04,1.18,sm,[0,.02,0],g);B(.16,.56,.045,sm,[0,.30,.57],g);B(.16,.56,.045,sm,[0,.30,-.57],g)}
 else if(type==='fcTape'){B(1.58,.035,1.40,mat(0x1c2328,.02,.92),[0,.018,0],g);B(1.45,.012,1.28,mat(0x333b40,.01,.94),[0,.042,0],g)}
 else B(.5,.2,.5,mat(0x64748b),[0,.1,0],g);
 return g
}

const textureLoader=new THREE.TextureLoader();let fcLayoutTexture=null;
function addLocalCylinder(parent,r,h,color,pos,rot=[0,0,0],metal=.7,info=null){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,16),new THREE.MeshStandardMaterial({color,metalness:metal,roughness:.28}));m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;if(info)m.userData.info=info;parent.add(m);return m}
function addLocalBox(parent,ext,color,pos,rot=[0,0,0],metal=.08,opts={}){const material=new THREE.MeshStandardMaterial({color,metalness:metal,roughness:opts.roughness??.55,transparent:!!opts.transparent,opacity:opts.opacity??1});const m=new THREE.Mesh(new THREE.BoxGeometry(...ext),material);m.position.set(...pos);m.rotation.set(...rot);m.castShadow=true;if(opts.info)m.userData.info=opts.info;parent.add(m);return m}
function curvedLocalCable(parent,pts,color,r=.018){const c=new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(c,24,r,7,false),new THREE.MeshStandardMaterial({color,roughness:.65}));m.castShadow=true;parent.add(m);return m}
function makeCaseDecal(text,fg='#ecfff8',bg='rgba(12,24,32,.96)',w=512,h=160){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=bg;x.beginPath();if(typeof x.roundRect==='function')x.roundRect(5,5,w-10,h-10,24);else x.rect(5,5,w-10,h-10);x.fill();x.strokeStyle='rgba(101,142,163,.9)';x.lineWidth=5;x.stroke();x.fillStyle=fg;x.textAlign='center';x.textBaseline='middle';x.font='900 58px Arial';x.fillText(text,w/2,h/2);const tx=new THREE.CanvasTexture(c);tx.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(1,.30),new THREE.MeshBasicMaterial({map:tx,transparent:true,side:THREE.DoubleSide,depthWrite:false}));m.rotation.x=-Math.PI/2;return m}
function fcPinInfo(title,electrical,use){return{title,detail:`${electrical}. ${use}`,rating:{Electrical:electrical,Accessible:'Yes • through FC case'},pins:[[title,use]]}}
function addFCCase(g){
 const shell=new THREE.Group();shell.name='ZEBJUS_FC_CASE';g.add(shell);
 const graphite=0x34434f,edge=0x141c22,gold=0xd7a12e,sourceCol=0xf59e0b,fiveCol=0xfb7185,gndCol=0x3a2419;
 addLocalBox(shell,[2.05,.07,1.87],edge,[0,-.045,0],[0,0,0],.18,{roughness:.44});
 addLocalBox(shell,[2.06,.27,.08],graphite,[0,.12,.90]);addLocalBox(shell,[2.06,.27,.08],graphite,[0,.12,-.90]);
 addLocalBox(shell,[.08,.27,1.72],graphite,[-.99,.12,0]);addLocalBox(shell,[.08,.27,1.72],graphite,[.99,.12,0]);
 addLocalBox(shell,[1.02,.13,.75],0x293844,[-.05,.285,.12],[0,0,0],.12,{roughness:.38});
 const brand=makeCaseDecal('ZEBJUS FC','#d4fff0');brand.position.set(-.05,.365,.08);brand.scale.set(.98,.98,1);shell.add(brand);
 const arrow=makeCaseDecal('↑ FRONT','#61f0c1','rgba(21,52,45,.96)');arrow.position.set(-.05,.369,.40);arrow.scale.set(.60,.60,1);shell.add(arrow);

 function headerBase(x,z,w,d,label=''){
   const b=addLocalBox(shell,[w,.072,d],0x0b1116,[x,.345,z],[0,0,0],.08,{roughness:.74});b.name='HEADER_BASE';
   return b
 }
 function maleHeaderPin(x,z,label,electrical,use,collarColor=sourceCol){
   addLocalBox(shell,[.080,.060,.080],0x111820,[x,.355,z],[0,0,0],.12,{roughness:.65});
   const pin=addLocalBox(shell,[.050,.31,.050],gold,[x,.535,z],[0,0,0],.82,{roughness:.15,info:fcPinInfo(label,electrical,use)});pin.name='FC_MALE_PIN';
   const ring=addLocalCylinder(shell,.044,.018,collarColor,[x,.390,z],[],.15,fcPinInfo(label,electrical,use));ring.name='HEADER_COLLAR';
 }

 // ESC SECTION — EXACT 4 COLUMNS × 3 ROWS.
 // Left→right: ESC1 ESC2 ESC3 ESC4
 // Top/front→bottom/back rows: SOURCE, +5V, GND
 const escCols=[-.54,-.18,.18,.54],escRows=[
   {z:-.55,name:'SOURCE',color:sourceCol},
   {z:-.70,name:'+5V',color:fiveCol},
   {z:-.85,name:'GND',color:gndCol}
 ];
 headerBase(0,-.70,1.22,.48);
 escCols.forEach((x,i)=>escRows.forEach(r=>maleHeaderPin(x,r.z,`ESC${i+1} ${r.name}`,r.name,r.name==='SOURCE'?'ESC PWM/source':r.name==='+5V'?'Centre +5V rail':'Ground rail',r.color)));

 // EXTERNAL GPIO — EXACT 3 COLUMNS × 3 ROWS.
 // Kept lower / separated from the RX block.
 const gpioCols=[.36,.60,.84],gpioRows=[
   {z:-.05,name:'SOURCE',color:sourceCol},
   {z:-.19,name:'+5V',color:fiveCol},
   {z:-.33,name:'GND',color:gndCol}
 ];
 headerBase(.60,-.19,.80,.48);
 gpioCols.forEach((x,i)=>gpioRows.forEach(r=>maleHeaderPin(x,r.z,`GPIO${i+1} ${r.name}`,r.name,r.name==='SOURCE'?'External GPIO source/input/output':r.name==='+5V'?'Centre +5V rail':'Ground rail',r.color)));

 // RX / PPM — SEPARATE 1 COLUMN × 3 ROWS.
 headerBase(.91,.35,.20,.48);
 [
   {z:.49,name:'SOURCE / PPM',color:sourceCol},
   {z:.35,name:'+5V',color:fiveCol},
   {z:.21,name:'GND',color:gndCol}
 ].forEach(r=>maleHeaderPin(.91,r.z,`RX ${r.name}`,r.name,r.name==='SOURCE / PPM'?'Optional PPM receiver source/signal':'RX '+r.name,r.color));

 // I²C — separate user 4-pin block.
 headerBase(-.47,.82,.62,.18);
 [['VCC',fiveCol],['GND',gndCol],['SCL',0x47c8f1],['SDA',0x47c8f1]].forEach(([n,c],i)=>maleHeaderPin(-.65+i*.12,.82,`I²C ${n}`,n,'User-accessible I²C header',c));

 // Small printed section legends on top of the case.
 const escLab=makeCaseDecal('ESC1   ESC2   ESC3   ESC4','#d9fff2','rgba(12,24,32,.93)',640,120);escLab.position.set(0,.374,-.36);escLab.scale.set(1.18,.48,1);shell.add(escLab);
 const gpioLab=makeCaseDecal('GPIO 1–3','#ffd67a','rgba(12,24,32,.93)',420,120);gpioLab.position.set(.60,.374,.01);gpioLab.scale.set(.56,.42,1);shell.add(gpioLab);
 const rxLab=makeCaseDecal('RX / PPM','#ffe96f','rgba(12,24,32,.93)',420,120);rxLab.position.set(.83,.374,.66);rxLab.scale.set(.43,.38,1);shell.add(rxLab);
 const i2cLab=makeCaseDecal('I²C','#7fdfff','rgba(12,24,32,.93)',300,120);i2cLab.position.set(-.47,.374,.64);i2cLab.scale.set(.37,.36,1);shell.add(i2cLab);

 // Bright RGB status LED window.
 const body=addLocalBox(shell,[.20,.035,.18],0x0a0f13,[.50,.375,.38],[0,0,0],.02,{roughness:.10});body.name='FC_RGB_LED_BODY';
 const lr=addLocalBox(shell,[.052,.022,.145],0x2f0909,[.463,.398,.38],[0,0,0],.02,{roughness:.06});lr.name='FC_RGB_LED_R';lr.material.emissive=new THREE.Color(0xff2035);lr.material.emissiveIntensity=0;
 const lg=addLocalBox(shell,[.052,.022,.145],0x082f16,[.500,.398,.38],[0,0,0],.02,{roughness:.06});lg.name='FC_RGB_LED_G';lg.material.emissive=new THREE.Color(0x27ff74);lg.material.emissiveIntensity=0;
 const lb=addLocalBox(shell,[.052,.022,.145],0x08182f,[.537,.398,.38],[0,0,0],.02,{roughness:.06});lb.name='FC_RGB_LED_B';lb.material.emissive=new THREE.Color(0x30a8ff);lb.material.emissiveIntensity=0;
 const pwr=addLocalCylinder(shell,.040,.028,0x17321f,[.68,.405,.40],[],.04);pwr.name='FC_PWR_LED';pwr.material.emissive=new THREE.Color(0x3dff86);pwr.material.emissiveIntensity=0;
 const stat=addLocalCylinder(shell,.040,.028,0x10263a,[.79,.405,.40],[],.04);stat.name='FC_STATUS_LED';stat.material.emissive=new THREE.Color(0x38a8ff);stat.material.emissiveIntensity=0;
 const glow=new THREE.PointLight(0x48ff9b,0,1.9);glow.name='FC_STATUS_LIGHT';glow.position.set(.61,.54,.39);shell.add(glow);
 return shell
}
function decoratePart(g,type,id){
 if(type==='fc'){
   if(!fcLayoutTexture){fcLayoutTexture=textureLoader.load('fc_top_layout.png');fcLayoutTexture.colorSpace=THREE.SRGBColorSpace}
   const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.78,1.60),new THREE.MeshBasicMaterial({map:fcLayoutTexture,transparent:true,side:THREE.DoubleSide,depthWrite:false}));plane.rotation.x=Math.PI/2;plane.position.y=.081;g.add(plane);addFCCase(g)
 }
 if(type==='esc'){
   [-.13,0,.13].forEach(z=>{addLocalCylinder(g,.048,.18,0xd49b27,[.74,.16,z],[0,0,Math.PI/2]);addLocalCylinder(g,.025,.20,0x1e293b,[.76,.16,z],[0,0,Math.PI/2],.1)});
   // Thick 12V power pair.
   curvedLocalCable(g,[[-.55,.20,.14],[-.73,.19,.15],[-.91,.16,.16]],0xef4444,.040);
   curvedLocalCable(g,[[-.55,.11,-.14],[-.73,.11,-.15],[-.91,.10,-.16]],0x4b2f20,.040);
   // Thin 3-wire control pigtail: orange Source, light red +5V, brown GND.
   const cols=[0xf59e0b,0xfb7185,0x4b2f20],zs=[-.10,0,.10];
   zs.forEach((z,i)=>curvedLocalCable(g,[[-.42,.18,z],[-.66,.23,z],[-.92,.28,z]],cols[i],.015));
   const housing=addLocalBox(g,[.24,.16,.38],0x1d252b,[-1.02,.29,0],[0,0,0],.06,{roughness:.72});housing.name='ESC_3PIN_FEMALE';
   zs.forEach(z=>{const socket=addLocalCylinder(g,.024,.06,0x050708,[-1.02,.37,z],[],.05);socket.name='FEMALE_SOCKET'});
   const led=addLocalBox(g,[.08,.03,.08],0x251a14,[.30,.305,.19],[0,0,0],.02,{roughness:.24});led.name='ESC_POWER_LED';led.material.emissive=new THREE.Color(0xff8a32);led.material.emissiveIntensity=0;
 }
 if(type==='motor')[-.13,0,.13].forEach((z,i)=>{const cols=[0xf5c542,0x2c92ff,0x87949d];curvedLocalCable(g,[[.18,.28,z],[.34,.22,z],[.52,.18,z]],cols[i],.020);addLocalCylinder(g,.040,.18,0xd49b27,[.61,.18,z],[0,0,Math.PI/2])});
 if(type==='battery'){
   curvedLocalCable(g,[[.75,.47,.26],[1.05,.55,.34],[1.35,.50,.43]],0xef4444,.048);
   curvedLocalCable(g,[[.75,.30,.18],[1.02,.39,.27],[1.35,.36,.35]],0x3a2419,.048);
 }
 return g
}
function createPart(type,id){
 const c=product(type);let path=c?.asset;if(type==='prop'&&(id==='M2'||id==='M4'))path=c.assetCCW;const a=path?cloneAsset(path):null;const g=decoratePart(a||procedural(type,id),type,id);g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;tag(o,{partRoot:g})}});return g
}
function init3D(){
 const e=$('#threeContainer');if(!e)throw new Error('3D container missing');
 const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||600);
 scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1720);
 camera=new THREE.PerspectiveCamera(40,w/h,.1,1000);camera.position.set(8.9,7.1,10.6);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.38;e.appendChild(renderer.domElement);
 controls=new MiniOrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=23;
 scene.add(new THREE.AmbientLight(0xffffff,.75));
 scene.add(new THREE.HemisphereLight(0xe7f5ff,0x63717c,1.65));
 const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(6,10,8);key.castShadow=true;scene.add(key);
 const fill=new THREE.DirectionalLight(0xb7dcff,1.55);fill.position.set(-7,6,4);scene.add(fill);
 const rim=new THREE.DirectionalLight(0x7de6ff,1.15);rim.position.set(-4,5,-8);scene.add(rim);
 const warm=new THREE.PointLight(0xffd7a8,1.25,18);warm.position.set(4.8,5.8,1.8);scene.add(warm);
 const frontFill=new THREE.PointLight(0xa9dcff,.95,16);frontFill.position.set(-4.5,3.8,5.5);scene.add(frontFill);
 // V16 round engineering workbench instead of the old square bed.
 const benchMat=mat(0x354550,.16,.52);bench=M(new THREE.CylinderGeometry(8.8,8.8,.38,112),benchMat,[0,-.18,0],[0,0,0],scene);
 const topDisc=M(new THREE.CylinderGeometry(8.55,8.55,.038,112),mat(0x1d2a32,.08,.44),[0,.018,0],[0,0,0],scene);
 [1.5,3.0,4.5,6.0,7.4,8.25].forEach(r=>{const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.012,6,96),new THREE.MeshBasicMaterial({color:0x3b6072,transparent:true,opacity:.46}));ring.rotation.x=Math.PI/2;ring.position.y=.041;scene.add(ring)});
 for(let a=0;a<Math.PI*2;a+=Math.PI/8){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.042,0),new THREE.Vector3(Math.cos(a)*8.25,.042,Math.sin(a)*8.25)]);scene.add(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0x2f4e5e,transparent:true,opacity:.32})))}
 snapPreview=new THREE.Mesh(new THREE.RingGeometry(.28,.42,36),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.85,side:THREE.DoubleSide,depthWrite:false}));snapPreview.rotation.x=-Math.PI/2;snapPreview.visible=false;scene.add(snapPreview);
 partsRoot=new THREE.Group();wiresRoot=new THREE.Group();guidesRoot=new THREE.Group();extrasRoot=new THREE.Group();labelsRoot=new THREE.Group();solderRoot=new THREE.Group();powerPulseRoot=new THREE.Group();
 [partsRoot,wiresRoot,guidesRoot,extrasRoot,labelsRoot,solderRoot,powerPulseRoot].forEach(g=>g.position.y=0);scene.add(partsRoot,wiresRoot,guidesRoot,extrasRoot,labelsRoot,solderRoot,powerPulseRoot);
 ray=new THREE.Raycaster();mouse=new THREE.Vector2();
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',()=>{dragging=null;controls.enabled=true});
 renderer.domElement.addEventListener('dragover',x=>x.preventDefault());renderer.domElement.addEventListener('drop',x=>{x.preventDefault();const t=x.dataTransfer.getData('text/plain')||state.selectedType;if(t){state.selectedType=t;placePointer(x)}});
 window.addEventListener('resize',resize3D);requestAnimationFrame(loop3D)
}
function ndc(e){const r=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height*2-1))}
function hitBench(e){ndc(e);ray.setFromCamera(mouse,camera);return ray.intersectObject(bench)[0]?.point}
function rootOf(o){while(o){if(o.userData?.partRoot)return o.userData.partRoot;o=o.parent}return null}
function down(e){
 // When a shelf component is selected, a click anywhere on the workbench/assembled drone means PLACE.
 // This fixes ESC/guard/motor placement on top of an existing arm or plate.
 if(state.selectedType){placePointer(e);return}
 ndc(e);ray.setFromCamera(mouse,camera);const h=ray.intersectObjects([partsRoot,wiresRoot,extrasRoot,solderRoot],true);
 if(h.length){
   const o=h[0].object;
   if(o.userData?.wire){showInspector('Wire / cable',o.userData.wire,{Route:'Flexible synchronized 2D ↔ 3D cable'},[[o.userData.wire,'Connection']],'WIRING');if(o.userData.wireId){$('#inspector').insertAdjacentHTML('beforeend','<button id="delete3DWireBtn" class="btn danger full">Delete this wire</button>');$('#delete3DWireBtn').onclick=()=>{wireRemember?.();state.connections=state.connections.filter(c=>c.id!==o.userData.wireId);render2D?.();rebuild3DWires();rebuildSolder();notify('Wire deleted from both 3D and 2D.')}}return}
   if(o.userData?.info){const d=o.userData.info;showInspector(d.title,d.detail,d.rating||{},d.pins||[],'ACCESSIBLE FC PIN');return}
   const r=rootOf(o);
   if(r){const p=state.parts.find(x=>x.obj===r);if(p){state.selectedInstalledId=p.id;const wireId=partToWireNodeId?.(p.type,p.slotId);if(wireId)selectedWireNodeId=wireId;const c=product(p.type);showInspector(c.name,c.detail,{...c.rating,Mount:'SNAP-LOCKED'},c.pins,'INSTALLED PRODUCT',c.asset||'');$('#inspector').insertAdjacentHTML('beforeend','<span class="locked-badge">✓ LOCKED IN CORRECT POSITION</span><button id="deleteSelectedPartBtn" class="btn danger full">Delete selected component</button>');$('#deleteSelectedPartBtn').onclick=()=>deleteInstalled(p.id);if($('#tab-wiring')?.classList.contains('active'))render2D();return}}
 }
}
function nearestFreeSlot(type,p){
 const used=new Set(state.parts.filter(x=>x.type===type).map(x=>x.slotId)),free=(slots[type]||[]).filter(s=>!used.has(s.id));if(!free.length)return null;
 return free.map(s=>({s,d:new THREE.Vector3(...s.p).distanceTo(p)})).sort((a,b)=>a.d-b.d)[0]
}
function updateThreeTooltip(e){
 const tip=$('#threeTooltip');if(!tip||!renderer||!ray)return;ndc(e);ray.setFromCamera(mouse,camera);const h=ray.intersectObjects([partsRoot,wiresRoot,extrasRoot,solderRoot],true)[0],info=h?.object?.userData?.info;
 if(info){tip.innerHTML=`<b>${info.title}</b><span>${info.detail||''}</span>`;tip.style.left=(e.offsetX+16)+'px';tip.style.top=(e.offsetY+16)+'px';tip.classList.add('show')}else tip.classList.remove('show')
}
function move(e){
 updateThreeTooltip(e);
 if(!state.selectedType||!snapPreview)return;
 const p=hitBench(e);if(!p){snapPreview.visible=false;return}
 const n=nearestFreeSlot(state.selectedType,p);if(!n){snapPreview.visible=false;return}
 snapPreview.visible=true;snapPreview.position.set(n.s.p[0],n.s.p[1]+.05,n.s.p[2]);snapPreview.material.color.setHex(n.d<1.6?0x53efbd:0xff5d68);
 const msg=$('#snapMessage');if(msg){msg.textContent=n.d<1.6?`✓ Magnetic snap ready: ${n.s.id}`:`Move closer to target ${n.s.id}`;msg.className='snap-message '+(n.d<1.6?'good':'bad')}
}
function findSlot(type,p){const n=nearestFreeSlot(type,p);return n?.s||null}
function placePointer(e){
 const type=state.selectedType,c=product(type);if(!c)return;
 if(state.guided&&!product(type)?.optional&&!steps[state.step].types.includes(type)){notify('Current guided step needs a different item.','bad');return}
 if(product(type)?.optional&&!state.parts.some(p=>p.type==='fc')){notify('Mount the ZEBJUS FC case before adding optional expansion devices.','bad');return}
 if(type==='frameScrew'||type==='motorScrew'){installFastenerSet(type);return}
 const p=hitBench(e)||new THREE.Vector3(),near=nearestFreeSlot(type,p),s=near?.s;if(!s){notify('No free snap point.','bad');return}
 if(near&&near.d>2.25){notify(`Wrong area • move closer to the highlighted ${s.id} snap target.`,'bad');return}
 historyPush();install(type,s,true);state.selectedType=null;if(snapPreview)snapPreview.visible=false;renderAssemblyUI();showGuides();
 if(state.guided&&stepDone(state.step)&&state.step<steps.length-1)setTimeout(()=>{state.step++;renderAssemblyUI();showGuides()},500)
}
function install(type,s,animate=true){
 const o=createPart(type,s.id),id=`${type}-${s.id}`;o.position.set(...s.p);o.rotation.y=s.r||0;tag(o,{partRoot:o});partsRoot.add(o);state.parts.push({type,slotId:s.id,id,obj:o});
 if(type==='esc')addEscStrap(s,id);
 if(type==='frameScrew'||type==='motorScrew')animateScrew(o,s,animate,0);
 if(type==='battery'){if(animate){const target=new THREE.Vector3(...s.p);o.position.set(s.p[0]+2.5,s.p[1]+.08,s.p[2]);animations.push({type:'batterySlide',obj:o,target});}ensureBatteryStraps(animate);}if(type==='fc'&&state.fcCaseXray)setTimeout(applyFcCaseXray,0);
 const snd={bottomPlate:'plate',topPlate:'plate',armRed:'arm',armWhite:'arm',guard:'guard',motor:'motor',esc:'esc',fcTape:'tape',fc:'fc',battery:'battery',prop:'prop'}[type];if(snd&&!history.restoring)playFX(snd);
 if(['receiver','gps','servo','matrix','sensor','led'].includes(type)){const bench=optionalBenchType?.(type);if(bench)ensureOptionalWireNode(bench,s.id)}
 rebuild3DWires();rebuildSolder();if(['receiver','gps','servo','matrix','sensor','led'].includes(type))render2D?.();if(!history.restoring)notify(`${product(type).name} snapped and locked at ${s.id}.`)
}
function addEscStrap(s,ownerPartId){const g=new THREE.Group(),strap=B(.18,.06,.72,mat(0x20262b,.02,.88),[0,.32,0],g);g.position.set(s.p[0],s.p[1],s.p[2]);g.rotation.y=s.r||0;g.userData.ownerPartId=ownerPartId;extrasRoot.add(g);tag(strap,{partRoot:g})}
function ensureBatteryStraps(animate=true){
 slots.batteryStrap.forEach((s,i)=>{
   if(state.parts.some(p=>p.type==='batteryStrap'&&p.slotId===s.id))return;
   const o=createPart('batteryStrap',s.id),id=`batteryStrap-${s.id}`;o.position.set(...s.p);o.rotation.y=s.r||0;tag(o,{partRoot:o,internal:true});partsRoot.add(o);state.parts.push({type:'batteryStrap',slotId:s.id,id,obj:o,internal:true});
   if(animate){o.scale.set(1,1.22,1.20);animations.push({type:'strapTighten',obj:o,t:0,delay:.30+i*.28});setTimeout(()=>playFX('strap'),380+i*280)}
 })
}
function removeBatteryStraps(){
 state.parts.filter(p=>p.type==='batteryStrap').forEach(p=>p.obj?.removeFromParent());
 state.parts=state.parts.filter(p=>p.type!=='batteryStrap')
}
function makeFastenerFlash(s,delay=0){
 const ring=new THREE.Mesh(new THREE.RingGeometry(.07,.20,28),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
 ring.rotation.x=-Math.PI/2;ring.position.set(s.p[0],s.p[1]+.025,s.p[2]);extrasRoot.add(ring);animations.push({type:'fastenerFlash',obj:ring,t:0,delay})
}

function makeAllenTool(s,delay=0){
 const g=new THREE.Group();const shaft=CY(.025,.68,mat(0xc7d0d6,.8,.18),[0,.34,0],g);const bend=B(.20,.05,.05,mat(0xc7d0d6,.8,.18),[.09,.67,0],g);const handle=B(.40,.075,.075,mat(0x2d8bc2,.18,.38),[.25,.67,0],g);g.position.set(s.p[0],s.p[1]+.30,s.p[2]);g.visible=delay<=0;extrasRoot.add(g);return g
}

function animateScrew(o,s,on=true,delay=0){
 if(!on)return;o.position.y=s.p[1]+.68;o.rotation.y=0;o.scale.setScalar(.70);o.visible=delay<=0;
 const tool=makeAllenTool(s,delay);animations.push({type:'screw',obj:o,tool,t:0,delay,targetY:s.p[1],soundPlayed:false});makeFastenerFlash(s,delay+1.02)
}
function installFastenerSet(type){
 const free=(slots[type]||[]).filter(s=>!state.parts.some(p=>p.type===type&&p.slotId===s.id));
 if(!free.length){notify(`${product(type).name} is already complete.`,'bad');state.selectedType=null;renderShelf();return}
 historyPush();const frame=type==='frameScrew';$('#threeWrap').classList.add('fastener-active');
 free.forEach((s,i)=>{
   const o=createPart(type,s.id),id=`${type}-${s.id}`;o.position.set(...s.p);o.rotation.y=s.r||0;tag(o,{partRoot:o});partsRoot.add(o);state.parts.push({type,slotId:s.id,id,obj:o});
   const delay=frame?(i*.20):(i*.18);
   animateScrew(o,s,true,delay)
 });
 state.selectedType=null;renderAssemblyUI();showGuides();rebuild3DWires();rebuildSolder();
 const qty=free.length;notify(`${qty} ${frame?'frame':'motor'} screws auto-positioned — tightening sequence started.`);
 setTimeout(()=>{$('#threeWrap').classList.remove('fastener-active');notify(`${qty} screws tightened and locked ✓`);if(state.guided&&stepDone(state.step)&&state.step<steps.length-1){state.step++;renderAssemblyUI();showGuides()}},frame?4300:4700)
}
function deleteInstalled(id){
 const p=state.parts.find(x=>x.id===id);if(!p)return;historyPush();p.obj.removeFromParent();state.parts=state.parts.filter(x=>x.id!==id);
 [...extrasRoot.children].filter(x=>x.userData?.ownerPartId===id).forEach(x=>x.removeFromParent());
 const prefix=p.slotId;
 if(p.type==='esc'){state.connections=state.connections.filter(c=>!c.from.startsWith(prefix+'.')&&!c.to.startsWith(prefix+'.'));['motorWire','powerWire','escFc'].forEach(x=>state.doneActions.delete(x))}
 if(p.type==='motor'){state.connections=state.connections.filter(c=>!c.from.startsWith(prefix+'.')&&!c.to.startsWith(prefix+'.'));state.doneActions.delete('motorWire')}
 if(p.type==='fc'){state.connections=state.connections.filter(c=>!c.from.startsWith('FC.')&&!c.to.startsWith('FC.'));state.doneActions.delete('escFc');state.doneActions.delete('receiverWire')}
 if(p.type==='battery'){state.connections=state.connections.filter(c=>!c.from.startsWith('BAT.')&&!c.to.startsWith('BAT.'));state.doneActions.delete('xt60');removeBatteryStraps();setPowerVisual(false,false)}
 if(p.type==='receiver'){state.connections=state.connections.filter(c=>!c.from.startsWith('RX.')&&!c.to.startsWith('RX.'));state.doneActions.delete('receiverWire')}
 const benchType=optionalBenchType?.(p.type);if(benchType){const nodeId=optionalNodeId(benchType,p.slotId);clearWireConnectionsForPrefix(nodeId);delete wireLayout[nodeId];delete wireNodeTransforms[nodeId];optionalWireNodes=optionalWireNodes.filter(n=>n.id!==nodeId);if(selectedWireNodeId===nodeId)selectedWireNodeId=null;persistWireLayout()}
 state.doneActions.delete('inspect');state.selectedInstalledId=null;renderAssemblyUI();render2D();rebuild3DWires();rebuildSolder();showGuides();
 $('#inspector').innerHTML='<div class="empty"><div>↩</div><p>Component deleted. It returned to the shelf in assembly order.</p></div>';notify(`${product(p.type).name} deleted — returned to shelf.`)
}
function showGuides(){if(!guidesRoot)return;guidesRoot.clear();const s=steps[state.step];if(!s.types.length)return;s.types.forEach(t=>(slots[t]||[]).forEach(q=>{if(state.parts.some(p=>p.type===t&&p.slotId===q.id))return;const R=t.includes('Screw')?.13:(t==='armRed'||t==='armWhite')?.55:.28,g=new THREE.Mesh(new THREE.RingGeometry(R*.65,R,28),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.55,side:THREE.DoubleSide}));g.rotation.x=-Math.PI/2;g.position.set(q.p[0],q.p[1]+.03,q.p[2]);guidesRoot.add(g)}))}
function resize3D(){if(!renderer||!camera)return;const e=$('#threeContainer');if(!e)return;const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||600);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
function loop3D(t){
 requestAnimationFrame(loop3D);fpsFrames++;if(t-fpsLast>1000){runtimeFps=Math.round(fpsFrames*1000/(t-fpsLast));fpsFrames=0;fpsLast=t;updateStartupDiagnostics?.()}
 controls.autoRotate=state.autoRotate;controls.update();
 guidesRoot.children.forEach((g,i)=>{g.material.opacity=.3+.28*Math.sin(t*.006+i);g.scale.setScalar(1+.08*Math.sin(t*.007+i))});
 for(let i=animations.length-1;i>=0;i--){
   const a=animations[i];a.t=(a.t||0)+.035;if(a.delay&&a.t<a.delay)continue;const lt=a.t-(a.delay||0);
   if(a.type==='screw'){
     a.obj.visible=true;
     if(a.tool){a.tool.visible=true;a.tool.position.set(a.obj.position.x,a.obj.position.y+.36,a.obj.position.z);a.tool.rotation.y+=.46}
     if(!a.soundPlayed){playFX('screw');a.soundPlayed=true}
     a.obj.rotation.y+=.78;a.obj.position.y=THREE.MathUtils.lerp(a.obj.position.y,a.targetY,.105);
     const sc=THREE.MathUtils.lerp(a.obj.scale.x,1,.09);a.obj.scale.setScalar(sc);
     if(lt>1.75){a.obj.position.y=a.targetY;a.obj.scale.setScalar(1);a.tool?.removeFromParent();animations.splice(i,1)}
   } else if(a.type==='fastenerFlash'){
     a.obj.material.opacity=Math.max(0,.9-lt*.68);a.obj.scale.setScalar(1+lt*2.2);if(lt>1.32){a.obj.removeFromParent();animations.splice(i,1)}
   } else if(a.type==='plug'||a.type==='batteryPlug'){
     a.obj.position.lerp(a.target,a.type==='batteryPlug'?.09:.115);
     if(a.obj.position.distanceTo(a.target)<.028){if(a.removeAtEnd)a.obj.removeFromParent();animations.splice(i,1)}
   } else if(a.type==='batterySlide'){
     a.obj.position.lerp(a.target,.075);if(a.obj.position.distanceTo(a.target)<.025){a.obj.position.copy(a.target);animations.splice(i,1);playFX('battery')}
   } else if(a.type==='strapTighten'){
     a.obj.scale.y=THREE.MathUtils.lerp(a.obj.scale.y,1,.10);a.obj.scale.z=THREE.MathUtils.lerp(a.obj.scale.z,1,.10);
     if(lt>1.45){a.obj.scale.set(1,1,1);animations.splice(i,1)}
   } else if(a.type==='spark'){
     a.obj.scale.setScalar(1+lt*5.5);a.obj.material.opacity=Math.max(0,1-lt*2.5);if(a.light)a.light.intensity=Math.max(0,6-lt*15);if(lt>.42){a.obj.removeFromParent();a.light?.removeFromParent();animations.splice(i,1)}
   } else if(a.type==='powerWave'){
     a.obj.visible=true;a.obj.scale.setScalar(1+lt*5.8);a.obj.material.opacity=Math.max(0,.95-lt*1.8);if(lt>.55){a.obj.removeFromParent();animations.splice(i,1)}
   }
 }
 if(state.powered&&state.powerStage>=3){state.parts.filter(p=>p.type==='prop').forEach((p,i)=>p.obj.rotation.y+=(i%2?1:-1)*.014);silenceMotorAudio('assembly');if(Math.floor(t/600)!==Math.floor((t-35)/600))setFcLeds(true,true,true)}else silenceMotorAudio('assembly');
 powerPulseItems.forEach(x=>{x.phase=(x.phase+x.speed*.016)%1;x.mesh.position.copy(x.curve.getPointAt(x.phase))});
 partsRoot.traverse(o=>{if(o.isMesh&&o.material){o.material.transparent=state.xray;o.material.opacity=state.xray?.36:1;o.material.depthWrite=!state.xray}});
 if(state.fcCaseXray&&!state.xray)applyFcCaseXray();
 wiresRoot.visible=state.wireMap||state.xray;
 if(powerPulseRoot)powerPulseRoot.visible=state.wireMap||state.xray||state.powered;
 renderer.render(scene,camera)
}
function setView(v){
 if(!camera||!controls)return;
 if(v==='3d')camera.position.set(8.9,7.1,10.6);
 if(v==='top')camera.position.set(0,14,.01);
 if(v==='front')camera.position.set(0,3.8,12);
 controls.target.set(0,.95,0);
 const active={'3d':'view3dBtn',top:'topBtn',front:'frontBtn'}[v];
 ['view3dBtn','topBtn','frontBtn'].forEach(id=>$('#'+id)?.classList.toggle('active',id===active))
}

function applyFcCaseXray(){
 const fc=state.parts.find(p=>p.type==='fc')?.obj;if(!fc)return;
 fc.traverse(o=>{if(!o.isMesh||!o.material)return;const keep=o.name==='FC_MALE_PIN'||o.name==='HEADER_COLLAR'||o.name.startsWith('FC_RGB');if(!keep){o.material.transparent=state.fcCaseXray;o.material.opacity=state.fcCaseXray?.24:1;o.material.depthWrite=!state.fcCaseXray}})
}

function setWireMap(on){state.wireMap=on;$('#wireMapBtn')?.classList.toggle('active',on);$('#objectViewBtn')?.classList.toggle('active',!on);$('#wireLegend')?.classList.toggle('hidden',!on);rebuild3DWires()}
function toggleExplode(){state.exploded=!state.exploded;$('#explodeBtn').classList.toggle('active',state.exploded);state.parts.forEach((p,i)=>{const s=slots[p.type]?.find(x=>x.id===p.slotId);if(!s)return;p.obj.position.set(s.p[0]*(state.exploded?1.15:1),s.p[1]+(state.exploded?.35+(i%5)*.15:0),s.p[2]*(state.exploded?1.15:1))});rebuild3DWires()}

/* V7 connector-accurate 3D wiring: endpoints follow installed part position + rotation. */
function installed(type,slotId){return state.parts.find(p=>p.type===type&&p.slotId===slotId)?.obj||null}
function localOnPart(type,slotId,v){
 const o=installed(type,slotId);if(!o)return new THREE.Vector3(...v);
 scene.updateMatrixWorld(true);const world=o.localToWorld(new THREE.Vector3(...v));return wiresRoot.worldToLocal(world.clone())
}
function endpoint(k){
 const [n,p]=k.split('.');
 if(n==='BAT')return localOnPart('battery','BAT',p==='+'?[1.35,.50,.43]:[1.35,.36,.35]);
 if(n==='PDB'){
   const q={'BAT+':[-2.34,.30,.13],'BAT-':[-2.34,.30,-.13],'E1+':[.95,.15,.73],'E1-':[.95,.15,.48],'E2+':[-.63,.15,.73],'E2-':[-.88,.15,.73],'E3+':[-.63,.15,-.73],'E3-':[-.88,.15,-.73],'E4+':[.95,.15,-.48],'E4-':[.95,.15,-.73]};
   return localOnPart('bottomPlate','bottom',q[p]||[0,.15,0])
 }
 if(/^ESC[1-4]$/.test(n)){
   const slot=n;
   if(p==='PWR+')return localOnPart('esc',slot,[-.91,.16,.16]);
   if(p==='PWR-')return localOnPart('esc',slot,[-.91,.10,-.16]);
   if(['U','V','W'].includes(p))return localOnPart('esc',slot,[.84,.16,{U:-.13,V:0,W:.13}[p]]);
   if(p==='SIG')return localOnPart('esc',slot,[-.94,.14,-.10]);
   if(p==='5V')return localOnPart('esc',slot,[-.94,.14,0]);
   return localOnPart('esc',slot,[-.94,.14,.10])
 }
 if(/^M[1-4]$/.test(n))return localOnPart('motor',n,[.70,.18,{U:-.13,V:0,W:.13}[p]||0]);
 if(n==='FC'){
   if(p.startsWith('ESC')){const i=+p[3],xs=[-.54,-.18,.18,.54],z=p.endsWith('-S')?-.55:p.endsWith('5V')?-.70:-.85;return localOnPart('fc','FC',[xs[i-1],.71,z])}
   if(p.startsWith('GPIO')){const i=+p[4],xs=[.36,.60,.84],z=p.endsWith('-S')?-.05:p.endsWith('5V')?-.19:-.33;return localOnPart('fc','FC',[xs[i-1],.71,z])}
   if(p==='RX-S')return localOnPart('fc','FC',[.91,.71,.49]);
   if(p==='RX-V')return localOnPart('fc','FC',[.91,.71,.35]);
   if(p==='RX-G')return localOnPart('fc','FC',[.91,.71,.21]);
   if(p.startsWith('I2C-')){const names=['V','G','SCL','SDA'],i=names.indexOf(p.slice(4));return localOnPart('fc','FC',[-.65+Math.max(0,i)*.12,.71,.82])}
 }
 if(n==='RX'){
   if(p==='SIG')return localOnPart('receiver','RX',[-.45,.12,-.12]);
   if(p==='VCC')return localOnPart('receiver','RX',[-.45,.12,0]);
   return localOnPart('receiver','RX',[-.45,.12,.12])
 }
 if(n.startsWith('OPT_')){
   const m=n.match(/^OPT_(ppm|servo|matrix|sensor|gps|led)_(.+)$/);if(m){const [,bt,slotId]=m,type=optionalThreeType(bt);const map={
     ppm:{SIG:[-.42,.14,-.12],'5V':[-.42,.14,0],GND:[-.42,.14,.12]},
     servo:{SIG:[-.34,.18,-.10],'5V':[-.34,.18,0],GND:[-.34,.18,.10]},
     matrix:{DATA:[-.48,.12,-.14],'5V':[-.48,.12,0],GND:[-.48,.12,.14]},
     sensor:{SDA:[-.33,.12,-.15],SCL:[-.33,.12,-.05],VCC:[-.33,.12,.05],GND:[-.33,.12,.15]},
     gps:{TX:[-.42,.20,-.15],RX:[-.42,.20,-.05],'5V':[-.42,.20,.05],GND:[-.42,.20,.15]},
     led:{DATA:[-.12,.16,-.08],'5V':[-.12,.16,0],GND:[-.12,.16,.08]}
   };return localOnPart(type,slotId,map[bt]?.[p]||[0,.15,0])}
 }
 return new THREE.Vector3()
}
function wColor(k){
 if(/\.U$/.test(k))return 0xf5c542;
 if(/\.V$/.test(k))return 0x2c92ff;
 if(/\.W$/.test(k))return 0x87949d;
 if(/PWR\+|BAT\.\+|PDB\..*\+/.test(k))return 0xef3f48;   // THICK +12V / battery positive
 if(/PWR-|BAT\.-|GND|-G$/.test(k))return 0x3a2419;      // brown-black GND
 if(/5V|-V$/.test(k))return 0xfb7185;                    // thin light-red +5V
 if(/I2C/.test(k))return 0x47c8f1;
 return 0xf59e0b;                                        // orange Source / PWM / signal
}
function routePoints(c){
 const a=endpoint(c.from),b=endpoint(c.to);
 if(/ESC\d\.[UVW]/.test(c.from)){const m=a.clone().lerp(b,.5);m.y=Math.max(a.y,b.y)+.035;const m2=m.clone().lerp(b,.48);m2.y+=.02;return[a,m,m2,b]}
 if(c.from.startsWith('PDB.E')){
   const i=+c.to[3],esc=installed('esc','ESC'+i);
   if(esc){scene.updateMatrixWorld(true);const w=esc.localToWorld(new THREE.Vector3(-.28,.12,0));const e=wiresRoot.worldToLocal(w.clone());const m=a.clone().lerp(e,.58);m.y=.92;return[a,m,e,b]}
 }
 if(c.from.startsWith('ESC')&&/SIG|5V|GND/.test(c.from)){
   const m1=a.clone();m1.y+=.11;
   const m2=a.clone().lerp(b,.38);m2.y=Math.max(a.y,b.y)+.30;
   const m3=a.clone().lerp(b,.70);m3.y=Math.max(a.y,b.y)+.42;
   const m4=b.clone();m4.y+=.18;
   return[a,m1,m2,m3,m4,b]
 }
 if(c.from.startsWith('BAT')){const m1=a.clone().lerp(b,.28);m1.y=.42;const m2=a.clone().lerp(b,.64);m2.y=.66;const m3=a.clone().lerp(b,.86);m3.y=.88;return[a,m1,m2,m3,b]}
 if(c.from.startsWith('OPT_')||c.to.startsWith('OPT_')){const m1=a.clone();m1.y+=.18;const m2=a.clone().lerp(b,.5);m2.y=Math.max(a.y,b.y)+.34;const m3=b.clone();m3.y+=.14;return[a,m1,m2,m3,b]}
 const m=a.clone().lerp(b,.5);m.y+=.08;return[a,m,b]
}
function rebuild3DWires(){
 if(!wiresRoot)return;wiresRoot.clear();
 state.connections.forEach(c=>{
   const pts=routePoints(c),th=/BAT|PWR/.test(c.from+c.to) ? .045 : (/\.[UVW]/.test(c.from) ? .020 : .018);
   const w=tube(pts,wColor(c.from),th,wiresRoot);tag(w,{wire:`${c.from} → ${c.to}`,wireId:c.id});
   if(c.new){w.material.emissive=new THREE.Color(C.green);w.material.emissiveIntensity=1.8}
 });
 rebuildPowerPulses();
}
function rebuildPowerPulses(){
 if(!powerPulseRoot)return;powerPulseRoot.clear();powerPulseItems=[];
 if(!state.powered)return;
 state.connections.forEach(c=>{
   if(!(/BAT\.|PDB\.E|PWR/.test(c.from+c.to)))return;
   const pts=routePoints(c);if(!pts||pts.length<2)return;const curve=new THREE.CatmullRomCurve3(pts);
   for(let j=0;j<3;j++){
     const m=new THREE.Mesh(new THREE.SphereGeometry(.043,12,9),new THREE.MeshBasicMaterial({color:wColor(c.from),transparent:true,opacity:.96}));
     powerPulseRoot.add(m);powerPulseItems.push({mesh:m,curve,phase:j/3,speed:.13+Math.random()*.035})
   }
 })
}

function animatePlug(from,to){
 if(from.startsWith('OPT')||to.startsWith('OPT'))return;
 const fcKey=from.startsWith('FC.ESC')?from:(to.startsWith('FC.ESC')?to:null);
 if(fcKey){
   if(!fcKey.endsWith('-S'))return;
   const escNum=+(fcKey.match(/ESC(\d)/)?.[1]||1),b=endpoint(fcKey),g=new THREE.Group();
   B(.19,.17,.40,mat(0x172027,.06,.75),[0,0,-.15],g);
   [0,-.15,-.30].forEach(z=>{const s=CY(.027,.075,mat(0x020405,.0,.92),[0,-.04,z],g);s.name='FEMALE_SOCKET'});
   g.position.copy(b.clone().add(new THREE.Vector3(0,.86,0)));extrasRoot.add(g);
   g.userData.ownerPartId=`esc-fc-plug-${escNum}`;
   animations.push({type:'plug',obj:g,target:b.clone().add(new THREE.Vector3(0,.12,0)),removeAtEnd:false});
   playFX('connector');notify(`ESC${escNum} female 3-pin plug moving from above onto FC ESC${escNum} male header`);
   return
 }
 const a=endpoint(from),b=endpoint(to),g=new THREE.Group();B(.14,.09,.18,mat(0x35424c),[0,0,0],g);g.position.copy(a);extrasRoot.add(g);animations.push({type:'plug',obj:g,target:b.clone(),removeAtEnd:true});playFX('connector')
}

function rebuildSolder(){
 if(!solderRoot)return;solderRoot.clear();
 const blob=p=>{const m=new THREE.Mesh(new THREE.SphereGeometry(.085,18,12),new THREE.MeshStandardMaterial({color:0xd7dde1,metalness:.9,roughness:.18}));m.scale.y=.34;m.position.set(...p);solderRoot.add(m)};
 if(state.doneActions.has('powerWire'))[[.95,.84,.73],[.95,.84,.48],[-.63,.84,.73],[-.88,.84,.73],[-.63,.84,-.73],[-.88,.84,-.73],[.95,.84,-.48],[.95,.84,-.73]].forEach(blob);
 if(state.doneActions.has('xt60'))[[-1.18,.84,.14],[-1.18,.84,-.14]].forEach(blob)
}

/* actions */
function addGroup(g){
 const groups={motor:requiredWires.filter(([a])=>/ESC\d\.[UVW]/.test(a)),power:requiredWires.filter(([a,b])=>a.startsWith('PDB.E')&&b.includes('PWR')),escfc:requiredWires.filter(([a,b])=>a.startsWith('ESC')&&(/SIG|5V|GND/.test(a))&&b.startsWith('FC.ESC')),xt60:requiredWires.filter(([a])=>a.startsWith('BAT.')),rx:requiredWires.filter(([a])=>a.startsWith('RX.'))};const arr=groups[g]||[];arr.forEach(([from,to],i)=>{if(!state.connections.some(c=>c.from===from&&c.to===to))state.connections.push({from,to,new:true});if(g!=='escfc'||from.endsWith('.SIG'))setTimeout(()=>animatePlug(from,to),i*80)});setTimeout(()=>state.connections.forEach(c=>c.new=false),1400);render2D();rebuild3DWires();rebuildSolder()
}
function performAction(s){
 if(s.id==='inspect'&&!steps.slice(0,steps.length-1).every((_,i)=>stepDone(i))){notify('Complete previous steps first.','bad');return}if(s.id==='inspect'&&typeof electricalIssues==='function'&&electricalIssues().some(x=>x.level==='bad')){notify('Final inspection blocked • fix critical electrical validation errors first.','bad');return}historyPush();if(s.id==='xt60'){if(!connectBatteryPower(true))return;state.doneActions.add('xt60');rebuildSolder();renderAssemblyUI();if(state.guided&&state.step<steps.length-1){state.step++;renderAssemblyUI();showGuides()}return}if(s.id==='motorWire')addGroup('motor');if(s.id==='powerWire')addGroup('power');if(s.id==='escFc')addGroup('escfc');state.doneActions.add(s.id);rebuildSolder();renderAssemblyUI();notify(`${s.title} completed.`);if(state.guided&&state.step<steps.length-1){state.step++;renderAssemblyUI();showGuides()}
}

/* ==================== V8 INTERACTIVE 2D WIRING BENCH ==================== */

let selPort=null,selectedWireId=null,selectedWireNodeId=null,svgPorts={},wireDrag=null,wireMotorRun=false,wireMotorAngle=[0,0,0,0],wireAnimLast=performance.now(),wireMode=false;
const wireUndoStack=[],wireStorageKey='zebjus-v152-wire-layout';
const wireDefaultLayout={BAT:{x:55,y:402},FC:{x:870,y:360},ESC1:{x:1085,y:175},ESC2:{x:230,y:175},ESC3:{x:230,y:635},ESC4:{x:1085,y:635},M1:{x:1260,y:55},M2:{x:90,y:55},M3:{x:90,y:790},M4:{x:1260,y:790}};
let wireLayout=structuredClone(wireDefaultLayout),wireNodeTransforms={},optionalWireNodes=[];
try{const raw=JSON.parse(localStorage.getItem(wireStorageKey)||'null');if(raw?.layout){wireLayout={...wireDefaultLayout,...raw.layout};wireNodeTransforms=raw.transforms||{}}else wireLayout={...wireDefaultLayout,...JSON.parse(localStorage.getItem('zebjus-v8-wire-layout')||'{}')}}catch{}
function E(t,a={},x=''){const e=document.createElementNS(SVG,t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));if(x)e.textContent=x;return e}
function wireSnapshot(){return JSON.stringify({connections:state.connections.map(c=>({...c})),layout:structuredClone(wireLayout),transforms:structuredClone(wireNodeTransforms),optional:structuredClone(optionalWireNodes),selectedNode:selectedWireNodeId})}
function persistWireLayout(){try{localStorage.setItem(wireStorageKey,JSON.stringify({layout:wireLayout,transforms:wireNodeTransforms}));localStorage.removeItem('zebjus-v8-wire-layout')}catch{}}
function wireRemember(){wireUndoStack.push(wireSnapshot());if(wireUndoStack.length>60)wireUndoStack.shift()}
function wireUndo(){const v=wireUndoStack.pop();if(!v){notify('Nothing to undo in wiring.','bad');return}const d=JSON.parse(v);state.connections=d.connections||[];wireLayout=d.layout||structuredClone(wireDefaultLayout);wireNodeTransforms=d.transforms||{};optionalWireNodes=d.optional||[];selectedWireNodeId=d.selectedNode||null;selectedWireId=null;selPort=null;render2D();rebuild3DWires();rebuildSolder();persistWireLayout();notify('Wiring undo restored.')}
function resetWireLayout(){wireRemember();wireLayout=structuredClone(wireDefaultLayout);wireNodeTransforms={};selectedWireNodeId=null;try{localStorage.removeItem(wireStorageKey);localStorage.removeItem('zebjus-v8-wire-layout')}catch{}render2D();notify('2D positions, flips and rotations reset.')}
function wireTransform(id){return wireNodeTransforms[id]||{rot:0,flipX:false}}
function nodeTransformAttr(id,w,h){const p=nodePos(id),t=wireTransform(id),cx=w/2,cy=h/2,sx=t.flipX?-1:1;return `translate(${p.x} ${p.y}) translate(${cx} ${cy}) rotate(${t.rot||0}) scale(${sx} 1) translate(${-cx} ${-cy})`}
function nodeCanvasPoint(id,w,h,x,y){const p=nodePos(id),t=wireTransform(id),cx=w/2,cy=h/2,sx=t.flipX?-1:1,r=rad(t.rot||0),dx=(x-cx)*sx,dy=y-cy;return{x:p.x+cx+dx*Math.cos(r)-dy*Math.sin(r),y:p.y+cy+dx*Math.sin(r)+dy*Math.cos(r)}}
function optionalNodeId(type,slotId){return `OPT_${type}_${slotId}`}
function optionalThreeType(type){return optional3DTypeMap[type]||null}
function optionalBenchType(threeType){return Object.entries(optional3DTypeMap).find(([,v])=>v===threeType)?.[0]||null}
function ensureOptionalWireNode(type,slotId){const id=optionalNodeId(type,slotId);let n=optionalWireNodes.find(x=>x.id===id);if(!n){n={id,type,slotId};optionalWireNodes.push(n)}if(!wireLayout[id])wireLayout[id]={x:1180,y:180+(optionalWireNodes.length-1)*118};return n}
function syncOptionalNodesFromParts(){state.parts.filter(p=>optionalBenchType(p.type)).forEach(p=>ensureOptionalWireNode(optionalBenchType(p.type),p.slotId));optionalWireNodes=optionalWireNodes.filter(n=>{const t=optionalThreeType(n.type);return !t||state.parts.some(p=>p.type===t&&p.slotId===n.slotId)})}
function wireNodePart(id){
 const fixed={BAT:['battery','BAT'],FC:['fc','FC'],ESC1:['esc','ESC1'],ESC2:['esc','ESC2'],ESC3:['esc','ESC3'],ESC4:['esc','ESC4'],M1:['motor','M1'],M2:['motor','M2'],M3:['motor','M3'],M4:['motor','M4']};
 if(fixed[id]){const [type,slotId]=fixed[id];return state.parts.find(p=>p.type===type&&p.slotId===slotId)||null}
 const n=optionalWireNodes.find(x=>x.id===id);if(!n)return null;const t=optionalThreeType(n.type);return t?state.parts.find(p=>p.type===t&&p.slotId===n.slotId)||null:null
}
function partToWireNodeId(type,slotId){const fixed={battery:{BAT:'BAT'},fc:{FC:'FC'},esc:{ESC1:'ESC1',ESC2:'ESC2',ESC3:'ESC3',ESC4:'ESC4'},motor:{M1:'M1',M2:'M2',M3:'M3',M4:'M4'}};if(fixed[type]?.[slotId])return fixed[type][slotId];const bench=optionalBenchType(type);return bench?optionalNodeId(bench,slotId):null}
function nodeLabelSuffix(id){return wireNodePart(id)?' • 3D attached':' • 2D reference'}
function selectWireNode(id){selectedWireNodeId=id;selectedWireId=null;selPort=null;render2D()}
function setWireMode(on=null,silent=false){wireMode=on===null?!wireMode:!!on;const b=$('#wireModeBadge');if(b){b.textContent=wireMode?'WIRE MODE':'OBJECT MODE';b.className='status '+(wireMode?'good':'')}if(!silent)notify(wireMode?'Wire mode enabled — click ports to connect.':'Object mode enabled — select, move, flip or rotate nodes.','good')}
function clearWireConnectionsForPrefix(prefix){state.connections=state.connections.filter(c=>!(c.from===prefix||c.to===prefix||c.from.startsWith(prefix+'.')||c.to.startsWith(prefix+'.')))}
function deleteOptionalNodeOnly(id,silent=false){wireRemember();clearWireConnectionsForPrefix(id);delete wireLayout[id];delete wireNodeTransforms[id];optionalWireNodes=optionalWireNodes.filter(n=>n.id!==id);if(selectedWireNodeId===id)selectedWireNodeId=null;render2D();rebuild3DWires();rebuildSolder();persistWireLayout();if(!silent)notify('Optional device deleted from 2D bench.')}
function rotateSelectedNode(){if(!selectedWireNodeId){notify('Select an object first.','bad');return}wireRemember();const t=wireTransform(selectedWireNodeId);wireNodeTransforms[selectedWireNodeId]={...t,rot:((t.rot||0)+90)%360};persistWireLayout();render2D();notify('Selected 2D object rotated 90°.','good')}
function flipSelectedNode(){if(!selectedWireNodeId){notify('Select an object first.','bad');return}wireRemember();const t=wireTransform(selectedWireNodeId);wireNodeTransforms[selectedWireNodeId]={...t,flipX:!t.flipX};persistWireLayout();render2D();notify('Selected 2D object flipped.','good')}
function deleteSelectedObject(){if(selectedWireId){deleteSelectedWire();return}if(!selectedWireNodeId){notify('Select an object or wire first.','bad');return}const part=wireNodePart(selectedWireNodeId);if(part){deleteInstalled(part.id);selectedWireNodeId=null;return}if(optionalWireNodes.some(n=>n.id===selectedWireNodeId)){deleteOptionalNodeOnly(selectedWireNodeId);return}notify('This fixed bench node is a reference. Install the matching 3D part first, then delete it.','bad')}
function portDot(svg,key,x,y,type,label,anchor='start'){svgPorts[key]={x,y};const c=E('circle',{cx:x,cy:y,r:6.5,class:`port-v8 ${type}${selPort===key?' selected':''}`});c.dataset.port=key;c.onclick=e=>{e.stopPropagation();choosePort(key)};svg.appendChild(c);if(label)svg.appendChild(E('text',{x:x+(anchor==='start'?9:-9),y:y+3,class:'port-label-v8','text-anchor':anchor},label))}
function draw2DFrame(svg){
 const g=E('g',{transform:'translate(750,450)',opacity:'.72'});svg.appendChild(g);
 const arms=[[-45,'red'],[45,'red'],[135,'white'],[-135,'white']];
 arms.forEach(([a,c])=>{const q=E('g',{transform:`rotate(${a})`});g.appendChild(q);q.appendChild(E('path',{d:'M-28 20 L-28 218 L-52 245 L-48 278 L48 278 L52 245 L28 218 L28 20 Z',class:`wire-bg-arm ${c==='red'?'red':''}`}));for(let y=55;y<210;y+=31)q.appendChild(E('path',{d:`M-19 ${y} L19 ${y+23} M19 ${y} L-19 ${y+23}`,stroke:c==='red'?'#b84a5060':'#9aa9b460','stroke-width':4}));q.appendChild(E('circle',{cx:0,cy:260,r:31,fill:'#0c182111',stroke:'#77899655','stroke-width':2}));q.appendChild(E('rect',{x:-22,y:250,width:44,height:75,rx:7,class:'wire-bg-foot'}))});
 g.appendChild(E('path',{d:'M-112 -96 L-60 -96 L-45 -118 L45 -118 L60 -96 L112 -96 L112 -42 L140 -28 L140 28 L112 42 L112 96 L60 96 L45 118 L-45 118 L-60 96 L-112 96 L-112 42 L-140 28 L-140 -28 L-112 -42 Z',class:'wire-bg-plate'}));
 g.appendChild(E('text',{x:-30,y:-140,class:'svg-front'},'↑ FRONT'));
 [['BAT+',655,438,'power'],['BAT-',655,462,'ground'],['E1+',828,392,'power'],['E1-',828,414,'ground'],['E2+',700,392,'power'],['E2-',678,392,'ground'],['E3+',700,508,'power'],['E3-',678,508,'ground'],['E4+',828,486,'power'],['E4-',828,508,'ground']].forEach(([n,x,y,t])=>portDot(svg,'PDB.'+n,x,y,t,n,'start'))
}
function nodePos(id){return wireLayout[id]||{x:100,y:100}}
function setNodePos(id,x,y){wireLayout[id]={x:clamp(x,10,1380),y:clamp(y,10,820)}}
function beginNodeDrag(id,e){if(e.target.closest?.('.port-v8'))return;e.preventDefault();e.stopPropagation();selectedWireNodeId=id;selectedWireId=null;selPort=null;wireRemember();const pt=svgLocalPoint($('#wiringSvg'),e.clientX,e.clientY),p=nodePos(id);wireDrag={id,dx:pt.x-p.x,dy:pt.y-p.y};document.body.style.userSelect='none'}
function svgLocalPoint(svg,x,y){const p=svg.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(svg.getScreenCTM().inverse())}
function drawNode(svg,id,title,w,h,portsLeft=[],portsRight=[],sub='DRAG TO MOVE',extraClass=''){
 const g=E('g',{class:`wire-node-v8 ${extraClass}${selectedWireNodeId===id?' selected-node':''}`,'data-node':id,transform:nodeTransformAttr(id,w,h)});
 g.onclick=e=>{if(e.target.closest?.('.port-v8'))return;e.stopPropagation();selectWireNode(id)};
 g.appendChild(E('rect',{x:0,y:0,width:w,height:h,rx:12}));g.appendChild(E('rect',{x:0,y:0,width:w,height:28,rx:12,class:'drag-handle'}));g.appendChild(E('text',{x:11,y:18,class:'node-title'},title+nodeLabelSuffix(id)));g.appendChild(E('text',{x:11,y:h-8,class:'node-sub'},sub));
 portsLeft.forEach((q,i)=>{const yy=42+i*20;g.appendChild(E('text',{x:14,y:yy+3,class:'port-label-v8'},q[0]));const c=E('circle',{cx:0,cy:yy,r:6.5,class:`port-v8 ${q[1]}${selPort===id+'.'+q[0]?' selected':''}`});c.dataset.port=id+'.'+q[0];c.onclick=e=>{e.stopPropagation();choosePort(c.dataset.port)};g.appendChild(c);svgPorts[id+'.'+q[0]]=nodeCanvasPoint(id,w,h,0,yy)});
 portsRight.forEach((q,i)=>{const yy=42+i*20;g.appendChild(E('text',{x:w-14,y:yy+3,class:'port-label-v8','text-anchor':'end'},q[0]));const c=E('circle',{cx:w,cy:yy,r:6.5,class:`port-v8 ${q[1]}${selPort===id+'.'+q[0]?' selected':''}`});c.dataset.port=id+'.'+q[0];c.onclick=e=>{e.stopPropagation();choosePort(c.dataset.port)};g.appendChild(c);svgPorts[id+'.'+q[0]]=nodeCanvasPoint(id,w,h,w,yy)});
 g.onpointerdown=e=>beginNodeDrag(id,e);svg.appendChild(g);return g
}
function drawMotorNode(svg,id,title){const w=150,h=100,g=drawNode(svg,id,title,w,h,[],[['U','u'],['V','v'],['W','w']],'DRAG • U/V/W • F flip • R rotate');const holder=E('g',{transform:'translate(75 62)'}),rotor=E('g',{id:`motorRotor${id.slice(1)}`,class:'motor-rotor-2d'});rotor.appendChild(E('circle',{cx:0,cy:0,r:25,class:'motor-ring-2d'}));rotor.appendChild(E('rect',{x:-39,y:-3,width:78,height:6,rx:3,class:'motor-blade-2d'}));rotor.appendChild(E('rect',{x:-3,y:-39,width:6,height:78,rx:3,class:'motor-blade-2d'}));holder.appendChild(rotor);g.appendChild(holder);g.appendChild(E('text',{x:75,y:95,id:`motorDir${id.slice(1)}`,class:'motor-dir-2d'},'OPEN'));return g}
function drawFCNode(svg){
 const id='FC',w=310,h=285,g=E('g',{class:`wire-node-v8 fc-node-v14${selectedWireNodeId===id?' selected-node':''}`,'data-node':id,transform:nodeTransformAttr(id,w,h)});
 g.onpointerdown=e=>beginNodeDrag(id,e);g.onclick=e=>{if(e.target.closest?.('.port-v8'))return;e.stopPropagation();selectWireNode(id)};
 g.appendChild(E('rect',{x:0,y:0,width:w,height:h,rx:14,class:'fc-2d-case'}));
 g.appendChild(E('rect',{x:78,y:44,width:132,height:95,rx:9,class:'fc-2d-window'}));
 g.appendChild(E('text',{x:w/2,y:22,class:'fc-2d-label'},'ZEBJUS FC • 2.54 mm HEADERS'));
 g.appendChild(E('text',{x:w/2,y:38,class:'fc-2d-front'},'↑ FRONT'));
 g.appendChild(E('text',{x:12,y:h-9,class:'node-sub'},'DRAG • WIRE MODE FOR PORTS • F / R SUPPORTED'));
 const makePin=(key,cx,cy,t,label)=>{const c=E('circle',{cx,cy,r:6.4,class:`port-v8 ${t}${selPort===key?' selected':''}`});c.dataset.port=key;c.onclick=e=>{e.stopPropagation();choosePort(key)};g.appendChild(c);svgPorts[key]=nodeCanvasPoint(id,w,h,cx,cy);if(label)g.appendChild(E('text',{x:cx,y:cy-9,class:'fc-pin-mini','text-anchor':'middle'},label))};
 g.appendChild(E('rect',{x:35,y:172,width:178,height:78,rx:7,class:'fc-block-v14 esc'}));g.appendChild(E('text',{x:124,y:166,'text-anchor':'middle',class:'fc-section-label'},'ESC1–ESC4 • 4 × 3'));
 const ex=[58,100,142,184],ey=[190,214,238];['SOURCE','+5V','GND'].forEach((n,r)=>g.appendChild(E('text',{x:28,y:ey[r]+3,'text-anchor':'end',class:`fc-row-label ${r===0?'source':r===1?'fivev':'ground'}`},n)));ex.forEach((x,i)=>ey.forEach((y,r)=>makePin(`FC.ESC${i+1}-${r===0?'S':r===1?'5V':'G'}`,x,y,r===0?'signal':r===1?'fivev':'ground',r===0?`E${i+1}`:'')));
 g.appendChild(E('rect',{x:219,y:115,width:78,height:78,rx:7,class:'fc-block-v14 gpio'}));g.appendChild(E('text',{x:258,y:108,'text-anchor':'middle',class:'fc-section-label'},'GPIO 1–3'));
 const gx=[232,258,284],gy=[132,154,176];gx.forEach((x,i)=>gy.forEach((y,r)=>makePin(`FC.GPIO${i+1}-${r===0?'S':r===1?'5V':'G'}`,x,y,r===0?'signal':r===1?'fivev':'ground',r===0?`G${i+1}`:'')));
 g.appendChild(E('rect',{x:263,y:45,width:34,height:64,rx:7,class:'fc-block-v14 rx'}));g.appendChild(E('text',{x:280,y:39,'text-anchor':'middle',class:'fc-section-label'},'RX'));
 [['S','signal',60,'PPM'],['V','fivev',78,'+5V'],['G','ground',96,'GND']].forEach(([n,t,y,l])=>makePin(`FC.RX-${n}`,280,y,t,l));
 g.appendChild(E('rect',{x:18,y:47,width:114,height:38,rx:7,class:'fc-block-v14 i2c'}));g.appendChild(E('text',{x:75,y:40,'text-anchor':'middle',class:'fc-section-label'},'I²C'));
 [['V','fivev'],['G','ground'],['SCL','i2c'],['SDA','i2c']].forEach(([n,t],i)=>makePin(`FC.I2C-${n}`,36+i*28,66,t,n));
 g.appendChild(E('circle',{cx:225,cy:65,r:9,class:'fc-rgb-v14'}));g.appendChild(E('text',{x:225,y:83,'text-anchor':'middle',class:'fc-rgb-label-v14'},'RGB'));
 svg.appendChild(g)
}
const optional3DTypeMap={ppm:'receiver',servo:'servo',matrix:'matrix',sensor:'sensor',gps:'gps',led:'led'};
function optionalPlacedIn3D(type){const t=optional3DTypeMap[type];return !!t&&state.parts.some(p=>p.type===t)}
function optionalNodeDefinition(n){
 if(n.type==='ppm')return{title:'PPM RECEIVER',ports:[['SIG','signal'],['5V','fivev'],['GND','ground']]};
 if(n.type==='servo')return{title:'SERVO',ports:[['SIG','signal'],['5V','fivev'],['GND','ground']]};
 if(n.type==='matrix')return{title:'LED MATRIX',ports:[['DATA','signal'],['5V','fivev'],['GND','ground']]};
 if(n.type==='sensor')return{title:'I²C SENSOR',ports:[['SDA','i2c'],['SCL','i2c'],['VCC','fivev'],['GND','ground']]};
 if(n.type==='led')return{title:'LED / OUTPUT',ports:[['DATA','signal'],['5V','fivev'],['GND','ground']]};
 return{title:'GPS',ports:[['TX','signal'],['RX','signal'],['5V','fivev'],['GND','ground']]}
}
function drawOptionalNodes(svg){syncOptionalNodesFromParts();optionalWireNodes.forEach(n=>{if(!wireLayout[n.id])wireLayout[n.id]={x:1180,y:420+(optionalWireNodes.indexOf(n)%3)*120};const d=optionalNodeDefinition(n),linked=wireNodePart(n.id);drawNode(svg,n.id,`${d.title} • ${n.slotId||'BENCH'}`,175,120,d.ports,[],linked?'SYNCED 2D ↔ 3D • DRAG':'UNPLACED IN 3D • DRAG','optional-node')})}
function wireRoute(c){
 const a=svgPorts[c.from],b=svgPorts[c.to];if(!a||!b)return'';
 if(/\.[UVW]$/.test(c.from)||/\.[UVW]$/.test(c.to)){const mx=(a.x+b.x)/2;return`M${a.x},${a.y} Q${mx},${Math.min(a.y,b.y)-18} ${b.x},${b.y}`}
 const aFC=c.from.startsWith('FC.'),bFC=c.to.startsWith('FC.');
 if(aFC||bFC){const pin=aFC?a:b,other=aFC?b:a,side=other.x<pin.x?-1:1,approach={x:pin.x+side*34,y:pin.y};if(aFC)return`M${pin.x},${pin.y} L${approach.x},${approach.y} C${approach.x+side*45},${approach.y} ${other.x-side*70},${other.y} ${other.x},${other.y}`;return`M${other.x},${other.y} C${other.x+side*70},${other.y} ${approach.x-side*45},${approach.y} ${approach.x},${approach.y} L${pin.x},${pin.y}`}
 return`M${a.x},${a.y} C${a.x+(b.x-a.x)*.38},${a.y} ${a.x+(b.x-a.x)*.62},${b.y} ${b.x},${b.y}`
}
function cssW(k){if(/\.U$/.test(k))return'#f5c542';if(/\.V$/.test(k))return'#2c92ff';if(/\.W$/.test(k))return'#87949d';if(/PWR\+|BAT\.\+|PDB\..*\+/.test(k))return'#ef3f48';if(/PWR-|BAT\.-|GND|-G$/.test(k))return'#3a2419';if(/5V|-V$/.test(k))return'#fb7185';if(/I2C/.test(k))return'#47c8f1';return'#f59e0b'}
function wireGauge(c){const k=c.from+' '+c.to;if(/BAT\.|PWR|PDB\.E/.test(k))return 7.5;if(/\.[UVW]/.test(k))return 4.6;if(/5V|GND|-G\b/.test(k))return 3.4;return 3.5}
function portTypeFromKey(k){if(/5V|-V$/.test(k))return'fivev';if(/GND|-G$|BAT-/.test(k))return'ground';if(/\.U$/.test(k))return'u';if(/\.V$/.test(k))return'v';if(/\.W$/.test(k))return'w';if(/\+|PWR\+/.test(k))return'power';if(/I2C-(SCL|SDA)/.test(k))return'i2c';return'signal'}
function drawFcPortOverlay(svg){const layer=E('g',{class:'fc-port-overlay-v13'});Object.entries(svgPorts).filter(([k])=>k.startsWith('FC.')).forEach(([k,p])=>{const c=E('circle',{cx:p.x,cy:p.y,r:7.4,class:`port-v8 port-overlay-v13 ${portTypeFromKey(k)}${selPort===k?' selected':''}`});c.dataset.port=k;c.onclick=e=>{e.stopPropagation();choosePort(k)};const title=E('title',{},k.replace('FC.','FC '));c.appendChild(title);layer.appendChild(c);const m=k.match(/^FC\.ESC(\d)-(S|5V|G)$/);if(m){const lab=E('text',{x:p.x,y:p.y-10,class:'fc-pin-mini','text-anchor':'middle'},`E${m[1]} ${m[2]}`);layer.appendChild(lab)}});svg.appendChild(layer)}
function conn(a,b){return state.connections.some(c=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a))}
function phaseMap(i){const esc=`ESC${i}`,mot=`M${i}`,src=['U','V','W'],dst=['U','V','W'],map=[];for(const s of src){const found=state.connections.find(c=>{const a=c.from.split('.'),b=c.to.split('.');return(a[0]===esc&&a[1]===s&&b[0]===mot&&dst.includes(b[1]))||(b[0]===esc&&b[1]===s&&a[0]===mot&&dst.includes(a[1]))});if(!found)return null;const a=found.from.split('.'),b=found.to.split('.');map.push(dst.indexOf(a[0]===mot?a[1]:b[1]))}if(new Set(map).size!==3)return null;return map}
function permutationOdd(a){let inv=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])inv++;return inv%2===1}
function motorElectrical(i){const map=phaseMap(i);const battery=conn('BAT.+','PDB.BAT+')&&conn('BAT.-','PDB.BAT-');const power=battery&&conn(`PDB.E${i}+`,`ESC${i}.PWR+`)&&conn(`PDB.E${i}-`,`ESC${i}.PWR-`);if(!map||!power)return{ready:false,dir:'OPEN',map};const base=(i===1||i===3)?'CW':'CCW',rev=permutationOdd(map),dir=rev?(base==='CW'?'CCW':'CW'):base;return{ready:true,dir,map,reverse:rev}}
function motorEnabled(i){return $('#wireAllMotors')?.checked?true:!!$(`#wireM${i}`)?.checked}
function motorActive(i){return wireMotorRun&&+($('#wireThrottle')?.value||1000)>=1100&&motorEnabled(i)&&motorElectrical(i).ready}
function wireCarriesCurrent(c){const k=c.from+' '+c.to;if(state.powered&&(/BAT\.|PDB\.E|PWR/.test(k)))return true;if(!wireMotorRun||+($('#wireThrottle')?.value||1000)<1100)return false;for(let i=1;i<=4;i++){if(!motorActive(i))continue;const keys=[['BAT.+','PDB.BAT+'],['BAT.-','PDB.BAT-'],[`PDB.E${i}+`,`ESC${i}.PWR+`],[`PDB.E${i}-`,`ESC${i}.PWR-`]];if(keys.some(([a,b])=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a)))return true;if((c.from.startsWith(`ESC${i}.`)&&/\.[UVW]$/.test(c.from)&&c.to.startsWith(`M${i}.`))||(c.to.startsWith(`ESC${i}.`)&&/\.[UVW]$/.test(c.to)&&c.from.startsWith(`M${i}.`)))return true}return false}
function render2D(){
 const svg=$('#wiringSvg');if(!svg)return;syncOptionalNodesFromParts();svg.innerHTML='';svgPorts={};const defs=E('defs');defs.innerHTML='<filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".55"/></filter><filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="flowGlow"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';svg.appendChild(defs);
 svg.onclick=()=>{selectedWireId=null;selPort=null;selectedWireNodeId=null;render2D()};
 draw2DFrame(svg);drawNode(svg,'BAT','3S LiPo / XT60',190,95,[],[['+','power'],['-','ground']],'DRAG • BATTERY • F / R');drawNode(svg,'ESC2','ESC2 • FRONT LEFT',185,165,[['U','u'],['V','v'],['W','w']],[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],'DRAG • F / R');drawNode(svg,'ESC1','ESC1 • FRONT RIGHT',185,165,[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],[['U','u'],['V','v'],['W','w']],'DRAG • F / R');drawNode(svg,'ESC3','ESC3 • REAR LEFT',185,165,[['U','u'],['V','v'],['W','w']],[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],'DRAG • F / R');drawNode(svg,'ESC4','ESC4 • REAR RIGHT',185,165,[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],[['U','u'],['V','v'],['W','w']],'DRAG • F / R');drawMotorNode(svg,'M1','M1 • A2212');drawMotorNode(svg,'M2','M2 • A2212');drawMotorNode(svg,'M3','M3 • A2212');drawMotorNode(svg,'M4','M4 • A2212');drawFCNode(svg);drawOptionalNodes(svg);
 const wires=E('g',{class:'wire-layer-v8'});state.connections.forEach((c,i)=>{const d=wireRoute(c);if(!d)return;const id=c.id||(c.id=`w${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`),path=E('path',{d,class:`wire-v8 ${selectedWireId===id?'selected':''} ${wireCarriesCurrent(c)?'current-flow':''}`,stroke:cssW(c.from),'stroke-width':wireGauge(c),'data-wire-id':id});path.onclick=e=>{e.stopPropagation();selectedWireId=id;selectedWireNodeId=null;render2D()};wires.appendChild(path)});svg.appendChild(wires);
 drawFcPortOverlay(svg);validate2D();updateMotorTestUI();persistWireLayout()
}
function choosePort(k){if(!wireMode){notify('Press W or click OBJECT/WIRE MODE to enable wire connections.','bad');return}if(!selPort){selPort=k;render2D();return}if(k===selPort){selPort=null;render2D();return}if(!state.connections.some(c=>(c.from===selPort&&c.to===k)||(c.from===k&&c.to===selPort))){wireRemember();state.connections.push({from:selPort,to:k,new:true,id:`w${Date.now()}-${Math.random().toString(36).slice(2,6)}`});animatePlug(selPort,k);setTimeout(()=>{state.connections.forEach(c=>c.new=false);render2D()},700)}selPort=null;render2D();rebuild3DWires();rebuildSolder()}
function deleteSelectedWire(){if(!selectedWireId){notify('Select a wire first.','bad');return}wireRemember();state.connections=state.connections.filter(c=>c.id!==selectedWireId);selectedWireId=null;render2D();rebuild3DWires();rebuildSolder();notify('Selected wire deleted.')}
function electricalIssues(){
 const issues=[],conns=state.connections;
 const has=(a,b)=>conns.some(c=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a));
 const isHigh=k=>/^BAT\.\+$|^PDB\.(BAT\+|E\d\+)$|^ESC\d\.PWR\+$/.test(k),isGround=k=>/^BAT\.-$|PWR-$|GND$|-G$/.test(k),isLow=k=>/^FC\.(ESC|GPIO|RX|I2C)/.test(k);
 conns.forEach(c=>{
   if((isHigh(c.from)&&isGround(c.to))||(isHigh(c.to)&&isGround(c.from)))issues.push({level:'bad',text:`Danger: positive connected to ground — ${c.from} ↔ ${c.to}`});
   if((isHigh(c.from)&&isLow(c.to))||(isHigh(c.to)&&isLow(c.from)))issues.push({level:'bad',text:`Danger: high-current battery voltage connected to FC low-voltage pin — ${c.from} ↔ ${c.to}`})
 });
 if(has('BAT.+','PDB.BAT-')||has('BAT.-','PDB.BAT+'))issues.push({level:'bad',text:'Battery polarity reversed at PDB XT60.'});
 for(let i=1;i<=4;i++){
   const sig=conns.find(c=>c.from===`ESC${i}.SIG`||c.to===`ESC${i}.SIG`);
   if(sig){const other=sig.from===`ESC${i}.SIG`?sig.to:sig.from;if(other!==`FC.ESC${i}-S`)issues.push({level:'bad',text:`ESC${i} signal is on ${other}; expected FC.ESC${i}-S.`})}
   const anyCtrl=['SIG','5V','GND'].some(p=>conns.some(c=>c.from===`ESC${i}.${p}`||c.to===`ESC${i}.${p}`));
   if(anyCtrl&&!conns.some(c=>(c.from===`ESC${i}.GND`&&c.to===`FC.ESC${i}-G`)||(c.to===`ESC${i}.GND`&&c.from===`FC.ESC${i}-G`)))issues.push({level:'warn',text:`ESC${i} control ground is missing.`});
   if(!phaseMap(i))issues.push({level:'warn',text:`M${i}: U/V/W phase set is incomplete or duplicated.`})
 }
 const fcUse={};conns.forEach(c=>[c.from,c.to].filter(k=>k.startsWith('FC.')).forEach(k=>(fcUse[k]??=[]).push(c)));
 Object.entries(fcUse).filter(([,v])=>v.length>1).forEach(([k,v])=>issues.push({level:'warn',text:`FC pin ${k} is used by ${v.length} wires.`}));
 conns.forEach(c=>{const t=c.from+' '+c.to;if(/OPT_sensor_.*\.SDA.*FC\.I2C-SCL|FC\.I2C-SCL.*OPT_sensor_.*\.SDA/.test(t)||/OPT_sensor_.*\.SCL.*FC\.I2C-SDA|FC\.I2C-SDA.*OPT_sensor_.*\.SCL/.test(t))issues.push({level:'warn',text:'I²C SDA/SCL appear swapped.'})});
 const bv=state.sim.batteryV||12.2;if(bv>16.8||bv<6.0)issues.push({level:'bad',text:`Battery ${bv.toFixed(1)} V is outside the 30A ESC 2S–4S training range.`});
 return issues
}
function validate2D(){
 const b=$('#wireValidation');if(!b)return;
 const fixed=requiredWires.filter(([a,z])=>!/\.[UVW]$/.test(a)&&!/\.[UVW]$/.test(z)),missingPairs=fixed.filter(([a,z])=>!conn(a,z)),batteryMissing=missingPairs.filter(([a,z])=>a.startsWith('BAT.')||z.startsWith('BAT.')).length,nonBatteryMissing=missingPairs.length-batteryMissing,phaseReady=[1,2,3,4].filter(i=>phaseMap(i)).length,issues=electricalIssues();
 const critical=issues.filter(x=>x.level==='bad').length,warns=issues.filter(x=>x.level==='warn').length,powerLine=nonBatteryMissing?`${nonBatteryMissing} fixed power/FC connection(s) missing`:(batteryMissing?`XT60 battery + / − not connected yet • press Connect battery XT60`:'✓ Fixed power + FC wiring complete');
 b.innerHTML=`<div class="check ${critical?'bad':'ok'}">${critical?`⚠ ${critical} critical electrical issue(s)`:'✓ No critical polarity / rail conflict'}</div><div class="check ${missingPairs.length?'warn':'ok'}">${powerLine}</div><div class="check ${phaseReady===4?'ok':'warn'}">${phaseReady}/4 motors have three unique U/V/W phase connections</div><div class="check ${warns?'warn':'ok'}">${warns?`${warns} wiring warning(s)`:'✓ Pin allocation checks pass'}</div><div class="electrical-issue-list">${issues.slice(0,8).map(x=>`<div class="${x.level}">${x.level==='bad'?'⚠':'○'} ${x.text}</div>`).join('')||'<div class="ok">✓ Electrical validation ready</div>'}</div><div class="check ${(selectedWireId||selectedWireNodeId)?'ok':'warn'}">${selectedWireId?'Wire selected — Delete removes it':selectedWireNodeId?'Object selected — F flip • R rotate • Delete removes it':'Click a wire or object to select. Press W for wire mode.'}</div>`
}
function addOptionalWireDevice(){const type=$('#optionalWireDevice')?.value||'servo',threeType=optionalThreeType(type);if(!threeType){notify('Unsupported optional device.','bad');return}if(!state.parts.some(p=>p.type==='fc')){notify('Mount the ZEBJUS FC first, then add optional devices.','bad');return}const free=(slots[threeType]||[]).find(s=>!state.parts.some(p=>p.type===threeType&&p.slotId===s.id));if(!free){notify(`${product(threeType)?.name||threeType} has no free mounting slot.`,'bad');return}historyPush();wireRemember();install(threeType,free,true);ensureOptionalWireNode(type,free.id);selectedWireNodeId=optionalNodeId(type,free.id);renderAssemblyUI();render2D();showGuides();notify(`${optionalNodeDefinition({type}).title} added in 2D and attached in 3D.`)}
function updateMotorTestUI(){for(let i=1;i<=4;i++){const e=motorElectrical(i),active=motorActive(i),el=$(`#wireM${i}State`);if(el){el.textContent=!e.ready?'OPEN':active?`${e.dir} • RUN`:`${e.dir} • READY`;el.className=active?(e.reverse?'reverse':'running'):''}const dir=$(`#motorDir${i}`);if(dir){dir.textContent=e.ready?e.dir:'OPEN';dir.setAttribute('class',`motor-dir-2d ${e.reverse?'reverse':''}`)}}const pwm=$('#wireThrottle');if($('#wirePwmOut')&&pwm)$('#wirePwmOut').textContent=`${pwm.value} µs`;if($('#wireRunState')){$('#wireRunState').textContent=wireMotorRun?'RUNNING':'STOPPED';$('#wireRunState').className='status '+(wireMotorRun?'good':'')}}
function animate2DMotors(now=performance.now()){requestAnimationFrame(animate2DMotors);const dt=Math.min(.05,(now-wireAnimLast)/1000);wireAnimLast=now;const pwm=+($('#wireThrottle')?.value||1000),speed=pwm<1100?0:clamp((pwm-1100)/900,0,1);let activeCount=0;for(let i=1;i<=4;i++){if(motorActive(i)){activeCount++;const e=motorElectrical(i),sign=e.dir==='CW'?1:-1;wireMotorAngle[i-1]=(wireMotorAngle[i-1]+sign*dt*(260+speed*1500))%360}const r=$(`#motorRotor${i}`);if(r)r.style.transform=`rotate(${wireMotorAngle[i-1]}deg)`}updateMotorAudio('wire',wireMotorRun&&activeCount?speed*(.45+.55*activeCount/4):0,.08*activeCount/4);if(wireMotorRun&&Math.floor(now/150)%2===0)updateMotorTestUI()}
function initWiringControls(){
 $('#wireUndoBtn').onclick=wireUndo;$('#deleteWireBtn').onclick=deleteSelectedWire;$('#deleteNodeBtn').onclick=deleteSelectedObject;$('#centerWireLayoutBtn').onclick=resetWireLayout;$('#addOptionalWireDevice').onclick=addOptionalWireDevice;const mode=$('#wireModeBadge');if(mode)mode.onclick=()=>setWireMode();
 $('#wireRunBtn').onclick=()=>{wireMotorRun=!wireMotorRun;if(wireMotorRun)ensureMotorAudio('wire');else silenceMotorAudio('wire');render2D()};
 $('#wireThrottle').oninput=()=>{if(wireMotorRun)ensureMotorAudio('wire');render2D()};$('#wireAllMotors').onchange=()=>render2D();[1,2,3,4].forEach(i=>$(`#wireM${i}`).onchange=()=>render2D());
 window.addEventListener('pointermove',e=>{if(!wireDrag)return;const p=svgLocalPoint($('#wiringSvg'),e.clientX,e.clientY);setNodePos(wireDrag.id,p.x-wireDrag.dx,p.y-wireDrag.dy);render2D()});window.addEventListener('pointerup',()=>{if(wireDrag){wireDrag=null;document.body.style.userSelect='';persistWireLayout()}});
 window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;if(!$('#tab-wiring')?.classList.contains('active'))return;const k=(e.key||'').toLowerCase();if(k==='w'&&!e.repeat){e.preventDefault();setWireMode();return}if(k==='f'&&!e.repeat){e.preventDefault();flipSelectedNode();return}if(k==='r'&&!e.repeat){e.preventDefault();rotateSelectedNode();return}if((e.key==='Delete'||e.key==='Backspace')){e.preventDefault();deleteSelectedObject()}});requestAnimationFrame(animate2DMotors);setWireMode(false,true)
}
/* ==================== V15 TRIPOD PID SIMULATOR ==================== */
let sScene,sCamera,sRenderer,sControls,sPivot,sDrone,simProps=[],simPropBlurs=[],sDust=null,sDustBase=[],sDownwash=[],sDownwashCones=[],sLast=performance.now(),chart=[],simInitialized=false,simMotorBank=null;
const keyDefaults={rollLeft:'ArrowLeft',rollRight:'ArrowRight',pitchForward:'ArrowUp',pitchBack:'ArrowDown',throttleUp:'w',throttleDown:'s',yawLeft:'a',yawRight:'d',run:'r'};
let keyMap=(()=>{try{return{...keyDefaults,...JSON.parse((localStorage.getItem('zebjus-v15-keys')||localStorage.getItem('zebjus-v10-keys')||localStorage.getItem('zebjus-v9-keys'))||'{}')}}catch{return{...keyDefaults}}})();
const heldKeys=new Set();let keyCaptureAction=null;
function keyLabel(k){return k===' '?'Space':k}
function simClone(type,slotId){const c=product(type);let path=c?.asset;if(type==='prop'&&(slotId==='M2'||slotId==='M4'))path=c.assetCCW;const g=(path?cloneAsset(path):null)||procedural(type,slotId);if(type==='fc')decoratePart(g,'fc',slotId);return g}
function buildFinalSimDrone(){
 const root=new THREE.Group(),baseY=.68;simProps=[];simPropBlurs=[];
 const add=(type,slot)=>{
   const o=simClone(type,slot.id);o.position.set(slot.p[0],slot.p[1]-baseY,slot.p[2]);o.rotation.y=slot.r||0;o.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true}});root.add(o);
   if(type==='prop'){simProps.push(o);const blur=new THREE.Mesh(new THREE.CircleGeometry(1.55,64),new THREE.MeshBasicMaterial({color:0xd9e5ea,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));blur.rotation.x=-Math.PI/2;blur.position.y=.13;o.add(blur);simPropBlurs.push(blur)}
 };
 slots.bottomPlate.forEach(s=>add('bottomPlate',s));slots.armRed.forEach(s=>add('armRed',s));slots.armWhite.forEach(s=>add('armWhite',s));slots.topPlate.forEach(s=>add('topPlate',s));slots.guard.forEach(s=>add('guard',s));slots.motor.forEach(s=>add('motor',s));slots.esc.forEach(s=>add('esc',s));slots.fcTape.forEach(s=>add('fcTape',s));slots.fc.forEach(s=>add('fc',s));slots.batteryStrap.forEach(s=>add('batteryStrap',s));slots.battery.forEach(s=>add('battery',s));slots.prop.forEach(s=>add('prop',s));root.scale.setScalar(.58);return root
}
function simCylinderBetween(a,b,r,color,parent){a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const d=b.clone().sub(a),L=d.length(),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,18),new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.42}));m.position.copy(a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());m.castShadow=true;parent.add(m);return m}
function buildTripod(){
 const g=new THREE.Group(),black=0x11161a,dark=0x20272c;simCylinderBetween([0,.3,0],[0,3.35,0],.13,black,g);simCylinderBetween([0,3.1,0],[0,3.46,0],.22,dark,g);
 for(const a of[0,2*Math.PI/3,4*Math.PI/3]){const foot=[Math.cos(a)*1.9,.08,Math.sin(a)*1.9],hub=[0,.55,0];simCylinderBetween(hub,foot,.09,black,g);simCylinderBetween([0,.52,0],[Math.cos(a)*1.20,.45,Math.sin(a)*1.20],.055,dark,g);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.18,18),new THREE.MeshStandardMaterial({color:0x252c31,roughness:.6}));cap.position.set(...foot);cap.rotation.z=Math.PI/2;g.add(cap)}return g
}
function buildDownwash(){
 sDownwash=[];sDownwashCones=[];const g=new THREE.Group(),centers=[[1.72,0,1.72],[-1.72,0,1.72],[-1.72,0,-1.72],[1.72,0,-1.72]];
 centers.forEach((c,mi)=>{
   const cone=new THREE.Mesh(new THREE.ConeGeometry(.58,2.0,32,1,true),new THREE.MeshBasicMaterial({color:0x83cde8,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));cone.position.set(c[0],-1.0,c[2]);cone.rotation.z=Math.PI;g.add(cone);sDownwashCones.push({cone,motor:mi});
   for(let j=0;j<6;j++){const ring=new THREE.Mesh(new THREE.TorusGeometry(.30,.012,8,40),new THREE.MeshBasicMaterial({color:0xa9ddf1,transparent:true,opacity:0,depthWrite:false}));ring.rotation.x=Math.PI/2;ring.position.set(c[0],-.24-j*.38,c[2]);g.add(ring);sDownwash.push({ring,motor:mi,phase:j/6})}
 });return g
}
function ensureSimMotorBank(){
 const ac=getAudioCtx();if(!ac||simMotorBank)return simMotorBank;
 simMotorBank=[0,1,2,3].map(i=>{const o=ac.createOscillator(),g=ac.createGain(),f=ac.createBiquadFilter();o.type=i%2?'sine':'triangle';o.detune.value=[-8,4,11,-3][i];g.gain.value=.0001;f.type='lowpass';f.frequency.value=1800;o.connect(f);f.connect(g);g.connect(ac.destination);o.start();return{o,g,f}});return simMotorBank
}
function updateSimMotorBank(mix){
 if(!simMotorBank)return;const t=getAudioCtx()?.currentTime||0;mix.forEach((v,i)=>{const s=clamp(v/100,0,1),m=simMotorBank[i],hz=70+s*440+i*3;m.o.frequency.setTargetAtTime(hz,t,.035);m.f.frequency.setTargetAtTime(800+s*3000,t,.04);m.g.gain.setTargetAtTime(state.sim.running&&soundEnabled?((.0015+s*.0065)*soundVolume):.0001,t,.07)})
}
function silenceSimMotorBank(){if(!simMotorBank)return;const t=getAudioCtx()?.currentTime||0;simMotorBank.forEach(m=>m.g.gain.setTargetAtTime(.0001,t,.06))}
function ensureSim(){
 if(simInitialized)return true;
 try{initSim();simInitialized=true;return true}catch(e){console.error('[ZEBJUS] Tripod simulator init failed:',e);const box=$('#simThree');if(box)box.innerHTML=`<div class="runtime-error-card"><b>Tripod 3D unavailable</b><span>${String(e?.message||e)}</span><small>Assembly, wiring, calibration, PID editor and Python Lab remain available.</small></div>`;notify('Tripod simulator 3D could not start. Other lab tools remain active.','bad');return false}
}
function initSim(){
 const e=$('#simThree');if(!e)throw new Error('Tripod simulator container missing');const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||650);
 sScene=new THREE.Scene();sScene.background=new THREE.Color(0x101b24);sCamera=new THREE.PerspectiveCamera(46,w/h,.1,1000);sCamera.position.set(9,6.4,10.8);
 sRenderer=new THREE.WebGLRenderer({antialias:true});sRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));sRenderer.setSize(w,h);sRenderer.shadowMap.enabled=true;sRenderer.outputColorSpace=THREE.SRGBColorSpace;e.appendChild(sRenderer.domElement);
 sControls=new MiniOrbitControls(sCamera,sRenderer.domElement);sControls.target.set(0,2.7,0);sControls.enableDamping=true;
 sScene.add(new THREE.AmbientLight(0xffffff,.72));sScene.add(new THREE.HemisphereLight(0xeaf7ff,0x374550,2.25));const l=new THREE.DirectionalLight(0xffffff,3.1);l.position.set(6,10,7);l.castShadow=true;sScene.add(l);const rim=new THREE.DirectionalLight(0x66d9ff,1.25);rim.position.set(-6,5,-4);sScene.add(rim);const warm=new THREE.PointLight(0xffd6aa,1.25,18);warm.position.set(4,5,2);sScene.add(warm);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshStandardMaterial({color:0x243039,roughness:.82,metalness:.05}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;sScene.add(floor);sScene.add(new THREE.GridHelper(28,28,0x48606e,0x324651));sScene.add(buildTripod());
 const dustCount=300,pos=new Float32Array(dustCount*3);sDustBase=[];for(let i=0;i<dustCount;i++){const a=Math.random()*Math.PI*2,r=.8+Math.random()*4.2,y=.025+Math.random()*.23;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=y;pos[i*3+2]=Math.sin(a)*r;sDustBase.push({a,r,y,seed:Math.random()*10})}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pos,3));const dm=new THREE.PointsMaterial({color:0xc2ae91,size:.06,transparent:true,opacity:0,depthWrite:false});sDust=new THREE.Points(dg,dm);sScene.add(sDust);
 sPivot=new THREE.Group();sPivot.position.set(0,3.48,0);sScene.add(sPivot);sDrone=buildFinalSimDrone();sPivot.add(sDrone);sPivot.add(buildDownwash());const clampG=new THREE.Group();simCylinderBetween([-.30,0,0],[.30,0,0],.09,0x161c20,clampG);sPivot.add(clampG);
 syncQuickPid();$('#simFlightMode').value=state.sim.flightMode;updateSimPidModeUI();
 $('#simRunBtn').onclick=toggleSimRun;$('#simResetBtn').onclick=resetSim;$('#simDisturbBtn').onclick=toggleDisturbMode;$('#simCalibrateLevelBtn').onclick=calibrateSimLevel;$('#simFlightMode').onchange=e=>{state.sim.flightMode=e.target.value;if(state.sim.flightMode==='rate'){state.sim.rateHoldRoll=state.sim.roll;state.sim.rateHoldPitch=state.sim.pitch;state.sim.rateRollStickActive=false;state.sim.ratePitchStickActive=false}updateSimPidModeUI();resetSimControllersOnly();chart=[]};$('#simApplyPidBtn').onclick=applyQuickPid;
 initSticks();initManualDisturbance();initSimEnvironmentControls();initPidLearning();renderKeySettings();window.addEventListener('resize',resizeSim);window.addEventListener('keydown',simKeyDown);window.addEventListener('keyup',simKeyUp);requestAnimationFrame(simLoop)
}
function pidInput(id){return +($(id)?.value||0)}
function applyQuickPid(){
 [['rateRoll','simRateRoll'],['ratePitch','simRatePitch'],['rateYaw','simRateYaw'],['angleRoll','simAngleRoll'],['anglePitch','simAnglePitch']].forEach(([k,p])=>Object.assign(state.pid[k],{P:pidInput('#'+p+'P'),I:pidInput('#'+p+'I'),D:pidInput('#'+p+'D')}));
 resetSimControllersOnly();renderPid();updatePidCoach();notify(`${state.sim.flightMode==='rate'?'Rate Hold capture + Rate PID':'Calibrated Angle + Rate PID; Yaw Rate PID'} applied.`)
}
function syncQuickPid(){
 const map=[['rateRoll','simRateRoll'],['ratePitch','simRatePitch'],['rateYaw','simRateYaw'],['angleRoll','simAngleRoll'],['anglePitch','simAnglePitch']];
 map.forEach(([k,p])=>['P','I','D'].forEach(v=>{const e=$('#'+p+v);if(e)e.value=state.pid[k][v]}))
}
function updateSimPidModeUI(){
 const angle=state.sim.flightMode==='angle',panel=$('#simAnglePidPanel'),title=$('#simPidTitle'),badge=$('#simPidModeBadge');
 if(panel)panel.classList.toggle('mode-hidden',!angle);
 if(title)title.textContent=angle?'Angle Mode: calibrated Roll/Pitch level → Angle PID → Rate PID • Yaw Rate':'Rate Hold: captured Roll/Pitch attitude → Rate PID • Yaw Rate';
 if(badge){badge.textContent=angle?'ANGLE':'RATE HOLD';badge.className='status '+(angle?'good':'')}
 const loopSel=$('#teachLoop');if(loopSel){if(state.sim.teachAxis==='yaw'||!angle){state.sim.teachLoop='rate';loopSel.value='rate';loopSel.disabled=true}else loopSel.disabled=false}
 updatePidCoach()
}
function initSimEnvironmentControls(){
 const bind=(id,key,out,fmt)=>{const e=$(id),o=$(out);if(!e)return;e.value=state.sim[key];const fn=()=>{state.sim[key]=+e.value;if(o)o.textContent=fmt(state.sim[key]);validate2D?.()};e.oninput=fn;fn()};
 bind('#simBatteryV','batteryV','#simBatteryOut',v=>v.toFixed(1)+' V');bind('#simPayload','payloadG','#simPayloadOut',v=>Math.round(v)+' g');bind('#simCgX','cgX','#simCgXOut',v=>Math.round(v)+' mm');bind('#simCgY','cgY','#simCgYOut',v=>Math.round(v)+' mm');bind('#simWind','wind','#simWindOut',v=>Math.round(v)+'%');bind('#simMotorLag','motorLag','#simLagOut',v=>v.toFixed(2)+' s')
}
function toggleSimRun(){
 state.sim.running=!state.sim.running;$('#simRunBtn').textContent=state.sim.running?'STOP':'RUN';$('#simRunBtn').classList.toggle('danger',state.sim.running);
 if(state.sim.running){ensureMotorAudio('sim');ensureSimMotorBank()}else{heldKeys.clear();silenceMotorAudio('sim');silenceSimMotorBank()}
}
function resetSimControllersOnly(){
 Object.assign(state.sim,{rollI:0,pitchI:0,yawI:0,prevRollErr:0,prevPitchErr:0,prevYawErr:0,angleRollI:0,anglePitchI:0,prevAngleRollErr:0,prevAnglePitchErr:0,pidLive:{P:0,I:0,D:0,error:0,target:0,actual:0,loop:'RATE'}})
}
function calibrateSimLevel(){
 const s=state.sim;s.levelTrimRoll=s.roll;s.levelTrimPitch=s.pitch;s.targetRoll=s.levelTrimRoll;s.targetPitch=s.levelTrimPitch;
 resetSimControllersOnly();chart=[];notify(`Level calibrated • Roll ${s.levelTrimRoll.toFixed(1)}° • Pitch ${s.levelTrimPitch.toFixed(1)}°`,'good');updatePidCoach()
}
function resetSimDynamics(resetAttitude=true){
 const s=state.sim,keep=resetAttitude?{roll:s.levelTrimRoll||0,pitch:s.levelTrimPitch||0,yaw:0}:{roll:s.roll,pitch:s.pitch,yaw:s.yaw};
 Object.assign(s,{...keep,rollRate:0,pitchRate:0,yawRate:0,rollI:0,pitchI:0,yawI:0,prevRollErr:0,prevPitchErr:0,prevYawErr:0,angleRollI:0,anglePitchI:0,prevAngleRollErr:0,prevAnglePitchErr:0,cmdRoll:0,cmdPitch:0,cmdYaw:0,vibration:0,liftY:0,lastMix:[0,0,0,0],motorActual:[0,0,0,0],targetRoll:s.levelTrimRoll||0,targetPitch:s.levelTrimPitch||0,targetYawRate:0,rateHoldRoll:s.levelTrimRoll||0,rateHoldPitch:s.levelTrimPitch||0,rateRollStickActive:false,ratePitchStickActive:false,pidLive:{P:0,I:0,D:0,error:0,target:0,actual:0,loop:'RATE'}});
 chart=[]
}
function resetSim(){state.sim.running=false;state.sim.throttle=1000;state.sim.disturbing=false;resetSimDynamics(true);silenceMotorAudio('sim');silenceSimMotorBank();$('#simRunBtn').textContent='RUN';$('#simRunBtn').classList.remove('danger');setStickVisual('right',0,0);setStickVisual('left',0,1);updateStickText()}
function resizeSim(){if(!sRenderer||!sCamera)return;const e=$('#simThree');if(!e)return;const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||650);sCamera.aspect=w/h;sCamera.updateProjectionMatrix();sRenderer.setSize(w,h)}
function avgPid(keys,v){return keys.reduce((s,k)=>s+state.pid[k][v],0)/keys.length}
function tuneQuality(){
 const s=state.sim,axis=s.teachAxis,k='rate'+axis[0].toUpperCase()+axis.slice(1),r=state.pid[k],angle=axis==='yaw'?null:state.pid['angle'+axis[0].toUpperCase()+axis.slice(1)];
 let score=0;
 if(axis==='yaw'){score+=Math.abs(r.P-3)/2.4+Math.abs(r.I-13)/18+Math.abs(r.D-0)/.06}
 else score+=Math.abs(r.P-.9)/.75+Math.abs(r.I-15)/15+Math.abs(r.D-.035)/.05;
 if(s.flightMode==='angle'&&angle)score+=Math.abs(angle.P-3)/2.2+Math.abs(angle.I)/1.5+Math.abs(angle.D)/.12;
 if(score<1.2)return{label:'STABLE',cls:'tune-stable',vib:.025};
 if((axis!=='yaw'&&r.P<.45)||(axis==='yaw'&&r.P<1.3))return{label:'UNDER-TUNED',cls:'tune-under',vib:.02};
 if((axis!=='yaw'&&r.P>1.8)||(axis==='yaw'&&r.P>4.5)||r.I>28||(axis!=='yaw'&&r.D<.006))return{label:'OSCILLATING',cls:'tune-over',vib:.34};
 return{label:'NEEDS TUNING',cls:'tune-under',vib:.08}
}
function wrapAngle(a){while(a>180)a-=360;while(a<-180)a+=360;return a}
function outerAxis(axis,target,current,dt){
 const k='angle'+axis,ik='angle'+axis+'I',pk='prevAngle'+axis+'Err',err=target-current;
 state.sim[ik]=clamp((state.sim[ik]||0)+err*dt,-45,45);
 const der=(err-(state.sim[pk]||0))/Math.max(dt,.004);state.sim[pk]=err;const pid=state.pid[k];
 const pTerm=err*pid.P,iTerm=state.sim[ik]*pid.I,dTerm=der*pid.D;
 if(state.sim.teachAxis===axis.toLowerCase()&&state.sim.teachLoop==='angle')state.sim.pidLive={P:pTerm,I:iTerm,D:dTerm,error:err,target,actual:current,loop:'ANGLE'};
 return clamp(pTerm+iTerm+dTerm,-220,220)
}
function rateAxis(axis,target,current,dt){
 const k='rate'+axis,ik=axis.toLowerCase()+'I',pk='prev'+axis+'Err',err=target-current;
 state.sim[ik]=clamp((state.sim[ik]||0)+err*dt,-110,110);
 const der=(err-(state.sim[pk]||0))/Math.max(dt,.004);state.sim[pk]=err;const pid=state.pid[k],pTerm=err*pid.P,iTerm=state.sim[ik]*pid.I*.012,dTerm=der*pid.D;
 if(state.sim.teachAxis===axis.toLowerCase()&&state.sim.teachLoop==='rate')state.sim.pidLive={P:pTerm,I:iTerm,D:dTerm,error:err,target,actual:current,loop:'RATE'};
 return pTerm+iTerm+dTerm
}
function toggleDisturbMode(){
 state.sim.disturbMode=!state.sim.disturbMode;state.sim.disturbing=false;const b=$('#simDisturbBtn');if(b){b.textContent=`Manual tilt: ${state.sim.disturbMode?'ON':'OFF'}`;b.classList.toggle('primary',state.sim.disturbMode);b.classList.toggle('ghost',!state.sim.disturbMode)}if(sControls)sControls.enabled=!state.sim.disturbMode
}
function initManualDisturbance(){
 const c=sRenderer?.domElement;if(!c)return;let start=null;
 c.addEventListener('pointerdown',e=>{if(!state.sim.disturbMode)return;e.preventDefault();start={x:e.clientX,y:e.clientY,roll:state.sim.roll,pitch:state.sim.pitch};state.sim.disturbing=true;try{c.setPointerCapture(e.pointerId)}catch{}});
 c.addEventListener('pointermove',e=>{if(!start||!state.sim.disturbMode)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;state.sim.roll=clamp(start.roll+dx*.12,-38,38);state.sim.pitch=clamp(start.pitch+dy*.12,-38,38);state.sim.rollRate=dx*.18;state.sim.pitchRate=dy*.18});
 const end=()=>{start=null;state.sim.disturbing=false};c.addEventListener('pointerup',end);c.addEventListener('pointercancel',end)
}
function rateHoldTargetRate(axis,cmd,currentAngle){
 const s=state.sim,isRoll=axis==='Roll',active=Math.abs(cmd)>.035,activeKey=isRoll?'rateRollStickActive':'ratePitchStickActive',holdKey=isRoll?'rateHoldRoll':'rateHoldPitch';
 if(active){s[activeKey]=true;return cmd*220}
 if(s[activeKey]){s[holdKey]=currentAngle;s[activeKey]=false;if(!s.disturbing)notify(`${axis} attitude captured at ${currentAngle.toFixed(1)}°`,'good')}
 const err=s[holdKey]-currentAngle;
 return clamp(err*s.rateHoldGain,-150,150)
}
function simLoop(now){
 requestAnimationFrame(simLoop);const dt=Math.min(.035,(now-sLast)/1000||.016);sLast=now;const s=state.sim,q=tuneQuality(),authority=clamp((s.throttle-1050)/650,0,1);
 let uR=0,uP=0,uY=0,cmdR=s.cmdRoll,cmdP=s.cmdPitch,cmdY=s.cmdYaw;
 if(s.running){
   const keyR=(heldKeys.has(keyMap.rollRight)?1:0)-(heldKeys.has(keyMap.rollLeft)?1:0),keyP=(heldKeys.has(keyMap.pitchForward)?1:0)-(heldKeys.has(keyMap.pitchBack)?1:0),keyY=(heldKeys.has(keyMap.yawRight)?1:0)-(heldKeys.has(keyMap.yawLeft)?1:0);
   cmdR=keyR||s.cmdRoll;cmdP=keyP||s.cmdPitch;cmdY=keyY||s.cmdYaw;
   if(keyR||keyP)setStickVisual('right',cmdR,-cmdP);else if(!s.cmdRoll&&!s.cmdPitch)setStickVisual('right',0,0);
   if(keyY)setStickVisual('left',cmdY,(1500-s.throttle)/500);
   let targetRR=0,targetPR=0,targetYR=cmdY*180;s.targetYawRate=targetYR;
   if(s.flightMode==='angle'){
     s.targetRoll=s.levelTrimRoll+cmdR*26;s.targetPitch=s.levelTrimPitch-cmdP*26;
     targetRR=outerAxis('Roll',s.targetRoll,s.roll,dt);targetPR=outerAxis('Pitch',s.targetPitch,s.pitch,dt)
   }else{
     targetRR=rateHoldTargetRate('Roll',cmdR,s.roll);targetPR=rateHoldTargetRate('Pitch',-cmdP,s.pitch);
     s.targetRoll=s.rateHoldRoll;s.targetPitch=s.rateHoldPitch
   }
   uR=rateAxis('Roll',targetRR,s.rollRate,dt);uP=rateAxis('Pitch',targetPR,s.pitchRate,dt);uY=rateAxis('Yaw',targetYR,s.yawRate,dt);

   const payloadFactor=1+s.payloadG/900,inertiaR=1.0*payloadFactor,inertiaP=1.08*payloadFactor,inertiaY=1.35*payloadFactor,battFactor=Math.pow(clamp(s.batteryV/12.6,.65,1),2),gain=(.10+.90*authority)*battFactor;
   const wind=s.wind/100,windR=Math.sin(now*.0017)*wind*18,windP=Math.cos(now*.00135+1.3)*wind*15,cgR=s.cgX*.18,cgP=s.cgY*.18,passiveDrag=.38;
   if(!s.disturbing){
     s.rollRate+=((uR*gain*1.20+windR+cgR)/inertiaR-s.rollRate*passiveDrag)*dt;
     s.pitchRate+=((uP*gain*1.20+windP+cgP)/inertiaP-s.pitchRate*passiveDrag)*dt;
     s.yawRate+=((uY*gain*.70)/inertiaY-s.yawRate*.34)*dt
   }
   s.roll=clamp(s.roll+s.rollRate*dt,-45,45);s.pitch=clamp(s.pitch+s.pitchRate*dt,-45,45);s.yaw=wrapAngle(s.yaw+s.yawRate*dt)
 }else{s.rollRate*=Math.exp(-2*dt);s.pitchRate*=Math.exp(-2*dt);s.yawRate*=Math.exp(-2*dt)}

 const vib=s.running?q.vib*(.25+.75*authority):0,jr=Math.sin(now*.052)*vib,jp=Math.sin(now*.071+1.7)*vib*.82;
 sPivot.rotation.z=-rad(s.roll+jr);sPivot.rotation.x=rad(s.pitch+jp);sPivot.rotation.y=rad(s.yaw);

 const weightFactor=1+s.payloadG/1600,thrustFactor=Math.pow(clamp(s.batteryV/12.6,.60,1),2),tn=clamp((s.throttle-1000)/1000,0,1),thrustCurve=tn*tn*thrustFactor/weightFactor,targetLift=s.running?clamp((thrustCurve-.25)*1.35,-1,1)*.34:0;
 s.liftY+=(targetLift-s.liftY)*Math.min(1,dt*2.8);sPivot.position.y=3.48+s.liftY;

 const base=clamp((s.throttle-1000)/10,0,100),rc=clamp(uR*.045,-30,30),pc=clamp(uP*.045,-30,30),yc=clamp(uY*.028,-20,20),cmdMix=[base+rc-pc+yc,base-rc-pc-yc,base-rc+pc+yc,base+rc+pc-yc].map(v=>clamp(v,0,100));
 const lag=Math.max(.035,s.motorLag),aLag=1-Math.exp(-dt/lag);s.motorActual=s.motorActual.map((v,i)=>v+(cmdMix[i]-v)*aLag);const mix=s.motorActual;s.lastMix=mix;

 simProps.forEach((p,i)=>{const sp=mix[i]/100;p.rotation.y+=(i%2?1:-1)*dt*(1+sp*108)});
 simPropBlurs.forEach((b,i)=>{const sp=mix[i]/100;b.material.opacity=clamp((sp-.08)*.34,0,.27);b.scale.setScalar(1+sp*.08)});
 const avg=mix.reduce((a,b)=>a+b,0)/400,spread=(Math.max(...mix)-Math.min(...mix))/100;updateMotorAudio('sim',s.running?avg:0,spread);updateSimMotorBank(mix);

 const groundFactor=clamp(1-Math.max(0,s.liftY)/.55,.18,1);
 sDownwash.forEach(x=>{const sp=mix[x.motor]/100,t=(now*.00030*(.35+sp*3.8)+x.phase)%1;x.ring.position.y=-.22-t*(2.45+sp*.9);x.ring.scale.setScalar(.78+t*(.72+sp*.50));x.ring.material.opacity=s.running?clamp(sp*.33*(1-t)*groundFactor,0,.27):0});
 sDownwashCones.forEach(x=>{const sp=mix[x.motor]/100;x.cone.material.opacity=s.running?sp*.055*groundFactor:0;x.cone.scale.set(1+sp*.45,1+sp*.30,1+sp*.45)});
 if(sDust){const ar=sDust.geometry.attributes.position.array;sDust.material.opacity=s.running?clamp((avg-.06)*1.18*groundFactor,0,.72):0;for(let i=0;i<sDustBase.length;i++){const d=sDustBase[i],flow=(now*.00017*(.4+avg*4.5)+d.seed)%1,rr=d.r+flow*(1.4+avg*3.8)*groundFactor;ar[i*3]=Math.cos(d.a+flow*avg*.8)*rr;ar[i*3+2]=Math.sin(d.a+flow*avg*.8)*rr;ar[i*3+1]=d.y+Math.abs(Math.sin(flow*Math.PI))*avg*.42*groundFactor}sDust.geometry.attributes.position.needsUpdate=true}

 $('#simRoll').textContent=s.roll.toFixed(1)+'°';$('#simPitch').textContent=s.pitch.toFixed(1)+'°';$('#simYaw').textContent=s.yaw.toFixed(1)+'°';$('#simYawRate').textContent=s.yawRate.toFixed(1)+'°/s';$('#simLift').textContent=`${s.throttle} µs • ${(s.liftY>=0?'+':'')}${s.liftY.toFixed(2)} m`;
 $('#simRollTarget').textContent=`${s.flightMode==='angle'?'Level target':'Hold target'} ${(s.targetRoll||0).toFixed(1)}°`;$('#simPitchTarget').textContent=`${s.flightMode==='angle'?'Level target':'Hold target'} ${(s.targetPitch||0).toFixed(1)}°`;$('#simYawTarget').textContent=`Rate target ${s.targetYawRate.toFixed(1)}°/s`;
 const ts=$('#simTuneState');ts.textContent=q.label;ts.className=q.cls;mix.forEach((v,i)=>$('#m'+(i+1)).textContent=Math.round(v)+'%');updatePidCoach();
 if(Math.floor(now/75)%2===0){chart.push({r:s.roll,p:s.pitch,yr:s.yawRate,tr:s.targetRoll||0,tp:s.targetPitch||0,ty:s.targetYawRate});if(chart.length>180)chart.shift();drawChart()}
 updateStickText();sControls.update();sRenderer.render(sScene,sCamera);
 if(!state.fc.connected){state.telemetry.roll=s.roll;state.telemetry.pitch=s.pitch;state.telemetry.yaw=s.yaw;state.telemetry.gyroX=s.rollRate;state.telemetry.gyroY=s.pitchRate;state.telemetry.gyroZ=s.yawRate;telemetryUI()}
}
function drawChart(){
 const c=$('#simChart'),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.strokeStyle='#17344a';for(let i=0;i<5;i++){const y=i*h/4;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}
 const p=(k,col,scale=45,dash=[])=>{x.save();x.strokeStyle=col;x.lineWidth=2;x.setLineDash(dash);x.beginPath();chart.forEach((d,i)=>{const px=i/Math.max(1,chart.length-1)*w,py=h/2-(d[k]||0)/scale*h*.42;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke();x.restore()};
 if(state.sim.teachAxis==='roll'){p('tr','#f7f7f7',45,[7,5]);p('r','#53efbd',45)}
 else if(state.sim.teachAxis==='pitch'){p('tp','#f7f7f7',45,[7,5]);p('p','#54dbef',45)}
 else{p('ty','#f7f7f7',180,[7,5]);p('yr','#f59e0b',180)}
}
function applyPidPreset(name){
 const stable={rateRoll:{P:.9,I:15,D:.035},ratePitch:{P:.9,I:15,D:.035},rateYaw:{P:3,I:13,D:0},angleRoll:{P:3,I:0,D:0},anglePitch:{P:3,I:0,D:0}},p=JSON.parse(JSON.stringify(stable));
 if(name==='lowP'){p.rateRoll.P=p.ratePitch.P=.25;p.rateYaw.P=.8;p.angleRoll.P=p.anglePitch.P=1}
 if(name==='highP'){p.rateRoll.P=p.ratePitch.P=2.3;p.rateYaw.P=5.2;p.angleRoll.P=p.anglePitch.P=6.5}
 if(name==='lowI'){p.rateRoll.I=p.ratePitch.I=0;p.rateYaw.I=0}
 if(name==='highI'){p.rateRoll.I=p.ratePitch.I=34;p.rateYaw.I=30;p.angleRoll.I=p.anglePitch.I=2.5}
 if(name==='lowD'){p.rateRoll.D=p.ratePitch.D=0}
 if(name==='highD'){p.rateRoll.D=p.ratePitch.D=.12}
 state.pid=p;syncQuickPid();resetSimDynamics(false);renderPid();updatePidCoach();notify(`PID lesson preset: ${name}`,'good')
}
function pidLessonDiagnosis(){
 const axis=state.sim.teachAxis,k='rate'+axis[0].toUpperCase()+axis.slice(1),r=state.pid[k],a=axis==='yaw'?null:state.pid['angle'+axis[0].toUpperCase()+axis.slice(1)],notes=[];let label='STABLE RANGE';
 if((axis==='yaw'&&r.P<1.3)||(axis!=='yaw'&&r.P<.45)){label='P TOO LOW';notes.push('Correction is weak, so the drone takes too long to return toward the captured/commanded attitude.')}
 if((axis==='yaw'&&r.P>4.5)||(axis!=='yaw'&&r.P>1.8)){label='P TOO HIGH';notes.push('Correction is too aggressive; expect fast motor alternation and oscillation.')}
 if(r.I<2)notes.push('I is low; a constant CG or wind bias can remain.');
 if(r.I>28){label='I TOO HIGH';notes.push('Integral builds too much correction and can create slow wobble / wind-up.')}
 if(axis!=='yaw'){
   if(r.D<.008)notes.push('D is low; overshoot and bounce are less damped.');
   if(r.D>.09){label='D TOO HIGH';notes.push('D is high; corrections become harsh and noise-sensitive.')}
   if(state.sim.flightMode==='angle'&&a){
     if(a.P<1.4){label='ANGLE P LOW';notes.push('Angle recovery is slow because the outer loop requests a small return rate.')}
     if(a.P>5.5){label='ANGLE P HIGH';notes.push('Angle recovery asks for very high rates and can overshoot.')}
     if(a.I>1.2)notes.push('Angle I is high. Normally keep Angle I/D near zero until the Rate loop is stable.')
   }
 }
 if(!notes.length)notes.push(axis==='yaw'?'Yaw Rate PID is close to the teaching stable range; yaw still has no heading lock.':'Values are close to the teaching stable range; Roll/Pitch should return quickly to the captured Rate-Hold attitude or calibrated Angle target.');
 return{label,notes}
}
function updatePidCoach(){
 const d=pidLessonDiagnosis(),e=$('#pidCoach'),diag=$('#simDiagnosis'),live=state.sim.pidLive||{};
 if(e)e.innerHTML=`<b>${d.label}</b><span>${d.notes.join(' ')}</span>`;
 if(diag)diag.textContent=d.label;
 if($('#liveP'))$('#liveP').textContent=(live.P||0).toFixed(2);if($('#liveI'))$('#liveI').textContent=(live.I||0).toFixed(2);if($('#liveD'))$('#liveD').textContent=(live.D||0).toFixed(2);
 if($('#teachTarget'))$('#teachTarget').textContent=(live.target||0).toFixed(2);if($('#teachActual'))$('#teachActual').textContent=(live.actual||0).toFixed(2);if($('#teachError'))$('#teachError').textContent=(live.error||0).toFixed(2);if($('#teachLoopLive'))$('#teachLoopLive').textContent=live.loop||'RATE'
}
function initPidLearning(){
 $$('.pid-preset').forEach(b=>b.onclick=()=>applyPidPreset(b.dataset.preset));
 const axis=$('#teachAxis'),loop=$('#teachLoop');
 if(axis){axis.value=state.sim.teachAxis;axis.onchange=()=>{state.sim.teachAxis=axis.value;if(axis.value==='yaw'){state.sim.teachLoop='rate';if(loop){loop.value='rate';loop.disabled=true}}else if(loop)loop.disabled=state.sim.flightMode!=='angle';chart=[];updatePidCoach()}}
 if(loop){loop.value=state.sim.teachLoop;loop.disabled=state.sim.teachAxis==='yaw'||state.sim.flightMode!=='angle';loop.onchange=()=>{state.sim.teachLoop=loop.value;chart=[];updatePidCoach()}}
 updatePidCoach()
}
function initSticks(){bindStick($('#rightStick'),'right');bindStick($('#leftStick'),'left');setStickVisual('right',0,0);setStickVisual('left',0,1)}
function bindStick(el,which){let drag=false;const update=e=>{const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=(e.clientX-cx)/(r.width*.38),dy=(e.clientY-cy)/(r.height*.38),mag=Math.hypot(dx,dy),sc=mag>1?1/mag:1,x=clamp(dx*sc,-1,1),y=clamp(dy*sc,-1,1);if(which==='right'){state.sim.cmdRoll=x;state.sim.cmdPitch=-y;setStickVisual('right',x,y)}else{state.sim.cmdYaw=x;state.sim.throttle=Math.round(clamp(1500-y*500,1000,2000));setStickVisual('left',x,y)}updateStickText()};el.onpointerdown=e=>{drag=true;el.setPointerCapture?.(e.pointerId);update(e)};el.onpointermove=e=>{if(drag)update(e)};el.onpointerup=()=>{drag=false;if(which==='right'){state.sim.cmdRoll=0;state.sim.cmdPitch=0;setStickVisual('right',0,0)}else{state.sim.cmdYaw=0;setStickVisual('left',0,(1500-state.sim.throttle)/500)}updateStickText()}}
function setStickVisual(which,x,y){const k=$(which==='right'?'#rightStickKnob':'#leftStickKnob');if(k){k.style.left=`${50+x*30}%`;k.style.top=`${50+y*30}%`}}
function updateStickText(){if($('#rightStickRead'))$('#rightStickRead').textContent=`P ${Math.round(state.sim.cmdPitch*100)} • R ${Math.round(state.sim.cmdRoll*100)}`;if($('#leftStickRead'))$('#leftStickRead').textContent=`T ${state.sim.throttle} • Y ${Math.round(state.sim.cmdYaw*100)}`}
function simKeyDown(e){if(keyCaptureAction){e.preventDefault();keyMap[keyCaptureAction]=e.key;keyCaptureAction=null;renderKeySettings();return}if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;if(!$('#tab-sim')?.classList.contains('active'))return;const relevant=Object.values(keyMap).includes(e.key);if(!relevant)return;e.preventDefault();if(e.key===keyMap.run&&!e.repeat){toggleSimRun();return}heldKeys.add(e.key);if(e.key===keyMap.throttleUp)state.sim.throttle=clamp(state.sim.throttle+25,1000,2000);if(e.key===keyMap.throttleDown)state.sim.throttle=clamp(state.sim.throttle-25,1000,2000);setStickVisual('left',state.sim.cmdYaw,(1500-state.sim.throttle)/500)}
function simKeyUp(e){
 heldKeys.delete(e.key);
 if([keyMap.rollLeft,keyMap.rollRight,keyMap.pitchForward,keyMap.pitchBack].includes(e.key))setStickVisual('right',state.sim.cmdRoll,-state.sim.cmdPitch);
 if([keyMap.yawLeft,keyMap.yawRight].includes(e.key))setStickVisual('left',state.sim.cmdYaw,(1500-state.sim.throttle)/500)
}
function renderKeySettings(){const box=$('#keySettings');if(!box)return;const labels={rollLeft:'Roll left',rollRight:'Roll right',pitchForward:'Pitch forward',pitchBack:'Pitch back',throttleUp:'Throttle +',throttleDown:'Throttle −',yawLeft:'Yaw left',yawRight:'Yaw right',run:'Run / Stop'};box.innerHTML=Object.entries(labels).map(([k,l])=>`<div class="key-row"><span>${l}</span><button class="key-capture ${keyCaptureAction===k?'listening':''}" data-key-action="${k}">${keyCaptureAction===k?'PRESS KEY…':keyLabel(keyMap[k])}</button></div>`).join('');$$('.key-capture').forEach(b=>b.onclick=()=>{keyCaptureAction=b.dataset.keyAction;renderKeySettings()})}
function downloadBlob(name,data,type='text/plain'){const a=document.createElement('a'),u=URL.createObjectURL(new Blob([data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1200)}
function projectPayload(){return{version:'17.3',savedAt:new Date().toISOString(),guided:state.guided,step:state.step,parts:state.parts.filter(p=>!p.internal&&p.type!=='batteryStrap').map(p=>({type:p.type,slotId:p.slotId})),actions:[...state.doneActions],connections:state.connections,pid:state.pid,wireLayout,wireNodeTransforms,optionalWireNodes,sim:{batteryV:state.sim.batteryV,payloadG:state.sim.payloadG,cgX:state.sim.cgX,cgY:state.sim.cgY,wind:state.sim.wind,motorLag:state.sim.motorLag}}}
function exportProjectJson(){downloadBlob('ZEBJUS_F450_Project_V17_3.json',JSON.stringify(projectPayload(),null,2),'application/json')}
function importProjectJson(file){const r=new FileReader();r.onload=()=>{try{const d=JSON.parse(r.result);localStorage.setItem('zebjusF450V173',JSON.stringify(d));notify('Project imported • reloading.','good');setTimeout(()=>location.reload(),450)}catch(e){notify('Invalid project JSON.','bad')}};r.readAsText(file)}
function exportWiringSvg(){const svg=$('#wiringSvg');if(!svg)return;const xml=new XMLSerializer().serializeToString(svg);downloadBlob('ZEBJUS_F450_Wiring.svg',xml,'image/svg+xml')}
function exportWiringPng(){const svg=$('#wiringSvg');if(!svg)return;const xml=new XMLSerializer().serializeToString(svg),img=new Image(),url=URL.createObjectURL(new Blob([xml],{type:'image/svg+xml'}));img.onload=()=>{const c=document.createElement('canvas');c.width=1500;c.height=900;const x=c.getContext('2d');x.fillStyle='#07131d';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0);URL.revokeObjectURL(url);c.toBlob(b=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='ZEBJUS_F450_Wiring.png';a.click()},'image/png')};img.src=url}
function exportBom(){const rows=[['Item','Quantity','Rating / Notes']];products.filter(p=>state.parts.some(x=>x.type===p.type)).forEach(p=>rows.push([p.name,state.parts.filter(x=>x.type===p.type).length,Object.values(p.rating||{}).join(' • ')]));downloadBlob('ZEBJUS_F450_BOM.csv',rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n'),'text/csv')}
function exportProgressReport(){const issues=electricalIssues?.()||[],done=steps.filter((_,i)=>stepDone(i)).length,html=`<!doctype html><meta charset="utf-8"><title>ZEBJUS F450 Build Report</title><style>body{font:14px system-ui;max-width:900px;margin:40px auto}h1{color:#087f5b}.bad{color:#b42318}.ok{color:#087f5b}li{margin:7px}</style><h1>ZEBJUS F450 Build Report</h1><p>Generated: ${new Date().toLocaleString()}</p><p>Progress: ${done}/${steps.length} (${Math.round(done/steps.length*100)}%)</p><h2>Assembly</h2><ol>${steps.map((s,i)=>`<li class="${stepDone(i)?'ok':''}">${stepDone(i)?'✓':'○'} ${s.title}</li>`).join('')}</ol><h2>Electrical validation</h2>${issues.length?`<ul>${issues.map(x=>`<li class="${x.level}">${x.text}</li>`).join('')}</ul>`:'<p class="ok">✓ No electrical issues detected.</p>'}<h2>PID</h2><pre>${JSON.stringify(state.pid,null,2)}</pre>`;downloadBlob('ZEBJUS_F450_Progress_Report.html',html,'text/html')}
function applyPerformanceMode(){const m=$('#performanceMode')?.value||'balanced';try{localStorage.setItem('zebjus-v17-performance',m)}catch{};const ratio=m==='high'?Math.min(devicePixelRatio||1,2):m==='low'?1:Math.min(devicePixelRatio||1,1.5);if(renderer){renderer.setPixelRatio(ratio);renderer.shadowMap.enabled=m!=='low';resize3D()}if(sRenderer){sRenderer.setPixelRatio(ratio);sRenderer.shadowMap.enabled=m!=='low';resizeSim()}notify(`Graphics profile: ${m}`)}
function updateStartupDiagnostics(){const e=$('#startupDiagnostics');if(!e)return;const lines=[`V17.3 runtime: ${window.__zebjusAppLoaded?'loaded':'starting'}`,`WebGL: ${renderer?'OK':'pending / unavailable'}`,`Local Three.js: ${THREE.REVISION}`,`Storage: ${(()=>{try{localStorage.setItem('__zj','1');localStorage.removeItem('__zj');return'OK'}catch{return'blocked'}})()}`,`Service worker: ${'serviceWorker' in navigator?'supported':'not supported'}`,`Pixel ratio: ${devicePixelRatio||1}`,`Assembly FPS: ${runtimeFps||'--'}`,`Parts installed: ${state.parts.filter(p=>!p.internal).length}`,`Connections: ${state.connections.length}`];e.textContent=lines.join('\n')}
function registerOffline(){if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./service-worker.js').catch(()=>{})}
function updateAudioUi(){
 const en=$('#soundEnabled'),vol=$('#soundVolume'),out=$('#soundVolumeOut'),st=$('#soundState');
 if(en)en.checked=soundEnabled;if(vol)vol.value=Math.round(soundVolume*100);if(out)out.textContent=Math.round(soundVolume*100)+'%';
 if(st){st.textContent=soundEnabled?'ON':'MUTED';st.className='status '+(soundEnabled?'good':'')}
}
function initAudioSettings(){
 updateAudioUi();
 if($('#soundEnabled'))$('#soundEnabled').onchange=e=>{soundEnabled=e.target.checked;try{localStorage.setItem('zebjus-v171-sound',soundEnabled?'on':'off')}catch{};if(!soundEnabled){Object.keys(motorAudio).forEach(silenceMotorAudio);silenceSimMotorBank?.()}else tone(660,.06,'sine',.008);updateAudioUi()};
 if($('#soundVolume'))$('#soundVolume').oninput=e=>{soundVolume=clamp(+e.target.value/100,0,1);try{localStorage.setItem('zebjus-v171-volume',String(soundVolume))}catch{};updateAudioUi()}
}
function initSettings(){renderKeySettings();initAudioSettings();$('#saveKeysBtn').onclick=()=>{try{localStorage.setItem('zebjus-v15-keys',JSON.stringify(keyMap))}catch{}notify('Keyboard mapping saved.')};$('#resetKeysBtn').onclick=()=>{keyMap={...keyDefaults};try{localStorage.removeItem('zebjus-v15-keys');localStorage.removeItem('zebjus-v10-keys');localStorage.removeItem('zebjus-v9-keys')}catch{}renderKeySettings();notify('Default key mapping restored.')};
 $('#exportProjectBtn').onclick=exportProjectJson;$('#importProjectBtn').onclick=()=>$('#importProjectFile').click();$('#importProjectFile').onchange=e=>e.target.files[0]&&importProjectJson(e.target.files[0]);$('#exportSvgBtn').onclick=exportWiringSvg;$('#exportPngBtn').onclick=exportWiringPng;$('#exportBomBtn').onclick=exportBom;$('#exportReportBtn').onclick=exportProgressReport;$('#printWiringBtn').onclick=()=>window.print();$('#fullscreenBtn').onclick=()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();$('#applyPerformanceBtn').onclick=applyPerformanceMode;
 const perf=localStorage.getItem('zebjus-v17-performance')||'balanced';if($('#performanceMode'))$('#performanceMode').value=perf;setTimeout(()=>{applyPerformanceMode();updateStartupDiagnostics()},100)
}


/* FC / CAL / PID / PYTHON */
function fcLog(t){const e=$('#fcLog');e.textContent+=`\n${new Date().toLocaleTimeString()} ${t}`;e.scrollTop=e.scrollHeight}
function fcStatus(on){state.fc.connected=on;$('#fcBadge').textContent=on?'Connected':'Disconnected';$('#fcBadge').className='status '+(on?'good':'')}
function connectFc(){disconnectFc(false);const ip=$('#fcIp').value.trim(),path=$('#fcPath').value.trim(),pref=$('#fcProtocol').value,proto=pref==='auto'?(location.protocol==='https:'?'wss':'ws'):pref,url=`${proto}://${ip}${path}`;fcLog('Connecting '+url);try{const ws=new WebSocket(url);state.fc.socket=ws;ws.onopen=()=>{fcStatus(true);fcLog('Connected');sendFc({type:'hello',client:'ZEBJUS F450 Lab V17.3'})};ws.onmessage=e=>packet(e.data);ws.onerror=()=>fcLog('WebSocket error');ws.onclose=()=>fcStatus(false)}catch(e){fcLog(e.message)}}
function disconnectFc(log=true){if(state.fc.socket)try{state.fc.socket.close()}catch{}state.fc.socket=null;fcStatus(false);if(log)fcLog('Disconnected')}
function sendFc(o){if(state.fc.socket?.readyState===1){state.fc.socket.send(JSON.stringify(o));fcLog('TX '+JSON.stringify(o));return true}fcLog('Not connected');return false}
function packet(raw){let d;try{d=JSON.parse(raw)}catch{d={raw}};['roll','pitch','yaw','gyroX','gyroY','gyroZ','battery'].forEach(k=>{if(Number.isFinite(+d[k]))state.telemetry[k]=+d[k]});$('#telemetryLog').textContent=(new Date().toLocaleTimeString()+' '+raw+'\n'+$('#telemetryLog').textContent).slice(0,12000);telemetryUI()}
function telemetryUI(){const t=state.telemetry;$('#telRoll').textContent=t.roll.toFixed(2)+'°';$('#telPitch').textContent=t.pitch.toFixed(2)+'°';$('#telYaw').textContent=t.yaw.toFixed(2)+'°';$('#telBatt').textContent=t.battery?t.battery.toFixed(2)+' V':'-- V';$('#gyroX').textContent=t.gyroX.toFixed(3);$('#gyroY').textContent=t.gyroY.toFixed(3);$('#gyroZ').textContent=t.gyroZ.toFixed(3);$('#levelState').textContent=(Math.abs(t.roll)<2&&Math.abs(t.pitch)<2)?'LEVEL':'TILTED'}
function initCal(){const a=[['Gyro zero','Keep level and still','calibrate_gyro'],['Accel +Z','Normal top-up','acc_zp'],['Accel +X','Right side','acc_xp'],['Accel −X','Left side','acc_xn'],['Accel +Y','Nose up','acc_yp'],['Accel −Y','Nose down','acc_yn'],['Level trim','Return level','calibrate_level'],['Motor order','REMOVE PROPELLERS','motor_order_test']];$('#calSteps').innerHTML=a.map((v,i)=>`<div class="cal-step"><i>${i+1}</i><div><b>${v[0]}</b><span>${v[1]}</span></div><button class="btn ghost small" data-c="${v[2]}">Run</button></div>`).join('');$$('#calSteps button').forEach(b=>b.onclick=()=>state.fc.connected?sendFc({type:b.dataset.c}):(b.textContent='Sim ✓',setTimeout(()=>b.textContent='Run',800)))}
function renderPid(){
 state.pid=normalizePidShape(state.pid);
 const g=[['Rate PID',[['Roll','rateRoll'],['Pitch','ratePitch'],['Yaw','rateYaw']]],['Angle PID • Roll/Pitch only',[['Roll','angleRoll'],['Pitch','anglePitch']]]];
 $('#pidEditor').innerHTML=g.map(x=>`<div class="pid-section"><h3>${x[0]}</h3>${x[1].map(([n,k])=>`<div class="pid-row"><span>${n}</span>${['P','I','D'].map(v=>`<label>${v}<input type="number" step=".001" data-p="${k}" data-k="${v}" value="${state.pid[k][v]}"></label>`).join('')}</div>`).join('')}</div>`).join('');
 $$('#pidEditor input').forEach(i=>i.onchange=()=>{state.pid[i.dataset.p][i.dataset.k]=+i.value;syncQuickPid?.();updatePidCoach?.()})
}
let py=null,pyodidePromise=null;
function ensurePyodide(){
 if(window.loadPyodide)return Promise.resolve();
 if(pyodidePromise)return pyodidePromise;
 $('#pyStatus').textContent='Loading Python runtime on demand…';
 pyodidePromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js';s.async=true;s.onload=resolve;s.onerror=()=>reject(new Error('Python CDN unavailable. The rest of Drone Lab works offline; connect to internet only when using Python Lab.'));document.head.appendChild(s)});
 return pyodidePromise
}
function initPython(){
 $('#pythonEditor').value=`from js import zebjusBridge
import json
print("Target:",zebjusBridge.target())
print("Attitude:",json.loads(str(zebjusBridge.attitude())))
`;
 window.zebjusBridge={target:()=>$('#pythonTarget').value,attitude:()=>JSON.stringify({roll:state.telemetry.roll,pitch:state.telemetry.pitch,yaw:state.telemetry.yaw})};
 $('#runPythonBtn').onclick=async()=>{try{await ensurePyodide();if(!py){$('#pyStatus').textContent='Starting Python…';py=await window.loadPyodide();py.setStdout({batched:s=>$('#pythonTerminal').textContent+=s+'\n'});py.setStderr({batched:s=>$('#pythonTerminal').textContent+='ERR: '+s+'\n'})}$('#pyStatus').textContent='Running';await py.runPythonAsync($('#pythonEditor').value);$('#pyStatus').textContent='Finished'}catch(e){$('#pythonTerminal').textContent+=String(e)+'\n';$('#pyStatus').textContent='Python unavailable'} };
 $('#clearTerminalBtn').onclick=()=>$('#pythonTerminal').textContent=''
}

/* Save/load/buttons */
function save(){try{localStorage.setItem('zebjusF450V173',JSON.stringify({guided:state.guided,step:state.step,parts:state.parts.filter(p=>!p.internal&&p.type!=='batteryStrap').map(p=>({type:p.type,slotId:p.slotId})),actions:[...state.doneActions],connections:state.connections,pid:state.pid,wireLayout,wireNodeTransforms,optionalWireNodes,sim:{batteryV:state.sim.batteryV,payloadG:state.sim.payloadG,cgX:state.sim.cgX,cgY:state.sim.cgY,wind:state.sim.wind,motorLag:state.sim.motorLag}}));$('#saveState').textContent='Saved';setTimeout(()=>$('#saveState').textContent='Ready',800)}catch(e){console.warn('[ZEBJUS] Save unavailable:',e);notify('Browser storage is unavailable in this embed/session.','bad')}}
function load(){try{const rawCurrent=localStorage.getItem('zebjusF450V173')||localStorage.getItem('zebjusF450V152')||localStorage.getItem('zebjusF450V151'),rawLegacy=localStorage.getItem('zebjusF450V121')||localStorage.getItem('zebjusF450V12')||localStorage.getItem('zebjusF450V10')||localStorage.getItem('zebjusF450V9'),d=JSON.parse(rawCurrent||rawLegacy||'null');if(!d)return;history.restoring=true;state.guided=d.guided??true;state.step=rawCurrent?(d.step||0):0;state.doneActions=new Set(d.actions||[]);state.connections=d.connections||[];state.pid=normalizePidShape(d.pid||state.pid);wireLayout={...wireDefaultLayout,...(d.wireLayout||{})};wireNodeTransforms=d.wireNodeTransforms||{};optionalWireNodes=d.optionalWireNodes||[];if(d.sim)Object.assign(state.sim,d.sim);(d.parts||[]).filter(p=>p.type!=='fcStandoff'&&p.type!=='batteryStrap').forEach(p=>{const s=(slots[p.type]||[]).find(x=>x.id===p.slotId);if(s)install(p.type,s,false)});if(!rawCurrent){const firstIncomplete=steps.findIndex((_,i)=>!stepDone(i));state.step=firstIncomplete<0?steps.length-1:firstIncomplete}render2D();renderPid();rebuild3DWires();rebuildSolder();setPowerVisual(state.doneActions.has('xt60'),true);persistWireLayout();history.restoring=false}catch(e){console.warn(e)}}
function initButtons(){
 $('#undoBtn').onclick=undoAction;$('#redoBtn').onclick=redoAction;
 $('#guidedModeBtn').onclick=()=>{historyPush();state.guided=true;$('#guidedModeBtn').classList.add('active');$('#freeModeBtn').classList.remove('active');renderAssemblyUI();showGuides()};$('#freeModeBtn').onclick=()=>{historyPush();state.guided=false;$('#freeModeBtn').classList.add('active');$('#guidedModeBtn').classList.remove('active');guidesRoot?.clear();renderAssemblyUI()};
 $('#prevStepBtn').onclick=()=>{historyPush();state.step=Math.max(0,state.step-1);renderAssemblyUI();showGuides()};$('#nextStepBtn').onclick=()=>{if(state.guided&&!stepDone(state.step)){notify('Complete current step first.','bad');return}historyPush();state.step=Math.min(steps.length-1,state.step+1);renderAssemblyUI();showGuides()};
 $('#objectViewBtn').onclick=()=>setWireMap(false);$('#wireMapBtn').onclick=()=>setWireMap(true);$('#xrayBtn').onclick=()=>{state.xray=!state.xray;$('#xrayBtn').classList.toggle('active',state.xray);document.body.classList.toggle('xray',state.xray)};$('#fcCaseXrayBtn').onclick=()=>{state.fcCaseXray=!state.fcCaseXray;$('#fcCaseXrayBtn').classList.toggle('active',state.fcCaseXray);applyFcCaseXray()};$('#view3dBtn').onclick=()=>setView('3d');$('#topBtn').onclick=()=>setView('top');$('#frontBtn').onclick=()=>setView('front');$('#explodeBtn').onclick=toggleExplode;$('#autoRotateBtn').onclick=()=>{state.autoRotate=!state.autoRotate;$('#autoRotateBtn').classList.toggle('active',state.autoRotate)};
 $('#saveBtn').onclick=save;$('#resetBtn').onclick=()=>{if(confirm('Reset project?')){try{localStorage.removeItem('zebjusF450V173');localStorage.removeItem('zebjusF450V152');localStorage.removeItem('zebjusF450V151');localStorage.removeItem('zebjusF450V121');localStorage.removeItem('zebjusF450V10');localStorage.removeItem('zebjusF450V9');localStorage.removeItem('zebjus-v152-wire-layout');localStorage.removeItem('zebjus-v8-wire-layout')}catch{}location.reload()}};
 $('#autoWireBtn').onclick=()=>{wireRemember();historyPush();state.connections=requiredWires.map(([from,to],i)=>({from,to,new:true,id:`ref-${Date.now()}-${i}`}));['motorWire','powerWire','escFc'].forEach(x=>state.doneActions.add(x));state.doneActions.delete('xt60');setPowerVisual(false,false);render2D();rebuild3DWires();rebuildSolder();renderAssemblyUI();notify('Full correct wiring created.');setTimeout(()=>{state.connections.forEach(c=>c.new=false);render2D()},900)};$('#clearWireBtn').onclick=()=>{wireRemember();historyPush();state.connections=[];['motorWire','powerWire','escFc','xt60'].forEach(x=>state.doneActions.delete(x));setPowerVisual(false,false);render2D();rebuild3DWires();rebuildSolder();renderAssemblyUI()};
 $('#batteryConnectBtn').onclick=toggleBatteryPower;$('#connectFcBtn').onclick=connectFc;$('#disconnectFcBtn').onclick=disconnectFc;$('#pingFcBtn').onclick=()=>sendFc({type:'ping',time:Date.now()});$('#applyPidBtn').onclick=()=>{syncQuickPid();notify('PID values applied to tripod simulator.');};$('#sendPidBtn').onclick=()=>sendFc({type:'pid_set',pid:state.pid});$('#restorePidBtn').onclick=()=>{historyPush();state.pid={rateRoll:{P:.9,I:15,D:.035},ratePitch:{P:.9,I:15,D:.035},rateYaw:{P:3,I:13,D:0},angleRoll:{P:3,I:0,D:0},anglePitch:{P:3,I:0,D:0}};renderPid();syncQuickPid()};
 window.addEventListener('keydown',e=>{const cmd=e.ctrlKey||e.metaKey;if(!cmd)return;if(e.key.toLowerCase()==='z'&&!e.shiftKey){e.preventDefault();undoAction()}else if((e.key.toLowerCase()==='z'&&e.shiftKey)||e.key.toLowerCase()==='y'){e.preventDefault();redoAction()}});historyButtons()
}
function bootStep(name,fn){
 try{fn();return true}
 catch(e){console.error(`[ZEBJUS] ${name} failed:`,e);return false}
}
function showAssembly3DError(e){
 const box=$('#threeContainer');if(box)box.innerHTML=`<div class="runtime-error-card"><b>Assembly 3D could not start</b><span>${String(e?.message||e||'Unknown WebGL error')}</span><small>Try the full GitHub Pages page in current Chrome/Edge. 2D Wiring and the other non-3D tools can still be used.</small></div>`;
}
function boot(){
 initTabs();
 setBootStatus('Starting local 3D renderer…');
 let threeOK=false;
 try{init3D();threeOK=true;window.__zebjus3DReady=true}
 catch(e){console.error('[ZEBJUS] Assembly 3D init failed:',e);showAssembly3DError(e)}
 bootStep('Assembly UI',renderAssemblyUI);
 bootStep('2D Wiring',render2D);
 bootStep('Calibration',initCal);
 bootStep('PID editor',renderPid);
 bootStep('Python Lab',initPython);
 bootStep('Buttons',initButtons);
 bootStep('Wiring controls',initWiringControls);
 bootStep('Settings',initSettings);registerOffline();
 loadAssets();
 if(threeOK){bootStep('Saved project',load);bootStep('Assembly refresh',renderAssemblyUI);bootStep('3D guides',showGuides)}
 bootStep('PID quick sync',syncQuickPid);
 if(threeOK){setBootStatus('Local 3D engine ready','good');notify('3D engine ready • offline/local runtime.','good')}
 else{setBootStatus('3D unavailable • 2D tools active');notify('3D renderer unavailable — 2D tools are still active.','bad')}
 window.__zebjusAppLoaded=true;updateStartupDiagnostics?.();
 window.dispatchEvent(new CustomEvent('zebjus-app-ready',{detail:{three:threeOK,version:'17.3'}}));
}
boot();
