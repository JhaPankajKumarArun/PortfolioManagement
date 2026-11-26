// Canonical FIFO matching. Preserve input order within each trading date.
export function fifoLedger(transactions,asOf='9999-12-31'){
 const groups=new Map();
 for(const t of transactions.filter(t=>t.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date))){
  const key=JSON.stringify([t.type,t.name]);
  let h=groups.get(key);
  if(!h){h={name:t.name,type:t.type,units:0,cost:0,flows:[],lots:[],sales:[],unmatched:0,last:t.price};groups.set(key,h)}
  const fee=t.fee||0;h.last=t.price;
  if(t.side==='buy'){
   const cost=t.units*t.price+fee;
   h.units+=t.units;h.lots.push({d:t.date,u:t.units,p:cost/t.units});h.flows.push([t.date,-cost]);
  }else if(t.side==='sell'){
   let remaining=t.units;h.units-=t.units;h.flows.push([t.date,t.units*t.price-fee]);
   for(const l of h.lots){
    if(remaining<=1e-9)break;
    const u=Math.min(l.u,remaining);if(u<=0)continue;
    h.sales.push({buy:l.d,sell:t.date,units:u,cost:u*l.p,proceeds:u*(t.price-fee/t.units)});
    l.u-=u;remaining-=u;
   }
   h.unmatched+=Math.max(0,remaining);
  }
 }
 for(const h of groups.values()){h.lots=h.lots.filter(l=>l.u>1e-9);h.cost=h.lots.reduce((s,l)=>s+l.u*l.p,0)}
 return [...groups.values()];
}
