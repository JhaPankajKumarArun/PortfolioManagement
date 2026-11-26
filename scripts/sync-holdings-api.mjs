import fs from 'node:fs/promises';
import {parseAmfiRegistry} from './amfi-registry.mjs';
import {validateDisclosure} from '../js/engines/overlap.mjs';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});if(!r.ok){const body=(await r.text()).slice(0,500);let detail;try{detail=JSON.parse(body).error}catch{detail=body.includes('DEPLOYMENT_NOT_FOUND')?'DEPLOYMENT_NOT_FOUND':body.includes('NOT_FOUND')?'NOT_FOUND':'Non-JSON response'};throw Error('HTTP '+r.status+' '+String(detail||'Unknown error').slice(0,120));}return r};
const registry=parseAmfiRegistry(await (await get('https://portal.amfiindia.com/spages/NAVAll.txt')).text());
if(registry.schemes.length<1000)throw Error('Incomplete AMFI registry');
const lookup=await (await get('https://raw.githubusercontent.com/subscriptionmanager26-png/fund-disclosures/main/holdings-browser/api/amfi-lookup.json')).json();
if(!lookup||Array.isArray(lookup)||typeof lookup!=='object')throw Error('Invalid provider lookup');
const supported=registry.schemes.filter(s=>lookup[s.code]?.has_holdings===true&&typeof lookup[s.code]?.b2_key==='string'&&lookup[s.code].b2_key.length>0);
console.log({universe:registry.schemes.length,providerSupported:supported.length});
if(!supported.length)throw Error('Provider has no mapped holdings');
const today=new Date().toISOString().slice(0,10), cutoff=new Date(Date.now()-35*864e5).toISOString().slice(0,10);
const path='data/disclosures.json', statePath='data/api-sync-state.json';
const read=async(p,f)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}};
const old=await read(path,{rows:[]}), state=await read(statePath,{attempts:{}});
const rows=new Map(old.rows.filter(x=>validateDisclosure(x,today)).map(x=>[x.code?'code:'+x.code:'name:'+x.scheme,x]));
const attempts=state.attempts||{};
const queue=supported.filter(s=>!rows.has('code:'+s.code)||rows.get('code:'+s.code).date<cutoff).sort((a,b)=>(attempts[a.code]||'').localeCompare(attempts[b.code]||''));
let success=0,failed=0,processed=0,stop=false,consecutive=0;const errors={};let stopReason=null;
const deadline=Date.now()+18*60*1000;
while(queue.length&&!stop&&processed<500&&Date.now()<deadline){
 const s=queue.shift();attempts[s.code]=new Date().toISOString();processed++;
 try{
 const d=await (await get('https://fund-holdings-browser.vercel.app/api/amfi/'+s.code)).json();
 if(String(d.amfi_code)!==s.code||d.meta?.pct_nav_unit!=='percent'||!Array.isArray(d.holdings))throw Error('Invalid provider response');
 const map=new Map();
 for(const h of d.holdings){if(h.holding_type!=='equity')continue;if(!Number.isFinite(h.pct_nav)||h.pct_nav<0)throw Error('Invalid weight');if(!h.pct_nav)continue;const p=map.get(h.isin)||{isin:h.isin,name:h.instrument,weight:0};p.weight+=h.pct_nav;map.set(h.isin,p)}
 const record={code:s.code,scheme:s.name,date:d.meta.as_of,source:d.meta.source_file,provider:'fund-disclosures',holdings:[...map.values()]};
 if(!validateDisclosure(record,today))throw Error('Invalid disclosure');
 const key='code:'+s.code;if(!rows.has(key)||rows.get(key).date<=record.date)rows.set(key,record);success++;consecutive=0;
 }catch(e){failed++;consecutive++;errors[e.message]=(errors[e.message]||0)+1;if(failed<=10)console.log(s.code,e.message);if(/^HTTP (429|403)\b/.test(e.message)||consecutive>=15){stop=true;stopReason=e.message+'; consecutive failures '+consecutive;console.warn('Stopping:',stopReason)}}
 if(processed%10===0)console.log({processed,success,failed,remaining:queue.length});
 if(!stop)await new Promise(r=>setTimeout(r,1100));
}
await fs.mkdir('data',{recursive:true});
const write=async(p,d)=>{await fs.writeFile(p+'.tmp',JSON.stringify(d));await fs.rename(p+'.tmp',p)};
await write(statePath,{attempts});
const summary={generatedAt:new Date().toISOString(),universe:registry.schemes.length,providerSupported:supported.length,unsupported:registry.schemes.length-supported.length,processed,success,failed,errors,stopReason,remaining:queue.length,current:[...rows.values()].filter(x=>x.code&&x.date>=cutoff).length};
await write('data/api-sync-report.json',summary);
if(success)await write(path,{...summary,rows:[...rows.values()]});
console.log(summary);
if(!success&&processed)process.exitCode=1;
