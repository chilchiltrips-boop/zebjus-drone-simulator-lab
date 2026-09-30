/* Test the actual browser camera routines without requiring a physical webcam. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.js'), 'utf8');
const begin = source.indexOf('let pythonCameraStream=null');
const end = source.indexOf('function pythonCameraFrame()', begin);
assert(begin > 0 && end > begin);
const nodes = {
  '#pythonCameraVideo': {srcObject:null, play:async()=>{}, closest:()=>({open:false})},
  '#pythonCameraStatus': {textContent:''},
  '#pythonHandsToggle': {textContent:''},
  '#pythonCameraOverlay': {width:640,height:480,getContext:()=>({clearRect:()=>{}})}
};
let resolvePermission;
const sandbox = {
  navigator:{mediaDevices:{getUserMedia:()=>new Promise(resolve=>{resolvePermission=resolve})}},
  $:selector=>nodes[selector],pythonWorker:null,console,clearInterval:()=>{},startPythonOutputPreview:()=>{},clearPythonCameraOutput:()=>{}
};
vm.runInNewContext(source.slice(begin,end)+'\nglobalThis.cameraApi={startPythonCamera,stopPythonCamera,active:()=>!!pythonCameraStream};', sandbox);
function fakeStream(){const track={stopped:false,stop(){this.stopped=true}};return {track,getTracks:()=>[track]}}
(async()=>{
  const pending=sandbox.cameraApi.startPythonCamera();
  sandbox.cameraApi.stopPythonCamera();
  const late=fakeStream();resolvePermission(late);await pending;
  assert(late.track.stopped,'late camera permission must stop its track');
  assert(!sandbox.cameraApi.active(),'late camera permission must not reopen video');
  const livePending=sandbox.cameraApi.startPythonCamera();
  const live=fakeStream();resolvePermission(live);await livePending;
  assert(sandbox.cameraApi.active(),'camera should open during a run');
  sandbox.cameraApi.stopPythonCamera();
  assert(live.track.stopped && !sandbox.cameraApi.active(),'Stop must release the camera');
  console.log('PASS: camera permission cancellation and track cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
