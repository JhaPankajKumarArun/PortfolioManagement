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

 // Independent period-return fixtures: opening 1000, midpoint contribution 500, closing 1650.
const periodTx=[{name:'Fixture',type:'mf',side:'buy',date:'2025-01-01',units:10,price:100},{name:'Fixture',type:'mf',side:'buy',date:'2025-01-16',units:5,price:100}];
const period=(price)=>calculatePerformance({S:{tx:periodTx},ser:{},PWH:{},pxAt:(s,n,d)=>d==='2025-01-01'?100:price,navCovers:()=>true,dnum},'2025-01-01','2025-01-31');
const complete=period(110);near(complete.gain,150);near(complete.vch,650);near(complete.pct,12);
for(const price of [null,undefined,0,-1,NaN,Infinity]){const incomplete=period(price);assert.equal(incomplete.hist,true);assert.equal(incomplete.gain,null);assert.equal(incomplete.pct,null);assert.equal(incomplete.vch,null);assert.equal(incomplete.rows[0].gain,null);near(incomplete.cf,500);}

 // A name-only market cache cannot safely identify two different asset types.
const collisionTx=[{name:'Collision',type:'mf',side:'buy',units:2,price:100,date:'2025-01-01'},{name:'Collision',type:'stock',side:'buy',units:3,price:200,date:'2025-01-02'}];
const collision=calculatePortfolio({tx:collisionTx,px:{Collision:500},pxd:{Collision:'2025-01-03'}},'2025-01-03');
near(collision.tv,800);assert.ok(collision.open.every(h=>h.valuation.estimated));
const unique=calculatePortfolio({tx:[collisionTx[0]],px:{Collision:500},pxd:{Collision:'2025-01-03'}},'2025-01-03');
near(unique.tv,1000);assert.equal(unique.open[0].valuation.estimated,false);

import {riskPortfolioAt} from '../js/engines/risk.mjs';
const riskCollision=riskPortfolioAt({tx:collisionTx},(n,type)=>type==='mf'?110:220,'2025-01-03');
near(riskCollision.value,880);assert.deepEqual(riskCollision.missing,[]);
const riskInvalid=riskPortfolioAt({tx:collisionTx},()=>Infinity,'2025-01-03');assert.equal(riskInvalid.missing.length,2);
const perfCollision=calculatePerformance({S:{tx:collisionTx},ser:{},PWH:{},pxAt:()=>500,navCovers:()=>true,dnum},'2025-01-02','2025-01-03');
assert.equal(perfCollision.hist,true);assert.equal(perfCollision.gain,null);assert.equal(perfCollision.rows.length,2);

import {calculateAttribution} from '../js/engines/attribution.mjs';
import {pbmPrice} from '../js/engines/benchmark.mjs';
const attr=calculateAttribution({tv:880,open:[{name:'Same',type:'mf',pl:20,value:220,cost:200},{name:'Same',type:'stock',pl:60,value:660,cost:600}]},[{name:'Same',type:'mf',gain:30},{name:'Same',type:'stock',gain:40}]);
assert.equal(attr.rows.length,2);near(attr.totalReal,70);near(attr.totalUnreal,80);near(attr.net,150);near(attr.rows.reduce((s,r)=>s+r.weight,0),100);
assert.equal(pbmPrice([['2025-01-03',110],['2025-01-01',100],['2025-01-04',0]],'2025-01-04'),110);
assert.equal(pbmPrice([['2025-01-01',Infinity]],'2025-01-01'),null);
const gapBm=calculateBenchmark([['2025-01-01',100],['2025-03-01',120],['2025-04-01',132]],{points:['2025-01-01','2025-02-01','2025-03-01','2025-04-01'].map(d=>({d}))},[tx[0]],dnum);
assert.equal(gapBm.ready,true);assert.equal(gapBm.points[0].d,'2025-03-01');near(gapBm.ret,10);

 // Non-conventional cash flows with two mathematical roots: 10% and 20%.
