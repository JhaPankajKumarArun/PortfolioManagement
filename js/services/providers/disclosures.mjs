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
 let rows=[],failures=0;
 try{const d=await readCatalog('./data/disclosures.json',fetcher);if(!Array.isArray(d.rows))throw Error('Invalid catalog');
 for(const name of names){const exact=d.rows.filter(x=>x.scheme===name);const candidates=exact.length?exact:d.rows.filter(x=>normalize(x.scheme)===normalize(name));const latest=candidates.filter(x=>validateDisclosure({...x,scheme:name},new Date().toISOString().slice(0,10))).sort((a,b)=>b.date.localeCompare(a.date)||Number(!b.code)-Number(!a.code))[0];if(latest&&validateDisclosure({...latest,scheme:name},new Date().toISOString().slice(0,10)))rows.push({...latest,scheme:name})}
 }catch{failures++}
 if(rows.length===names.length&&rows.every(x=>Date.now()-Date.parse(x.date)<=45*864e5))return {rows,failures,missing:[]};
 try{const fallback=await aerieDisclosures(names,fetcher);failures+=fallback.failures;for(const d of fallback.rows){if(!validateDisclosure(d,new Date().toISOString().slice(0,10)))continue;if(!rows.some(x=>x.scheme===d.scheme&&x.date>=d.date)){rows=rows.filter(x=>x.scheme!==d.scheme);rows.push(d)}}}catch{failures++}
 return {rows,failures,missing:names.filter(n=>!rows.some(r=>r.scheme===n))};
}

async function readCatalog(url,fetcher){let last;for(let attempt=0;attempt<2;attempt++){const controller=new AbortController();let timer;try{return await Promise.race([ (async()=>{const r=await fetcher(url,{cache:'no-store',credentials:'omit',signal:controller.signal});if(!r.ok)throw Error('Disclosure HTTP '+r.status);return await r.json()})(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('Disclosure timeout'))},12000)})])}catch(e){last=e;if(String(e.message).includes('HTTP 404'))break}finally{clearTimeout(timer)}}throw last}

 // Fixed public probes: never send a user's portfolio or selected scheme codes.
 export async function probeCharlie(fetcher=fetch){
 const base='https://api.charliealpha.in/v1/mf/';
 const result={};
 for(const [key,path] of [['coverage','holdings-periods'],['sample','holdings/122639']]){
 try{const d=await readCatalog(base+path,fetcher);result[key]={ok:true,fields:Object.keys(d),sampleFields:Array.isArray(d.holdings)&&d.holdings.length?Object.keys(d.holdings[0]):[]};}
 catch(e){result[key]={ok:false,error:String(e.message)};}
 }
 return result;
 }

export function normalizeCharlie(raw,code,scheme,asOf){
 if(String(raw?.amfi_code)!==String(code)||normalize(raw.scheme_name)!==normalize(scheme)||!Array.isArray(raw.holdings)||raw.total_holdings!==raw.holdings.length)return null;
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
 const d={code:String(code),scheme,date:raw.as_of,source:'https://api.charliealpha.in/v1/mf/holdings/'+code,provider:'charlie-alpha',holdings:[...map.values()]};
 return validateDisclosure(d,asOf)?d:null;
}
