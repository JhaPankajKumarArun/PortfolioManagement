import assert from 'node:assert/strict';
import {createState,exposeLegacyState} from '../js/core/state.mjs';
const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
const store=createState(storage),legacy={};exposeLegacyState(store,legacy);
assert.equal(legacy.tab,'home');legacy.tab='tax';assert.equal(store.state.tab,'tax');
legacy.S={tx:[{name:'Synthetic'}],px:{}};legacy.save();assert.deepEqual(createState(storage).state.S,legacy.S);
store.state.pl.sip=20000;assert.equal(legacy.pl.sip,20000);
assert.equal(createState(storage).state.tab,'home');
assert.throws(()=>exposeLegacyState(store,legacy),/already exists/);
