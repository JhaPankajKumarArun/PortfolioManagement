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
function calculatePortfolio(S,asOf){const m={};S.tx.filter(t=>t.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date)).forEach(t=>{const h=m[t.name]||(m[t.name]={name:t.name,type:t.type,units:0,cost:0,flows:[],L:[],last:t.price}),a=t.units*t.price+(t.side==='buy'?(t.fee||0):-(t.fee||0));h.last=t.price;
if(t.side==='buy'){h.units+=t.units;h.cost+=a;h.L.push({u:t.units,p:a/t.units});h.flows.push([t.date,-a])}else{let u=t.units;h.units-=t.units;for(const l of h.L){if(u<=1e-9)break;const x=Math.min(l.u,u);l.u-=x;h.cost-=x*l.p;u-=x}h.flows.push([t.date,a])}});
const all=Object.values(m).map(h=>{h.price=S.px[h.name]>0?S.px[h.name]:h.last;h.value=Math.max(h.units,0)*h.price;h.pl=h.value-h.cost;h.plp=h.cost>0?h.pl/h.cost*100:null;h.xirr=xirr(h.flows.concat([[asOf,h.value]]));return h});
const open=all.filter(h=>h.units>1e-4),tv=open.reduce((s,h)=>s+h.value,0),tc=open.reduce((s,h)=>s+h.cost,0);
return{open,tv,tc,pl:tv-tc,plp:tc>0?(tv-tc)/tc*100:null,xirr:xirr(all.flatMap(h=>h.flows).concat([[asOf,tv]]))}}

export { xirr, calculatePortfolio };
