(()=>{
 if(!('serviceWorker' in navigator)||!/^https?:$/.test(location.protocol))return;
 const box=document.createElement('div');box.id='pwa-update-status';box.setAttribute('role','status');
 box.style.display='none';
 const label=document.createElement('span'),button=document.createElement('button');button.type='button';button.textContent='Update & reload';box.append(label,button);const header=document.getElementById('bar');if(header)header.after(box);else document.body.prepend(box);
 let activationTimer=null,requested=false,reloading=false,hadController=!!navigator.serviceWorker.controller;
 const show=(message,action=false)=>{label.textContent=message;button.hidden=!action;box.style.display='flex'};
 navigator.serviceWorker.addEventListener('controllerchange',()=>{if(requested&&!reloading){clearTimeout(activationTimer);reloading=true;location.reload()}else if(!requested&&hadController)show('App version changed. Reopen after saving your work.');hadController=true});
 navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>{
  const ready=()=>{if(reg.waiting&&navigator.serviceWorker.controller)show('New application version ready. Save your work before updating.',true)};
  button.onclick=()=>{if(!reg.waiting)return;if(!confirm('Reload now? Unsaved form changes will be lost. Saved portfolio data will remain.'))return;requested=true;button.disabled=true;show('Applying update…');activationTimer=setTimeout(()=>{requested=false;button.disabled=false;show('Update not confirmed. Save your work before retrying.',!!reg.waiting)},15000);try{reg.waiting.postMessage({type:'ACTIVATE_UPDATE'})}catch{clearTimeout(activationTimer);requested=false;button.disabled=false;show('Update request failed. Try again.',!!reg.waiting)}};
  reg.addEventListener('updatefound',()=>{const worker=reg.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='redundant'&&!reg.waiting)show('Update installation did not complete. Current saved data is unchanged.');else ready()})});ready();
  let checking=null;const check=()=>{if(!checking)checking=reg.update().catch(()=>{}).finally(()=>{checking=null});return checking};check();window.addEventListener('pageshow',e=>{if(e.persisted)check()});document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')check()});
 }).catch(()=>show('Offline installation unavailable. Saved portfolio storage is unchanged.'));
})();
