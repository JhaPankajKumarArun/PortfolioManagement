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
