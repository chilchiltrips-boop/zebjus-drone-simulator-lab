/* Read-only controller RC stream; HTTP configuration and control grants stay separate. */
(function(scope){'use strict';
 const MAX_LINE=1200,STALE_MS=1400;
 function validPacket(t,id){return t?.type==='rc_live'&&String(t.deviceId).toUpperCase()===String(id).toUpperCase()&&Number.isInteger(t.controllerMs)&&t.controllerMs>=0&&Number.isInteger(t.trainingRunId)&&t.trainingRunId>=0&&typeof t.trainingActive==='boolean'&&t.outputsBlocked===t.trainingActive&&['NONE','TRIPOD','FLIGHT'].includes(t.trainingTarget)&&(!t.trainingActive||t.trainingTarget!=='NONE')&&['NONE','PPM','WEB_AP','WEB_STA'].includes(t.rcSource)&&Number.isFinite(t.rcAgeMs)&&t.rcAgeMs>=0&&Array.isArray(t.rc)&&t.rc.length===10&&t.rc.every(v=>Number.isInteger(v)&&v>=1000&&v<=2000);}
 class RcLiveStream{
  constructor({packet=()=>{},event=()=>{}}={}){this.packet=packet;this.event=event;this.binding='';this.latest=null;this.receivedAt=0;this.generation=0;this.retry=null;this.abort=null;this.state='off';this.stats={protocol:'NDJSON1',frames:0,reconnects:0,invalidFrames:0,lastError:''};}
  get live(){return this.state==='live'&&Date.now()-this.receivedAt<STALE_MS;}
  setState(state,message){if(this.state===state)return;this.state=state;this.event({kind:'rc-monitor',state,message,deviceId:this.deviceId,transport:'NDJSON1'});}
  update(base,id,info){
   const next=base&&id&&info?.rcMonitorProtocol==='NDJSON1'&&Number(info.rcMonitorPort)===4211?base+'|'+id:'';
   if(next===this.binding)return;this.stop();if(!next)return;
   this.binding=next;this.base=base;this.deviceId=id;this.stats={protocol:'NDJSON1',frames:0,reconnects:0,invalidFrames:0,lastError:''};this.connect();
  }
  stop(){this.generation++;clearTimeout(this.retry);this.retry=null;this.abort?.abort();this.abort=null;this.binding='';this.latest=null;this.receivedAt=0;this.state='off';}
  async connect(){
   if(!this.binding||this.abort)return;const generation=this.generation,ctl=new AbortController();this.abort=ctl;
   const url=new URL('/api/rc/live',this.base);url.port='4211';url.search=new URLSearchParams({deviceId:this.deviceId});
   let reader,timer,lastClock=null,buffer='';this.setState('connecting','Connecting the live RC monitor.');
   try{
    timer=setTimeout(()=>ctl.abort(),5000);
    const response=await fetch(url.href,{signal:ctl.signal,cache:'no-store',targetAddressSpace:'local'});
    if(!response.ok||!response.body?.getReader)throw Error('Live RC monitor unavailable; using telemetry polling.');
    clearTimeout(timer);let lastRead=Date.now();timer=setInterval(()=>{if(Date.now()-lastRead>STALE_MS)ctl.abort();},200);
    reader=response.body.getReader();const decoder=new TextDecoder();
    while(generation===this.generation){
     const result=await reader.read();if(result.done)throw Error('Live RC monitor closed.');buffer+=decoder.decode(result.value,{stream:true});
     let newline,count=0;while((newline=buffer.indexOf('\n'))>=0){
      const line=buffer.slice(0,newline);buffer=buffer.slice(newline+1);if(line.length>MAX_LINE||++count>64)throw Error('Live RC packet exceeds its limit.');if(!line.trim())continue;
      let t;try{t=JSON.parse(line);}catch{this.stats.invalidFrames++;continue;}
      if(!validPacket(t,this.deviceId)||lastClock!==null&&((t.controllerMs-lastClock)|0)<=0){this.stats.invalidFrames++;continue;}
      if(generation!==this.generation)return;lastClock=t.controllerMs;lastRead=this.receivedAt=Date.now();this.latest=t;this.stats.frames++;this.stats.lastError='';this.setState('live','Live RC monitor connected (NDJSON1).');this.packet(t);
     }
     if(buffer.length>MAX_LINE)throw Error('Incomplete live RC packet exceeds its limit.');
    }
   }catch(error){if(generation===this.generation){this.stats.lastError=error.name==='AbortError'?'Live RC monitor timed out.':error.message;this.setState('retrying',this.stats.lastError+' Retrying; telemetry polling remains available.');}}
   finally{
    clearTimeout(timer);clearInterval(timer);try{await reader?.cancel();}catch{}ctl.abort();
    if(generation===this.generation){this.abort=null;if(this.binding){this.stats.reconnects++;this.retry=setTimeout(()=>this.connect(),1000);}}
   }
  }
  diagnostics(){return{...this.stats,state:this.state,frameAgeMs:this.receivedAt?Date.now()-this.receivedAt:null};}
 }
 scope.AerionRcLive={RcLiveStream,validPacket};if(typeof module!=='undefined')module.exports=scope.AerionRcLive;
})(typeof window!=='undefined'?window:globalThis);
