(()=>{'use strict';let panel;
function start(){const school=window.zebjusSchool,root=document.getElementById('labKitConsole');if(!school||!root||!window.AerionConsole){setTimeout(start,100);return}
 panel=AerionConsole.mount(root,{kit:()=>school.isSelectedConnected()?school.getSelectedDevice():null,owned:()=>school.canControl(),command:data=>school.commandDevice(data),ensureControl:()=>school.acquireLock(false),prepareSetup:()=>school.prepareFcSetup(),afterSetup:()=>school.releaseLock(false),request:(path,data)=>{const c=school.client;return c.request(path+(data?'':(path.includes('?')?'&':'?')+'clientId='+encodeURIComponent(c.clientId)),{method:data?'POST':'GET',data:data?{clientId:c.clientId,expectedDeviceId:c.deviceId,...data}:null,timeout:6500})},networkChanged:()=>{school.client.disconnect();school.markOffline('Kit is changing Wi-Fi. Join the new network, then reconnect.')}},{wizard:false});
 const rec=AerionFlightRecorder.create({actor:'web',context:()=>({userAgent:navigator.userAgent,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,device:school.getSelectedDevice(),connected:school.isSelectedConnected(),ownsControl:school.canControl(),rcMonitor:school.rcMonitor?.diagnostics?.(),setupReport:window.AerionFcSetup?.getReport?.(school.getSelectedDevice()?.deviceId)})});
 window.AerionWebRecorder=rec;AerionFlightRecorder.mount(document.getElementById('flightRecorderRoot'),rec);
 window.addEventListener('aerion-telemetry',e=>rec.ingest(e.detail,{tab:window.zebjusLabAPI?.getActiveTab?.(),tripod:window.zebjusLabAPI?.getSimState?.(),training:window.AerionTraining?.diagnostics?.()}));
 window.addEventListener('aerion-link-event',e=>rec.event('link',e.detail.message,e.detail));
 window.addEventListener('zebjus-device-command-result',e=>{const d=e.detail;if(!d.ok||['training_select','training_begin','training_end','setup_begin','setup_end','pid_set'].includes(d.type))rec.event(d.ok?'command':'command-error',d.type+': '+(d.error||'accepted'),{type:d.type,ok:d.ok,sentAt:d.sentAt,ackAt:d.ackAt});});
 window.addEventListener('error',e=>rec.error(e.message));window.addEventListener('unhandledrejection',e=>rec.error(e.reason?.message||e.reason));
 setInterval(()=>panel.update(),1200);window.addEventListener('aerion-telemetry',e=>panel.telemetry(e.detail));window.AerionLabDiagnostics=panel;
 // Diagnostics stays read-only when the phone owns the kit.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
