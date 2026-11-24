import assert from 'node:assert/strict';
import {recordError,getDiagnostics,showStartupFailure} from '../js/core/errors.mjs';
import {fetchWithTimeout} from '../js/services/http.mjs';
recordError('private portfolio value');assert.equal(getDiagnostics()[0].category,'runtime');assert.equal(Object.keys(getDiagnostics()[0]).length,2);
for(let i=0;i<60;i++)recordError('network');assert.equal(getDiagnostics().length,50);
globalThis.fetch=async(url,opts)=>({ok:true,signal:opts.signal});assert.equal((await fetchWithTimeout('/test')).ok,true);
globalThis.fetch=async()=>{throw Error('private detail')};await assert.rejects(fetchWithTimeout('/test'));assert.equal(getDiagnostics().at(-1).category,'network');
const node={setAttribute(){}};showStartupFailure({querySelector:()=>node});assert.match(node.textContent,/could not start/);
