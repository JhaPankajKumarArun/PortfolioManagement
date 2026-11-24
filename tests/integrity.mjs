import assert from 'node:assert/strict';import {auditTransactions,blockingIssues} from '../js/core/integrity.mjs';
const buy={name:'A',type:'mf',side:'buy',units:10,price:100,date:'2025-01-01'};
const sell={...buy,side:'sell',units:11,date:'2025-02-01'};
assert.deepEqual(auditTransactions([buy],'2025-03-01'),[]);
assert.equal(auditTransactions([buy,sell],'2025-03-01')[0].code,'oversold');
assert.equal(auditTransactions([{...buy,date:'2025-02-30'}],'2025-03-01')[0].code,'invalid-transaction');
assert.equal(blockingIssues(auditTransactions([buy],'2024-01-01')).length,0);
assert.equal(auditTransactions([{...buy,fee:-1}],'2025-03-01')[0].code,'invalid-transaction');
