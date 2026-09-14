import * as THREE from './three.module.min.js';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rad=d=>d*Math.PI/180;
const SVG='http://www.w3.org/2000/svg';
window.__zebjusModuleParsed=true;
window.__zebjusAppLoaded=false;
window.__zebjus3DReady=false;
function setBootStatus(text,kind=''){const s=$('#assetStatus');if(s){s.textContent=text;s.className='status'+(kind?' '+kind:'')}}
setBootStatus('V12 local module loaded • starting enhanced 3D renderer…');

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
 {id:'inspect',title:'Final inspection',desc:'Check frame, soldering, ESC plugs, FC FRONT direction, under-frame battery straps, motor direction and propeller orientation.',types:[],need:1,target:'Complete drone',action:'inspect'}
];

const state={guided:true,step:0,selectedType:null,selectedInstalledId:null,parts:[],doneActions:new Set(),connections:[],wireMap:false,xray:false,exploded:false,autoRotate:false,powered:false,powerStage:0,
 pid:{rateRoll:{P:.9,I:15,D:.035},ratePitch:{P:.9,I:15,D:.035},rateYaw:{P:3,I:13,D:0},angleRoll:{P:3,I:0,D:0},anglePitch:{P:3,I:0,D:0}},
 fc:{socket:null,connected:false},telemetry:{roll:0,pitch:0,yaw:0,battery:null,gyroX:0,gyroY:0,gyroZ:0},
 sim:{running:false,flightMode:'angle',roll:0,pitch:0,yawRate:0,rollRate:0,pitchRate:0,rollI:0,pitchI:0,throttle:1000,cmdRoll:0,cmdPitch:0,cmdYaw:0,vibration:0}};

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
function snapState(){return JSON.stringify({guided:state.guided,step:state.step,parts:state.parts.filter(p=>!p.internal&&p.type!=='batteryStrap').map(p=>({type:p.type,slotId:p.slotId})),actions:[...state.doneActions],connections:state.connections.map(c=>({from:c.from,to:c.to})),pid:state.pid})}
function historyPush(){if(history.restoring)return;history.undo.push(snapState());if(history.undo.length>history.max)history.undo.shift();history.redo.length=0;historyButtons()}
function historyButtons(){const u=$('#undoBtn'),r=$('#redoBtn');if(u)u.disabled=!history.undo.length;if(r)r.disabled=!history.redo.length}
function clearAssemblyObjects(){state.selectedInstalledId=null;if(partsRoot)partsRoot.clear();if(wiresRoot)wiresRoot.clear();if(guidesRoot)guidesRoot.clear();if(extrasRoot)extrasRoot.clear();if(labelsRoot)labelsRoot.clear();if(typeof solderRoot!=='undefined'&&solderRoot)solderRoot.clear();state.parts=[]}
function restoreHistory(raw){history.restoring=true;const d=JSON.parse(raw);clearAssemblyObjects();state.guided=d.guided;state.step=d.step;state.doneActions=new Set(d.actions||[]);state.connections=(d.connections||[]).map(c=>({...c}));state.pid=d.pid||state.pid;(d.parts||[]).filter(p=>p.type!=='fcStandoff'&&p.type!=='batteryStrap').forEach(p=>{const s=(slots[p.type]||[]).find(x=>x.id===p.slotId);if(s)install(p.type,s,false)});renderAssemblyUI();render2D();renderPid();rebuild3DWires();rebuildSolder();setPowerVisual(state.doneActions.has('xt60'),true);showGuides();history.restoring=false;historyButtons()}
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
function getAudioCtx(){try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx}catch{return null}}
function tone(freq=440,dur=.08,type='sine',gain=.035,delay=0){
 const ac=getAudioCtx();if(!ac)return;const o=ac.createOscillator(),g=ac.createGain(),t=ac.currentTime+delay;o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(.001,gain),t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g).connect(ac.destination);o.start(t);o.stop(t+dur+.02)
}
function playFX(kind){
 const seq={
  plate:[[155,.06,'triangle'],[205,.07,'triangle']],
  arm:[[215,.05,'square'],[280,.045,'triangle']],
  guard:[[310,.06,'triangle'],[370,.04,'sine']],
  motor:[[420,.05,'sine'],[560,.07,'sine']],
  esc:[[520,.04,'square'],[690,.05,'square']],
  tape:[[130,.055,'triangle'],[105,.06,'triangle']],
  fc:[[640,.045,'sine'],[820,.07,'sine']],
  battery:[[235,.075,'sine'],[185,.08,'triangle']],
  strap:[[175,.05,'triangle'],[145,.06,'triangle']],
  prop:[[390,.04,'triangle'],[510,.05,'sine']],
  connector:[[760,.035,'sine'],[990,.05,'sine']],
  screw:[[960,.018,'square'],[1180,.018,'square']]
 };
 (seq[kind]||[[360,.05,'sine']]).forEach((q,i)=>tone(q[0],q[1],q[2],.022,i*.045))
}
function escBeep(i){tone(650+i*115,.07,'square',.026,0);tone(820+i*105,.055,'square',.020,.08)}
function setEscLed(index,on){
 const p=state.parts.filter(x=>x.type==='esc')[index];if(!p)return;
 p.obj.traverse(o=>{if(o.isMesh&&o.name==='ESC_POWER_LED')o.material.emissiveIntensity=on?2.4:0})
}
function setFcLeds(powerOn,statusOn){
 const p=state.parts.find(x=>x.type==='fc');if(!p)return;
 p.obj.traverse(o=>{
   if(!o.isMesh||!o.material)return;
   if(o.name==='FC_RGB_LED_R')o.material.emissiveIntensity=powerOn&&!statusOn?7.5:0;
   if(o.name==='FC_RGB_LED_G')o.material.emissiveIntensity=powerOn&&statusOn?9.0:0;
   if(o.name==='FC_RGB_LED_B')o.material.emissiveIntensity=powerOn&&statusOn?3.4:0
 })
}
function updatePowerUi(){
 const st=$('#batteryPowerState'),btn=$('#batteryConnectBtn');
 if(st){st.textContent=!state.powered?'POWER OFF':state.powerStage<3?'POWERING…':'POWER ON';st.className='status '+(state.powered?'good':'')}
 if(btn){btn.textContent=state.powered?'Disconnect battery':'Connect battery XT60';btn.disabled=!installed('battery','BAT')}
}
function setPowerVisual(on,instant=false){
 powerSequenceToken++;
 state.powered=!!on;state.powerStage=on?(instant?3:0):0;
 for(let i=0;i<4;i++)setEscLed(i,on&&instant);
 setFcLeds(on&&instant,on&&instant);
 if(!on&&powerPulseRoot){powerPulseRoot.clear();powerPulseItems=[]}
 rebuildPowerPulses();updatePowerUi()
}
function runPowerUpSequence(){
 const token=++powerSequenceToken;state.powered=true;state.powerStage=1;for(let i=0;i<4;i++)setEscLed(i,false);setFcLeds(false,false);rebuildPowerPulses();updatePowerUi();
 [0,1,2,3].forEach(i=>setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setEscLed(i,true);escBeep(i)},300+i*190));
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;state.powerStage=2;setFcLeds(true,false);tone(1180,.08,'sine',.025);updatePowerUi();notify('FC RGB LED bright RED • booting…')},1120);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setFcLeds(true,true);tone(1480,.06,'sine',.02);notify('FC RGB LED bright GREEN/CYAN • ready')},1360);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;setFcLeds(true,false)},1510);
 setTimeout(()=>{if(token!==powerSequenceToken||!state.powered)return;state.powerStage=3;setFcLeds(true,true);tone(1680,.09,'sine',.018);updatePowerUi();notify('Power-up complete • ESCs armed in virtual idle • FC LEDs ready • prop idle enabled.','good')},1740)
}
function animateBatteryPlug(connect=true){
 if(!extrasRoot)return;const bottom=installed('bottomPlate','bottom'),bat=installed('battery','BAT');if(!bottom||!bat)return;
 scene.updateMatrixWorld(true);
 const target=wiresRoot.worldToLocal(bottom.localToWorld(new THREE.Vector3(-1.88,.31,0)));
 const start=wiresRoot.worldToLocal(bat.localToWorld(new THREE.Vector3(1.62,.44,.42)));
 const g=new THREE.Group();const plug=B(.34,.20,.28,mat(0xf3c42f,.05,.48),[0,0,0],g);plug.name='BAT_XT60_MOVING';
 curvedLocalCable(g,[[.12,.04,.09],[.40,.10,.14],[.68,.13,.18]],0xef3f48,.045);
 curvedLocalCable(g,[[.12,-.04,-.09],[.40,.03,-.14],[.68,.06,-.18]],0x3a2419,.045);
 g.position.copy(connect?start:target);extrasRoot.add(g);
 animations.push({type:'batteryPlug',obj:g,target:(connect?target:start),removeAtEnd:true})
}
function connectBatteryPower(fromGuided=false){
 if(!installed('battery','BAT')){notify('Install the LiPo underneath the frame first.','bad');return false}
 if(!installed('bottomPlate','bottom')){notify('Bottom PDB is missing.','bad');return false}
 [['BAT.+','PDB.BAT+'],['BAT.-','PDB.BAT-']].forEach(([from,to])=>{if(!state.connections.some(c=>c.from===from&&c.to===to))state.connections.push({from,to,new:true,id:`bat-${Date.now()}-${from}`})});
 state.doneActions.add('xt60');animateBatteryPlug(true);playFX('connector');rebuild3DWires();rebuildSolder();render2D();renderAssemblyUI();
 notify('XT60 inserted • beginning ESC / FC startup sequence…','good');runPowerUpSequence();return true
}
function disconnectBatteryPower(){
 state.connections=state.connections.filter(c=>!((c.from.startsWith('BAT.')||c.to.startsWith('BAT.'))));
 state.doneActions.delete('xt60');animateBatteryPlug(false);setPowerVisual(false,false);renderAssemblyUI();render2D();rebuild3DWires();rebuildSolder();notify('Battery disconnected • ESC/FC LEDs OFF • propellers stopped.','good')
}
function toggleBatteryPower(){historyPush();if(state.powered)disconnectBatteryPower();else connectBatteryPower(false)}

