import assert from 'node:assert/strict';
import {xirr,calculatePortfolio} from '../js/engines/portfolio.mjs';
import {calculateBenchmark} from '../js/engines/benchmark.mjs';
import {calculatePerformance} from '../js/engines/performance.mjs';
import {projectPortfolio,swpSim} from '../js/engines/planning.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
near(xirr([['2025-01-01',-1000],['2026-01-01',1100]]),10);
near(xirr([['2025-01-01',-100],['2026-01-01',2100]]),2000);
near(xirr([['2025-01-01',-100],['2026-01-01',50]]),-50);
assert.equal(xirr([['2025-01-01',-100],['2025-01-01',100]]),null);
assert.equal(xirr([['2025-01-01',100],['2026-01-01',100]]),null);
const tx=[{name:'A',type:'mf',side:'buy',date:'2025-01-01',units:10,price:100,fee:10},{name:'A',type:'mf',side:'buy',date:'2025-02-01',units:5,price:120},{name:'A',type:'mf',side:'sell',date:'2025-03-01',units:12,price:150,fee:20}];
const p=calculatePortfolio({tx,px:{A:160},pxd:{A:'2025-04-01'}},'2025-04-01');near(p.tc,360);near(p.tv,480);near(p.pl,120);
const historical=calculatePortfolio({tx,px:{A:160},pxd:{A:'2025-04-01'}},'2025-03-01');near(historical.tv,450);
const undated=calculatePortfolio({tx,px:{A:160}},'2025-03-01');near(undated.tv,450);
const dnum=d=>Date.parse(d)/86400000;
const q=calculatePerformance({S:{tx},ser:{},PWH:{},pxAt:(s,n,d)=>d==='2025-01-01'?100:160,navCovers:()=>true,dnum},'2025-01-01','2025-04-01');near(q.cf,-1180);near(q.vch,-520);near(q.gain,660);
const bm=calculateBenchmark([['2025-01-01',100],['2026-01-01',110]],{points:[{d:'2025-01-01'},{d:'2026-01-01'}]},[tx[0]],dnum);assert.equal(bm.ready,true);near(bm.ret,10);
near(projectPortfolio(0,{tv:1000,tc:1000},{sip:100,step:10,yrs:2})[2][1],3520);near(swpSim(1200,0,100,0,1).end,0);

import {calculateSips} from '../js/engines/sip.mjs';
import {riskHistPrice,calculateRiskSeries,calculateRiskStats} from '../js/engines/risk.mjs';
import {calculateRealized,calculateTaxFY} from '../js/engines/tax.mjs';
const sip=calculateSips([{...tx[0],sip:true},{...tx[1],sip:true}], '2025-01-15')[0];near(sip.total,1010);assert.equal(sip.n,1);
assert.equal(riskHistPrice({px:{A:200},pxd:{A:'2025-02-01'}},{},{},'2025-01-31',dnum,'A','mf','2025-01-31'),null);
assert.deepEqual(calculateRiskSeries({tx:[tx[1]]},'2025-01-01',dnum,()=>100).points,[]);
const realized=calculateRealized({tx});near(realized.reduce((s,x)=>s+x.gain,0),530);
const tax=calculateTaxFY([{fy:'2025-26',bucket:'eqST',gain:10000,sell:'2025-05-01'},{fy:'2024-25',bucket:'eqST',gain:10000,sell:'2025-03-01'}],'2025-26',30);near(tax.tax,2080);

 // Regression: historical untagged SIPs, without changing portfolio storage.
const recurring=['2025-01-05','2025-02-06','2025-03-05','2025-04-07'].map((date,i)=>({name:'Monthly',type:'mf',side:'buy',date,units:1000/(100+i*10),price:100+i*10,sip:false}));
const unrelated=[{...recurring[0],name:'Lump sum'},{...recurring[1],name:'Lump sum'},{...recurring[2],name:'Lump sum',units:100},{...recurring[2],side:'sell'},{...recurring[3],date:'2025-05-05'}];
const history=[...recurring,...unrelated],before=JSON.stringify(history);
const recovered=calculateSips(history,'2025-04-10');
assert.equal(recovered.length,1);assert.equal(recovered[0].name,'Monthly');assert.equal(recovered[0].n,4);assert.equal(recovered[0].inferred,4);near(recovered[0].total,4000);near(recovered[0].amt,1000);assert.equal(recovered[0].active,true);assert.equal(recovered[0].missed,0);
assert.equal(JSON.stringify(history),before);
assert.equal(calculateSips(recurring,'2025-02-10').length,0);
assert.equal(calculateSips(recurring,'2025-07-01')[0].active,false);
assert.equal(calculateSips(recurring.map(t=>({...t,type:'stock'})),'2025-04-10').length,0);
const mixed=calculateSips(recurring.map((t,i)=>({...t,sip:i===0})),'2025-04-10')[0];assert.equal(mixed.n,4);assert.equal(mixed.inferred,3);near(mixed.total,4000);
console.log('SIP recovery regression fixtures passed');

import {stressExposure} from '../js/engines/risk.mjs';
const exposure=stressExposure([{name:'A',value:600},{name:'B',value:400}]);
near(exposure.largestWeight,60);near(exposure.effective,1/.52);near(exposure.scenarios[1].loss,200);near(exposure.scenarios[3].remaining,820);
assert.equal(stressExposure([]),null);
assert.equal(riskHistPrice({}, {}, {A:{d:[['2025-01-31',100],['2025-02-01',999],['2025-01-30',90]]}},'2025-01-31',dnum,'A','mf','2025-01-31'),100);
const riskPoints=Array.from({length:13},(_,i)=>({d:new Date(Date.UTC(2025,i+1,0)).toISOString().slice(0,10),r:i?0.01:null,index:100*1.01**i}));
const riskResult=calculateRiskStats({points:[...riskPoints,{d:'2026-02-10',r:-.1,index:riskPoints[12].index*.9}],missing:[]});
assert.equal(riskResult.months,12);assert.equal(riskResult.roll.length,1);assert.equal(riskResult.negativeMonths,0);

// Same display name in different asset types must not share transaction prices.
const distinct=calculatePortfolio({tx:[{name:'Same',type:'mf',side:'buy',units:2,price:100,date:'2025-01-01'},{name:'Same',type:'stock',side:'buy',units:3,price:200,date:'2025-01-02'}]},'2025-01-03');
near(distinct.tv,800);assert.equal(distinct.open.length,2);

near(p.realized,530);near(p.lifetimeGain,650);near(p.netInvested,-170);near(p.reconciliationDifference,0);
const firstFee=calculatePortfolio({tx:[tx[0]],px:{A:100},pxd:{A:'2025-01-01'}},'2025-01-01');
near(firstFee.lifetimeGain,-10);near(firstFee.realized,0);near(firstFee.reconciliationDifference,0);
const closed=calculatePortfolio({tx:[tx[0],{...tx[0],side:'sell',date:'2025-02-01',price:120,fee:5}]},'2025-02-01');
near(closed.lifetimeGain,185);near(closed.realized,185);near(closed.pl,0);near(closed.reconciliationDifference,0);
