import assert from 'node:assert/strict';
import {indiaLatest} from '../js/services/providers/amfi.mjs';
globalThis.location={protocol:'file:'};let requests=0;globalThis.fetch=async()=>({ok:true,text:async()=>{requests++;return '100000;INF000000001;-;Test fund;123.45;23-Nov-2026'}});const pd=s=>s==='23-Nov-2026'?'2026-11-23':null;const rows=await indiaLatest(pd);assert.equal(rows[0].nav,'123.45');await indiaLatest(pd);assert.equal(requests,1);
