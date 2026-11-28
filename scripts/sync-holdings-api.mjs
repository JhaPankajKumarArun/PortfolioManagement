import fs from 'node:fs/promises';
import {parseAmfiRegistry} from './amfi-registry.mjs';
import {validateDisclosure} from '../js/engines/overlap.mjs';
const get=async (url,accept='application/json')=>{console.log('Fetching',url);const r=await fetch(url,{headers:{Accept:accept},signal:AbortSignal.timeout(15000)});if(!r.ok){const body=(await r.text()).slice(0,500);let detail;try{detail=JSON.parse(body).error}catch{detail=body.includes('DEPLOYMENT_NOT_FOUND')?'DEPLOYMENT_NOT_FOUND':body.includes('NOT_FOUND')?'NOT_FOUND':'Non-JSON response'};throw Error('HTTP '+r.status+' '+String(detail||'Unknown error').slice(0,120));}return r};
const registry=parseAmfiRegistry(await (await get('https://portal.amfiindia.com/spages/NAVAll.txt','*/*')).text());
if(registry.schemes.length<1000)throw Error('Incomplete AMFI registry');
const base='https://api.charliealpha.in/v1/mf/';
let coverage;
try { coverage=await (await get(base+'holdings-periods')).json(); }
catch(e) {
 await fs.mkdir('data',{recursive:true});
 await fs.writeFile('data/api-sync-report.json',JSON.stringify({generatedAt:new Date().toISOString(),provider:'charlie-alpha',status:'blocked',stage:'coverage',error:e.message,processed:0,success:0},null,2));
 throw e;
}
if(!Array.isArray(coverage.periods)||!coverage.periods.length)throw Error('Invalid Charlie coverage');
console.log('Charlie coverage',coverage.latest_as_of,coverage.periods.slice(0,3));
const supported=registry.schemes;
const today=new Date().toISOString().slice(0,10), cutoff=new Date(Date.now()-35*864e5).toISOString().slice(0,10);
const path='data/disclosures.json', statePath='data/charlie-sync-state.json';
const read=async(p,f)=>{try{return JSON.parse(await fs.readFile(p,'utf8'))}catch{return f}};
const old=await read(path,{rows:[]}), state=await read(statePath,{attempts:{}});
const rows=new Map(old.rows.filter(x=>validateDisclosure(x,today)).map(x=>[x.code?'code:'+x.code:'name:'+x.scheme,x]));
const attempts=state.attempts||{};
const queue=supported.filter(s=>!rows.has('code:'+s.code)||rows.get('code:'+s.code).date<cutoff).sort((a,b)=>(attempts[a.code]||'').localeCompare(attempts[b.code]||''));
const probe=queue.findIndex(s=>s.code==='122639');if(probe>=0)queue.unshift(...queue.splice(probe,1));
let success=0,failed=0,processed=0,stop=false,consecutive=0;const errors={};let stopReason=null;
const deadline=Date.now()+18*60*1000;
while(queue.length&&!stop&&processed<20&&Date.now()<deadline){
 const s=queue.shift();attempts[s.code]=new Date().toISOString();processed++;
 try{
 const url=base+'holdings/'+s.code;const d=await (await get(url)).json();
 if(String(d.amfi_code??d.scheme_code)!==s.code||!Array.isArray(d.holdings)||d.total_holdings!==d.holdings.length){console.log('Response fields',Object.keys(d));throw Error('Invalid Charlie response');}
 const map=new Map();
 for(const h of d.holdings){const kind=h.instrument_type??h.asset_class??h.holding_type;if(typeof kind!=='string'){console.log('Holding fields',Object.keys(h));throw Error('Missing asset classification')}if(!/^(equity|equity shares|common stock)$/i.test(kind))continue;const weight=h.pct_nav??h.weight_pct??h.percent_of_nav;if(!Number.isFinite(weight)||weight<0){console.log('Holding fields',Object.keys(h));throw Error('Missing explicit percent weight')}if(!weight)continue;const p=map.get(h.isin)||{isin:h.isin,name:h.name??h.instrument_name??h.instrument,weight:0};p.weight+=weight;map.set(h.isin,p)}
 const record={code:s.code,scheme:s.name,date:d.as_of,source:url,provider:'charlie-alpha',holdings:[...map.values()]};
 if(!validateDisclosure(record,today))throw Error('Invalid disclosure');
 const key='code:'+s.code;if(!rows.has(key)||rows.get(key).date<=record.date)rows.set(key,record);success++;consecutive=0;
 }catch(e){failed++;consecutive++;errors[e.message]=(errors[e.message]||0)+1;if(failed<=10)console.log(s.code,e.message);if(/^HTTP (429|403)\b/.test(e.message)||consecutive>=15){stop=true;stopReason=e.message+'; consecutive failures '+consecutive;console.warn('Stopping:',stopReason)}}
 if(processed%10===0)console.log({processed,success,failed,remaining:queue.length});
 if(!stop)await new Promise(r=>setTimeout(r,1100));
}
await fs.mkdir('data',{recursive:true});
const write=async(p,d)=>{await fs.writeFile(p+'.tmp',JSON.stringify(d));await fs.rename(p+'.tmp',p)};
await write(statePath,{attempts});
const summary={generatedAt:new Date().toISOString(),universe:registry.schemes.length,provider:'charlie-alpha',processed,success,failed,errors,stopReason,remaining:queue.length,current:[...rows.values()].filter(x=>x.code&&x.date>=cutoff).length};
await write('data/api-sync-report.json',summary);
if(success&&process.env.PUBLISH_CHARLIE==='true')await write(path,{...summary,rows:[...rows.values()]});
console.log(summary);
if(!success&&processed)process.exitCode=1;
