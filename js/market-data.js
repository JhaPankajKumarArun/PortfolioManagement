const NHK='portfolio-navh-v1';let NH={},NHBUSY=false,NHMSG='',NHFAIL=0,NHPROG='',pf={mode:'gain',sel:'1M',from:''};try{NH=JSON.parse(localStorage.getItem(NHK))||{}}catch(e){}
const saveNH=()=>{try{localStorage.setItem(NHK,JSON.stringify(NH))}catch(e){NHMSG='Couldn’t save NAV history on this device.'}};
const mfHeld=C=>C.open.filter(h=>{const t=S.tx.find(x=>x.name===h.name);return t&&t.type==='mf'&&S.isin&&S.isin[h.name]});
function updatePerfUi(){const w=$('#pfw');if(w)w.innerHTML=tab==='home'?overviewPerformance(calc()):perfBody(calc())}
// Recover missing history per fund; successful downloads survive other failures.
const historyTargets=()=>[...new Set(S.tx.filter(t=>t.type==='mf'&&t.date<=today()).map(t=>t.name))].map(name=>({name})).filter(h=>S.isin?.[h.name]||S.sc?.[h.name]);
const historyDue=h=>!NH[h.name]?.d?.length||Date.now()-(NH[h.name].t||0)>432e5;
async function navhLoad(force=true){
 if(NHBUSY||navigator.onLine===false)return;
 const H=historyTargets().filter(h=>force||historyDue(h));if(!H.length)return;
 NHBUSY=true;NHMSG='';NHPROG='Finding your funds…';updatePerfUi();
 const owner=S,failed=[];let done=0;
 try{
 const need=H.filter(h=>!S.sc?.[h.name]);
 if(need.length){try{const all=await mfJson('https://api.mfapi.in/mf/latest'),byI=new Map();for(const x of all){if(x.isinGrowth)byI.set(x.isinGrowth,x.schemeCode);if(x.isinDivReinvestment)byI.set(x.isinDivReinvestment,x.schemeCode)}if(S!==owner)return;for(const h of need){const c=byI.get(S.isin?.[h.name]);if(c)(S.sc=S.sc||{})[h.name]=c}}catch(e){/* known codes can still be recovered */}}
 const q=H.slice();
 const worker=async()=>{while(q.length&&S===owner){const h=q.shift(),c=S.sc?.[h.name];try{
 if(!c)throw Error('Unmapped fund');
 await refreshService.refreshManager.run('nav-history:'+c+':'+h.name,async()=>{
 const rows=toRows(await mfJson('https://api.mfapi.in/mf/'+encodeURIComponent(c)+'?startDate=1991-01-01',45000)).filter(r=>r[0]<=today()&&Number.isFinite(r[1])&&r[1]>0);
 if(!rows.length)throw Error('Empty history');
 if(S!==owner)return;
 const merged=new Map(NH[h.name]?.d||[]);for(const [d,p] of rows)merged.set(d,p);
 NH[h.name]={t:Date.now(),d:[...merged].sort((a,b)=>a[0].localeCompare(b[0]))};saveNH();
 },{force,ttl:432e5,baseDelay:60000,maxDelay:600000});
 if(historyDue(h))failed.push(h.name);
 }catch(e){failed.push(h.name)}finally{done++;NHPROG='Checked '+done+' of '+H.length+' funds…';updatePerfUi()}}};
 await Promise.all([worker(),worker(),worker()]);
 if(S===owner){save();NHMSG=failed.length?'History still needs attention for '+failed.length+' fund(s): '+failed.join(', '):'Fund history checked successfully.';NHFAIL=failed.length?Date.now():0}
 }finally{NHBUSY=false;updatePerfUi();if(S===owner&&(tab==='data'||tab==='time'))render()}
}

/* Personal Wealth Analytics: local market-data cache and provider adapter. */
function pwTicker(name){const m=S.symbols||S.tickers||S.sym||{};let x=m[name];if(!x&&S.stockSymbols)x=S.stockSymbols[name];return typeof x==='string'?x.trim().toUpperCase():''}
function indiaCSV(text){return marketProviders.stocks.indiaCSV(text,pd,today())}
async function indiaImport(kind,name,file){try{const rows=indiaCSV(await file.text()),id=kind+':'+name;await pwPut(id,kind,{rows},'User-imported official CSV');if(kind==='stock'){PWH[name]=rows;const last=rows[rows.length-1];if(!S.pxd[name]||last[0]>=S.pxd[name])setPx(name,last[1],last[0]);save();PWSTATUS='Imported '+rows.length+' observations for '+name}else PBMMSG='Imported '+rows.length+' observations; latest '+rows[rows.length-1][0];render();updatePbmUi()}catch(e){toast('Import failed: '+e.message)}}
async function pwSyncStocks(force=false){PW_LAST=Date.now();if(force){PWSTATUS='Import exchange historical CSV for each stock below. Automatic exchange refresh is unavailable in this browser-only version.';render()}}
async function indiaLatest(){return amfiProvider.indiaLatest(pd)}
async function pwHydrate(){const a=await pwAll('stock');for(const x of a){const n=x.id.slice(6);if(x.data&&x.data.rows&&x.data.rows.length){PWH[n]=x.data.rows}}}
async function pwCacheNav(){for(const [n,h] of Object.entries(NH||{})){if(h&&h.d&&h.d.length)try{await pwPut('nav:'+n,'nav',h,'MFAPI.in')}catch(e){}}}
function pwAuto(){if(document.visibilityState==='hidden'||Date.now()-PW_LAST<6*60*60*1000)return;pwSyncStocks(false);pwCacheNav()}


function navhEnsure(){if(NHBUSY||Date.now()-NHFAIL<6e5)return;const H=historyTargets();if(H.some(historyDue))navhLoad(false)}
