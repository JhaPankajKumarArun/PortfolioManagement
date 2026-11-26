(()=>{
 if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
 const box=document.createElement('div');box.id='pwa-update-status';box.setAttribute('role','status');
 box.style.cssText='position:fixed;top:env(safe-area-inset-top,0px);left:0;right:0;z-index:10000;padding:8px;text-align:center;background:#173c30;color:white;font-size:13px;display:none';
 const label=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='Update & reload';button.style.marginLeft='8px';box.append(label,button);document.body.append(box);
 let requested=false,reloading=false;
 const show=(message,action=false)=>{label.textContent=message;button.hidden=!action;box.style.display='block'};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requested&&!reloading){reloading=true;location.reload()}else if(!requested)show('App version changed. Reopen after saving your work.')});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  const ready=()=>{if(reg.waiting&&navigator.serviceWorker.controller)show('New application version ready. Save your work before updating.',true)};
  button.onclick=()=>{if(!reg.waiting)return;if(!confirm('Reload now? Unsaved form changes will be lost. Saved portfolio data will remain.'))return;requested=true;button.disabled=true;reg.waiting.postMessage({type:'ACTIVATE_UPDATE'});show('Applying update…')};
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',ready)});ready();
  const check=()=>reg.update().catch(()=>{});check();document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 }).catch(()=>show('Offline installation unavailable. Saved portfolio storage is unchanged.'));
})();
