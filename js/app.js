render();updatePbmUi();if(S.tx.length)pbmLoad(PBMSEL);pwHydrate().then(()=>{render();updatePbmUi();pwAuto()}).catch(()=>pwAuto());
const refreshVisible=()=>{pwAuto();navhEnsure();return liveRefresh()};
setTimeout(refreshVisible,400);refreshService.installRefreshTriggers({document,window,refresh:refreshVisible});

