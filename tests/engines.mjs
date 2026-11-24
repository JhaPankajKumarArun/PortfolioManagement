import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const paths=fs.readdirSync('js',{recursive:true}).filter(p=>p.endsWith('.js'));
for(const p of paths)new vm.Script(fs.readFileSync('js/'+p,'utf8'),{filename:p});
const c=vm.createContext({});
for(const p of fs.readdirSync('js/engines').filter(p=>p.endsWith('.mjs')))Object.assign(c,await import('../js/engines/'+p));
const run=s=>vm.runInContext(s,c);
assert.equal(run("calculatePortfolio({tx:[{name:'A',type:'mf',side:'buy',units:10,price:100,date:'2025-01-01'}],px:{A:120}},'2026-01-01').pl"),200);
assert.equal(run("projectPortfolio(0,{tv:1000,tc:1000},{sip:100,yrs:1,step:0})[1][1]"),2200);
assert.equal(run("swpSim(1200,0,100,0,1).end"),0);
assert.equal(run("calculateAttribution({open:[{name:'A',pl:200,value:1200,cost:1000}],tv:1200},[{name:'A',gain:50}]).net"),250);
const p=run("calculatePerformance({S:{tx:[{name:'A',type:'mf',side:'buy',units:10,price:100,date:'2025-01-01'},{name:'A',type:'mf',side:'buy',units:5,price:100,date:'2025-02-01'}]},ser:{},PWH:{},pxAt:(s,n,d)=>d==='2025-01-01'?100:120,navCovers:()=>true,dnum:d=>Date.parse(d)/864e5},'2025-01-01','2025-03-01')");assert.equal(p.gain,300);assert.equal(p.vch,800);
console.log('Syntax and financial engine fixtures passed');

assert.equal(run("calculateSips([{name:'A',side:'buy',sip:true,units:10,price:100,date:'2025-01-01'}],'2025-01-10')[0].amt"),1000);
assert.equal(run("calculateRiskStats({points:[],missing:[]}).ready"),false);
assert.equal(run("calculateRealized({tx:[{name:'A',type:'stock',side:'buy',units:10,price:100,date:'2025-01-01'},{name:'A',type:'stock',side:'sell',units:5,price:120,date:'2025-02-01'}]})[0].gain"),100);
assert.equal(run("calculateBenchmark([], {points:[]}, [], d=>Date.parse(d)/864e5).ready"),false);
