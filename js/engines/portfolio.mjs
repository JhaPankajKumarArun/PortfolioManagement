function xirr(f){if(f.length<2)return null;f=[...f].sort((a,b)=>a[0]<b[0]?-1:1);const t0=Date.parse(f[0][0]),y=f.map(x=>(Date.parse(x[0])-t0)/31557600000);
const npv=r=>f.reduce((s,x,i)=>s+x[1]/Math.pow(1+r,y[i]),0);let lo=-.99,hi=10;if(npv(lo)*npv(hi)>0)return null;
for(let i=0;i<100;i++){const m=(lo+hi)/2;npv(lo)*npv(m)<=0?hi=m:lo=m}return(lo+hi)*50}
function calculatePortfolio(S,asOf){const m={};[...S.tx].sort((a,b)=>a.date<b.date?-1:1).forEach(t=>{const h=m[t.name]||(m[t.name]={name:t.name,type:t.type,units:0,cost:0,flows:[],L:[],last:t.price}),a=t.units*t.price+(t.side==='buy'?(t.fee||0):-(t.fee||0));h.last=t.price;
if(t.side==='buy'){h.units+=t.units;h.cost+=a;h.L.push({u:t.units,p:a/t.units});h.flows.push([t.date,-a])}else{let u=t.units;h.units-=t.units;for(const l of h.L){if(u<=1e-9)break;const x=Math.min(l.u,u);l.u-=x;h.cost-=x*l.p;u-=x}h.flows.push([t.date,a])}});
const all=Object.values(m).map(h=>{h.price=S.px[h.name]>0?S.px[h.name]:h.last;h.value=Math.max(h.units,0)*h.price;h.pl=h.value-h.cost;h.plp=h.cost>0?h.pl/h.cost*100:null;h.xirr=xirr(h.flows.concat([[asOf,h.value]]));return h});
const open=all.filter(h=>h.units>1e-4),tv=open.reduce((s,h)=>s+h.value,0),tc=open.reduce((s,h)=>s+h.cost,0);
return{open,tv,tc,pl:tv-tc,plp:tc>0?(tv-tc)/tc*100:null,xirr:xirr(all.flatMap(h=>h.flows).concat([[asOf,tv]]))}}

export { xirr, calculatePortfolio };
