import assert from 'node:assert/strict';
import {fifoLedger} from '../js/engines/ledger.mjs';
import {calculatePortfolio} from '../js/engines/portfolio.mjs';
import {calculateRealized,calculateRemainingLots} from '../js/engines/tax.mjs';
const tx=[{name:'Example',type:'stock',date:'2025-01-01',side:'buy',units:10,price:100,fee:10},{name:'Example',type:'stock',date:'2025-02-01',side:'buy',units:5,price:120,fee:0},{name:'Example',type:'stock',date:'2025-03-01',side:'sell',units:12,price:150,fee:12}];
const before=JSON.stringify(tx),S={tx,px:{Example:140}};
const [h]=fifoLedger(tx);
assert.equal(h.units,3);assert.equal(h.cost,360);
assert.equal(h.sales.reduce((s,l)=>s+l.cost,0),1250);
assert.equal(h.sales.reduce((s,l)=>s+l.proceeds,0),1788);
assert.equal(calculatePortfolio(S,'2025-03-01').tc,360);
assert.equal(calculateRealized(S).reduce((s,l)=>s+l.gain,0),538);
assert.equal(calculateRemainingLots('Example',S)[0].u,3);
assert.equal(fifoLedger(tx,'2025-01-31')[0].cost,1010);
assert.equal(JSON.stringify(tx),before);
const same=[{...tx[2],date:'2025-01-01',units:2},{...tx[0]}];
assert.equal(fifoLedger(same)[0].unmatched,2);
assert.equal(fifoLedger([tx[0],{...tx[0],type:'mf'}]).length,2);
console.log('Ledger regression fixtures passed');

const invalid=[tx[0],{...tx[2],units:12},{...tx[1],date:'2025-04-01'}];
const [quarantined]=fifoLedger(invalid);
assert.equal(quarantined.units,15);
assert.equal(quarantined.cost,1610);
assert.equal(quarantined.unmatched,2);
assert.equal(quarantined.sales.length,0);
assert.equal(quarantined.flows.length,2);
assert.equal(quarantined.rejectedSales.length,1);
assert.equal(calculatePortfolio({tx:invalid},'2025-04-01').ledgerValid,false);
assert.equal(calculateRealized({tx:invalid}).length,0);

import {applyCorporateAction} from '../js/engines/ledger.mjs';
const originalHolding=fifoLedger([tx[0]])[0],snapshot=JSON.stringify(originalHolding);
const split=applyCorporateAction(originalHolding,{kind:'split',ratio:2,date:'2025-02-01'});
assert.equal(split.units,20);assert.equal(split.cost,1010);assert.equal(split.lots[0].p,50.5);assert.equal(split.lots[0].d,'2025-01-01');assert.deepEqual(split.flows,originalHolding.flows);
const bonus=applyCorporateAction(originalHolding,{kind:'bonus',ratio:.5,date:'2025-02-01'});
assert.equal(bonus.units,15);assert.equal(bonus.cost,1010);assert.deepEqual(bonus.lots[1],{d:'2025-02-01',u:5,p:0});assert.deepEqual(bonus.flows,originalHolding.flows);
assert.equal(applyCorporateAction(originalHolding,{kind:'split',ratio:0,date:'2025-02-01'}),null);
assert.equal(JSON.stringify(originalHolding),snapshot);

const splitEvents=[{name:'Example',type:'stock',kind:'split',ratio:2,date:'2025-02-01'}];
const splitTrades=[tx[0],{...tx[2],units:12,price:75,fee:0}];
const [splitSale]=fifoLedger(splitTrades,'2025-03-01',splitEvents);
assert.equal(splitSale.units,8);assert.equal(splitSale.cost,404);assert.equal(splitSale.sales[0].cost,606);assert.equal(splitSale.sales[0].proceeds,900);assert.equal(splitSale.flows.length,2);assert.equal(splitSale.unmatched,0);
assert.equal(fifoLedger(splitTrades,'2025-01-31',splitEvents)[0].units,10);
const [invalidAction]=fifoLedger([tx[0]],'2025-03-01',[{...splitEvents[0],ratio:0}]);
assert.equal(invalidAction.rejectedActions.length,1);assert.equal(invalidAction.units,10);