/* UI */
function initTabs(){$$('.tab').forEach(b=>b.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$$('.tab-panel').forEach(x=>x.classList.remove('active'));$('#tab-'+b.dataset.tab)?.classList.add('active');if(b.dataset.tab==='assembly')setTimeout(resize3D,40);if(b.dataset.tab==='sim'){ensureSim();setTimeout(resizeSim,80)}})}
const product=t=>products.find(x=>x.type===t);
function showInspector(title,detail,rating={},pins=[],kind='PRODUCT',asset=''){ $('#inspector').innerHTML=`<div class="type">${kind}</div><h3>${title}</h3><p>${detail}</p><div class="specs">${Object.entries(rating).map(([k,v])=>`<div class="spec"><b>${k}</b><span>${v}</span></div>`).join('')}</div><table class="pin-table">${pins.map(p=>`<tr><td>${p[0]}</td><td>${p[1]}</td></tr>`).join('')}</table>${asset?`<div class="asset-path">3D asset: ${asset}</div>`:''}` }
function notify(t,k='good'){const e=$('#snapMessage');e.textContent=t;e.className='snap-message '+k;clearTimeout(notify.t);notify.t=setTimeout(()=>e.className='snap-message',1800)}
function renderShelf(){
 const b=$('#componentShelf');b.innerHTML='';
 const stepRank=t=>{const i=steps.findIndex(s=>s.types.includes(t));return i<0?999:i};
 const required=products.filter(c=>!c.optional&&!c.internal&&state.parts.filter(p=>p.type===c.type).length<c.max).sort((a,b)=>stepRank(a.type)-stepRank(b.type));
 const optional=products.filter(c=>c.optional&&!c.internal&&state.parts.filter(p=>p.type===c.type).length<c.max);
 const addCard=(c)=>{
   const n=state.parts.filter(p=>p.type===c.type).length,left=c.max-n,e=document.createElement('button');
   e.className='product-card'+(c.optional?' optional-product':'')+(state.selectedType===c.type?' selected':'')+(steps[state.step]?.types.includes(c.type)?' current-part':'');
   e.draggable=true;const batch=(c.type==='frameScrew'||c.type==='motorScrew');
   const img=c.thumb?`<img class="product-thumb" src="${c.thumb}" alt="${c.name} preview">`:`<div class="product-fallback">${c.icon}</div>`;
   e.innerHTML=`${img}<div><b>${c.name}</b><span>${c.short}</span>${batch?'<small class="one-drag-note">ONE DRAG installs complete set</small>':''}${c.optional?'<em class="optional-badge">OPTIONAL / EXPANSION</em>':''}</div><i class="count-badge">${left} left</i><em class="model-tag">${c.asset?'3D MODEL':'VIRTUAL PART'}</em>`;
   e.onclick=()=>selectProduct(c.type);e.ondragstart=x=>{x.dataTransfer.setData('text/plain',c.type);state.selectedType=c.type};b.appendChild(e)
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
 state.selectedType=type;renderShelf();showInspector(c.name,c.detail,c.rating,c.pins,c.optional?'OPTIONAL DEVICE':'PRODUCT',c.asset||'')
}
function countStep(s){if(s.action)return state.doneActions.has(s.id)?s.need:0;return state.parts.filter(p=>s.types.includes(p.type)).length}
const stepDone=i=>countStep(steps[i])>=steps[i].need;
function renderSteps(){
 $('#assemblySteps').innerHTML=steps.map((s,i)=>`<div class="build-step ${i===state.step?'active':''} ${stepDone(i)?'done':''}" data-i="${i}"><div class="n">${String(i+1).padStart(2,'0')}</div><div><b>${s.title}</b><span>${s.target}</span></div><i class="state-dot"></i></div>`).join('');
 $$('.build-step').forEach(e=>e.onclick=()=>{const i=+e.dataset.i;if(state.guided&&i>state.step&&!steps.slice(0,i).every((_,j)=>stepDone(j))){notify('Complete earlier guided steps first.','bad');return}historyPush();state.step=i;renderAssemblyUI();showGuides()});
 const s=steps[state.step];$('#currentStepTitle').textContent=s.title;$('#currentStepCard').innerHTML=`<b>${s.title}</b><p>${s.desc}</p><div class="targets">Target: ${s.target} • ${countStep(s)}/${s.need}</div>${s.action?'<button id="doStepAction" class="btn primary full">Run guided connection animation</button>':''}`;
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
let scene,camera,renderer,controls,ray,mouse,bench,partsRoot,wiresRoot,guidesRoot,extrasRoot,labelsRoot,solderRoot,powerPulseRoot,animations=[],powerPulseItems=[];
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
 // Soldered XT60 battery connector mounted at the left edge of the PDB.
 const xt=new THREE.Group();xt.name='PDB_XT60_SOCKET';g.add(xt);
 B(.48,.28,.42,mat(0xf2c230,.08,.42),[-1.88,.25,0],xt);
 B(.12,.10,.12,mat(0xb87333,.72,.22),[-1.63,.24,.105],xt);B(.12,.10,.12,mat(0xb87333,.72,.22),[-1.63,.24,-.105],xt);
 curvedLocalCable(xt,[[-1.63,.24,.105],[-1.48,.20,.15],[-1.22,.16,.17]],0xef4444,.048);
 curvedLocalCable(xt,[[-1.63,.24,-.105],[-1.48,.20,-.15],[-1.22,.16,-.17]],0x4b2f20,.048);
 xt.traverse(o=>{if(o.isMesh)o.userData.info={title:'PDB XT60 Battery Connector',detail:'XT60 socket soldered to the bottom PDB. The LiPo plug inserts here during the battery-connect step.',rating:{Voltage:'3S / ~12V',Mount:'Soldered to BAT+/BAT−'},pins:[['RED','BAT+'],['BROWN/BLACK','BAT−']]}});return g
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
 camera=new THREE.PerspectiveCamera(40,w/h,.1,1000);camera.position.set(8.6,6.8,10.2);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.setSize(w,h);
 renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.38;e.appendChild(renderer.domElement);
 controls=new MiniOrbitControls(camera,renderer.domElement);controls.target.set(0,.95,0);controls.enableDamping=true;controls.minDistance=4;controls.maxDistance=20;
 scene.add(new THREE.AmbientLight(0xffffff,.75));
 scene.add(new THREE.HemisphereLight(0xe7f5ff,0x63717c,1.65));
 const key=new THREE.DirectionalLight(0xffffff,2.8);key.position.set(6,10,8);key.castShadow=true;scene.add(key);
 const fill=new THREE.DirectionalLight(0xb7dcff,1.55);fill.position.set(-7,6,4);scene.add(fill);
 const rim=new THREE.DirectionalLight(0x7de6ff,1.15);rim.position.set(-4,5,-8);scene.add(rim);
 const warm=new THREE.PointLight(0xffd7a8,1.25,18);warm.position.set(4.8,5.8,1.8);scene.add(warm);
 const frontFill=new THREE.PointLight(0xa9dcff,.95,16);frontFill.position.set(-4.5,3.8,5.5);scene.add(frontFill);
 bench=B(16,.32,12,mat(0x354550,.14,.58),[0,-.16,0],scene);
 B(15.5,.035,11.5,mat(0x1d2a32,.08,.48),[0,.018,0],scene);
 const grid=new THREE.GridHelper(16,32,0x426070,0x2d4552);grid.position.y=.003;scene.add(grid);
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
   if(o.userData?.wire){showInspector('Wire / cable',o.userData.wire,{Route:'Flexible arm-following cable'},[[o.userData.wire,'Connection']],'WIRING');return}
   if(o.userData?.info){const d=o.userData.info;showInspector(d.title,d.detail,d.rating||{},d.pins||[],'ACCESSIBLE FC PIN');return}
   const r=rootOf(o);
   if(r){const p=state.parts.find(x=>x.obj===r);if(p){state.selectedInstalledId=p.id;const c=product(p.type);showInspector(c.name,c.detail,{...c.rating,Mount:'SNAP-LOCKED'},c.pins,'INSTALLED PRODUCT',c.asset||'');$('#inspector').insertAdjacentHTML('beforeend','<span class="locked-badge">✓ LOCKED IN CORRECT POSITION</span><button id="deleteSelectedPartBtn" class="btn danger full">Delete selected component</button>');$('#deleteSelectedPartBtn').onclick=()=>deleteInstalled(p.id);return}}
 }
}
function move(e){/* V5: snapped components are locked; use Undo to change assembly. */}
function findSlot(type,p){
 const used=new Set(state.parts.filter(x=>x.type===type).map(x=>x.slotId));
 const f=(slots[type]||[]).filter(s=>!used.has(s.id));if(!f.length)return null;
 if(state.guided)return f[0];
 f.sort((a,b)=>new THREE.Vector3(...a.p).distanceTo(p)-new THREE.Vector3(...b.p).distanceTo(p));return f[0]
}
function placePointer(e){
 const type=state.selectedType,c=product(type);if(!c)return;
 if(state.guided&&!product(type)?.optional&&!steps[state.step].types.includes(type)){notify('Current guided step needs a different item.','bad');return}
 if(product(type)?.optional&&!state.parts.some(p=>p.type==='fc')){notify('Mount the ZEBJUS FC case before adding optional expansion devices.','bad');return}
 if(type==='frameScrew'||type==='motorScrew'){installFastenerSet(type);return}
 const p=hitBench(e)||new THREE.Vector3(),s=findSlot(type,p);if(!s){notify('No free snap point.','bad');return}
 historyPush();install(type,s,true);state.selectedType=null;renderAssemblyUI();showGuides();
 if(state.guided&&stepDone(state.step)&&state.step<steps.length-1)setTimeout(()=>{state.step++;renderAssemblyUI();showGuides()},500)
}
function install(type,s,animate=true){
 const o=createPart(type,s.id),id=`${type}-${s.id}`;o.position.set(...s.p);o.rotation.y=s.r||0;tag(o,{partRoot:o});partsRoot.add(o);state.parts.push({type,slotId:s.id,id,obj:o});
 if(type==='esc')addEscStrap(s,id);
 if(type==='frameScrew'||type==='motorScrew')animateScrew(o,s,animate,0);
 if(type==='battery'){if(animate){const target=new THREE.Vector3(...s.p);o.position.set(s.p[0]+2.5,s.p[1]+.08,s.p[2]);animations.push({type:'batterySlide',obj:o,target});}ensureBatteryStraps(animate);}
 const snd={bottomPlate:'plate',topPlate:'plate',armRed:'arm',armWhite:'arm',guard:'guard',motor:'motor',esc:'esc',fcTape:'tape',fc:'fc',battery:'battery',prop:'prop'}[type];if(snd&&!history.restoring)playFX(snd);
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
 state.doneActions.delete('inspect');state.selectedInstalledId=null;renderAssemblyUI();render2D();rebuild3DWires();rebuildSolder();showGuides();
 $('#inspector').innerHTML='<div class="empty"><div>↩</div><p>Component deleted. It returned to the shelf in assembly order.</p></div>';notify(`${product(p.type).name} deleted — returned to shelf.`)
}
function showGuides(){if(!guidesRoot)return;guidesRoot.clear();const s=steps[state.step];if(!s.types.length)return;s.types.forEach(t=>(slots[t]||[]).forEach(q=>{if(state.parts.some(p=>p.type===t&&p.slotId===q.id))return;const R=t.includes('Screw')?.13:(t==='armRed'||t==='armWhite')?.55:.28,g=new THREE.Mesh(new THREE.RingGeometry(R*.65,R,28),new THREE.MeshBasicMaterial({color:C.green,transparent:true,opacity:.55,side:THREE.DoubleSide}));g.rotation.x=-Math.PI/2;g.position.set(q.p[0],q.p[1]+.03,q.p[2]);guidesRoot.add(g)}))}
function resize3D(){if(!renderer||!camera)return;const e=$('#threeContainer');if(!e)return;const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||600);camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}
function loop3D(t){
 requestAnimationFrame(loop3D);
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
   }
 }
 if(state.powered&&state.powerStage>=3)state.parts.filter(p=>p.type==='prop').forEach((p,i)=>p.obj.rotation.y+=(i%2?1:-1)*.014);
 powerPulseItems.forEach(x=>{x.phase=(x.phase+x.speed*.016)%1;x.mesh.position.copy(x.curve.getPointAt(x.phase))});
 partsRoot.traverse(o=>{if(o.isMesh&&o.material){o.material.transparent=state.xray;o.material.opacity=state.xray?.36:1}});
 wiresRoot.visible=state.wireMap||state.xray;
 if(powerPulseRoot)powerPulseRoot.visible=state.wireMap||state.xray||state.powered;
 renderer.render(scene,camera)
}
function setView(v){
 if(!camera||!controls)return;
 if(v==='3d')camera.position.set(8.6,6.8,10.2);
 if(v==='top')camera.position.set(0,14,.01);
 if(v==='front')camera.position.set(0,3.8,12);
 controls.target.set(0,.95,0);
 const active={'3d':'view3dBtn',top:'topBtn',front:'frontBtn'}[v];
 ['view3dBtn','topBtn','frontBtn'].forEach(id=>$('#'+id)?.classList.toggle('active',id===active))
}
function setWireMap(on){state.wireMap=on;$('#wireMapBtn').classList.toggle('active',on);$('#objectViewBtn').classList.toggle('active',!on);$('#wireLegend').classList.toggle('hidden',!on);$('#benchSubtitle').textContent=on?'Full arm-routed wiring trace':'Asset-based mechanical assembly';rebuild3DWires()}
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
   const q={'BAT+':[-1.88,.31,.105],'BAT-':[-1.88,.31,-.105],'E1+':[.95,.15,.73],'E1-':[.95,.15,.48],'E2+':[-.63,.15,.73],'E2-':[-.88,.15,.73],'E3+':[-.63,.15,-.73],'E3-':[-.88,.15,-.73],'E4+':[.95,.15,-.48],'E4-':[.95,.15,-.73]};
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
 const m=a.clone().lerp(b,.5);m.y+=.08;return[a,m,b]
}
function rebuild3DWires(){
 if(!wiresRoot)return;wiresRoot.clear();
 state.connections.forEach(c=>{
   if(c.from.startsWith('OPT')||c.to.startsWith('OPT'))return;
   const pts=routePoints(c),th=/BAT|PWR/.test(c.from+c.to) ? .045 : (/\.[UVW]/.test(c.from) ? .020 : .018);
   const w=tube(pts,wColor(c.from),th,wiresRoot);tag(w,{wire:`${c.from} → ${c.to}`});
   if(c.new){w.material.emissive=new THREE.Color(C.green);w.material.emissiveIntensity=1.8}
 });
 rebuildPowerPulses();
}
function rebuildPowerPulses(){
 if(!powerPulseRoot)return;powerPulseRoot.clear();powerPulseItems=[];
 if(!state.powered)return;
 state.connections.forEach(c=>{
   if(!(/BAT\.|PDB\.E|PWR/.test(c.from+c.to)))return;
   const pts=routePoints(c);if(!pts||pts.length<2)return;
   const curve=new THREE.CatmullRomCurve3(pts);
   for(let j=0;j<2;j++){
     const m=new THREE.Mesh(new THREE.SphereGeometry(.035,10,8),new THREE.MeshBasicMaterial({color:wColor(c.from),transparent:true,opacity:.9}));
     powerPulseRoot.add(m);powerPulseItems.push({mesh:m,curve,phase:j*.5,speed:.10+Math.random()*.03});
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
 if(s.id==='inspect'&&!steps.slice(0,steps.length-1).every((_,i)=>stepDone(i))){notify('Complete previous steps first.','bad');return}historyPush();if(s.id==='xt60'){if(!connectBatteryPower(true))return;state.doneActions.add('xt60');rebuildSolder();renderAssemblyUI();if(state.guided&&state.step<steps.length-1){state.step++;renderAssemblyUI();showGuides()}return}if(s.id==='motorWire')addGroup('motor');if(s.id==='powerWire')addGroup('power');if(s.id==='escFc')addGroup('escfc');state.doneActions.add(s.id);rebuildSolder();renderAssemblyUI();notify(`${s.title} completed.`);if(state.guided&&state.step<steps.length-1){state.step++;renderAssemblyUI();showGuides()}
}

/* ==================== V8 INTERACTIVE 2D WIRING BENCH ==================== */
let selPort=null,selectedWireId=null,svgPorts={},wireDrag=null,wireMotorRun=false,wireMotorAngle=[0,0,0,0],wireAnimLast=performance.now();
const wireUndoStack=[];
const wireDefaultLayout={BAT:{x:55,y:402},FC:{x:870,y:360},ESC1:{x:1085,y:175},ESC2:{x:230,y:175},ESC3:{x:230,y:635},ESC4:{x:1085,y:635},M1:{x:1260,y:55},M2:{x:90,y:55},M3:{x:90,y:790},M4:{x:1260,y:790}};
let wireLayout=(()=>{try{return{...wireDefaultLayout,...JSON.parse(localStorage.getItem('zebjus-v8-wire-layout')||'{}')}}catch{return structuredClone(wireDefaultLayout)}})();
let optionalWireNodes=[];
function E(t,a={},x=''){const e=document.createElementNS(SVG,t);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));if(x)e.textContent=x;return e}
function wireSnapshot(){return JSON.stringify({connections:state.connections.map(c=>({...c})),layout:structuredClone(wireLayout),optional:structuredClone(optionalWireNodes)})}
function wireRemember(){wireUndoStack.push(wireSnapshot());if(wireUndoStack.length>50)wireUndoStack.shift()}
function wireUndo(){const v=wireUndoStack.pop();if(!v){notify('Nothing to undo in wiring.','bad');return}const d=JSON.parse(v);state.connections=d.connections;wireLayout=d.layout;optionalWireNodes=d.optional||[];selectedWireId=null;render2D();rebuild3DWires();notify('Wiring undo restored.')}
function resetWireLayout(){wireRemember();wireLayout=structuredClone(wireDefaultLayout);try{localStorage.removeItem('zebjus-v8-wire-layout')}catch{}render2D();notify('2D component positions reset.')}
function portDot(svg,key,x,y,type,label,anchor='start'){svgPorts[key]={x,y};const c=E('circle',{cx:x,cy:y,r:6.5,class:`port-v8 ${type}${selPort===key?' selected':''}`});c.dataset.port=key;c.onclick=e=>{e.stopPropagation();choosePort(key)};svg.appendChild(c);if(label)svg.appendChild(E('text',{x:x+(anchor==='start'?9:-9),y:y+3,class:'port-label-v8','text-anchor':anchor},label))}
function draw2DFrame(svg){
 const g=E('g',{transform:'translate(750,450)',opacity:'.72'});svg.appendChild(g);
 const arms=[[-45,'red'],[45,'red'],[135,'white'],[-135,'white']];
 arms.forEach(([a,c])=>{const q=E('g',{transform:`rotate(${a})`});g.appendChild(q);q.appendChild(E('path',{d:'M-28 20 L-28 218 L-52 245 L-48 278 L48 278 L52 245 L28 218 L28 20 Z',class:`wire-bg-arm ${c==='red'?'red':''}`}));for(let y=55;y<210;y+=31)q.appendChild(E('path',{d:`M-19 ${y} L19 ${y+23} M19 ${y} L-19 ${y+23}`,stroke:c==='red'?'#b84a5060':'#9aa9b460','stroke-width':4}));q.appendChild(E('circle',{cx:0,cy:260,r:31,fill:'#0c182111',stroke:'#77899655','stroke-width':2}));q.appendChild(E('rect',{x:-22,y:250,width:44,height:75,rx:7,class:'wire-bg-foot'}))});
 g.appendChild(E('path',{d:'M-112 -96 L-60 -96 L-45 -118 L45 -118 L60 -96 L112 -96 L112 -42 L140 -28 L140 28 L112 42 L112 96 L60 96 L45 118 L-45 118 L-60 96 L-112 96 L-112 42 L-140 28 L-140 -28 L-112 -42 Z',class:'wire-bg-plate'}));
 g.appendChild(E('text',{x:-30,y:-140,class:'svg-front'},'↑ FRONT'));
 // PDB ports remain fixed to the physical plate and never overlap the draggable FC node.
 [['BAT+',655,438,'power'],['BAT-',655,462,'ground'],['E1+',828,392,'power'],['E1-',828,414,'ground'],['E2+',700,392,'power'],['E2-',678,392,'ground'],['E3+',700,508,'power'],['E3-',678,508,'ground'],['E4+',828,486,'power'],['E4-',828,508,'ground']].forEach(([n,x,y,t])=>portDot(svg,'PDB.'+n,x,y,t,n,'start'))
}
function nodePos(id){return wireLayout[id]||{x:100,y:100}}
function setNodePos(id,x,y){wireLayout[id]={x:clamp(x,10,1380),y:clamp(y,10,820)}}
function beginNodeDrag(id,e){if(e.target.closest?.('.port-v8'))return;e.preventDefault();e.stopPropagation();wireRemember();const pt=svgLocalPoint($('#wiringSvg'),e.clientX,e.clientY),p=nodePos(id);wireDrag={id,dx:pt.x-p.x,dy:pt.y-p.y};document.body.style.userSelect='none'}
function svgLocalPoint(svg,x,y){const p=svg.createSVGPoint();p.x=x;p.y=y;return p.matrixTransform(svg.getScreenCTM().inverse())}
function drawNode(svg,id,title,w,h,portsLeft=[],portsRight=[],sub='DRAG TO MOVE',extraClass=''){
 const p=nodePos(id),g=E('g',{class:`wire-node-v8 ${extraClass}`,'data-node':id,transform:`translate(${p.x},${p.y})`});
 g.appendChild(E('rect',{x:0,y:0,width:w,height:h,rx:12}));g.appendChild(E('rect',{x:0,y:0,width:w,height:28,rx:12,class:'drag-handle'}));g.appendChild(E('text',{x:11,y:18,class:'node-title'},title));g.appendChild(E('text',{x:11,y:h-8,class:'node-sub'},sub));
 portsLeft.forEach((q,i)=>{const yy=42+i*20;g.appendChild(E('text',{x:14,y:yy+3,class:'port-label-v8'},q[0]));const c=E('circle',{cx:0,cy:yy,r:6.5,class:`port-v8 ${q[1]}${selPort===id+'.'+q[0]?' selected':''}`});c.dataset.port=id+'.'+q[0];c.onclick=e=>{e.stopPropagation();choosePort(c.dataset.port)};g.appendChild(c);svgPorts[id+'.'+q[0]]={x:p.x,y:p.y+yy}});
 portsRight.forEach((q,i)=>{const yy=42+i*20;g.appendChild(E('text',{x:w-14,y:yy+3,class:'port-label-v8','text-anchor':'end'},q[0]));const c=E('circle',{cx:w,cy:yy,r:6.5,class:`port-v8 ${q[1]}${selPort===id+'.'+q[0]?' selected':''}`});c.dataset.port=id+'.'+q[0];c.onclick=e=>{e.stopPropagation();choosePort(c.dataset.port)};g.appendChild(c);svgPorts[id+'.'+q[0]]={x:p.x+w,y:p.y+yy}});
 g.onpointerdown=e=>beginNodeDrag(id,e);svg.appendChild(g);return g
}
function drawMotorNode(svg,id,title){const p=nodePos(id),w=150,h=100,g=drawNode(svg,id,title,w,h,[],[['U','u'],['V','v'],['W','w']],'DRAG • U/V/W');const holder=E('g',{transform:'translate(75 62)'}),rotor=E('g',{id:`motorRotor${id.slice(1)}`,class:'motor-rotor-2d'});rotor.appendChild(E('circle',{cx:0,cy:0,r:25,class:'motor-ring-2d'}));rotor.appendChild(E('rect',{x:-39,y:-3,width:78,height:6,rx:3,class:'motor-blade-2d'}));rotor.appendChild(E('rect',{x:-3,y:-39,width:6,height:78,rx:3,class:'motor-blade-2d'}));holder.appendChild(rotor);g.appendChild(holder);g.appendChild(E('text',{x:75,y:95,id:`motorDir${id.slice(1)}`,class:'motor-dir-2d'},'OPEN'));return g}
function drawFCNode(svg){
 const id='FC',p=nodePos(id),w=310,h=285,g=E('g',{class:'wire-node-v8 fc-node-v14','data-node':id,transform:`translate(${p.x},${p.y})`});
 g.onpointerdown=e=>beginNodeDrag(id,e);
 g.appendChild(E('rect',{x:0,y:0,width:w,height:h,rx:14,class:'fc-2d-case'}));
 g.appendChild(E('rect',{x:78,y:44,width:132,height:95,rx:9,class:'fc-2d-window'}));
 g.appendChild(E('text',{x:w/2,y:22,class:'fc-2d-label'},'ZEBJUS FC • 2.54 mm HEADERS'));
 g.appendChild(E('text',{x:w/2,y:38,class:'fc-2d-front'},'↑ FRONT'));
 g.appendChild(E('text',{x:12,y:h-9,class:'node-sub'},'DRAG • ALL PINS ACCESSIBLE FROM TOP'));

 const makePin=(key,cx,cy,t,label)=>{
   const c=E('circle',{cx,cy,r:6.4,class:`port-v8 ${t}${selPort===key?' selected':''}`});
   c.dataset.port=key;c.onclick=e=>{e.stopPropagation();choosePort(key)};g.appendChild(c);
   svgPorts[key]={x:p.x+cx,y:p.y+cy};
   if(label)g.appendChild(E('text',{x:cx,y:cy-9,class:'fc-pin-mini','text-anchor':'middle'},label))
 };

 // ESC section: 4 columns × 3 rows
 g.appendChild(E('rect',{x:35,y:172,width:178,height:78,rx:7,class:'fc-block-v14 esc'}));
 g.appendChild(E('text',{x:124,y:166,'text-anchor':'middle',class:'fc-section-label'},'ESC1–ESC4 • 4 × 3'));
 const ex=[58,100,142,184],ey=[190,214,238];
 ['SOURCE','+5V','GND'].forEach((n,r)=>g.appendChild(E('text',{x:28,y:ey[r]+3,'text-anchor':'end',class:`fc-row-label ${r===0?'source':r===1?'fivev':'ground'}`},n)));
 ex.forEach((x,i)=>ey.forEach((y,r)=>makePin(`FC.ESC${i+1}-${r===0?'S':r===1?'5V':'G'}`,x,y,r===0?'signal':r===1?'fivev':'ground',r===0?`E${i+1}`:'')));

 // GPIO section: separate 3 × 3, lower/side
 g.appendChild(E('rect',{x:219,y:115,width:78,height:78,rx:7,class:'fc-block-v14 gpio'}));
 g.appendChild(E('text',{x:258,y:108,'text-anchor':'middle',class:'fc-section-label'},'GPIO 1–3'));
 const gx=[232,258,284],gy=[132,154,176];
 gx.forEach((x,i)=>gy.forEach((y,r)=>makePin(`FC.GPIO${i+1}-${r===0?'S':r===1?'5V':'G'}`,x,y,r===0?'signal':r===1?'fivev':'ground',r===0?`G${i+1}`:'')));

 // RX/PPM isolated 1 × 3
 g.appendChild(E('rect',{x:263,y:45,width:34,height:64,rx:7,class:'fc-block-v14 rx'}));
 g.appendChild(E('text',{x:280,y:39,'text-anchor':'middle',class:'fc-section-label'},'RX'));
 [['S','signal',60,'PPM'],['V','fivev',78,'+5V'],['G','ground',96,'GND']].forEach(([n,t,y,l])=>makePin(`FC.RX-${n}`,280,y,t,l));

 // I2C 4 pin
 g.appendChild(E('rect',{x:18,y:47,width:114,height:38,rx:7,class:'fc-block-v14 i2c'}));
 g.appendChild(E('text',{x:75,y:40,'text-anchor':'middle',class:'fc-section-label'},'I²C'));
 [['V','fivev'],['G','ground'],['SCL','i2c'],['SDA','i2c']].forEach(([n,t],i)=>makePin(`FC.I2C-${n}`,36+i*28,66,t,n));

 // RGB LED indicator
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
function drawOptionalNodes(svg){
 optionalWireNodes.forEach(n=>{
   if(optionalPlacedIn3D(n.type))return;
   if(!wireLayout[n.id])wireLayout[n.id]={x:1180,y:420+(optionalWireNodes.indexOf(n)%3)*120};
   const d=optionalNodeDefinition(n);drawNode(svg,n.id,d.title,175,120,d.ports,[],'UNPLACED IN 3D • DRAG','optional-node')
 })
}
function wireRoute(c){
 const a=svgPorts[c.from],b=svgPorts[c.to];if(!a||!b)return'';
 if(/\.[UVW]$/.test(c.from)||/\.[UVW]$/.test(c.to)){const mx=(a.x+b.x)/2;return`M${a.x},${a.y} Q${mx},${Math.min(a.y,b.y)-18} ${b.x},${b.y}`}
 const aFC=c.from.startsWith('FC.'),bFC=c.to.startsWith('FC.');
 if(aFC||bFC){
   const pin=aFC?a:b,other=aFC?b:a,side=other.x<pin.x?-1:1,approach={x:pin.x+side*34,y:pin.y};
   if(aFC)return`M${pin.x},${pin.y} L${approach.x},${approach.y} C${approach.x+side*45},${approach.y} ${other.x-side*70},${other.y} ${other.x},${other.y}`;
   return`M${other.x},${other.y} C${other.x+side*70},${other.y} ${approach.x-side*45},${approach.y} ${approach.x},${approach.y} L${pin.x},${pin.y}`
 }
 return`M${a.x},${a.y} C${a.x+(b.x-a.x)*.38},${a.y} ${a.x+(b.x-a.x)*.62},${b.y} ${b.x},${b.y}`
}
function cssW(k){
 if(/\.U$/.test(k))return'#f5c542';
 if(/\.V$/.test(k))return'#2c92ff';
 if(/\.W$/.test(k))return'#87949d';
 if(/PWR\+|BAT\.\+|PDB\..*\+/.test(k))return'#ef3f48';
 if(/PWR-|BAT\.-|GND|-G$/.test(k))return'#3a2419';
 if(/5V|-V$/.test(k))return'#fb7185';
 if(/I2C/.test(k))return'#47c8f1';
 return'#f59e0b';
}
function wireGauge(c){
 const k=c.from+' '+c.to;
 if(/BAT\.|PWR|PDB\.E/.test(k))return 7.5;
 if(/\.[UVW]/.test(k))return 4.6;
 if(/5V|GND|-G\b/.test(k))return 3.4;
 return 3.5
}
function portTypeFromKey(k){
 if(/5V|-V$/.test(k))return'fivev';
 if(/GND|-G$|BAT-/.test(k))return'ground';
 if(/\.U$/.test(k))return'u';if(/\.V$/.test(k))return'v';if(/\.W$/.test(k))return'w';
 if(/\+|PWR\+/.test(k))return'power';if(/I2C-(SCL|SDA)/.test(k))return'i2c';return'signal'
}
function drawFcPortOverlay(svg){
 const layer=E('g',{class:'fc-port-overlay-v13'});
 Object.entries(svgPorts).filter(([k])=>k.startsWith('FC.')).forEach(([k,p])=>{
   const c=E('circle',{cx:p.x,cy:p.y,r:7.4,class:`port-v8 port-overlay-v13 ${portTypeFromKey(k)}${selPort===k?' selected':''}`});
   c.dataset.port=k;c.onclick=e=>{e.stopPropagation();choosePort(k)};
   const title=E('title',{},k.replace('FC.','FC '));c.appendChild(title);layer.appendChild(c);
   const m=k.match(/^FC\.ESC(\d)-(S|5V|G)$/);if(m){const lab=E('text',{x:p.x,y:p.y-10,class:'fc-pin-mini','text-anchor':'middle'},`E${m[1]} ${m[2]}`);layer.appendChild(lab)}
 });
 svg.appendChild(layer)
}
function conn(a,b){return state.connections.some(c=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a))}
function phaseMap(i){const esc=`ESC${i}`,mot=`M${i}`,src=['U','V','W'],dst=['U','V','W'],map=[];for(const s of src){const found=state.connections.find(c=>{const a=c.from.split('.'),b=c.to.split('.');return(a[0]===esc&&a[1]===s&&b[0]===mot&&dst.includes(b[1]))||(b[0]===esc&&b[1]===s&&a[0]===mot&&dst.includes(a[1]))});if(!found)return null;const a=found.from.split('.'),b=found.to.split('.');map.push(dst.indexOf(a[0]===mot?a[1]:b[1]))}if(new Set(map).size!==3)return null;return map}
function permutationOdd(a){let inv=0;for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++)if(a[i]>a[j])inv++;return inv%2===1}
function motorElectrical(i){const map=phaseMap(i);const battery=conn('BAT.+','PDB.BAT+')&&conn('BAT.-','PDB.BAT-');const power=battery&&conn(`PDB.E${i}+`,`ESC${i}.PWR+`)&&conn(`PDB.E${i}-`,`ESC${i}.PWR-`);if(!map||!power)return{ready:false,dir:'OPEN',map};const base=(i===1||i===3)?'CW':'CCW',rev=permutationOdd(map),dir=rev?(base==='CW'?'CCW':'CW'):base;return{ready:true,dir,map,reverse:rev}}
function motorEnabled(i){return $('#wireAllMotors')?.checked?true:!!$(`#wireM${i}`)?.checked}
function motorActive(i){return wireMotorRun&&+($('#wireThrottle')?.value||1000)>=1100&&motorEnabled(i)&&motorElectrical(i).ready}
function wireCarriesCurrent(c){
 const k=c.from+' '+c.to;
 if(state.powered&&(/BAT\.|PDB\.E|PWR/.test(k)))return true;
 if(!wireMotorRun||+($('#wireThrottle')?.value||1000)<1100)return false;
 for(let i=1;i<=4;i++){
   if(!motorActive(i))continue;
   const keys=[['BAT.+','PDB.BAT+'],['BAT.-','PDB.BAT-'],[`PDB.E${i}+`,`ESC${i}.PWR+`],[`PDB.E${i}-`,`ESC${i}.PWR-`]];
   if(keys.some(([a,b])=>(c.from===a&&c.to===b)||(c.from===b&&c.to===a)))return true;
   if((c.from.startsWith(`ESC${i}.`)&&/\.[UVW]$/.test(c.from)&&c.to.startsWith(`M${i}.`))||(c.to.startsWith(`ESC${i}.`)&&/\.[UVW]$/.test(c.to)&&c.from.startsWith(`M${i}.`)))return true
 }
 return false
}
function render2D(){
 const svg=$('#wiringSvg');if(!svg)return;svg.innerHTML='';svgPorts={};const defs=E('defs');defs.innerHTML='<filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity=".55"/></filter><filter id="glow"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="flowGlow"><feGaussianBlur stdDeviation="1.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';svg.appendChild(defs);
 draw2DFrame(svg);
 drawNode(svg,'BAT','3S LiPo / XT60',190,95,[],[['+','power'],['-','ground']],'DRAG • BATTERY');
 drawNode(svg,'ESC2','ESC2 • FRONT LEFT',185,165,[['U','u'],['V','v'],['W','w']],[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']]);
 drawNode(svg,'ESC1','ESC1 • FRONT RIGHT',185,165,[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],[['U','u'],['V','v'],['W','w']]);
 drawNode(svg,'ESC3','ESC3 • REAR LEFT',185,165,[['U','u'],['V','v'],['W','w']],[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']]);
 drawNode(svg,'ESC4','ESC4 • REAR RIGHT',185,165,[['PWR+','power'],['PWR-','ground'],['SIG','signal'],['5V','fivev'],['GND','ground']],[['U','u'],['V','v'],['W','w']]);
 drawMotorNode(svg,'M1','M1 • A2212');drawMotorNode(svg,'M2','M2 • A2212');drawMotorNode(svg,'M3','M3 • A2212');drawMotorNode(svg,'M4','M4 • A2212');drawFCNode(svg);drawOptionalNodes(svg);
 // wires after ports have coordinates; draw them on top of the background but under connector dots.
 const wires=E('g',{class:'wire-layer-v8'});state.connections.forEach((c,i)=>{const d=wireRoute(c);if(!d)return;const id=c.id||(c.id=`w${Date.now()}-${i}-${Math.random().toString(36).slice(2,5)}`),path=E('path',{d,class:`wire-v8 ${selectedWireId===id?'selected':''} ${wireCarriesCurrent(c)?'current-flow':''}`,stroke:cssW(c.from),'stroke-width':wireGauge(c),'data-wire-id':id});path.onclick=e=>{e.stopPropagation();selectedWireId=id;render2D()};wires.appendChild(path)});svg.appendChild(wires);
 // Wires intentionally pass over the FC case body; exact FC pins are redrawn above the wires.
 drawFcPortOverlay(svg);validate2D();updateMotorTestUI()
}
function choosePort(k){if(!selPort){selPort=k;render2D();return}if(k===selPort){selPort=null;render2D();return}if(!state.connections.some(c=>(c.from===selPort&&c.to===k)||(c.from===k&&c.to===selPort))){wireRemember();state.connections.push({from:selPort,to:k,new:true,id:`w${Date.now()}-${Math.random().toString(36).slice(2,6)}`});animatePlug(selPort,k);setTimeout(()=>{state.connections.forEach(c=>c.new=false);render2D()},700)}selPort=null;render2D();rebuild3DWires();rebuildSolder()}
function deleteSelectedWire(){if(!selectedWireId){notify('Select a wire first.','bad');return}wireRemember();state.connections=state.connections.filter(c=>c.id!==selectedWireId);selectedWireId=null;render2D();rebuild3DWires();rebuildSolder();notify('Selected wire deleted.')}
function validate2D(){
 const b=$('#wireValidation');if(!b)return;const fixed=requiredWires.filter(([a,b])=>!/\.[UVW]$/.test(a)&&!/\.[UVW]$/.test(b));const missing=fixed.filter(([a,z])=>!conn(a,z)).length;const phaseReady=[1,2,3,4].filter(i=>phaseMap(i)).length;let conflict=false;state.connections.forEach(c=>{const t=c.from+' '+c.to;if((/\+|PWR\+/.test(t))&&(/PWR-|GND|BAT-|\.G$/.test(t)))conflict=true});b.innerHTML=`<div class="check ${conflict?'bad':'ok'}">${conflict?'⚠ Positive / ground conflict':'✓ No direct positive-to-ground conflict'}</div><div class="check ${missing?'warn':'ok'}">${missing?`${missing} fixed power/FC connection(s) missing`:'✓ Fixed power + FC wiring complete'}</div><div class="check ${phaseReady===4?'ok':'warn'}">${phaseReady}/4 motors have three unique U/V/W phase connections</div><div class="check ${selectedWireId?'ok':'warn'}">${selectedWireId?'Wire selected — Delete/Backspace or button removes it':'Click a wire to select/delete/redraw'}</div>`
}
function addOptionalWireDevice(){
 const type=$('#optionalWireDevice')?.value||'ppm';
 if(optionalPlacedIn3D(type)){notify(`${optionalNodeDefinition({type}).title} is already placed in 3D, so it is hidden from the 2D unplaced-parts bench.`,'bad');return}
 const n={id:`OPT${Date.now().toString(36)}`,type};wireRemember();optionalWireNodes.push(n);wireLayout[n.id]={x:1180,y:390+(optionalWireNodes.length-1)*120};render2D();notify(`${optionalNodeDefinition(n).title} added to 2D bench.`)
}
function updateMotorTestUI(){for(let i=1;i<=4;i++){const e=motorElectrical(i),active=motorActive(i),el=$(`#wireM${i}State`);if(el){el.textContent=!e.ready?'OPEN':active?`${e.dir} • RUN`:`${e.dir} • READY`;el.className=active?(e.reverse?'reverse':'running'):''}const dir=$(`#motorDir${i}`);if(dir){dir.textContent=e.ready?e.dir:'OPEN';dir.setAttribute('class',`motor-dir-2d ${e.reverse?'reverse':''}`)}}const pwm=$('#wireThrottle');if($('#wirePwmOut')&&pwm)$('#wirePwmOut').textContent=`${pwm.value} µs`;if($('#wireRunState')){$('#wireRunState').textContent=wireMotorRun?'RUNNING':'STOPPED';$('#wireRunState').className='status '+(wireMotorRun?'good':'')}}
function animate2DMotors(now=performance.now()){requestAnimationFrame(animate2DMotors);const dt=Math.min(.05,(now-wireAnimLast)/1000);wireAnimLast=now;const pwm=+($('#wireThrottle')?.value||1000),speed=pwm<1100?0:(pwm-1000)/1000;for(let i=1;i<=4;i++){if(motorActive(i)){const e=motorElectrical(i),sign=e.dir==='CW'?1:-1;wireMotorAngle[i-1]=(wireMotorAngle[i-1]+sign*dt*(220+speed*1100))%360}const r=$(`#motorRotor${i}`);if(r)r.style.transform=`rotate(${wireMotorAngle[i-1]}deg)`}if(wireMotorRun&&Math.floor(now/150)%2===0)updateMotorTestUI()}
function initWiringControls(){
 $('#wireUndoBtn').onclick=wireUndo;$('#deleteWireBtn').onclick=deleteSelectedWire;$('#centerWireLayoutBtn').onclick=resetWireLayout;$('#addOptionalWireDevice').onclick=addOptionalWireDevice;
 $('#wireRunBtn').onclick=()=>{wireMotorRun=!wireMotorRun;render2D()};$('#wireThrottle').oninput=()=>render2D();$('#wireAllMotors').onchange=()=>render2D();[1,2,3,4].forEach(i=>$(`#wireM${i}`).onchange=()=>render2D());
 window.addEventListener('pointermove',e=>{if(!wireDrag)return;const p=svgLocalPoint($('#wiringSvg'),e.clientX,e.clientY);setNodePos(wireDrag.id,p.x-wireDrag.dx,p.y-wireDrag.dy);render2D()});window.addEventListener('pointerup',()=>{if(wireDrag){wireDrag=null;document.body.style.userSelect='';try{localStorage.setItem('zebjus-v8-wire-layout',JSON.stringify(wireLayout))}catch{}}});
 window.addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&selectedWireId&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();deleteSelectedWire()}});requestAnimationFrame(animate2DMotors)
}

/* ==================== V8 TRIPOD PID SIMULATOR ==================== */
let sScene,sCamera,sRenderer,sControls,sPivot,sDrone,simProps=[],simPropBlurs=[],sDust=null,sDustBase=[],sLast=performance.now(),chart=[],simInitialized=false;
const keyDefaults={rollLeft:'ArrowLeft',rollRight:'ArrowRight',pitchForward:'ArrowUp',pitchBack:'ArrowDown',throttleUp:'w',throttleDown:'s',yawLeft:'a',yawRight:'d',run:'r'};
let keyMap=(()=>{try{return{...keyDefaults,...JSON.parse((localStorage.getItem('zebjus-v10-keys')||localStorage.getItem('zebjus-v9-keys'))||'{}')}}catch{return{...keyDefaults}}})();
const heldKeys=new Set();let keyCaptureAction=null;
function keyLabel(k){return k===' '?'Space':k}
function simClone(type,slotId){const c=product(type);let path=c?.asset;if(type==='prop'&&(slotId==='M2'||slotId==='M4'))path=c.assetCCW;const g=(path?cloneAsset(path):null)||procedural(type,slotId);if(type==='fc')decoratePart(g,'fc',slotId);return g}
function buildFinalSimDrone(){
 const root=new THREE.Group(),baseY=.68;simProps=[];simPropBlurs=[];
 const add=(type,slot)=>{
   const o=simClone(type,slot.id);o.position.set(slot.p[0],slot.p[1]-baseY,slot.p[2]);o.rotation.y=slot.r||0;o.traverse(x=>{if(x.isMesh){x.castShadow=true;x.receiveShadow=true}});root.add(o);
   if(type==='prop'){
     simProps.push(o);
     const blur=new THREE.Mesh(new THREE.CircleGeometry(1.55,64),new THREE.MeshBasicMaterial({color:0xb8c5cc,transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
     blur.rotation.x=-Math.PI/2;blur.position.y=.13;o.add(blur);simPropBlurs.push(blur)
   }
 };
 slots.bottomPlate.forEach(s=>add('bottomPlate',s));slots.armRed.forEach(s=>add('armRed',s));slots.armWhite.forEach(s=>add('armWhite',s));slots.topPlate.forEach(s=>add('topPlate',s));slots.guard.forEach(s=>add('guard',s));slots.motor.forEach(s=>add('motor',s));slots.esc.forEach(s=>add('esc',s));slots.fcTape.forEach(s=>add('fcTape',s));slots.fc.forEach(s=>add('fc',s));slots.batteryStrap.forEach(s=>add('batteryStrap',s));slots.battery.forEach(s=>add('battery',s));slots.prop.forEach(s=>add('prop',s));root.scale.setScalar(.58);return root
}
function simCylinderBetween(a,b,r,color,parent){a=new THREE.Vector3(...a);b=new THREE.Vector3(...b);const d=b.clone().sub(a),L=d.length(),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,L,18),new THREE.MeshStandardMaterial({color,metalness:.35,roughness:.42}));m.position.copy(a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());m.castShadow=true;parent.add(m);return m}
function buildTripod(){
 const g=new THREE.Group(),black=0x11161a,dark=0x20272c;simCylinderBetween([0,.3,0],[0,3.35,0],.13,black,g);simCylinderBetween([0,3.1,0],[0,3.46,0],.22,dark,g);for(const a of[0,2*Math.PI/3,4*Math.PI/3]){const foot=[Math.cos(a)*1.9,.08,Math.sin(a)*1.9],hub=[0,.55,0];simCylinderBetween(hub,foot,.09,black,g);simCylinderBetween([0,.52,0],[Math.cos(a)*1.20,.45,Math.sin(a)*1.20],.055,dark,g);const cap=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.18,18),new THREE.MeshStandardMaterial({color:0x252c31,roughness:.6}));cap.position.set(...foot);cap.rotation.z=Math.PI/2;g.add(cap)}return g
}
function ensureSim(){
 if(simInitialized)return true;
 try{initSim();simInitialized=true;return true}
 catch(e){
  console.error('[ZEBJUS] Tripod simulator init failed:',e);
  const box=$('#simThree');if(box)box.innerHTML=`<div class="runtime-error-card"><b>Tripod 3D unavailable</b><span>${String(e?.message||e)}</span><small>Assembly, wiring, calibration, PID editor and Python Lab remain available.</small></div>`;
  notify('Tripod simulator 3D could not start. Other lab tools remain active.','bad');
  return false
 }
}
function initSim(){
 const e=$('#simThree');if(!e)throw new Error('Tripod simulator container missing');const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||650);sScene=new THREE.Scene();sScene.background=new THREE.Color(0x101b24);sCamera=new THREE.PerspectiveCamera(46,w/h,.1,1000);sCamera.position.set(9,6.4,10.8);sRenderer=new THREE.WebGLRenderer({antialias:true});sRenderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));sRenderer.setSize(w,h);sRenderer.shadowMap.enabled=true;sRenderer.outputColorSpace=THREE.SRGBColorSpace;e.appendChild(sRenderer.domElement);sControls=new MiniOrbitControls(sCamera,sRenderer.domElement);sControls.target.set(0,2.7,0);sControls.enableDamping=true;sScene.add(new THREE.AmbientLight(0xffffff,.65));sScene.add(new THREE.HemisphereLight(0xeaf7ff,0x374550,2.15));const l=new THREE.DirectionalLight(0xffffff,3.0);l.position.set(6,10,7);l.castShadow=true;sScene.add(l);const rim=new THREE.DirectionalLight(0x66d9ff,1.15);rim.position.set(-6,5,-4);sScene.add(rim);const warm=new THREE.PointLight(0xffd6aa,1.15,18);warm.position.set(4,5,2);sScene.add(warm);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,28),new THREE.MeshStandardMaterial({color:0x243039,roughness:.82,metalness:.05}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;sScene.add(floor);sScene.add(new THREE.GridHelper(28,28,0x48606e,0x324651));sScene.add(buildTripod());
 // Dust / downwash particles make propeller speed visually readable.
 const dustCount=180,pos=new Float32Array(dustCount*3);sDustBase=[];for(let i=0;i<dustCount;i++){const a=Math.random()*Math.PI*2,r=1.0+Math.random()*3.8,y=.03+Math.random()*.25;pos[i*3]=Math.cos(a)*r;pos[i*3+1]=y;pos[i*3+2]=Math.sin(a)*r;sDustBase.push({a,r,y,seed:Math.random()*10})}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.BufferAttribute(pos,3));const dm=new THREE.PointsMaterial({color:0xb9a78c,size:.055,transparent:true,opacity:0,depthWrite:false});sDust=new THREE.Points(dg,dm);sScene.add(sDust);
 sPivot=new THREE.Group();sPivot.position.set(0,3.48,0);sScene.add(sPivot);sDrone=buildFinalSimDrone();sPivot.add(sDrone);const clampG=new THREE.Group();simCylinderBetween([-.30,0,0],[.30,0,0],.09,0x161c20,clampG);sPivot.add(clampG);
 $('#simRateP').value=state.pid.rateRoll.P;$('#simRateI').value=state.pid.rateRoll.I;$('#simRateD').value=state.pid.rateRoll.D;$('#simAngleP').value=state.pid.angleRoll.P;$('#simAngleI').value=state.pid.angleRoll.I;$('#simAngleD').value=state.pid.angleRoll.D;$('#simFlightMode').value=state.sim.flightMode;
 $('#simRunBtn').onclick=toggleSimRun;$('#simResetBtn').onclick=resetSim;$('#simFlightMode').onchange=e=>{state.sim.flightMode=e.target.value;resetSimDynamics()};$('#simApplyPidBtn').onclick=applyQuickPid;initSticks();renderKeySettings();window.addEventListener('resize',resizeSim);window.addEventListener('keydown',simKeyDown);window.addEventListener('keyup',simKeyUp);requestAnimationFrame(simLoop)
}
function applyQuickPid(){const p=+$(`#simRateP`).value,i=+$(`#simRateI`).value,d=+$(`#simRateD`).value,a=+$(`#simAngleP`).value,ai=+$(`#simAngleI`).value,ad=+$(`#simAngleD`).value;['rateRoll','ratePitch'].forEach(k=>Object.assign(state.pid[k],{P:p,I:i,D:d}));['angleRoll','anglePitch'].forEach(k=>Object.assign(state.pid[k],{P:a,I:ai,D:ad}));resetSimDynamics();renderPid();notify('Simulator Rate + Angle Roll/Pitch PID updated.')}
function syncQuickPid(){if(!$('#simRateP'))return;$('#simRateP').value=state.pid.rateRoll.P;$('#simRateI').value=state.pid.rateRoll.I;$('#simRateD').value=state.pid.rateRoll.D;$('#simAngleP').value=state.pid.angleRoll.P;$('#simAngleI').value=state.pid.angleRoll.I;$('#simAngleD').value=state.pid.angleRoll.D}
function toggleSimRun(){state.sim.running=!state.sim.running;$('#simRunBtn').textContent=state.sim.running?'STOP':'RUN';$('#simRunBtn').classList.toggle('danger',state.sim.running);if(!state.sim.running)heldKeys.clear()}
function resetSimDynamics(){Object.assign(state.sim,{roll:0,pitch:0,yawRate:0,rollRate:0,pitchRate:0,rollI:0,pitchI:0,angleRollI:0,anglePitchI:0,prevAngleRollErr:0,prevAnglePitchErr:0,cmdRoll:0,cmdPitch:0,cmdYaw:0,vibration:0});chart=[]}
function resetSim(){state.sim.running=false;state.sim.throttle=1000;resetSimDynamics();$('#simRunBtn').textContent='RUN';$('#simRunBtn').classList.remove('danger');setStickVisual('right',0,0);setStickVisual('left',0,1);updateStickText()}
function resizeSim(){if(!sRenderer||!sCamera)return;const e=$('#simThree');if(!e)return;const w=Math.max(1,e.clientWidth||e.getBoundingClientRect().width||900),h=Math.max(1,e.clientHeight||e.getBoundingClientRect().height||650);sCamera.aspect=w/h;sCamera.updateProjectionMatrix();sRenderer.setSize(w,h)}
function tuneQuality(){const p=(state.pid.rateRoll.P+state.pid.ratePitch.P)/2,i=(state.pid.rateRoll.I+state.pid.ratePitch.I)/2,d=(state.pid.rateRoll.D+state.pid.ratePitch.D)/2,a=(state.pid.angleRoll.P+state.pid.anglePitch.P)/2,ai=(state.pid.angleRoll.I+state.pid.anglePitch.I)/2,ad=(state.pid.angleRoll.D+state.pid.anglePitch.D)/2;if(p<.55||a<1.8)return{label:'UNDER-TUNED',cls:'tune-under',vib:.05};const over=Math.max(0,p-1.25)*1.2+Math.max(0,.022-d)*18+Math.max(0,i-20)*.08+Math.max(0,a-5)*.2+Math.max(0,ai-2)*.12+Math.max(0,ad-.18)*2;if(over>.2)return{label:'OSCILLATING',cls:'tune-over',vib:Math.min(2.4,.25+over)};return{label:'STABLE',cls:'tune-stable',vib:.04}}
function simLoop(now){
 requestAnimationFrame(simLoop);const dt=Math.min(.035,(now-sLast)/1000||.016);sLast=now;const s=state.sim,q=tuneQuality();const throttleAuthority=clamp((s.throttle-1050)/650,0,1);
 if(state.sim.running){
   const keyRoll=(heldKeys.has(keyMap.rollRight)?1:0)-(heldKeys.has(keyMap.rollLeft)?1:0),keyPitch=(heldKeys.has(keyMap.pitchBack)?1:0)-(heldKeys.has(keyMap.pitchForward)?1:0),keyYaw=(heldKeys.has(keyMap.yawRight)?1:0)-(heldKeys.has(keyMap.yawLeft)?1:0);const cmdR=clamp(s.cmdRoll+keyRoll,-1,1),cmdP=clamp(s.cmdPitch+keyPitch,-1,1),cmdY=clamp(s.cmdYaw+keyYaw,-1,1);if(keyRoll||keyPitch)setStickVisual('right',cmdR,-cmdP);if(keyYaw)setStickVisual('left',cmdY,(1500-s.throttle)/500);
   let desiredRollRate=cmdR*220,desiredPitchRate=-cmdP*220;if(s.flightMode==='angle'){const erA=cmdR*24-s.roll,epA=-cmdP*24-s.pitch;s.angleRollI=clamp(s.angleRollI+erA*dt,-40,40);s.anglePitchI=clamp(s.anglePitchI+epA*dt,-40,40);const drA=(erA-s.prevAngleRollErr)/Math.max(dt,.004),dpA=(epA-s.prevAnglePitchErr)/Math.max(dt,.004);s.prevAngleRollErr=erA;s.prevAnglePitchErr=epA;desiredRollRate=clamp(erA*state.pid.angleRoll.P+s.angleRollI*state.pid.angleRoll.I+drA*state.pid.angleRoll.D,-220,220);desiredPitchRate=clamp(epA*state.pid.anglePitch.P+s.anglePitchI*state.pid.anglePitch.I+dpA*state.pid.anglePitch.D,-220,220)}
   const er=desiredRollRate-s.rollRate,ep=desiredPitchRate-s.pitchRate;s.rollI=clamp(s.rollI+er*dt,-80,80);s.pitchI=clamp(s.pitchI+ep*dt,-80,80);const p=(state.pid.rateRoll.P+state.pid.ratePitch.P)/2,i=(state.pid.rateRoll.I+state.pid.ratePitch.I)/2,d=(state.pid.rateRoll.D+state.pid.ratePitch.D)/2;const gain=(.55+p*1.05)*(.18+.82*throttleAuthority),damp=1.4+d*24;
   s.rollRate+=(er*gain+s.rollI*i*.0022-s.rollRate*damp)*dt;s.pitchRate+=(ep*gain+s.pitchI*i*.0022-s.pitchRate*damp)*dt;s.yawRate+=(cmdY*160-s.yawRate)*dt*(.7+throttleAuthority*2);s.roll=clamp(s.roll+s.rollRate*dt,-42,42);s.pitch=clamp(s.pitch+s.pitchRate*dt,-42,42)
 }else{s.rollRate*=Math.exp(-4*dt);s.pitchRate*=Math.exp(-4*dt);s.yawRate*=Math.exp(-4*dt);s.roll*=Math.exp(-2*dt);s.pitch*=Math.exp(-2*dt)}
 const vib=state.sim.running?q.vib*(.3+.7*throttleAuthority):0,jx=Math.sin(now*.052)*vib,jz=Math.sin(now*.071+1.7)*vib*.8;sPivot.rotation.z=-rad(s.roll+jx);sPivot.rotation.x=rad(s.pitch+jz);sPivot.rotation.y+=rad(s.yawRate)*dt*.15;
 const propSpeed=state.sim.running?Math.max(0,(s.throttle-1000)/1000):0;
 simProps.forEach((p,i)=>p.rotation.y+=(i%2?1:-1)*dt*(1.5+propSpeed*86));
 simPropBlurs.forEach(b=>{b.material.opacity=clamp((propSpeed-.10)*.30,0,.22);b.scale.setScalar(1+propSpeed*.05)});
 if(sDust){sDust.material.opacity=state.sim.running?clamp((propSpeed-.06)*1.10,0,.62):0;const ar=sDust.geometry.attributes.position.array;for(let i=0;i<sDustBase.length;i++){const qd=sDustBase[i],spin=now*.00045*(1+propSpeed*6)+qd.seed;const rr=qd.r+Math.sin(spin*2+qd.seed)*.18*propSpeed;ar[i*3]=Math.cos(qd.a+spin*propSpeed)*rr;ar[i*3+2]=Math.sin(qd.a+spin*propSpeed)*rr;ar[i*3+1]=qd.y+Math.abs(Math.sin(spin*3+qd.seed))*.45*propSpeed}sDust.geometry.attributes.position.needsUpdate=true}
 $('#simRoll').textContent=s.roll.toFixed(1)+'°';$('#simPitch').textContent=s.pitch.toFixed(1)+'°';$('#simYaw').textContent=s.yawRate.toFixed(1)+'°/s';const ts=$('#simTuneState');ts.textContent=q.label;ts.className=q.cls;
 const throttlePct=clamp((s.throttle-1000)/10,0,100),mix=[throttlePct+s.roll*1.1-s.pitch*1.1+s.yawRate*.08,throttlePct-s.roll*1.1-s.pitch*1.1-s.yawRate*.08,throttlePct-s.roll*1.1+s.pitch*1.1+s.yawRate*.08,throttlePct+s.roll*1.1+s.pitch*1.1-s.yawRate*.08].map(v=>clamp(v,0,100));mix.forEach((v,i)=>$('#m'+(i+1)).textContent=Math.round(v)+'%');
 if(Math.floor(now/75)%2===0){chart.push({r:s.roll,p:s.pitch});if(chart.length>180)chart.shift();drawChart()}updateStickText();sControls.update();sRenderer.render(sScene,sCamera);if(!state.fc.connected){state.telemetry.roll=s.roll;state.telemetry.pitch=s.pitch;state.telemetry.yaw=s.yawRate;state.telemetry.gyroX=s.rollRate;state.telemetry.gyroY=s.pitchRate;state.telemetry.gyroZ=s.yawRate;telemetryUI()}
}
function drawChart(){const c=$('#simChart'),x=c.getContext('2d'),w=c.width,h=c.height;x.clearRect(0,0,w,h);x.strokeStyle='#17344a';for(let i=0;i<5;i++){const y=i*h/4;x.beginPath();x.moveTo(0,y);x.lineTo(w,y);x.stroke()}const p=(k,col)=>{x.strokeStyle=col;x.lineWidth=2;x.beginPath();chart.forEach((d,i)=>{const px=i/Math.max(1,chart.length-1)*w,py=h/2-d[k]/45*h*.42;i?x.lineTo(px,py):x.moveTo(px,py)});x.stroke()};p('r','#53efbd');p('p','#54dbef')}
function initSticks(){bindStick($('#rightStick'),'right');bindStick($('#leftStick'),'left');setStickVisual('right',0,0);setStickVisual('left',0,1)}
function bindStick(el,which){let drag=false;const update=e=>{const r=el.getBoundingClientRect(),x=clamp(((e.clientX-r.left)/r.width-.5)*2,-1,1),y=clamp(((e.clientY-r.top)/r.height-.5)*2,-1,1);if(which==='right'){state.sim.cmdRoll=x;state.sim.cmdPitch=-y;setStickVisual('right',x,y)}else{state.sim.cmdYaw=x;state.sim.throttle=Math.round(1500-y*500);setStickVisual('left',x,y)}updateStickText()};el.onpointerdown=e=>{drag=true;el.setPointerCapture?.(e.pointerId);update(e)};el.onpointermove=e=>{if(drag)update(e)};el.onpointerup=()=>{drag=false;if(which==='right'){state.sim.cmdRoll=0;state.sim.cmdPitch=0;setStickVisual('right',0,0)}else{state.sim.cmdYaw=0;const y=(1500-state.sim.throttle)/500;setStickVisual('left',0,y)}updateStickText()}}
function setStickVisual(which,x,y){const k=$(which==='right'?'#rightStickKnob':'#leftStickKnob');if(k){k.style.left=`${50+x*34}%`;k.style.top=`${50+y*34}%`}}
function updateStickText(){if($('#rightStickRead'))$('#rightStickRead').textContent=`P ${Math.round(state.sim.cmdPitch*100)} • R ${Math.round(state.sim.cmdRoll*100)}`;if($('#leftStickRead'))$('#leftStickRead').textContent=`T ${state.sim.throttle} • Y ${Math.round(state.sim.cmdYaw*100)}`}
function simKeyDown(e){if(keyCaptureAction){e.preventDefault();keyMap[keyCaptureAction]=e.key;keyCaptureAction=null;renderKeySettings();return}if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;if(!$('#tab-sim')?.classList.contains('active'))return;const relevant=Object.values(keyMap).includes(e.key);if(!relevant)return;e.preventDefault();if(e.key===keyMap.run&&!e.repeat){toggleSimRun();return}heldKeys.add(e.key);if(e.key===keyMap.throttleUp)state.sim.throttle=clamp(state.sim.throttle+25,1000,2000);if(e.key===keyMap.throttleDown)state.sim.throttle=clamp(state.sim.throttle-25,1000,2000);const y=(1500-state.sim.throttle)/500;setStickVisual('left',0,y)}
function simKeyUp(e){heldKeys.delete(e.key);if([keyMap.rollLeft,keyMap.rollRight,keyMap.pitchForward,keyMap.pitchBack].includes(e.key))setStickVisual('right',state.sim.cmdRoll,-state.sim.cmdPitch);if([keyMap.yawLeft,keyMap.yawRight].includes(e.key))setStickVisual('left',state.sim.cmdYaw,(1500-state.sim.throttle)/500)}
function renderKeySettings(){const box=$('#keySettings');if(!box)return;const labels={rollLeft:'Roll left',rollRight:'Roll right',pitchForward:'Pitch forward',pitchBack:'Pitch back',throttleUp:'Throttle +',throttleDown:'Throttle −',yawLeft:'Yaw left',yawRight:'Yaw right',run:'Run / Stop'};box.innerHTML=Object.entries(labels).map(([k,l])=>`<div class="key-row"><span>${l}</span><button class="key-capture ${keyCaptureAction===k?'listening':''}" data-key-action="${k}">${keyCaptureAction===k?'PRESS KEY…':keyLabel(keyMap[k])}</button></div>`).join('');$$('.key-capture').forEach(b=>b.onclick=()=>{keyCaptureAction=b.dataset.keyAction;renderKeySettings()})}
function initSettings(){renderKeySettings();$('#saveKeysBtn').onclick=()=>{try{localStorage.setItem('zebjus-v10-keys',JSON.stringify(keyMap))}catch{}notify('Keyboard mapping saved.')};$('#resetKeysBtn').onclick=()=>{keyMap={...keyDefaults};try{localStorage.removeItem('zebjus-v10-keys');localStorage.removeItem('zebjus-v9-keys')}catch{}renderKeySettings();notify('Default key mapping restored.')}}

