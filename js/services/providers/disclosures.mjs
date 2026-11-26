import {validateDisclosure} from '../../engines/overlap.mjs';
const base='https://raw.githubusercontent.com/Garuda8887/aerie-data/main/';
const normalize=s=>String(s).toLowerCase().replace(/\b(direct|regular)\s+(plan|growth)\b/g,' ').replace(/\b(direct|regular|growth|plan|option)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
export function matchDisclosure(name,index){const matches=index.filter(x=>normalize(x.name)===normalize(name));return matches.length===1?matches[0]:null}
export function normalizeDisclosure(raw,entry,name){
 if(raw.id!==entry.id||raw.name!==entry.name||raw.asOf!==entry.asOf||!Array.isArray(raw.holdings)||!raw.source?.file)return null;
 const map=new Map();
 for(const h of raw.holdings){if(h.kind!=='equity')continue;if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.isin)||!Number.isFinite(h.pct)||h.pct<0)return null;if(h.pct===0)continue;const p=map.get(h.isin);if(p)p.weight+=h.pct;else map.set(h.isin,{isin:h.isin,name:h.name,weight:h.pct})}
 return {scheme:name,date:raw.asOf,source:raw.source.file,holdings:[...map.values()]};
}
async function aerieDisclosures(names,fetcher=fetch){
 const get=path=>readCatalog(base+path,fetcher);
 const catalog=await get('data/index.json');const index=Array.isArray(catalog)?catalog:catalog?.schemes;if(!Array.isArray(index))throw Error('Unsupported catalog format');
 // Fetch the entire available catalog, independent of the personal portfolio.
 const records=new Map(),queue=[...index];let failures=0;
 await Promise.all(Array.from({length:3},async()=>{while(queue.length){const e=queue.shift();if(!/^(?:data\/)?[a-zA-Z0-9_./-]+\.json$/.test(e.path)||e.path.includes('..')){failures++;continue}try{records.set(e.id,await get(e.path.startsWith('data/')?e.path:'data/'+e.path))}catch{failures++}}}));
 return {rows:names.map(name=>{const e=matchDisclosure(name,index);return e&&records.has(e.id)?normalizeDisclosure(records.get(e.id),e,name):null}).filter(Boolean),failures};
}

export async function publicDisclosures(names,fetcher=fetch){
 let rows=[],failures=0,diagnostics=null;
 try{const p=await charlieCatalog(names,fetcher);rows=p.rows;failures+=p.failures;diagnostics=p.diagnostics;}catch(e){failures++;console.warn('Charlie catalog',e.message)}
 try{const d=await readCatalog('./data/disclosures.json',fetcher);if(!Array.isArray(d.rows))throw Error('Invalid catalog');
 for(const name of names){const exact=d.rows.filter(x=>x.scheme===name);const candidates=exact.length?exact:d.rows.filter(x=>normalize(x.scheme)===normalize(name));const latest=candidates.filter(x=>validateDisclosure({...x,scheme:name},new Date().toISOString().slice(0,10))).sort((a,b)=>b.date.localeCompare(a.date)||Number(!b.code)-Number(!a.code))[0];if(latest&&validateDisclosure({...latest,scheme:name},new Date().toISOString().slice(0,10))){if(!rows.some(x=>x.scheme===name&&x.date>=latest.date)){rows=rows.filter(x=>x.scheme!==name);rows.push({...latest,scheme:name})}}}
 }catch{failures++}
 if(rows.length===names.length&&rows.every(x=>Date.now()-Date.parse(x.date)<=45*864e5))return {rows,failures,diagnostics,missing:[]};
 try{const fallback=await aerieDisclosures(names,fetcher);failures+=fallback.failures;for(const d of fallback.rows){if(!validateDisclosure(d,new Date().toISOString().slice(0,10)))continue;if(!rows.some(x=>x.scheme===d.scheme&&x.date>=d.date)){rows=rows.filter(x=>x.scheme!==d.scheme);rows.push(d)}}}catch{failures++}
 return {rows,failures,diagnostics,missing:names.filter(n=>!rows.some(r=>r.scheme===n))};
}

async function readCatalog(url,fetcher){let last;for(let attempt=0;attempt<2;attempt++){const controller=new AbortController();let timer;try{return await Promise.race([ (async()=>{const r=await fetcher(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Disclosure HTTP '+r.status);return await r.json()})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Disclosure timeout'))},12000)})])}catch(e){last=e;if(String(e.message).includes('HTTP 404'))break}finally{clearTimeout(timer)}}throw last}

 // Fixed public probes: never send a user's portfolio or selected scheme codes.
 export async function probeCharlie(fetcher=fetch){
 const base='https://api.charliealpha.in/v1/mf/';
 const result={};
 for(const [key,path] of [['coverage','holdings-periods'],['sample','holdings/122639']]){
 try{const d=await readCatalog(base+path,fetcher);result[key]={ok:true,fields:Object.keys(d),sampleFields:Array.isArray(d.holdings)&&d.holdings.length?Object.keys(d.holdings[0]):[],example:key==='sample'?{scheme:d.scheme_name,asOf:d.as_of,total:d.total_holdings,types:[...new Set(d.holdings?.map(h=>h.holding_type))],sides:[...new Set(d.holdings?.map(h=>h.position_side))],first:d.holdings?.[0],allocation:d.asset_allocation}:d.periods?.[0]};}
 catch(e){result[key]={ok:false,error:String(e.message)};}
 }
 return result;
 }

