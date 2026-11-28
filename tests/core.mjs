import assert from 'node:assert/strict';
import {K,loadPortfolio,persistPortfolio} from '../js/core/storage.mjs';
import {inr,esc} from '../js/core/format.mjs';
const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
assert.deepEqual(loadPortfolio(storage),{tx:[],px:{}});
const portfolio={tx:[{name:'Synthetic'}],px:{Synthetic:100},extra:true};persistPortfolio(storage,portfolio);assert.deepEqual(loadPortfolio(storage),portfolio);assert.equal(K,'portfolio-v1');assert.equal(esc('<'),'&lt;');assert.equal(inr(1000),'₹1,000');
