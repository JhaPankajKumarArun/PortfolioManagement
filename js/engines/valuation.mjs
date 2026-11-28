const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export function resolvePrice(date,sources,maxAge=7){
 let best=null;
 if(validDate(date))for(const {rows,source,estimated=false} of sources){
  for(const r of rows||[]){if(!r||!validDate(r[0])||r[0]>date||!Number.isFinite(r[1])||r[1]<=0)continue;
   if(!best||r[0]>best.date||(r[0]===best.date&&(!estimated||best.estimated)))best={date:r[0],price:r[1],source,estimated};
  }
 }
 if(!best)return {price:null,date:null,source:null,estimated:false,age:null,status:'missing'};
 const age=(Date.parse(date)-Date.parse(best.date))/86400000;
 return {...best,age,status:age>maxAge?'stale':best.estimated?'estimated':'market'};
}

 // Convert a split-adjusted close to the contemporaneous raw trading basis.
 // adjustedThrough must be the verified provider adjustment cutoff, not today's date.
 // Bonus-adjusted or dividend-adjusted series require separate verified semantics.
export function normalizeHistoricalPrice({price,date,name,type,basis='unknown',adjustedThrough,actions=[]}){
 if(!Number.isFinite(price)||price<=0||!validDate(date))return null;
 if(type!=='stock'||basis==='raw')return price;
 const relevant=actions.filter(a=>a?.name===name&&a.type===type);
 if(relevant.some(a=>!validDate(a.date)))return null;
 if(basis==='unknown')return relevant.some(a=>a.date>date)?null:price;
 if(basis!=='split-adjusted'||!validDate(adjustedThrough)||adjustedThrough<date)return null;
 let factor=1;
 for(const a of relevant){
  if(a.date<=date||a.date>adjustedThrough)continue;
  if(a.kind!=='split'||!Number.isFinite(a.ratio)||a.ratio<=0)return null;
  factor*=a.ratio;
 }
 const raw=price*factor;
 return Number.isFinite(raw)&&raw>0?raw:null;
}
