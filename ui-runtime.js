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
        // app.js owns tab switching after startup. This fallback is only for the
        // short boot window / degraded startup path, otherwise simulator cleanup
        // in app.js would see the wrong active panel and could keep running hidden.
        if(window.__zebjusAppLoaded)return;
        document.querySelectorAll('.tab').forEach(function(x){x.classList.remove('active')});
        b.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(function(x){x.classList.remove('active')});
        var p=document.querySelector('#tab-'+b.dataset.tab);if(p)p.classList.add('active');
      });
    });
  }
  function initButtonFeedback(){
    var selector='button,.btn,.view-btn,.mode,.key-capture,.firmware-file-label';
    function targetFrom(node){
      var el=node&&node.closest?node.closest(selector):null;
      if(!el||el.disabled||el.getAttribute('aria-disabled')==='true')return null;
      return el;
    }
    function release(el){if(!el)return;setTimeout(function(){el.classList.remove('zj-pressing')},90)}
    document.addEventListener('pointerdown',function(e){
      var el=targetFrom(e.target);if(!el)return;
      el.classList.add('zj-click-target','zj-pressing');
      var r=el.getBoundingClientRect(),size=Math.max(34,Math.max(r.width,r.height)*1.18),wave=document.createElement('span');
      wave.className='zj-click-wave';wave.setAttribute('aria-hidden','true');wave.style.width=size+'px';wave.style.height=size+'px';
      wave.style.left=(e.clientX-r.left-size/2)+'px';wave.style.top=(e.clientY-r.top-size/2)+'px';el.appendChild(wave);
      setTimeout(function(){wave.remove()},520);
    },{passive:true});
    document.addEventListener('pointerup',function(){document.querySelectorAll('.zj-pressing').forEach(release)},{passive:true});
    document.addEventListener('pointercancel',function(){document.querySelectorAll('.zj-pressing').forEach(release)},{passive:true});
    document.addEventListener('keydown',function(e){
      if(e.key!=='Enter'&&e.key!==' ')return;var el=targetFrom(document.activeElement);if(!el)return;el.classList.add('zj-click-target','zj-pressing');
    });
    document.addEventListener('keyup',function(e){if(e.key==='Enter'||e.key===' ')release(targetFrom(document.activeElement))});
    window.addEventListener('blur',function(){document.querySelectorAll('.zj-pressing').forEach(function(x){x.classList.remove('zj-pressing')})});
  }
  function initUiRuntime(){initTabs();initButtonFeedback()}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initUiRuntime);else initUiRuntime();
  if(location.protocol==='file:')setStatus('Open with GitHub Pages or a local HTTP server • file:// blocks ES modules',true);
  window.addEventListener('error',function(e){
    if(e.target&&e.target.tagName==='SCRIPT'){report('Script load failed',e.target.src||'script');return;}
    if(e.message||e.error)report('Runtime error',e.error||e.message);
  },true);
  window.addEventListener('unhandledrejection',function(e){report('Promise error',e.reason||'Unhandled promise rejection')});
  setTimeout(function(){
    if(window.__zebjusAppLoaded)return;
    if(window.__zebjusModuleParsed)setStatus('App startup did not finish • check runtime error',true);
    else setStatus('V18 app.js failed to load/parse • check app.js and school-lab.js',true);
  },7000);
})();