assert.equal(xirr([['2023-01-01',-100],['2024-01-01',230],['2024-12-31',-132]]),null);
const fractional=calculatePortfolio({tx:[{name:'Fraction',type:'mf',side:'buy',date:'2025-01-01',units:0.00005,price:1000000}]},'2025-01-02');
near(fractional.tv,50);near(fractional.tc,50);near(fractional.reconciliationDifference,0);
const oversold=calculatePortfolio({tx:[tx[0],{...tx[0],side:'sell',units:11,date:'2025-02-01'}]},'2025-02-01');
assert.equal(oversold.ledgerValid,false);assert.equal(oversold.xirr,null);
import {reconcilePortfolio} from '../js/core/integrity.mjs';
const reconciledCollision=reconcilePortfolio({tx:collisionTx},collision,'2025-01-03');
assert.equal(reconciledCollision.ready,true);near(reconciledCollision.totals.value,800);

const taxCollisionTx=['mf','stock'].flatMap(type=>[{name:'Liquid Fund',type,side:'buy',units:2,price:100,date:'2025-01-01',fee:2},{name:'Liquid Fund',type,side:'sell',units:1,price:120,date:'2025-06-01',fee:1}]);
const taxCollision=calculateRealized({tx:taxCollisionTx,cls:{'Liquid Fund':'debt'}});
assert.equal(taxCollision.find(g=>g.type==='stock').bucket,'eqST');
assert.equal(taxCollision.find(g=>g.type==='mf').bucket,'slab');
for(const g of taxCollision){near(g.cost,101);near(g.pro,119);near(g.gain,18);}

import {capitalGainRules} from '../js/engines/tax.mjs';
near(capitalGainRules('2024-07-22').eqST,.15);
near(capitalGainRules('2024-07-23').eqST,.20);
near(capitalGainRules('2024-07-23').eqLT,.125);
near(capitalGainRules('2024-07-22').exemption,125000);
near(capitalGainRules('2024-03-31').exemption,100000);
assert.equal(capitalGainRules('2026-04-01').requiresReview,true);
assert.equal(tax.estimateOnly,true);

import {mk,taxAutoCls,addM} from '../js/engines/tax.mjs';
assert.equal(taxAutoCls('SBI Gold ETF',{tx:[]},'stock'),'listedOther');
assert.equal(taxAutoCls('GoldBeES',{tx:[]},'stock'),'listedOther');
assert.equal(taxAutoCls('Gold mining company',{tx:[]},'stock'),'equity');
assert.equal(addM('2024-02-29',12),'2025-02-28');
assert.equal(mk('A','equity','2024-08-01','2025-08-01',1,100,120).lt,false);
assert.equal(mk('A','equity','2024-08-01','2025-08-02',1,100,120).lt,true);
assert.ok(taxCollision.every(g=>g.review&&g.classificationSource==='inferred'));

const lossFixture=(entries)=>calculateTaxFY(entries.map(([bucket,gain])=>({bucket,gain,fy:'2025-26',sell:'2025-06-01'})),'2025-26',30);
const restricted=lossFixture([['eqST',-10000],['eqLT',20000],['otLT',-20000]]);
near(restricted.carryShort,10000);near(restricted.carryLong,0);near(restricted.carry,10000);
assert.deepEqual(restricted.offsets,[{from:'otLT',to:'eqLT',amount:20000}]);
const noLongToShort=lossFixture([['eqLT',-10000],['eqST',20000]]);
near(noLongToShort.tax,4160);near(noLongToShort.carryLong,10000);
assert.equal(noLongToShort.carryEligibilityVerified,false);

import {grandfatheredEquityBasis,indexedAcquisitionBasis} from '../js/engines/tax.mjs';
near(grandfatheredEquityBasis(100,200,150),150);
near(grandfatheredEquityBasis(100,120,150),120);
near(grandfatheredEquityBasis(100,80,150),100);
assert.equal(grandfatheredEquityBasis(100,200,null),null);
near(indexedAcquisitionBasis(100000,200,300),150000);
assert.equal(indexedAcquisitionBasis(100000,0,300),null);
assert.equal(indexedAcquisitionBasis(100000,300,200),null);

import {applyHistoricalTaxBasis} from '../js/engines/tax.mjs';
const historicalLot=mk('Historical','equity','2017-01-01','2025-06-01',1,100000,350000);
const adjustedLot=applyHistoricalTaxBasis(historicalLot,{kind:'grandfathering',verified:true,fairMarketValue:200000});
near(adjustedLot.gain,250000);near(adjustedLot.taxableGain,150000);
near(calculateTaxFY([adjustedLot],'2025-26',30).tax,3250);
near(calculateTaxFY([historicalLot],'2025-26',30).tax,16250);
assert.equal(applyHistoricalTaxBasis(historicalLot,{kind:'grandfathering',fairMarketValue:200000}),historicalLot);
assert.equal(applyHistoricalTaxBasis({...historicalLot,buy:'2019-01-01'},{kind:'grandfathering',verified:true,fairMarketValue:200000}).taxableGain,undefined);

