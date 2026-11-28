import assert from 'node:assert/strict';import {auditTransactions,blockingIssues} from '../js/core/integrity.mjs';
const buy={name:'A',type:'mf',side:'buy',units:10,price:100,date:'2025-01-01'};
const sell={...buy,side:'sell',units:11,date:'2025-02-01'};
assert.deepEqual(auditTransactions([buy],'2025-03-01'),[]);
assert.equal(auditTransactions([buy,sell],'2025-03-01')[0].code,'oversold');
assert.equal(auditTransactions([{...buy,date:'2025-02-30'}],'2025-03-01')[0].code,'invalid-transaction');
assert.equal(blockingIssues(auditTransactions([buy],'2024-01-01')).length,0);
assert.equal(auditTransactions([{...buy,fee:-1}],'2025-03-01')[0].code,'invalid-transaction');

import {reconcilePortfolio} from '../js/core/integrity.mjs';
import {calculatePortfolio} from '../js/engines/portfolio.mjs';
const state={tx:[buy,{...sell,units:4,price:150,fee:10}],px:{A:120},pxd:{A:'2025-03-01'}};
const before=JSON.stringify(state), C=calculatePortfolio(state,'2025-03-01'),q=reconcilePortfolio(state,C,'2025-03-01');
assert.equal(q.ready,true);assert.deepEqual(q.issues,[]);
assert.deepEqual(q.totals,{bought:1000,sold:590,value:720,cost:600,realized:190,unrealized:120,totalGain:310});
assert.equal(JSON.stringify(state),before);
assert.equal(reconcilePortfolio(state,{...C,tv:999},'2025-03-01').ready,false);
assert.ok(reconcilePortfolio({...state,px:{}},C,'2025-03-01').issues.some(x=>x.code==='missing-current-price'));
assert.ok(reconcilePortfolio({...state,pxd:{A:'2025-02-01'}},C,'2025-03-01').issues.some(x=>x.code==='stale-price'));
assert.equal(reconcilePortfolio({...state,tx:[buy,sell]},C,'2025-03-01').ready,false);

import {historicalCoverage} from '../js/core/integrity.mjs';
const histState={tx:[buy,{...buy,side:'sell',date:'2025-03-15'}]};
const hist={A:{d:[['2025-01-30',100],['2025-02-10',101],['2025-04-01',999]]}};
const cov=historicalCoverage(histState,hist,{},'2025-03-31');
assert.equal(cov.required,2);assert.equal(cov.covered,1);assert.equal(cov.percent,50);assert.deepEqual(cov.rows[0].missing,['2025-02-28']);assert.equal(cov.rows[0].latest,'2025-02-10');assert.equal(cov.rows[0].open,false);
assert.equal(historicalCoverage({tx:[]},{},{},'2025-03-31').percent,null);
assert.equal(historicalCoverage({tx:[buy]},{A:{d:[['2025-01-31',0],['2025-02-01',100]]}},{},'2025-01-31').covered,0);
assert.equal(historicalCoverage({tx:[{...buy,type:'stock'}]},{},{A:[['2025-01-30',100]]},'2025-01-31').covered,1);