const actionState={tx:splitTrades,corporateActions:splitEvents,px:{Example:80},pxd:{Example:'2025-03-01'}};
const actionPortfolio=calculatePortfolio(actionState,'2025-03-01');
assert.equal(actionPortfolio.tv,640);assert.equal(actionPortfolio.tc,404);assert.equal(actionPortfolio.realized,294);assert.equal(actionPortfolio.pl,236);assert.equal(actionPortfolio.lifetimeGain,530);assert.equal(actionPortfolio.reconciliationDifference,0);
assert.equal(calculateRealized(actionState)[0].gain,294);
assert.equal(calculateRemainingLots('Example',actionState)[0].u,8);
const staleActionState={tx:[tx[0]],corporateActions:splitEvents,px:{Example:100},pxd:{Example:'2025-01-01'}};
assert.equal(calculatePortfolio(staleActionState,'2025-02-01').tv,1000);

import {decodePortfolio,persistPortfolio,loadPortfolio} from '../js/core/storage.mjs';
const localMap=new Map(),localStore={getItem:k=>localMap.get(k)??null,setItem:(k,v)=>localMap.set(k,v)};
persistPortfolio(localStore,actionState);
assert.deepEqual(loadPortfolio(localStore),actionState);
assert.deepEqual(decodePortfolio('{"tx":[]}'),{tx:[]});
for(const corporateActions of [null,[{...splitEvents[0],ratio:0}],[{...splitEvents[0],date:'2025-02-30'}],[...splitEvents,...splitEvents]])assert.throws(()=>persistPortfolio(localStore,{tx:[],corporateActions}));
assert.deepEqual(loadPortfolio(localStore),actionState);

import {auditTransactions,reconcilePortfolio} from '../js/core/integrity.mjs';
assert.deepEqual(auditTransactions(splitTrades,'2025-03-01',splitEvents),[]);
const independentSplit=reconcilePortfolio(actionState,actionPortfolio,'2025-03-01',{realized:calculateRealized(actionState)});
assert.equal(independentSplit.ready,true);
assert.equal(independentSplit.totals.totalGain,530);
assert.ok(independentSplit.checks.every(c=>c.passed));

 // Malformed trades must never create units, costs, proceeds or cash flows.
const malformedTrades=[
 {...tx[0],units:0},{...tx[0],units:-1},{...tx[0],units:Infinity},
 {...tx[0],price:0},{...tx[0],price:NaN},{...tx[0],price:-1},
 {...tx[0],fee:-1},{...tx[0],fee:Infinity},
 {...tx[0],date:'2025-02-30'},{...tx[0],date:null},
 {...tx[0],side:'transfer'},{...tx[0],units:Number.MAX_VALUE,price:2},
 {...tx[2],units:1,price:100,fee:101}
];
const malformedInput=[tx[0],...malformedTrades],malformedBefore=JSON.stringify(malformedInput);
const [cleanLedger]=fifoLedger(malformedInput);
assert.equal(cleanLedger.units,10);
assert.equal(cleanLedger.cost,1010);
assert.deepEqual(cleanLedger.flows,[['2025-01-01',-1010]]);
assert.equal(cleanLedger.sales.length,0);
assert.deepEqual(cleanLedger.rejectedTransactions.map(r=>r.row),malformedTrades.map((_,i)=>i+2));
assert.equal(JSON.stringify(malformedInput),malformedBefore);
for(const bad of [null,{...tx[0],type:'unknown'},{...tx[0],name:''}]){
 const [rejected]=fifoLedger([bad]);
 assert.equal(rejected.units,0);assert.equal(rejected.cost,0);
 assert.equal(rejected.flows.length,0);assert.equal(rejected.rejectedTransactions.length,1);
}
assert.equal(fifoLedger([tx[0],{...tx[0],date:'2026-01-01',units:-1}],'2025-12-31')[0].rejectedTransactions,undefined);

const annualProfile={fy:'2025-26',verified:true,source:'Synthetic evidence',listed:false,equityOriented:false,domesticEquity:0,debtMoneyMarket:100,qualifyingDebtFundUnits:0};
const profileState={...actionState,taxProfiles:{mf:{Example:{'2025-26':annualProfile}}}};
persistPortfolio(localStore,profileState);
assert.deepEqual(loadPortfolio(localStore),profileState);
assert.deepEqual(decodePortfolio(JSON.stringify(profileState)),profileState);
for(const taxProfiles of [null,[],{unknown:{}},{mf:{Example:{'2025-27':annualProfile}}},{mf:{Example:{'2025-26':{...annualProfile,verified:false}}}},{mf:{Example:{'2025-26':{...annualProfile,debtMoneyMarket:101}}}}]){
 assert.throws(()=>persistPortfolio(localStore,{...actionState,taxProfiles}));
 assert.deepEqual(loadPortfolio(localStore),profileState);
}