import {simulateTaxHarvest} from '../js/engines/tax.mjs';
const harvestState={tx:[{name:'Gain',type:'stock',date:'2025-04-01',side:'buy',units:100,price:100},{name:'Gain',type:'stock',date:'2025-05-01',side:'sell',units:100,price:200},{name:'Loss',type:'stock',date:'2025-04-01',side:'buy',units:100,price:100}]};
const harvestOriginal=JSON.stringify(harvestState);
const harvest=simulateTaxHarvest(harvestState,{name:'Loss',type:'stock',date:'2025-06-01',units:100,price:50,fee:10,slab:30});
assert.equal(harvest.ready,true);near(harvest.before.tax,2080);near(harvest.after.tax,1037.92);near(harvest.taxReduction,1042.08);near(harvest.netTaxBenefit,1032.08);near(harvest.netProceeds,4990);
assert.equal(JSON.stringify(harvestState),harvestOriginal);
assert.equal(simulateTaxHarvest(harvestState,{name:'Loss',type:'stock',date:'2025-06-01',units:101,price:50,slab:30}).ready,false);

import {discoverTaxHarvest} from '../js/engines/tax.mjs';
const scan=discoverTaxHarvest(harvestState,{date:'2025-06-01',slab:30,quotes:[{name:'Loss',type:'stock',date:'2025-06-01',price:50}],feeRate:.002});
assert.equal(scan.length,1);near(scan[0].units,100);near(scan[0].netTaxBenefit,1032.08);
assert.deepEqual(discoverTaxHarvest(harvestState,{date:'2025-06-01',slab:30,quotes:[{name:'Loss',type:'stock',date:'2025-05-01',price:50}]}),[]);
assert.equal(JSON.stringify(harvestState),harvestOriginal);

 // Annual dates with exact 365-day spacing: polynomial in discount factor.
 near(xirr([['2021-01-01',-100],['2022-01-01',50],['2023-01-01',-100],['2024-01-01',150]]),0);
 assert.equal(xirr([['2021-01-01',-100],['2022-01-01',230],['2023-01-01',-132]]),null);
 near(xirr([['2021-01-01',-100],['2022-01-01',200],['2023-01-01',-100]]),0);

const splitPerf=calculatePerformance({S:{tx:[{name:'Split test',type:'stock',side:'buy',date:'2025-01-01',units:10,price:100}],corporateActions:[{name:'Split test',type:'stock',kind:'split',ratio:2,date:'2025-02-01'}]},ser:{},PWH:{},pxAt:(_s,_n,d)=>d<'2025-02-01'?100:50,navCovers:()=>true,dnum:d=>Date.parse(d)/864e5},'2025-01-31','2025-02-01');
assert.equal(splitPerf.v0,1000);assert.equal(splitPerf.v1,1000);assert.equal(splitPerf.cf,0);assert.equal(splitPerf.gain,0);

const riskSplitState={tx:[{name:'Risk split',type:'stock',side:'buy',date:'2025-01-01',units:10,price:100}],corporateActions:[{name:'Risk split',type:'stock',kind:'split',ratio:2,date:'2025-02-01'}]};
const riskSplit=calculateRiskSeries(riskSplitState,'2025-02-28',dnum,(_n,_t,d)=>d<'2025-02-01'?100:50);
assert.equal(riskSplit.points.length,2);near(riskSplit.points[1].value,1000);near(riskSplit.points[1].r,0);
const splitBenchmark=calculateBenchmark([['2025-01-01',100],['2025-01-31',100],['2025-02-28',100]],riskSplit,riskSplitState.tx,dnum,riskSplitState.corporateActions);
assert.equal(splitBenchmark.ready,true);near(splitBenchmark.ret,0);

 // Independent cross-engine fixture: valid purchase plus rejected negative quantity.
