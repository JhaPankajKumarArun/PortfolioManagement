import assert from 'node:assert/strict';
import {mergeBenchmarkRows} from '../js/services/providers/benchmark.mjs';
const old=[['2020-01-01',100],['2025-01-01',200]],fresh=[['2025-01-01',201],['2025-01-02',202]];
assert.deepEqual(mergeBenchmarkRows(old,fresh,'2025-01-02'),[['2020-01-01',100],...fresh]);
assert.throws(()=>mergeBenchmarkRows(old,[['2025-01-01',0],['2025-01-02',202]],'2025-01-02'));
console.log('Benchmark cache merge passed');