/* FC / CAL / PID / PYTHON */
function fcLog(t){const e=$('#fcLog');e.textContent+=`\n${new Date().toLocaleTimeString()} ${t}`;e.scrollTop=e.scrollHeight}
function fcStatus(on){state.fc.connected=on;$('#fcBadge').textContent=on?'Connected':'Disconnected';$('#fcBadge').className='status '+(on?'good':'')}
function connectFc(){disconnectFc(false);const ip=$('#fcIp').value.trim(),path=$('#fcPath').value.trim(),pref=$('#fcProtocol').value,proto=pref==='auto'?(location.protocol==='https:'?'wss':'ws'):pref,url=`${proto}://${ip}${path}`;fcLog('Connecting '+url);try{const ws=new WebSocket(url);state.fc.socket=ws;ws.onopen=()=>{fcStatus(true);fcLog('Connected');sendFc({type:'hello',client:'ZEBJUS F450 Lab V14'})};ws.onmessage=e=>packet(e.data);ws.onerror=()=>fcLog('WebSocket error');ws.onclose=()=>fcStatus(false)}catch(e){fcLog(e.message)}}
function disconnectFc(log=true){if(state.fc.socket)try{state.fc.socket.close()}catch{}state.fc.socket=null;fcStatus(false);if(log)fcLog('Disconnected')}
function sendFc(o){if(state.fc.socket?.readyState===1){state.fc.socket.send(JSON.stringify(o));fcLog('TX '+JSON.stringify(o));return true}fcLog('Not connected');return false}
function packet(raw){let d;try{d=JSON.parse(raw)}catch{d={raw}};['roll','pitch','yaw','gyroX','gyroY','gyroZ','battery'].forEach(k=>{if(Number.isFinite(+d[k]))state.telemetry[k]=+d[k]});$('#telemetryLog').textContent=(new Date().toLocaleTimeString()+' '+raw+'\n'+$('#telemetryLog').textContent).slice(0,12000);telemetryUI()}
function telemetryUI(){const t=state.telemetry;$('#telRoll').textContent=t.roll.toFixed(2)+'°';$('#telPitch').textContent=t.pitch.toFixed(2)+'°';$('#telYaw').textContent=t.yaw.toFixed(2)+'°';$('#telBatt').textContent=t.battery?t.battery.toFixed(2)+' V':'-- V';$('#gyroX').textContent=t.gyroX.toFixed(3);$('#gyroY').textContent=t.gyroY.toFixed(3);$('#gyroZ').textContent=t.gyroZ.toFixed(3);$('#levelState').textContent=(Math.abs(t.roll)<2&&Math.abs(t.pitch)<2)?'LEVEL':'TILTED'}
function initCal(){const a=[['Gyro zero','Keep level and still','calibrate_gyro'],['Accel +Z','Normal top-up','acc_zp'],['Accel +X','Right side','acc_xp'],['Accel −X','Left side','acc_xn'],['Accel +Y','Nose up','acc_yp'],['Accel −Y','Nose down','acc_yn'],['Level trim','Return level','calibrate_level'],['Motor order','REMOVE PROPELLERS','motor_order_test']];$('#calSteps').innerHTML=a.map((v,i)=>`<div class="cal-step"><i>${i+1}</i><div><b>${v[0]}</b><span>${v[1]}</span></div><button class="btn ghost small" data-c="${v[2]}">Run</button></div>`).join('');$$('#calSteps button').forEach(b=>b.onclick=()=>state.fc.connected?sendFc({type:b.dataset.c}):(b.textContent='Sim ✓',setTimeout(()=>b.textContent='Run',800)))}
function renderPid(){const g=[['Rate PID',[['Roll','rateRoll'],['Pitch','ratePitch'],['Yaw','rateYaw']]],['Angle PID',[['Roll','angleRoll'],['Pitch','anglePitch']]]];$('#pidEditor').innerHTML=g.map(x=>`<div class="pid-section"><h3>${x[0]}</h3>${x[1].map(([n,k])=>`<div class="pid-row"><span>${n}</span>${['P','I','D'].map(v=>`<label>${v}<input type="number" step=".001" data-p="${k}" data-k="${v}" value="${state.pid[k][v]}"></label>`).join('')}</div>`).join('')}</div>`).join('');$$('#pidEditor input').forEach(i=>i.onchange=()=>{state.pid[i.dataset.p][i.dataset.k]=+i.value;syncQuickPid?.()})}
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
function save(){try{localStorage.setItem('zebjusF450V14',JSON.stringify({guided:state.guided,step:state.step,parts:state.parts.filter(p=>!p.internal&&p.type!=='batteryStrap').map(p=>({type:p.type,slotId:p.slotId})),actions:[...state.doneActions],connections:state.connections,pid:state.pid}));$('#saveState').textContent='Saved';setTimeout(()=>$('#saveState').textContent='Ready',800)}catch(e){console.warn('[ZEBJUS] Save unavailable:',e);notify('Browser storage is unavailable in this embed/session.','bad')}}
function load(){try{const raw13=localStorage.getItem('zebjusF450V14'),rawLegacy=localStorage.getItem('zebjusF450V121')||localStorage.getItem('zebjusF450V12')||localStorage.getItem('zebjusF450V10')||localStorage.getItem('zebjusF450V9'),d=JSON.parse(raw13||rawLegacy||'null');if(!d)return;history.restoring=true;state.guided=d.guided??true;state.step=raw13?(d.step||0):0;state.doneActions=new Set(d.actions||[]);state.connections=d.connections||[];state.pid=d.pid||state.pid;(d.parts||[]).filter(p=>p.type!=='fcStandoff'&&p.type!=='batteryStrap').forEach(p=>{const s=(slots[p.type]||[]).find(x=>x.id===p.slotId);if(s)install(p.type,s,false)});if(!raw13){const firstIncomplete=steps.findIndex((_,i)=>!stepDone(i));state.step=firstIncomplete<0?steps.length-1:firstIncomplete}render2D();renderPid();rebuild3DWires();rebuildSolder();setPowerVisual(state.doneActions.has('xt60'),true);history.restoring=false}catch(e){console.warn(e)}}
function initButtons(){
 $('#undoBtn').onclick=undoAction;$('#redoBtn').onclick=redoAction;
 $('#guidedModeBtn').onclick=()=>{historyPush();state.guided=true;$('#guidedModeBtn').classList.add('active');$('#freeModeBtn').classList.remove('active');renderAssemblyUI();showGuides()};$('#freeModeBtn').onclick=()=>{historyPush();state.guided=false;$('#freeModeBtn').classList.add('active');$('#guidedModeBtn').classList.remove('active');guidesRoot?.clear();renderAssemblyUI()};
 $('#prevStepBtn').onclick=()=>{historyPush();state.step=Math.max(0,state.step-1);renderAssemblyUI();showGuides()};$('#nextStepBtn').onclick=()=>{if(state.guided&&!stepDone(state.step)){notify('Complete current step first.','bad');return}historyPush();state.step=Math.min(steps.length-1,state.step+1);renderAssemblyUI();showGuides()};
 $('#objectViewBtn').onclick=()=>setWireMap(false);$('#wireMapBtn').onclick=()=>setWireMap(true);$('#xrayBtn').onclick=()=>{state.xray=!state.xray;$('#xrayBtn').classList.toggle('active',state.xray);document.body.classList.toggle('xray',state.xray)};$('#view3dBtn').onclick=()=>setView('3d');$('#topBtn').onclick=()=>setView('top');$('#frontBtn').onclick=()=>setView('front');$('#explodeBtn').onclick=toggleExplode;$('#autoRotateBtn').onclick=()=>{state.autoRotate=!state.autoRotate;$('#autoRotateBtn').classList.toggle('active',state.autoRotate)};
 $('#saveBtn').onclick=save;$('#resetBtn').onclick=()=>{if(confirm('Reset project?')){try{localStorage.removeItem('zebjusF450V14');localStorage.removeItem('zebjusF450V10');localStorage.removeItem('zebjusF450V9')}catch{}location.reload()}};
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
 bootStep('Settings',initSettings);
 loadAssets();
 if(threeOK){bootStep('Saved project',load);bootStep('Assembly refresh',renderAssemblyUI);bootStep('3D guides',showGuides)}
 bootStep('PID quick sync',syncQuickPid);
 if(threeOK){setBootStatus('Local 3D engine ready','good');notify('3D engine ready • offline/local runtime.','good')}
 else{setBootStatus('3D unavailable • 2D tools active');notify('3D renderer unavailable — 2D tools are still active.','bad')}
 window.__zebjusAppLoaded=true;
 window.dispatchEvent(new CustomEvent('zebjus-app-ready',{detail:{three:threeOK,version:'14.0'}}));
}
boot();
