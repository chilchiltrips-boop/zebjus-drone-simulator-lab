(function(){
  window.__zebjusBootErrors=window.__zebjusBootErrors||[];
  function setStatus(text,bad){
    var s=document.getElementById('assetStatus');
    if(s){s.textContent=text;s.className='status'+(bad?' bad':'');}
    var m=document.getElementById('snapMessage');
    if(m&&bad){m.textContent=text;m.className='snap-message bad';}
  }
  function report(label,value){
    var msg=String(value&&value.message?value.message:value||'Unknown error');
    window.__zebjusBootErrors.push({label:label,message:msg,time:Date.now()});
    console.error('[ZEBJUS]',label,msg);
    if(!window.__zebjusAppLoaded)setStatus(label+' • '+msg.slice(0,90),true);
  }
  function initTabs(){
    document.querySelectorAll('.tab').forEach(function(b){
      b.addEventListener('click',function(){
        document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
        b.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function(x){x.classList.remove('active')});
        var p=document.querySelector('#tab-'+b.dataset.tab);if(p)p.classList.add('active');
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initTabs);else initTabs();
  if(location.protocol==='file:')setStatus('Open with GitHub Pages or a local HTTP server • file:// blocks ES modules',true);
  window.addEventListener('error',function(e){
    if(e.target&&e.target.tagName==='SCRIPT'){report('Script load failed',e.target.src||'script');return;}
    if(e.message||e.error)report('Runtime error',e.error||e.message);
  },true);
  window.addEventListener('unhandledrejection',function(e){report('Promise error',e.reason||'Unhandled promise rejection')});
  setTimeout(function(){
    if(window.__zebjusAppLoaded)return;
    if(window.__zebjusModuleParsed)setStatus('App startup did not finish • check runtime error',true);
    else setStatus('V17.5 app.js failed to load/parse • upload the corrected V17.5 files',true);
  },7000);
})();
