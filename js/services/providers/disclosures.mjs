const base='https://raw.githubusercontent.com/Garuda8887/aerie-data/main/';
const normalize=s=>String(s).toLowerCase().replace(/\b(direct|regular)\s+(plan|growth)\b/g,' ').replace(/\b(direct|regular|growth|plan)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
export function matchDisclosure(name,index){const matches=index.filter(x=>normalize(x.name)===normalize(name));return matches.length===1?matches[0]:null}
export function normalizeDisclosure(raw,entry,name){
 if(raw.id!==entry.id||raw.name!==entry.name||raw.asOf!==entry.asOf||!Array.isArray(raw.holdings)||!raw.source?.file)return null;
 const map=new Map();
 for(const h of raw.holdings){if(h.kind!=='equity')continue;if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.isin)||!Number.isFinite(h.pct)||h.pct<=0)return null;const p=map.get(h.isin);if(p)p.weight+=h.pct;else map.set(h.isin,{isin:h.isin,name:h.name,weight:h.pct})}
 return {scheme:name,date:raw.asOf,source:raw.source.file,holdings:[...map.values()]};
}
export async function publicDisclosures(names,fetcher=fetch){
 const get=async path=>{const r=await fetcher(base+path,{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('Public disclosure HTTP '+r.status);return r.json()};
 const index=await get('data/index.json');if(!Array.isArray(index))throw Error('Unsupported catalog format');
 // Fetch the entire available catalog, independent of the personal portfolio.
 const records=new Map(),queue=[...index];let failures=0;
 await Promise.all(Array.from({length:3},async()=>{while(queue.length){const e=queue.shift();if(!/^data\/[a-zA-Z0-9_./-]+\.json$/.test(e.path)||e.path.includes('..')){failures++;continue}try{records.set(e.id,await get(e.path))}catch{failures++}}}));
 return {rows:names.map(name=>{const e=matchDisclosure(name,index);return e&&records.has(e.id)?normalizeDisclosure(records.get(e.id),e,name):null}).filter(Boolean),failures};
}
