import {fetchWithTimeout} from '../http.mjs';
export async function mfJson(u,ms){const r=await fetchWithTimeout(u,{},ms||25000);if(!r.ok)throw new Error('mfapi.in returned HTTP '+r.status);return r.json()}
export const toRows=(j,pd)=>((j&&j.data)||[]).map(x=>[pd(x.date),parseFloat(x.nav)]).filter(x=>x[0]&&x[1]>0).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:0);
