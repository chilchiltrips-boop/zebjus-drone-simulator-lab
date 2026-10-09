/* Virtual sensors enter the paired FC. Returned motor values stay in virtual physics. */
(function(w){'use strict';
let binding='',engine='WEB',run=0,sequence=0,inFlight=false,output=null,at=0,source=null,lastSent=0,generation=0,acceptedSensorSeq=0;
function kit(){const s=w.zebjusSchool,d=s?.getSelectedDevice?.();return s?.isSelectedConnected?.()&&d&&String(d.mode).startsWith('AP')&&w.ZfcSecurity?.get(s.client.base)&&Date.now()-(w.ZfcSecurity.get(s.client.base).lastReceive||0)<1500?d:null;}
function allowed(target){const d=kit();return !!d&&w.zebjusSchool?.webAppMatches?.(d)&&d.trainingActive&&d.outputsBlocked===true&&d.trainingTarget===target&&d.trainingController==='APP';}
async function select(value,target){
 const d=kit();if(!allowed(target))throw Error('Connect and pair the kit AP; select '+target+' in the app first.');
 if(value==='FC_PID'&&d.boardId!=='ZFC-A2')throw Error('This kit uses the laptop engine. Advanced Kit PID requires A2.');
 const g=++generation;output=null;at=0;sequence=0;acceptedSensorSeq=0;run=d.trainingRunId;binding=d.deviceId;source=target;
 const r=await w.zebjusSchool.client.command({type:'training_engine',engine:value,runId:run});
 if(g!==generation)return;if(!r.outputsBlocked||r.runId!==run||r.deviceId!==binding)throw Error('FC did not confirm virtual output inhibition.');engine=value;return r;
}
function pause(){generation++;output=null;at=0;inFlight=false;}
function stop(){generation++;engine='WEB';output=null;at=0;binding='';run=0;inFlight=false;}
function tick(target,sensors){
 if(engine!=='FC_PID'||inFlight||performance.now()-lastSent<100)return;const d=kit();
 if(!allowed(target)){const selected=w.zebjusSchool?.getSelectedDevice?.();if(selected?.deviceId===binding&&selected.trainingRunId===run&&selected.trainingActive&&selected.outputsBlocked){pause();return;}stop();return;}if(d.deviceId!==binding||d.trainingRunId!==run){stop();return;}
 const g=generation,n=++sequence;lastSent=performance.now();inFlight=true;
 w.zebjusSchool.client.command({type:'training_sensor',runId:run,sensorSeq:n,...sensors}).then(r=>{
  if(g!==generation)return;
  if(r.deviceId!==binding||r.runId!==run||!r.outputsBlocked||r.engine!=='FC_PID'||!Array.isArray(r.motors)||r.motors.length!==4||r.motors.some(x=>!Number.isFinite(x)||x<1000||x>2000))throw Error('Invalid FC virtual output.');
  // Task outputs correspond to an already accepted sensor sample, never a future sample.
  if(!Number.isInteger(r.sensorSeq)||r.sensorSeq<=acceptedSensorSeq||r.sensorSeq>n)return;
  acceptedSensorSeq=r.sensorSeq;output=r;at=performance.now();
 }).catch(e=>{if(g===generation){output=null;at=0;w.dispatchEvent(new CustomEvent('zebjus-drone-diagnostic',{detail:{kind:'fc-training',message:e.message}}));}}).finally(()=>{if(g===generation)inFlight=false;});
}
function current(target){return engine==='FC_PID'&&source===target&&performance.now()-at<=220?output:null;}
w.AerionFcTraining={kit,allowed,select,tick,current,pause,stop,get engine(){return engine},get source(){return source}};
function mount(){
 for(const [id,target] of [['simRunBtn','TRIPOD'],['trainingStart','FLIGHT']]){
  const node=document.getElementById(id);if(!node||document.querySelector('[data-fc-engine="'+target+'"]'))continue;
  const label=document.createElement('label');label.textContent='Controller ';const select=document.createElement('select');select.dataset.fcEngine=target;
  select.innerHTML='<option value="WEB">Laptop PID · paired kit required</option><option value="FC_PID">Kit PID · advanced training</option>';
  select.onchange=async()=>{select.disabled=true;try{await w.AerionFcTraining.select(select.value,target);}catch(e){select.value='WEB';w.AerionFcTraining.stop();w.alert(e.message);}finally{select.disabled=false;}};label.append(select);node.after(label);
 }
}
setInterval(mount,500);w.addEventListener('pagehide',stop);
})(window);
