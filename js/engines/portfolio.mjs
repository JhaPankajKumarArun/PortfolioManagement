import {resolvePrice} from './valuation.mjs';
import {fifoLedger} from './ledger.mjs';
function xirr(f){
 if(!Array.isArray(f)||f.length<2||f.some(x=>!Number.isFinite(Date.parse(x[0]))||!Number.isFinite(x[1])))return null;
 const grouped=new Map();for(const [d,v] of f){const t=Date.parse(d);grouped.set(t,(grouped.get(t)||0)+v)}
 const flows=[...grouped].filter(x=>x[1]!==0).sort((a,b)=>a[0]-b[0]);
 if(flows.length<2||!flows.some(x=>x[1]<0)||!flows.some(x=>x[1]>0))return null;
 const t0=flows[0][0],scale=Math.max(...flows.map(x=>Math.abs(x[1])));
 const npv=z=>flows.reduce((s,[t,v])=>s+v/scale*Math.exp(-z*(t-t0)/31536000000),0);
 let lo=Math.log(0.000001),hi=Math.log(11),a=npv(lo),c=npv(hi);
 while(Math.sign(a)===Math.sign(c)&&hi<Math.log(1000001)){hi=Math.min(hi+Math.log(10),Math.log(1000001));c=npv(hi)}
 if(!Number.isFinite(a)||!Number.isFinite(c)||Math.sign(a)===Math.sign(c))return null;
 for(let i=0;i<120;i++){const mid=(lo+hi)/2,v=npv(mid);if(v===0)return Math.expm1(mid)*100;if(Math.sign(v)===Math.sign(a)){lo=mid;a=v}else hi=mid}
 return Math.expm1((lo+hi)/2)*100;
}
function calculatePortfolio(S,asOf){
const tradeIndex=new Map();
for(const t of S.tx){const key=JSON.stringify([t.type,t.name]);if(!tradeIndex.has(key))tradeIndex.set(key,[]);tradeIndex.get(key).push([t.date,t.price]);}
const all=fifoLedger(S.tx,asOf).map(h=>{h.L=h.lots;const trades=tradeIndex.get(JSON.stringify([h.type,h.name]))||[];h.valuation=resolvePrice(asOf,[{rows:trades,source:'transaction',estimated:true},{rows:[[S.pxd?.[h.name],S.px?.[h.name]]],source:'cached market'}]);if(!S.pxd?.[h.name]&&S.px?.[h.name]>0&&asOf===new Date().toISOString().slice(0,10))h.valuation={price:S.px[h.name],date:null,source:'undated cache',estimated:true,age:null,status:'estimated'};h.price=h.valuation.price??h.last;h.value=Math.max(h.units,0)*h.price;h.pl=h.value-h.cost;h.plp=h.cost>0?h.pl/h.cost*100:null;h.xirr=xirr(h.flows.concat([[asOf,h.value]]));return h});
const open=all.filter(h=>h.units>1e-4),tv=open.reduce((s,h)=>s+h.value,0),tc=open.reduce((s,h)=>s+h.cost,0);
const realized=all.reduce((sum,h)=>sum+h.sales.reduce((n,s)=>n+s.proceeds-s.cost,0),0),netInvested=-all.flatMap(h=>h.flows).reduce((sum,f)=>sum+f[1],0),lifetimeGain=tv-netInvested;
return{open,tv,tc,realized,netInvested,lifetimeGain,reconciliationDifference:lifetimeGain-realized-(tv-tc),pl:tv-tc,plp:tc>0?(tv-tc)/tc*100:null,xirr:xirr(all.flatMap(h=>h.flows).concat([[asOf,tv]]))}}

export { xirr, calculatePortfolio };
