import {showRecovery} from './features/recovery-ui.mjs';
import {wealthView,installWealth} from './features/wealth-ui.mjs';
import {createSnapshotMirror,openSnapshotDB,readSnapshot} from './core/indexed-storage.mjs';
import {assetClassCard,allocationPlanner,installAllocation} from './features/allocation-ui.mjs';
import {resolvePrice} from './engines/valuation.mjs';
import {fifoLedger} from './engines/ledger.mjs';
import * as integrity from './core/integrity.mjs';
import * as refreshService from './services/refresh.mjs';
import {installErrorHandlers,recordError,showStartupFailure} from './core/errors.mjs';
import * as uiViews from './ui/views.mjs';
import {createState,exposeLegacyState} from './core/state.mjs';
import * as financialFeatures from './features/financial.mjs';
import {marketProviders} from './services/market-data.mjs';
import * as amfiProvider from './services/providers/amfi.mjs';
import * as storage from './core/storage.mjs';
import * as format from './core/format.mjs';
import * as cache from './services/cache.mjs';
import * as e0 from './engines/portfolio.mjs';
import * as e1 from './engines/planning.mjs';
import * as e2 from './engines/attribution.mjs';
import * as e3 from './engines/performance.mjs';
import * as e4 from './engines/risk.mjs';
import * as e5 from './engines/benchmark.mjs';
import * as e6 from './engines/tax.mjs';
import * as e7 from './engines/sip.mjs';
// Temporary compatibility bridge; remove when feature modules migrate.
Object.assign(globalThis,{resolvePrice,fifoLedger,amfiProvider,marketProviders,financialFeatures,uiViews,refreshService,integrity},storage,format,cache,{xirr:e0.xirr,swpSim:e1.swpSim,safeW:e1.safeW,paMonthEnd:e4.paMonthEnd,pbmPrice:e5.pbmPrice,addM:e6.addM,fyOf:e6.fyOf,srt:e6.srt,mk:e6.mk,PA_RF:e4.PA_RF});
installErrorHandlers(globalThis);
function returnFromStartup(){throw new Error('Recovery required')}
try {
storage.trackPortfolioVersion(localStorage);
if(localStorage.getItem(storage.K)===null){
 let discoveryFailed=false;
 let hasBackup=[storage.RECOVERY_KEY,storage.REPLACEMENT_KEY].some(k=>localStorage.getItem(k)!==null);
 if(!hasBackup&&globalThis.indexedDB){try{const db=await openSnapshotDB(indexedDB);try{hasBackup=!!(await readSnapshot(db,'current'))||!!(await readSnapshot(db,'previous'))}finally{db.close()}}catch{discoveryFailed=true}}
 if((hasBackup||discoveryFailed)&&localStorage.getItem(storage.K)===null){showRecovery(document,localStorage,globalThis.indexedDB,()=>location.reload(),message=>confirm(message),true);returnFromStartup();}
}
const appState=createState(localStorage);
function checkPortfolioConflict(){
 if(!storage.portfolioVersionChanged(localStorage))return;
 if(document.getElementById('portfolio-conflict'))return;
 const banner=document.createElement('div');banner.id='portfolio-conflict';banner.setAttribute('role','alert');
 banner.textContent='Portfolio changed in another tab. Saving here is blocked. Copy any unsaved changes before reloading.';
 const copy=document.createElement('button');copy.type='button';copy.textContent='Copy this tab’s backup';
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(JSON.stringify(storage.withLegacyGoals(localStorage,appState.state.S)));copy.textContent='Copied'}catch{alert('Copy failed. Use Data management → Backup to copy manually.')}});
 const reload=document.createElement('button');reload.type='button';reload.textContent='Reload latest';
 reload.addEventListener('click',()=>{if(confirm('Reload saved portfolio? Unsaved changes in this tab will be lost.'))location.reload()});
 banner.append(copy,reload);document.body.prepend(banner);
}
window.addEventListener('storage',e=>{if(e.storageArea===localStorage&&(e.key===storage.K||e.key===null))checkPortfolioConflict()});
window.addEventListener('focus',checkPortfolioConflict);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)checkPortfolioConflict()});
const mirror=createSnapshotMirror(localStorage,globalThis.indexedDB);
storage.setSnapshotHook(()=>mirror.sync());
globalThis.portfolioSnapshotStatus=mirror.status;
mirror.sync();
exposeLegacyState(appState,globalThis);
Object.assign(globalThis,{assetClassCard,allocationPlanner});
installAllocation({doc:document,getPortfolio:()=>globalThis.calc?globalThis.calc():calc(),getState:()=>appState.state.S,commit:c=>{storage.persistPortfolio(localStorage,c);appState.state.S=c},cr:format.cr,esc:format.esc});
Object.assign(globalThis,{wealthView});
installWealth({doc:document,getState:()=>appState.state.S,getPortfolio:()=>calc(),commit:c=>{storage.persistPortfolio(localStorage,c);appState.state.S=c},render:()=>render()});
const scripts=["./services/cache.js","./core.js","./analytics.js","./planning.js","./controller.js","./ui/events.js","./tax-prices.js","./fund-analysis.js","./market-data.js","./performance.js","./app.js","./register-sw.js"];
for(const path of scripts){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,import.meta.url).href;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+path));document.body.appendChild(s)})}

} catch(error){if(error.message==='Recovery required'){/* recovery screen already displayed */}else{recordError('startup');showStartupFailure(document);try{showRecovery(document,localStorage,globalThis.indexedDB,()=>location.reload(),message=>confirm(message))}catch{}}}
