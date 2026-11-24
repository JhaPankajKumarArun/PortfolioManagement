import assert from 'node:assert/strict';
import {marketProviders as p} from '../js/services/market-data.mjs';
const pd=x=>x;assert.deepEqual(p.mfapi.toRows({data:[{date:'2025-01-02',nav:'12'},{date:'2025-01-01',nav:'10'}]},pd),[['2025-01-01',10],['2025-01-02',12]]);
assert.deepEqual(p.stocks.indiaCSV('Date,Close\n2025-01-01,10\n2025-01-02,12',pd,'2025-01-03'),[['2025-01-01',10],['2025-01-02',12]]);
globalThis.fetch=async()=>({ok:true,json:async()=>({id:'nifty50',series:'TRI',rows:[['2025-01-01',10],['2025-01-02',12]]})});assert.equal((await p.benchmark.loadBenchmark('nifty50','2025-01-03',null)).length,2);await assert.rejects(p.benchmark.loadBenchmark('nifty50','2025-01-03',{data:{rows:[['2025-01-04',13]]}}),/older/);
