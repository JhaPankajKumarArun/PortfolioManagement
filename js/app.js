render();updatePbmUi();if(S.tx.length)pbmLoad(PBMSEL);pwHydrate().then(()=>{render();updatePbmUi();pwAuto()}).catch(()=>pwAuto());
setTimeout(liveRefresh,400);document.addEventListener('visibilitychange',()=>{if(!document.hidden)liveRefresh()});

