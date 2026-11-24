import fs from 'node:fs/promises';
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(String(r.status));return r};
const nav=await (await get('https://portal.amfiindia.com/spages/NAVAll.txt')).text();
const universe=nav.split(/\r?\n/).map(x=>x.split(';')).filter(x=>/^\d{6}$/.test(x[0])&&x[3]).map(x=>({code:x[0],name:x[3]}));
if(universe.length<1000)throw Error('Incomplete AMFI universe');
const path='data/disclosures.json';let previous=[];try{previous=JSON.parse(await fs.readFile(path,'utf8')).rows}catch{}
const rows=new Map(previous.map(x=>[x.code,x]));const queue=[...universe];let success=0,failed=0;
await Promise.all(Array.from({length:3},async()=>{while(queue.length){const {code,name}=queue.shift();try{
 const url='https://fund-holdings-browser.vercel.app/api/amfi/'+code;
 const d=await (await get(url)).json();
 if(String(d.amfi_code)!==code||d.meta?.pct_nav_unit!=='percent'||!/^\d{4}-\d{2}-\d{2}$/.test(d.meta?.as_of)||!Array.isArray(d.holdings)||!d.meta.source_file)throw Error('Missing disclosure');
 const m=new Map();for(const h of d.holdings){if(h.holding_type!=='equity')continue;if(!Number.isFinite(h.pct_nav)||h.pct_nav<0||! /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.isin))throw Error('Invalid equity');if(!h.pct_nav)continue;const p=m.get(h.isin)||{isin:h.isin,name:h.instrument,weight:0};p.weight+=h.pct_nav;m.set(h.isin,p)}
 const holdings=[...m.values()];if(!holdings.length||holdings.reduce((s,h)=>s+h.weight,0)>100.05)throw Error('Invalid weights');
 const date=d.meta.as_of;if(date>new Date().toISOString().slice(0,10))throw Error('Future disclosure');
 if(!rows.has(code)||rows.get(code).date<=date)rows.set(code,{code,scheme:name,date,source:d.meta.source_file,holdings});success++;
 }catch{failed++}await new Promise(r=>setTimeout(r,250))}}));
if(!success)throw Error('No usable upstream disclosures; retaining previous catalog');
await fs.mkdir('data',{recursive:true});await fs.writeFile(path,JSON.stringify({generatedAt:new Date().toISOString(),success,failed,rows:[...rows.values()]}));console.log({success,failed});
