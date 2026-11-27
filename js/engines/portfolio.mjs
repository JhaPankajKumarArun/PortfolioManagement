import {resolvePrice} from './valuation.mjs';
import {fifoLedger} from './ledger.mjs';
function xirr(f){
 if(!Array.isArray(f)||f.length<2||f.some(x=>!Number.isFinite(Date.parse(x[0]))||!Number.isFinite(x[1])))return null;
 const grouped=new Map();for(const [d,v] of f){const t=Date.parse(d);grouped.set(t,(grouped.get(t)||0)+v)}
 const flows=[...grouped].filter(x=>x[1]!==0).sort((a,b)=>a[0]-b[0]);
 if(flows.length<2||!flows.some(x=>x[1]<0)||!flows.some(x=>x[1]>0))return null;
 // Work in log-discount space. Derivative roots partition the domain into
 // monotonic intervals, including tangent roots that a sign scan misses.
 const t0=flows[0][0],scale=flows.reduce((m,x)=>Math.max(m,Math.abs(x[1])),0);
 const terms=flows.map(([t,v])=>[(t-t0)/31536000000,v/scale]);
 const lo=Math.log(0.000001),hi=Math.log(1000001);
 const changes=a=>a.slice(1).reduce((n,x,i)=>n+(Math.sign(x[1])!==Math.sign(a[i][1])?1:0),0);
 function roots(a,depth=0){
  if(!a.length||!changes(a))return [];
  if(depth>64)return null;
  const shift=a[0][0];a=a.map(([t,v])=>[t-shift,v]);
  const value=z=>{const pivot=z<0?a[a.length-1][0]:0;let sum=0,abs=0;for(const [t,v] of a){const w=v*Math.exp(-z*(t-pivot));sum+=w;abs+=Math.abs(w)}return {sum,zero:Math.abs(sum)<=1e-12*abs}};
  let critical=[];
  if(changes(a)>1){const derivative=a.slice(1).map(([t,v])=>[t,-t*v]);critical=roots(derivative,depth+1);if(critical===null)return null}
  const points=[lo,...critical.filter(z=>z>lo&&z<hi),hi],found=[];
  for(const z of points)if(value(z).zero)found.push(z);
  for(let i=1;i<points.length;i++){
   let l=points[i-1],r=points[i],left=value(l),right=value(r);
   if(left.zero||right.zero||Math.sign(left.sum)===Math.sign(right.sum))continue;
   for(let j=0;j<100;j++){const m=(l+r)/2,v=value(m);if(Math.sign(v.sum)===Math.sign(left.sum))l=m;else r=m}
   found.push((l+r)/2);
  }
  return found.sort((a,b)=>a-b).filter((z,i,all)=>!i||Math.abs(z-all[i-1])>1e-9);
 }
 const result=roots(terms);
 if(result?.length===1)return Math.expm1(result[0])*100;
 if(result!==null)return null;
 // Large alternating cash-flow histories can exceed the recursive isolation budget.
 // Use a conventional guess-based XIRR only if a bracketed root is verified.
 const value=z=>{const pivot=z<0?terms[terms.length-1][0]:0;let sum=0,abs=0;for(const [t,v] of terms){const w=v*Math.exp(-z*(t-pivot));sum+=w;abs+=Math.abs(w)}return {sum,abs}};
 const candidates=[];let l=lo,left=value(l);for(let i=1;i<=2048;i++){let r=lo+(hi-lo)*i/2048,right=value(r);if(Math.sign(left.sum)!==Math.sign(right.sum)){let a=l,b=r;for(let j=0;j<80;j++){const m=(a+b)/2;if(Math.sign(value(m).sum)===Math.sign(left.sum))a=m;else b=m}const z=(a+b)/2,v=value(z);if(Math.abs(v.sum)<=1e-10*v.abs)candidates.push(z)}l=r;left=right}
 return candidates.length===1?Math.expm1(candidates[0])*100:null;
}
function calculatePortfolio(S,asOf){
const tradeIndex=new Map();
const acceptedLedger=fifoLedger(S.tx,asOf,S.corporateActions??[]);
const rejectedRows=new Set(acceptedLedger.flatMap(h=>h.rejectedTransactions??[]).map(r=>r.row));
for(const [i,t] of S.tx.entries()){if(!t||rejectedRows.has(i+1))continue;const key=JSON.stringify([t.type,t.name]);if(!tradeIndex.has(key))tradeIndex.set(key,[]);tradeIndex.get(key).push([t.date,t.price]);}
// Legacy market caches are keyed by display name, not asset identity.
const typesByName=new Map();
for(const t of S.tx){if(!t)continue;if(!typesByName.has(t.name))typesByName.set(t.name,new Set());typesByName.get(t.name).add(t.type);}
const all=acceptedLedger.map(h=>{h.L=h.lots;const actions=(S.corporateActions??[]).filter(a=>a.name===h.name&&a.type===h.type&&a.date<=asOf);const cutoff=actions.reduce((d,a)=>a.date>d?a.date:d,'');const trades=(tradeIndex.get(JSON.stringify([h.type,h.name]))||[]).filter(([d])=>d>=cutoff);const unambiguous=typesByName.get(h.name)?.size===1;h.valuation=resolvePrice(asOf,[{rows:trades,source:'transaction',estimated:true},{rows:unambiguous?[[S.pxd?.[h.name]>=cutoff?S.pxd?.[h.name]:null,S.px?.[h.name]]]:[],source:'cached market'}]);if(!cutoff&&unambiguous&&!S.pxd?.[h.name]&&Number.isFinite(S.px?.[h.name])&&S.px?.[h.name]>0&&asOf===new Date().toISOString().slice(0,10))h.valuation={price:S.px[h.name],date:null,source:'undated cache',estimated:true,age:null,status:'estimated'};h.price=h.valuation.price??h.last;h.value=Math.max(h.units,0)*h.price;h.pl=h.value-h.cost;h.plp=h.cost>0?h.pl/h.cost*100:null;h.xirr=(h.unmatched>1e-9||h.rejectedActions?.length||h.rejectedTransactions?.length)?null:xirr(h.flows.concat([[asOf,h.value]]));return h});
const open=all.filter(h=>h.units>1e-9),tv=open.reduce((s,h)=>s+h.value,0),tc=open.reduce((s,h)=>s+h.cost,0);
const realized=all.reduce((sum,h)=>sum+h.sales.reduce((n,s)=>n+s.proceeds-s.cost,0),0),netInvested=-all.flatMap(h=>h.flows).reduce((sum,f)=>sum+f[1],0),lifetimeGain=tv-netInvested;
return{open,tv,tc,rejectedTransactions:all.flatMap(h=>h.rejectedTransactions??[]),ledgerValid:all.every(h=>h.unmatched<=1e-9&&!h.rejectedActions?.length&&!h.rejectedTransactions?.length),realized,netInvested,lifetimeGain,reconciliationDifference:lifetimeGain-realized-(tv-tc),pl:tv-tc,plp:tc>0?(tv-tc)/tc*100:null,xirr:all.some(h=>h.unmatched>1e-9||h.rejectedActions?.length||h.rejectedTransactions?.length)?null:xirr(all.flatMap(h=>h.flows).concat([[asOf,tv]]))}}

export { xirr, calculatePortfolio };
