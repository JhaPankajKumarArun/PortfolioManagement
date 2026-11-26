import fs from 'node:fs/promises';
import {validateDisclosure} from '../js/engines/overlap.mjs';
const registry=JSON.parse(await fs.readFile('data/amfi-registry.json','utf8'));
const today=new Date().toISOString().slice(0,10);
const cutoff=new Date(Date.now()-45*864e5).toISOString().slice(0,10);
const schemes=[...new Map(registry.schemes.map(s=>[String(s.code),s])).values()];
const limit=Math.max(1,Number(process.env.AUDIT_LIMIT)||150);
const groups=new Map();
for(const s of schemes){const key=s.amc||s.fundHouse||'Unknown';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(s)}
const sample=[];while(sample.length<Math.min(limit,schemes.length)){for(const g of groups.values()){if(g.length&&sample.length<limit)sample.push(g.shift())}}
const get=async(url,headers={})=>{const r=await fetch(url,{headers,signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
const primary=async s=>{const d=await get('https://fund-holdings-browser.vercel.app/api/amfi/'+s.code);if(String(d.amfi_code)!==String(s.code)||d.meta?.pct_nav_unit!=='percent'||!Array.isArray(d.holdings))throw Error('Invalid or missing disclosure');return {scheme:s.name,date:d.meta.as_of,source:d.meta.source_file,holdings:d.holdings.filter(h=>h.holding_type==='equity'&&h.pct_nav!==0).map(h=>({isin:h.isin,name:h.instrument,weight:h.pct_nav}))}};
const secondary=async s=>{const base='https://fin.ejiapi.com/api/mf/';const headers={'x-api-key':process.env.EJI_API_KEY};const d=(await get(base+'holdings-history/scheme-code/'+s.code,headers)).data;if(String(d?.schemeCode)!==String(s.code))throw Error('Scheme mismatch');const h=d.holdingsHistory?.[0];if(!h||!Array.isArray(h.holdings))throw Error('Missing disclosure');const docs=(await get(base+'scheme-code/'+s.code+'/documents?months=3',headers)).data;const source=docs?.disclosures?.find(x=>x.asOf===h.holdingsAsOf)?.portfolioDisclosure;return {scheme:s.name,date:h.holdingsAsOf,source,holdings:h.holdings.filter(x=>x.category==='Equity'&&Number(x.weightage)!==0).map(x=>({isin:x.isin,name:x.name,weight:x.weightage==null||String(x.weightage).trim()===''?NaN:Number(x.weightage)}))}};
const providers=[['fund-disclosures',primary],...(process.env.EJI_API_KEY?[['eji',secondary]]:[])];
const results=[];
for(const [provider,load] of providers){for(const s of sample){let result={provider,code:s.code,amc:s.amc||s.fundHouse||'Unknown',scheme:s.name};try{const d=await load(s);result={...result,date:d.date,holdings:d.holdings.length,status:!validateDisclosure(d,today)?'invalid':d.date<cutoff?'stale':'valid'}}catch(e){result.status='error';result.error=String(e.message).slice(0,150)}results.push(result);if(result.error==='HTTP 429')break;await new Promise(r=>setTimeout(r,1100))}}
const summary=Object.fromEntries(providers.map(([p])=>[p,results.filter(r=>r.provider===p).reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})]));
await fs.writeFile('data/holdings-provider-audit.json',JSON.stringify({generatedAt:new Date().toISOString(),universe:schemes.length,sample:sample.length,ejiConfigured:!!process.env.EJI_API_KEY,summary,results},null,2));
console.log(summary);
