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
Object.assign(globalThis,{fifoLedger,amfiProvider,marketProviders,financialFeatures,uiViews,refreshService,integrity},storage,format,cache,{xirr:e0.xirr,swpSim:e1.swpSim,safeW:e1.safeW,paMonthEnd:e4.paMonthEnd,pbmPrice:e5.pbmPrice,addM:e6.addM,fyOf:e6.fyOf,srt:e6.srt,mk:e6.mk,PA_RF:e4.PA_RF});
installErrorHandlers(globalThis);
try {
const appState=createState(localStorage);
exposeLegacyState(appState,globalThis);
const scripts=["./services/cache.js","./core.js","./analytics.js","./planning.js","./controller.js","./ui/events.js","./tax-prices.js","./fund-analysis.js","./market-data.js","./performance.js","./app.js","./register-sw.js"];
for(const path of scripts){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,import.meta.url).href;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+path));document.body.appendChild(s)})}

} catch(error){recordError('startup');showStartupFailure(document);}
