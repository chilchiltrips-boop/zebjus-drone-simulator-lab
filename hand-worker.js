'use strict';
// Classic Worker: the pinned MediaPipe WASM loader uses importScripts.
// Inference stays off the UI/RC thread; at most one frame is transferred at a time.
let detector=null;
self.onmessage=async event=>{
 const m=event.data||{};
 try{
  if(m.type==='init'){
   const {FilesetResolver,HandLandmarker}=await import('./vendor/mediapipe/vision_bundle.mjs');
   const files=await FilesetResolver.forVisionTasks(new URL('./vendor/mediapipe/wasm',self.location.href).href);
   detector=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:new URL('./vendor/mediapipe/hand_landmarker.task',self.location.href).href,delegate:'CPU'},runningMode:'VIDEO',numHands:2});
   self.postMessage({type:'ready'});
  }else if(m.type==='frame'){
   if(!detector)throw new Error('Hand model is not ready');
   const result=detector.detectForVideo(m.bitmap,m.videoTimestamp);
   self.postMessage({type:'hands',data:{landmarks:(result.landmarks||[]).map(hand=>hand.map(p=>({x:p.x,y:p.y,z:p.z}))),handedness:(result.handedness||[]).map(x=>x?.[0]?.categoryName||'Unknown'),timestampMs:m.capturedAt}});
  }
 }catch(e){self.postMessage({type:'error',error:String(e?.message||e)})}
 finally{m.bitmap?.close()}
};
