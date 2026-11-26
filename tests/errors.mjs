import assert from 'node:assert/strict';
import {recordError,getDiagnostics,showStartupFailure} from '../js/core/errors.mjs';
import {fetchWithTimeout} from '../js/services/http.mjs';
recordError('private portfolio value');assert.equal(getDiagnostics()[0].category,'runtime');assert.equal(Object.keys(getDiagnostics()[0]).length,2);
for(let i=0;i<60;i++)recordError('network');assert.equal(getDiagnostics().length,50);
globalThis.fetch=async(url,opts)=>({ok:true,signal:opts.signal});assert.equal((await fetchWithTimeout('/test')).ok,true);
globalThis.fetch=async()=>{throw Error('private detail')};await assert.rejects(fetchWithTimeout('/test'));assert.equal(getDiagnostics().at(-1).category,'network');
const node={setAttribute(){}};showStartupFailure({querySelector:()=>node});assert.match(node.textContent,/could not start/);

const {diagnosticSummary,clearDiagnostics}=await import('../js/core/errors.mjs');
clearDiagnostics();recordError('storage');recordError('conflict');recordError('storage');
assert.deepEqual(diagnosticSummary().counts,{storage:2,conflict:1});
assert.equal(diagnosticSummary().events[0].category,'storage');
const copy=diagnosticSummary();copy.events[0].category='private';assert.equal(getDiagnostics().at(-1).category,'storage');
clearDiagnostics();assert.equal(diagnosticSummary().count,0);

{
 const {fetchJsonWithTimeout}=await import('../js/services/http.mjs');
 globalThis.fetch=async(url,{signal})=>({ok:true,json:()=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true})})});
 await assert.rejects(fetchJsonWithTimeout('/test',{},5),/aborted/);
 globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true})});
 assert.deepEqual(await fetchJsonWithTimeout('/test'),{ok:true});
}
