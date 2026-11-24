import assert from 'node:assert/strict';
import {createRefreshManager} from '../js/services/refresh.mjs';
let t=0,calls=0,online=true;const m=createRefreshManager({now:()=>t,online:()=>online});const work=async()=>++calls;
const a=m.run('x',work,{ttl:100}),b=m.run('x',work,{ttl:100});assert.equal(a,b);assert.equal(await a,1);assert.equal(await m.run('x',work,{ttl:100}),1);t=101;assert.equal(await m.run('x',work,{ttl:100}),2);
await assert.rejects(m.run('y',async()=>{throw Error('test')}));assert.equal(m.status('y').failures,1);assert.equal(await m.run('y',work),undefined);t=1101;assert.equal(await m.run('y',work),3);online=false;assert.equal(await m.run('z',work),undefined);
