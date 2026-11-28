import assert from 'node:assert/strict';
import {createRefreshManager} from '../js/services/refresh.mjs';
let t=0,calls=0,online=true;const m=createRefreshManager({now:()=>t,online:()=>online});const work=async()=>++calls;
const a=m.run('x',work,{ttl:100}),b=m.run('x',work,{ttl:100});assert.equal(a,b);assert.equal(await a,1);assert.equal(await m.run('x',work,{ttl:100}),1);t=101;assert.equal(await m.run('x',work,{ttl:100}),2);
await assert.rejects(m.run('y',async()=>{throw Error('test')}));assert.equal(m.status('y').failures,1);assert.equal(await m.run('y',work),undefined);t=1101;assert.equal(await m.run('y',work),3);online=false;assert.equal(await m.run('z',work),undefined);

{
 const bounded=createRefreshManager({online:()=>true,maxIdle:2});
 for(let i=0;i<10;i++)await bounded.run('fund:'+i,async()=>i);
 assert.equal(bounded.size(),2);assert.equal(bounded.status('fund:0'),null);
 let release;const pending=bounded.run('active',()=>new Promise(r=>{release=r}));await Promise.resolve();
 for(let i=0;i<5;i++)await bounded.run('other:'+i,async()=>i);
 assert.equal(bounded.status('active').busy,true);release(42);assert.equal(await pending,42);assert.equal(bounded.size(),2);
}

{
 const {installRefreshTriggers}=await import('../js/services/refresh.mjs');
 const target=()=>({handlers:new Map(),addEventListener(k,f){this.handlers.set(k,f)},removeEventListener(k){this.handlers.delete(k)}});
 const document=target(),window=Object.assign(target(),{navigator:{onLine:true},setInterval:()=>1,clearInterval:()=>{}});
 let calls=0;const stop=installRefreshTriggers({document,window,refresh:()=>calls++});
 window.handlers.get('pageshow')({persisted:false});await Promise.resolve();assert.equal(calls,0);
 window.handlers.get('pageshow')({persisted:true});await Promise.resolve();assert.equal(calls,1);
 document.hidden=true;window.handlers.get('pageshow')({persisted:true});await Promise.resolve();assert.equal(calls,1);
 stop();assert.equal(window.handlers.size,0);assert.equal(document.handlers.size,0);
}