export function normalizeCharlie(raw,code,scheme,asOf){
 if(String(raw?.amfi_code)!==String(code)||typeof raw.scheme_name!=='string'||!raw.scheme_name.trim()||!Array.isArray(raw.holdings)||raw.total_holdings!==raw.holdings.length)return null;
 const map=new Map();
 for(const h of raw.holdings){
 if(typeof h.holding_type!=='string')return null;
 if(!/^(equity|equity shares|common stock)$/i.test(h.holding_type))continue;
 if(typeof h.position_side!=='string')return null;
 if(/^short$/i.test(h.position_side))continue;
 if(!/^long$/i.test(h.position_side)||!Number.isFinite(h.holding_pct)||h.holding_pct<0)return null;
 if(!h.holding_pct)continue;
 const p=map.get(h.isin)||{isin:h.isin,name:h.name,weight:0};p.weight+=h.holding_pct;map.set(h.isin,p);
 }
 const physical=raw.asset_allocation?.physical?.equity_pct;const sum=[...map.values()].reduce((s,h)=>s+h.weight,0);if(!Number.isFinite(physical)||physical<0||physical>100||Math.abs(sum-physical)>0.6)return null;
 const d={code:String(code),scheme,date:raw.as_of,source:'https://api.charliealpha.in/v1/mf/holdings/'+code,provider:'charlie-alpha',providerScheme:raw.scheme_name,holdings:[...map.values()],...(physical===0&&map.size===0?{equityStatus:'verified-zero'}:{})};
 return validateDisclosure(d,asOf)?d:null;
}

const charlieBase='https://api.charliealpha.in/v1/mf/';
function openCharlieCache(){return new Promise((resolve,reject)=>{const q=indexedDB.open('public-charlie-holdings-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('catalog');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);q.onblocked=()=>reject(Error('Cache blocked'))})}
function cacheOp(db,mode,key,value){return new Promise((resolve,reject)=>{const tx=db.transaction('catalog',mode),s=tx.objectStore('catalog'),q=mode==='readonly'?s.get(key):s.put(value,key);tx.oncomplete=()=>resolve(q.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
let catalogJob;
async function charlieCatalog(names,fetcher){
 if(!catalogJob)catalogJob=syncCharlie(fetcher).finally(()=>{catalogJob=null});
 const {records,failures,diagnostics}=await catalogJob;
 const today=new Date().toISOString().slice(0,10);
 return {failures,diagnostics,rows:names.flatMap(name=>{const candidates=records.filter(x=>(normalize(x.scheme)===normalize(name)||normalize(x.providerScheme||'')===normalize(name))&&validateDisclosure(x,today));const dates=[...new Set(candidates.map(x=>x.date))].sort();const latest=candidates.filter(x=>x.date===dates.at(-1));if(!latest.length)return [];const signatures=new Set(latest.map(x=>JSON.stringify(x.holdings.map(h=>[h.isin,h.weight]).sort())));return signatures.size===1?[{...latest[0],scheme:name}]:[]})};
}
async function syncCharlie(fetcher){
 const db=await openCharlieCache();
 try{
 const state=await cacheOp(db,'readonly','state')||{records:[],cursor:0,period:null,last:0};
 const records=new Map(state.records.map(x=>[x.code,x]));
 if(state.order===3&&Date.now()-state.last<60000)return {records:[...records.values()],failures:0,diagnostics:state.diagnostics};
 const coverage=await readCatalog(charlieBase+'holdings-periods',fetcher);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(coverage.latest_as_of))throw Error('Invalid disclosure period');
 const registry=await readCatalog('./data/amfi-registry.json',fetcher);
 if(!Array.isArray(registry.schemes)||registry.schemes.length<1000)throw Error('Incomplete public registry');
 const queue=registry.schemes.filter(s=>/^\d+$/.test(String(s.code))&&typeof s.name==='string').sort((a,b)=>Number(/direct.*growth/i.test(b.name))-Number(/direct.*growth/i.test(a.name))||Number(a.code)-Number(b.code));
 let cursor=state.period===coverage.latest_as_of&&state.order===3?state.cursor:0,failures=0,consecutive=0;const diagnostics={period:coverage.latest_as_of,universe:queue.length,accepted:0,rejected:0,errors:{},examples:[]};
 const today=new Date().toISOString().slice(0,10),deadline=Date.now()+45000;
 // Fixed public order and bounded batches, independent of portfolio membership.
 for(let n=0;n<30&&cursor<queue.length&&Date.now()<deadline;n++){
 const s=queue[cursor];
 try{const raw=await readCatalog(charlieBase+'holdings/'+s.code,fetcher);const d=normalizeCharlie(raw,s.code,s.name,today);if(d){if(!records.has(d.code)||records.get(d.code).date<=d.date)records.set(d.code,d);consecutive=0;diagnostics.accepted++}else{failures++;consecutive++;diagnostics.rejected++;if(diagnostics.examples.length<3)diagnostics.examples.push({code:s.code,expected:s.name,actual:raw.scheme_name,types:[...new Set(raw.holdings?.map(h=>h.holding_type))],sides:[...new Set(raw.holdings?.map(h=>h.position_side))],first:raw.holdings?.[0]})}cursor++}
 catch(e){failures++;diagnostics.errors[e.message]=(diagnostics.errors[e.message]||0)+1;if(/HTTP (403|429)/.test(e.message))break;cursor++;consecutive++}
 if(consecutive>=10&&Object.keys(diagnostics.errors).some(e=>!/HTTP 404/.test(e)))break;
 await new Promise(r=>setTimeout(r,1100));
 }
 diagnostics.cursor=cursor;diagnostics.cached=records.size;await cacheOp(db,'readwrite','state',{order:3,diagnostics,records:[...records.values()],cursor,period:coverage.latest_as_of,last:Date.now()});
 return {records:[...records.values()],failures,diagnostics};
 }finally{db.close()}
}