const rejectedState={tx:[{name:'Validation fixture',type:'stock',side:'buy',date:'2025-01-01',units:10,price:100},{name:'Validation fixture',type:'stock',side:'buy',date:'2025-02-01',units:-5,price:200}],px:{'Validation fixture':120},pxd:{'Validation fixture':'2025-03-01'}};
const rejectedBefore=JSON.stringify(rejectedState);
const rejectedPortfolio=calculatePortfolio(rejectedState,'2025-03-01');
assert.equal(rejectedPortfolio.tv,1200);assert.equal(rejectedPortfolio.tc,1000);
assert.equal(rejectedPortfolio.ledgerValid,false);assert.equal(rejectedPortfolio.xirr,null);
assert.equal(rejectedPortfolio.open[0].xirr,null);assert.equal(rejectedPortfolio.rejectedTransactions[0].row,2);
const rejectedPerf=calculatePerformance({S:rejectedState,ser:{},PWH:{},pxAt:()=>120,navCovers:()=>true,dnum},'2025-01-31','2025-03-01');
assert.equal(rejectedPerf.hist,true);assert.equal(rejectedPerf.gain,null);assert.equal(rejectedPerf.pct,null);
const rejectedRisk=calculateRiskSeries(rejectedState,'2025-03-01',dnum,()=>120);
assert.deepEqual(rejectedRisk.points,[]);assert.ok(rejectedRisk.missing.includes('Validation fixture'));
assert.equal(calculateBenchmark([['2025-01-01',100],['2025-03-01',120]],{points:[{d:'2025-01-01'},{d:'2025-03-01'}]},rejectedState.tx,dnum).ready,false);
assert.equal(simulateTaxHarvest(rejectedState,{name:'Validation fixture',type:'stock',date:'2025-03-01',units:1,price:120,slab:30}).ready,false);
assert.equal(calculatePortfolio(rejectedState,'2025-01-31').ledgerValid,true);
assert.equal(JSON.stringify(rejectedState),rejectedBefore);

import {normalizeHistoricalPrice as normalizeSplitPrice} from '../js/engines/valuation.mjs';
import {riskHistPrice as splitRiskPrice} from '../js/engines/risk.mjs';
import {historicalCoverage as splitCoverage} from '../js/core/integrity.mjs';
const splitQuote={name:'Risk split',type:'stock',date:'2025-01-31',price:50,actions:riskSplitState.corporateActions};
assert.equal(normalizeSplitPrice({...splitQuote,basis:'raw'}),50);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'unknown'}),null);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'split-adjusted'}),null);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'split-adjusted',adjustedThrough:'2025-02-28'}),100);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'split-adjusted',adjustedThrough:'2025-02-28',actions:[...splitQuote.actions,{name:'Risk split',type:'stock',kind:'split',ratio:3,date:'2025-02-15'}]}),300);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'split-adjusted',adjustedThrough:'2025-02-28',actions:[{...splitQuote.actions[0],kind:'bonus'}]}),null);
assert.equal(normalizeSplitPrice({...splitQuote,basis:'split-adjusted',adjustedThrough:'2025-02-28',date:'2025-02-01'}),50);
const adjustedRows={'Risk split':[['2025-01-31',50],['2025-02-28',50]]};
const adjustedBasis=new Map([['Risk split',{basis:'split-adjusted',adjustedThrough:'2025-02-28'}]]);
const splitStateBefore=JSON.stringify(riskSplitState),splitRowsBefore=JSON.stringify(adjustedRows);
const adjustedRisk=calculateRiskSeries(riskSplitState,'2025-02-28',dnum,(n,t,d)=>splitRiskPrice(riskSplitState,adjustedRows,{},'2025-02-28',dnum,n,t,d,adjustedBasis));
assert.equal(adjustedRisk.points.length,2);near(adjustedRisk.points[0].value,1000);near(adjustedRisk.points[1].value,1000);near(adjustedRisk.points[1].r,0);
assert.equal(splitRiskPrice(riskSplitState,adjustedRows,{},'2025-02-28',dnum,'Risk split','stock','2025-01-31'),null);
const afterSale={...riskSplitState,tx:[...riskSplitState.tx,{name:'Risk split',type:'stock',side:'sell',date:'2025-02-15',units:15,price:50}]};
const coverage=splitCoverage(afterSale,{},adjustedRows,'2025-02-28');
assert.equal(coverage.rows[0].open,true);assert.equal(coverage.required,2);
assert.equal(JSON.stringify(riskSplitState),splitStateBefore);assert.equal(JSON.stringify(adjustedRows),splitRowsBefore);
console.log('Corporate action price normalization fixtures passed');

