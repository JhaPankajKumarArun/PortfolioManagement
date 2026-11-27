const CACHE_NAME = 'my-portfolio-pwa-v125-holdings-width-fix';
const APP_SHELL = [
  './js/vendor/pdf.min.js',
  './js/vendor/pdf.worker.min.js',
  './',
  './index.html',
  './css/app.css',
  './js/engines/portfolio.mjs',
  './js/engines/ledger.mjs',
  './js/engines/valuation.mjs',
  './js/engines/allocation.mjs',
  './js/engines/overlap.mjs',
  './js/services/providers/disclosures.mjs',
  './js/engines/planning.mjs',
  './js/engines/goals.mjs',
  './js/engines/wealth.mjs',
  './js/features/wealth-ui.mjs',
  './js/engines/attribution.mjs',
  './js/engines/performance.mjs',
  './js/engines/risk.mjs',
  './js/engines/benchmark.mjs',
  './js/engines/tax.mjs',
  './js/engines/sip.mjs',
  './js/engines/sip-optimization.mjs',
  './js/bootstrap.mjs',
  './js/features/recovery-ui.mjs',
  './js/core/errors.mjs',
  './js/core/integrity.mjs',
  './js/services/http.mjs',
  './js/services/refresh.mjs',
  './js/features/financial.mjs',
  './js/features/allocation-ui.mjs',
  './js/core/state.mjs',
  './js/core/storage.mjs',
  './js/core/indexed-storage.mjs',
  './js/core/format.mjs',
  './js/services/cache.mjs',
  './js/services/providers/amfi.mjs',
  './js/services/providers/mfapi.mjs',
  './js/services/providers/benchmark.mjs',
  './js/services/providers/stocks.mjs',
  './js/services/market-data.mjs',
  './js/services/cache.js',
  './js/core.js',
  './js/analytics.js',
  './js/planning.js',
  './js/controller.js',
  './js/ui/views.mjs',
  './js/ui/events.js',
  './js/tax-prices.js',
  './js/fund-analysis.js',
  './js/market-data.js',
  './js/performance.js',
  './js/app.js',
  './js/register-sw.js',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png'
];

const prefix='my-portfolio-pwa-';
const MARKET_CACHE='portfolio-public-market-v1';
const scope=self.registration.scope;
const shell=new Set(APP_SHELL.map(p=>new URL(p,scope).href));
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL.map(p=>new Request(new URL(p,scope),{cache:'reload'})))));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='GET_VERSION')event.ports[0]?.postMessage(CACHE_NAME);
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(prefix)&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(shell.has(url.href)||(req.mode==='navigate'&&url.href.startsWith(scope))){
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>(await cache.match(req))||(req.mode==='navigate'?await cache.match(new URL('./index.html',scope).href):null)||Response.error()));
  return;
 }
 // Cache only explicitly public market endpoints; never arbitrary requests.
 const publicMarket=(url.origin===new URL(scope).origin&&['data/amfi-nav.txt','data/disclosures.json'].some(p=>url.href===new URL(p,scope).href))||(url.origin==='https://api.mfapi.in'&&/^\/mf(?:\/latest|\/\d+(?:\/latest)?)?$/.test(url.pathname))||(url.href==='https://portal.amfiindia.com/spages/NAVAll.txt');
 if(!publicMarket)return;
 // Market data is independent of the versioned application shell.
 event.respondWith((async()=>{const cache=await caches.open(MARKET_CACHE);try{const res=await fetch(req);if(res.ok&&res.type!=='opaque'){try{await cache.put(req,res.clone())}catch{}}return res}catch(e){return (await cache.match(req))||Response.error()}})());
});
