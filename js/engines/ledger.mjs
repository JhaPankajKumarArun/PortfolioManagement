// Canonical FIFO matching. Preserve input order within each trading date.
export function fifoLedger(transactions,asOf='9999-12-31'){
 const groups=new Map();
 for(const t of transactions.filter(t=>t.date<=asOf).sort((a,b)=>a.date.localeCompare(b.date))){
  const key=JSON.stringify([t.type,t.name]);
  let h=groups.get(key);
  if(!h){h={name:t.name,type:t.type,units:0,cost:0,flows:[],lots:[],sales:[],unmatched:0,rejectedSales:[],last:t.price};groups.set(key,h)}
  const fee=t.fee||0;
  if(t.side==='buy'){
   h.last=t.price;
   const cost=t.units*t.price+fee;
   h.units+=t.units;h.lots.push({d:t.date,u:t.units,p:cost/t.units});h.flows.push([t.date,-cost]);
  }else if(t.side==='sell'){
   // Reject the entire impossible sale; do not create phantom proceeds or negative inventory.
   if(t.units>h.units+1e-9){h.unmatched+=t.units-Math.max(0,h.units);h.rejectedSales.push({date:t.date,units:t.units,available:h.units});continue}
   h.last=t.price;
   let remaining=Math.min(t.units,h.units);h.units=Math.max(0,h.units-t.units);h.flows.push([t.date,t.units*t.price-fee]);
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

// Explicit corporate-action accounting primitive. Not a transaction import format.
// Split ratio is new shares / old shares. Bonus ratio is additional shares / old shares.
// No rounding or cash-in-lieu assumptions: fractional entitlements require review.
export function applyCorporateAction(holding,action){
 if(!holding||!action||!['split','bonus'].includes(action.kind)||!Number.isFinite(action.ratio)||action.ratio<=0||!/^\d{4}-\d{2}-\d{2}$/.test(action.date)||!Number.isFinite(Date.parse(action.date))||new Date(Date.parse(action.date)).toISOString().slice(0,10)!==action.date||holding.units<=0||holding.unmatched>1e-9||holding.lots.some(l=>l.d>action.date))return null;
 const lots=holding.lots.map(l=>({...l}));
 const factor=action.kind==='split'?action.ratio:1+action.ratio;
 const units=holding.units*factor;
 if(!Number.isFinite(units)||units<=0)return null;
 if(action.kind==='split'){for(const l of lots){l.u*=factor;l.p/=factor}}
 else lots.push({d:action.date,u:holding.units*action.ratio,p:0});
 if(lots.some(l=>!Number.isFinite(l.u)||!Number.isFinite(l.p)))return null;
 const cost=lots.reduce((s,l)=>s+l.u*l.p,0);
 if(!Number.isFinite(cost))return null;
 return {...holding,units,lots,cost,last:Number.isFinite(holding.last)?holding.last/factor:null,flows:holding.flows.map(f=>[...f]),sales:holding.sales.map(s=>({...s})),corporateActionReview:true};
}
