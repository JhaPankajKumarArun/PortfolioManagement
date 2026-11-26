import assert from 'node:assert/strict';
import {validateDisclosure,overlapAnalysis} from '../js/engines/overlap.mjs';
const date='2026-10-31',source='fixture',h={isin:'INE040A01034',name:'Example',weight:20},a={scheme:'A',date,source,holdings:[h]},b={scheme:'B',date,source,holdings:[{...h,weight:10}]};
const positions=[{type:'mf',name:'A',value:100000},{type:'mf',name:'B',value:200000}];
const p=overlapAnalysis(positions,[a,b],'2026-11-24');
assert.equal(p.pairs[0].weight,10);
assert.equal(p.exposure[0].value,40000);
assert.equal(p.covered,300000);
assert.equal(validateDisclosure({...a,holdings:[h,h]},'2026-11-24'),false);
assert.equal(overlapAnalysis(positions,[a,b],'2027-02-01').covered,0);
assert.equal(overlapAnalysis(positions,[a,{...b,date:'2026-11-01'}],'2026-11-24').pairs.length,0);
console.log('Overlap fixtures passed');

assert.equal(p.pairs[0].details[0].a,20);
assert.equal(p.pairs[0].details[0].b,10);
assert.equal(p.pairs[0].details[0].weight,10);
const selected=overlapAnalysis(positions.slice(0,1),[a,b],'2026-11-24');
assert.equal(selected.pairs.length,0);
assert.equal(selected.total,100000);
assert.equal(selected.exposure[0].value,20000);

for(const bad of [{isin:'TREP02112026',name:'TREPS',weight:2},{isin:'GSECREPO1125',name:'Reverse Repo',weight:1},{...h,isin:'INE040A01035'},{...h,name:'Reverse Repo'}])assert.equal(validateDisclosure({...a,holdings:[bad]},'2026-11-24'),false);

const zero={...a,holdings:[],equityStatus:'verified-zero'};
assert.equal(validateDisclosure(zero,'2026-11-24'),true);
assert.equal(validateDisclosure({...zero,equityStatus:undefined},'2026-11-24'),false);
assert.equal(validateDisclosure({...a,equityStatus:'verified-zero'},'2026-11-24'),false);
const zp=overlapAnalysis(positions,[zero,b],'2026-11-24');
assert.equal(zp.zeroEquity[0],'A');
assert.equal(zp.covered,300000);
assert.equal(zp.pairs[0].weight,0);
