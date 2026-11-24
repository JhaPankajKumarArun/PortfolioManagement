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
Object.assign(globalThis,{amfiProvider,marketProviders},storage,format,cache,e0,e1,e2,e3,e4,e5,e6,e7);
const scripts=["./core/state.js","./services/cache.js","./core.js","./analytics.js","./planning.js","./controller.js","./tax-prices.js","./fund-analysis.js","./market-data.js","./performance.js","./app.js","./register-sw.js"];
for(const path of scripts){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=new URL(path,import.meta.url).href;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+path));document.body.appendChild(s)})}
