import assert from 'node:assert/strict';
import {K,RECOVERY_KEY,loadPortfolio,persistPortfolio,readRecovery} from '../js/core/storage.mjs';
const m=new Map();let fail=null;
const storage={getItem:k=>m.get(k)??null,setItem:(k,v)=>{if(k===fail)throw Error('Quota exceeded');m.set(k,v)}};
const first={tx:[],px:{},symbols:{A:'A.NS'}},second={...first,px:{A:100}};
assert.deepEqual(loadPortfolio(storage),{tx:[],px:{}});
persistPortfolio(storage,first);persistPortfolio(storage,second);
assert.deepEqual(readRecovery(storage),first);
assert.deepEqual(loadPortfolio(storage),second);
fail=K;assert.throws(()=>persistPortfolio(storage,{...second,px:{A:200}}),/Quota/);
assert.deepEqual(loadPortfolio(storage),second);
fail=null;m.set(K,'corrupt');assert.throws(()=>loadPortfolio(storage));assert.throws(()=>persistPortfolio(storage,first));assert.equal(m.get(K),'corrupt');
console.log('Storage safety fixtures passed');

const {restoreDamagedPortfolio,DAMAGED_KEY}=await import('../js/core/storage.mjs');
fail=DAMAGED_KEY;assert.throws(()=>restoreDamagedPortfolio(storage,second),/Quota/);assert.equal(m.get(K),'corrupt');
fail=K;assert.throws(()=>restoreDamagedPortfolio(storage,second),/Quota/);assert.equal(m.get(K),'corrupt');
fail=null;restoreDamagedPortfolio(storage,second);assert.deepEqual(loadPortfolio(storage),second);assert.equal(m.get(DAMAGED_KEY),'corrupt');
assert.throws(()=>restoreDamagedPortfolio(storage,first),/valid/);assert.deepEqual(loadPortfolio(storage),second);
