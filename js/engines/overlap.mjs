export function validateDisclosure(d,asOf){
 if(!d||typeof d.scheme!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date||d.date>asOf||typeof d.source!=='string'||!d.source.trim()||!Array.isArray(d.holdings)||!d.holdings.length)return false;
 const seen=new Set();let sum=0;
 for(const h of d.holdings){if(!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(h.isin)||seen.has(h.isin)||typeof h.name!=='string'||!Number.isFinite(h.weight)||h.weight<=0||h.weight>100)return false;seen.add(h.isin);sum+=h.weight}
 return sum<=100.05;
}
export function overlapAnalysis(positions,disclosures,asOf){
 const funds=positions.filter(h=>h.type==='mf'&&Number.isFinite(h.value)&&h.value>0),total=funds.reduce((s,h)=>s+h.value,0),available=[],missing=[],exposure=new Map();
 for(const f of funds){const d=disclosures.find(x=>x.scheme===f.name&&validateDisclosure(x,asOf));if(!d){missing.push(f.name);continue}const age=(Date.parse(asOf)-Date.parse(d.date))/864e5;if(age>45){missing.push(f.name+' (stale)');continue}available.push({f,d});for(const h of d.holdings){const a=exposure.get(h.isin)||{isin:h.isin,name:h.name,value:0,funds:0};a.value+=f.value*h.weight/100;a.funds++;exposure.set(h.isin,a)}}
 const pairs=[];for(let i=0;i<available.length;i++)for(let j=i+1;j<available.length;j++){const a=available[i].d,b=available[j].d;if(a.date!==b.date)continue;const m=new Map(b.holdings.map(h=>[h.isin,h.weight]));const common=a.holdings.filter(h=>m.has(h.isin));pairs.push({a:a.scheme,b:b.scheme,date:a.date,common:common.length,details:common.map(h=>({isin:h.isin,name:h.name,a:h.weight,b:m.get(h.isin),weight:Math.min(h.weight,m.get(h.isin))})).sort((x,y)=>y.weight-x.weight),weight:common.reduce((s,h)=>s+Math.min(h.weight,m.get(h.isin)),0)})}
 const covered=available.reduce((s,x)=>s+x.f.value,0);
 return {total,covered,missing,pairs:pairs.sort((a,b)=>b.weight-a.weight),exposure:[...exposure.values()].sort((a,b)=>b.value-a.value).map(x=>({...x,weight:total?100*x.value/total:0})),dates:[...new Set(available.map(x=>x.d.date))]};
}
