import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync('js/market-data.js','utf8');
const a=src.indexOf('async function amfiLatest()'),b=src.indexOf('async function pwHydrate()',a);assert.ok(a>=0&&b>a);
let requests=0;const c=vm.createContext({location:{protocol:'file:'},AbortSignal,pd:s=>s==='23-Nov-2026'?'2026-11-23':null,fetch:async()=>({ok:true,text:async()=>{requests++;return '100000;INF000000001;-;Test fund;123.45;23-Nov-2026'}})});
vm.runInContext(src.slice(a,b),c);const rows=await vm.runInContext('indiaLatest()',c);assert.equal(rows[0].nav,'123.45');await vm.runInContext('indiaLatest()',c);assert.equal(requests,1);console.log('AMFI parser and cache fixture passed');
