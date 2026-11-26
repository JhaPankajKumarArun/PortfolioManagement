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

const {withLegacyGoals,LEGACY_GOALS_KEY}=await import('../js/core/storage.mjs');
m.set(LEGACY_GOALS_KEY,JSON.stringify([{id:'home',name:'Home'}]));
assert.deepEqual(withLegacyGoals(storage,first).goals,[{id:'home',name:'Home'}]);
assert.deepEqual(withLegacyGoals(storage,{...first,goals:[]}).goals,[]);
assert.throws(()=>withLegacyGoals(storage,{...first,goals:null}),/Invalid/);
m.set(LEGACY_GOALS_KEY,'broken');assert.throws(()=>withLegacyGoals(storage,first));

const {persistReplacement,readReplacement,REPLACEMENT_KEY}=await import('../js/core/storage.mjs');
m.delete(LEGACY_GOALS_KEY);persistPortfolio(storage,second);fail=REPLACEMENT_KEY;
assert.throws(()=>persistReplacement(storage,{tx:[],px:{},sample:true}),/Quota/);assert.deepEqual(loadPortfolio(storage),second);
fail=null;persistReplacement(storage,{tx:[],px:{},sample:true});assert.deepEqual(readReplacement(storage),second);
persistReplacement(storage,{tx:[],px:{},goals:[]});assert.deepEqual(readReplacement(storage),second);

{
 const {storageFootprint,quotaSummary}=await import('../js/core/storage.mjs');
 const fake={getItem:k=>k==='portfolio-v1'?'₹':null};
 const rows=storageFootprint(fake);
 if(rows[0].bytes!==3||rows[1].present)throw Error('Incorrect footprint');
 if(!quotaSummary({usage:80,quota:100}).warning||quotaSummary({usage:79,quota:100}).warning||quotaSummary({usage:1,quota:0})!==null)throw Error('Incorrect quota classification');
}

{
 const {isDisposableNav}=await import('../js/services/cache.mjs');
 assert.equal(isDisposableNav({kind:'nav',id:'nav:A',source:'MFAPI.in'}),true);
 for(const r of [{kind:'stock',id:'stock:A',source:'User-imported official CSV'},{kind:'index',id:'index:A',source:'User-imported official CSV'},{kind:'nav',id:'nav:A',source:'manual'},null])assert.equal(isDisposableNav(r),false);
 fail=RECOVERY_KEY;const before=m.get(K);assert.throws(()=>persistPortfolio(storage,{tx:[],px:{B:300}}),/Quota/);assert.equal(m.get(K),before);fail=null;
}

{
 const {trackPortfolioVersion,portfolioVersionChanged}=await import('../js/core/storage.mjs');
 const records=new Map(),tab=()=>({getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v)});
 const a=tab(),b=tab();trackPortfolioVersion(a);trackPortfolioVersion(b);
 persistPortfolio(a,{tx:[],px:{A:1}});
 assert.equal(portfolioVersionChanged(a),false);assert.equal(portfolioVersionChanged(b),true);
 const before=new Map(records);
 assert.throws(()=>persistPortfolio(b,{tx:[],px:{B:2}}),/another tab/);
 assert.throws(()=>persistReplacement(b,{tx:[],px:{}}),/another tab/);
 assert.deepEqual(records,before);
 trackPortfolioVersion(b);persistPortfolio(b,{tx:[],px:{B:2}});assert.equal(portfolioVersionChanged(a),true);
}
