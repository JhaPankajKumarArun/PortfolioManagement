import fs from 'node:fs/promises';
import {parseAmfiRegistry} from './amfi-registry.mjs';
import {publicDisclosures} from '../js/services/providers/disclosures.mjs';
import {validateDisclosure} from '../js/engines/overlap.mjs';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(String(r.status));return r};
const nav=await (await get('https://portal.amfiindia.com/spages/NAVAll.txt')).text();
const registry=parseAmfiRegistry(nav);
const universe=registry.schemes;
if(registry.amcs.length<10)throw Error('Incomplete AMC registry');
if(universe.length<1000)throw Error('Incomplete AMFI universe');
await fs.mkdir('data',{recursive:true});
await fs.writeFile('data/amfi-registry.json.tmp',JSON.stringify({generatedAt:new Date().toISOString(),...registry}));
await fs.rename('data/amfi-registry.json.tmp','data/amfi-registry.json');
const path='data/disclosures.json';let previous=[];try{previous=JSON.parse(await fs.readFile(path,'utf8')).rows}catch{}
const rows=new Map(previous.map(x=>[x.code,x]));const cutoff=new Date(Date.now()-35*864e5).toISOString().slice(0,10);
const queue=[...new Map(universe.map(x=>[x.code,x])).values()].filter(x=>!rows.has(x.code)||rows.get(x.code).date<cutoff);const total=queue.length;let success=0,failed=0,consecutive=0,stop=false;const deadline=Date.now()+20*60*1000;console.log({universe:universe.length,queued:total,cached:rows.size});
await Promise.all(Array.from({length:3},async()=>{while(queue.length&&!stop&&Date.now()<deadline){const {code,name}=queue.shift();try{
 const url='https://fund-holdings-browser.vercel.app/api/amfi/'+code;
 const d=await (await get(url)).json();
 if(String(d.amfi_code)!==code||d.meta?.pct_nav_unit!=='percent'||!/^\d{4}-\d{2}-\d{2}$/.test(d.meta?.as_of)||!Array.isArray(d.holdings)||!d.meta.source_file)throw Error('Missing disclosure');
 const m=new Map();for(const h of d.holdings){if(h.holding_type!=='equity')continue;if(!Number.isFinite(h.pct_nav)||h.pct_nav<0||! /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.isin))throw Error('Invalid equity');if(!h.pct_nav)continue;const p=m.get(h.isin)||{isin:h.isin,name:h.instrument,weight:0};p.weight+=h.pct_nav;m.set(h.isin,p)}
 const holdings=[...m.values()];if(!holdings.length||holdings.reduce((s,h)=>s+h.weight,0)>100.05)throw Error('Invalid weights');
 const date=d.meta.as_of;if(date>new Date().toISOString().slice(0,10))throw Error('Future disclosure');
 if(!rows.has(code)||rows.get(code).date<=date)rows.set(code,{code,scheme:name,date,source:d.meta.source_file,holdings});success++;consecutive=0;
 }catch(e){failed++;consecutive++;if(failed<=10)console.log('Failed',code,String(e.message));if(consecutive>=30){stop=true;console.warn('Stopping after 30 consecutive unusable responses')}}if((success+failed)%25===0)console.log({processed:success+failed,total,success,failed,remaining:queue.length});await new Promise(r=>setTimeout(r,250))}}));
if(!total){console.log('Catalog already fresh');process.exit(0)}
if(!success||queue.length){
 const fallback=await publicDisclosures([...new Set(universe.map(x=>x.name))]);
 const byName=new Map(fallback.rows.map(x=>[x.scheme,x]));
 for(const {code,name} of universe){const d=byName.get(name);if(d&&validateDisclosure(d,new Date().toISOString().slice(0,10))&&(!rows.has(code)||rows.get(code).date<d.date)){rows.set(code,{...d,code});success++}}
 console.log('Fallback catalog', {matched:byName.size,failures:fallback.failures});
}
if(!success)throw Error('No usable upstream disclosures; retaining previous catalog');
await fs.mkdir('data',{recursive:true});await fs.writeFile(path+'.tmp',JSON.stringify({generatedAt:new Date().toISOString(),success,failed,remaining:queue.length,rows:[...rows.values()]}));await fs.rename(path+'.tmp',path);console.log({success,failed,remaining:queue.length});
