/* Compact, viewport-sized lab inside Wix and other cross-origin frames. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search),framed=window.self!==window.top;
 const enabled=params.get('embed')==='0'?false:framed||['1','true','wix'].includes(params.get('embed'));
 if(enabled)document.documentElement.classList.add('zebjus-embedded');
 // Browser prompt/confirm dialogs are blocked in cross-origin Wix frames.
 function ask(kind,message,value=''){
  if(!enabled&&!framed)return Promise.resolve(kind==='prompt'?window.prompt(message,value):window.confirm(message));
  return new Promise(resolve=>{
   const dialog=document.createElement('dialog');dialog.className='embed-dialog';
   dialog.innerHTML='<form method="dialog"><h2></h2><p></p><input type="text" aria-label="Python file name"><div class="embed-dialog-actions"><button value="cancel" type="submit">Cancel</button><button value="ok" type="submit" class="primary">Continue</button></div></form>';
   dialog.querySelector('h2').textContent=kind==='prompt'?'New Python file':'Confirm action';dialog.querySelector('p').textContent=message;
   const input=dialog.querySelector('input');input.hidden=kind!=='prompt';input.value=value;
   const cancel=()=>{if(dialog.open)dialog.close('cancel')},hidden=()=>{if(document.hidden)cancel()};
   dialog.addEventListener('close',()=>{document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',cancel);resolve(dialog.returnValue==='ok'?(kind==='prompt'?input.value:true):(kind==='prompt'?null:false));dialog.remove()},{once:true});
   input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();dialog.close('ok')}});
   document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',cancel);document.body.append(dialog);dialog.showModal();if(kind==='prompt'){input.focus();input.select()}
  });
 }
 window.AerionDialogs=Object.freeze({prompt:(message,value)=>ask('prompt',message,value),confirm:message=>ask('confirm',message)});
 function fullUrl(){const url=new URL(location.href);url.searchParams.set('embed','0');const tab=document.querySelector('.tabs .tab.active')?.dataset.tab;if(tab)url.searchParams.set('tab',tab);url.hash='';return url.href}
 function start(){
  if(enabled){
   const bar=document.createElement('div');bar.className='embed-actions';
   const link=document.createElement('a');link.className='embed-open';link.textContent='Open full lab ↗';link.target='_blank';link.rel='noopener';link.href=fullUrl();link.title='Open separately for camera, USB and local kit permissions';
   const expand=document.createElement('button');expand.type='button';expand.className='embed-expand';expand.innerHTML='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6"/></svg>';expand.title='Expand lab';expand.setAttribute('aria-label','Expand lab to full screen');
   expand.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(document.fullscreenEnabled)await document.documentElement.requestFullscreen();else link.click()}catch{link.click()}};
   bar.append(link,expand);document.querySelector('.topbar-main')?.append(bar);
   document.addEventListener('fullscreenchange',()=>{expand.setAttribute('aria-label',document.fullscreenElement?'Exit full screen':'Expand lab to full screen')});
   document.querySelector('.tabs')?.addEventListener('click',event=>{const tab=event.target.closest('.tab');if(!tab)return;link.href=fullUrl();const nav=tab.parentElement;if(tab.offsetLeft<nav.scrollLeft||tab.offsetLeft+tab.offsetWidth>nav.scrollLeft+nav.clientWidth)nav.scrollTo({left:Math.max(0,tab.offsetLeft-(nav.clientWidth-tab.offsetWidth)/2),behavior:'smooth'})});
  }
  const requested=params.get('tab');if(!requested)return;
  const tab=Array.from(document.querySelectorAll('.tabs .tab')).find(b=>b.dataset.tab===requested);if(!tab)return;
  let tries=0;const open=()=>{if(window.__zebjusAppLoaded){tab.click();return}if(++tries<300)setTimeout(open,100)};open();
 }
 window.AerionEmbed=Object.freeze({enabled,framed,version:'18.3.67-web.1'});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
