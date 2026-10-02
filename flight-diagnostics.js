(()=>{'use strict';let panel;
function start(){const school=window.zebjusSchool,root=document.getElementById('labKitConsole');if(!school||!root||!window.AerionConsole){setTimeout(start,100);return}
 panel=AerionConsole.mount(root,{kit:()=>school.isSelectedConnected()?school.getSelectedDevice():null,owned:()=>school.canControl(),command:data=>school.commandDevice(data),ensureControl:()=>school.acquireLock(false),request:(path,data)=>{const c=school.client;return c.request(path+(data?'':(path.includes('?')?'&':'?')+'clientId='+encodeURIComponent(c.clientId)),{method:data?'POST':'GET',data:data?{clientId:c.clientId,expectedDeviceId:c.deviceId,...data}:null,timeout:6500})},networkChanged:()=>{school.client.disconnect();school.markOffline('Kit is changing Wi-Fi. Join the new network, then reconnect.')}});
 setInterval(()=>panel.update(),1200);window.addEventListener('aerion-telemetry',e=>panel.telemetry(e.detail));window.AerionLabDiagnostics=panel;
 // Diagnostics stays read-only when the phone owns the kit.
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