const fractionalPerfArgs={S:{tx:[{name:'Fractional',type:'mf',side:'buy',date:'2025-01-01',units:0.0000005,price:100000000}]},ser:{},PWH:{},pxAt:(_s,_n,d)=>d==='2025-01-31'?100000000:120000000,navCovers:()=>true,dnum};
const fractionalPerf=calculatePerformance(fractionalPerfArgs,'2025-01-31','2025-02-28');
near(fractionalPerf.v0,50);near(fractionalPerf.v1,60);near(fractionalPerf.gain,10);near(fractionalPerf.pct,20);
for(const [start,end] of [['2025-02-28','2025-01-31'],['2025-02-30','2025-03-01'],['invalid','2025-03-01']]){
 const bad=calculatePerformance(fractionalPerfArgs,start,end);assert.equal(bad.hist,true);assert.equal(bad.gain,null);assert.equal(bad.cf,null);
}

const dietzState={tx:[{name:'Dietz',type:'stock',side:'buy',date:'2025-01-01',units:10,price:100},{name:'Dietz',type:'stock',side:'buy',date:'2025-01-16',units:5,price:100,fee:10},{name:'Dietz',type:'stock',side:'sell',date:'2025-01-26',units:2,price:110,fee:5}]};
const dietzArgs={S:dietzState,ser:{},PWH:{},pxAt:(_s,_n,d)=>d==='2025-01-01'?100:120,navCovers:()=>true,dnum};
const mixedDietz=calculatePerformance(dietzArgs,'2025-01-01','2025-01-31');
near(mixedDietz.v0,1000);near(mixedDietz.v1,1560);near(mixedDietz.cf,295);near(mixedDietz.gain,265);near(mixedDietz.pct,265/(1000+510*15/30-215*5/30)*100);
const tinyDietz=calculatePerformance({...dietzArgs,S:{tx:[{name:'Tiny',type:'mf',side:'buy',date:'2025-01-01',units:0.005,price:100}]}},'2025-01-01','2025-01-31');
near(tinyDietz.v0,.5);near(tinyDietz.v1,.6);near(tinyDietz.pct,20);near(tinyDietz.vpct,20);

const rejectedFallback=calculatePortfolio({tx:rejectedState.tx},'2025-03-01');
near(rejectedFallback.tv,1000);assert.equal(rejectedFallback.ledgerValid,false);
const reversedBenchmark=calculateBenchmark([['2025-01-01',100],['2025-03-01',120]],{points:[{d:'2025-03-01'},{d:'2025-01-01'}]},[tx[0]],dnum);
assert.equal(reversedBenchmark.ready,false);
const excessRedemption=[{name:'Index test',type:'stock',side:'buy',date:'2025-01-01',units:10,price:100},{name:'Index test',type:'stock',side:'sell',date:'2025-02-01',units:10,price:200}];
assert.equal(calculateBenchmark([['2025-01-01',100],['2025-02-01',100]],{points:[{d:'2025-01-01'},{d:'2025-02-01'}]},excessRedemption,dnum).ready,false);

import {calculateRealized as safeTaxLots,calculateTaxFY as safeTaxFY} from '../js/engines/tax.mjs';
const incompleteTax=safeTaxLots(rejectedState);
assert.equal(incompleteTax.ledgerValid,false);
const incompleteEstimate=safeTaxFY(incompleteTax,'2024-25',30);
assert.equal(incompleteEstimate.ready,false);assert.equal(incompleteEstimate.tax,null);assert.equal(incompleteEstimate.rulesReview,true);

for(const slab of [-1,101,NaN,Infinity,null,'30']){const invalid=safeTaxFY([],'2025-26',slab);assert.equal(invalid.ready,false);assert.equal(invalid.tax,null);}
for(const lot of [{bucket:'unknown',gain:100},{bucket:'eqST',gain:Infinity},{bucket:'eqST',gain:100,taxableGain:NaN}]){const invalid=safeTaxFY([{...lot,fy:'2025-26',sell:'2025-05-01'}],'2025-26',30);assert.equal(invalid.ready,false);assert.equal(invalid.tax,null);}
assert.equal(safeTaxFY([],'2025-26',0).tax,0);
