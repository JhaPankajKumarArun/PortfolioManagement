import {fifoLedger} from './ledger.mjs';
const addM=(s,m)=>{const [y,mo,day]=s.split('-').map(Number),first=new Date(Date.UTC(y,mo-1+m,1)),yy=first.getUTCFullYear(),mm=first.getUTCMonth(),last=new Date(Date.UTC(yy,mm+1,0)).getUTCDate();return new Date(Date.UTC(yy,mm,Math.min(day,last))).toISOString().slice(0,10)};
const fyOf=d=>{const y=+d.slice(0,4),s=+d.slice(5,7)>=4?y:y-1;return s+'-'+String((s+1)%100).padStart(2,'0')};
const srt=(a,b)=>a.date.localeCompare(b.date)||(a.side===b.side?0:a.side==='buy'?-1:1);
function taxAutoCls(n,S,type){const t=S.tx.find(x=>x?.name===n);const x=n.toLowerCase();if((type??t?.type)==='stock'){if(/gold|silver|commodit|international|overseas|nasdaq|s&p 500|\b(?:gilt|bond|liquid|debt)\b/.test(x)&&/etf|bees/.test(x))return /\b(?:gilt|bond|liquid|debt)\b/.test(x)?'listedDebt':'listedOther';return 'equity'}
if(/liquid|overnight|money market|ultra short|low duration|short duration|medium duration|long duration|corporate bond|gilt|credit risk|banking and psu|banking & psu|floater|dynamic bond|bond fund|debt/.test(x))return 'debt';
if(/gold|silver|commodit|fund of fund|fof|international|overseas|global|nasdaq|s&p 500/.test(x))return 'other';return 'equity'}
const taxClass=(n,S,type)=>{const ambiguous=new Set(S.tx.filter(t=>t?.name===n).map(t=>t.type)).size>1;return (!ambiguous&&S.cls?.[n])||taxAutoCls(n,S,type)};

 // Explicit annual scheme evidence; no inference from a monthly portfolio snapshot.
 export function verifiedFundTaxProfile(profile,saleDate){
  if(!profile||profile.verified!==true||profile.fy!==fyOf(saleDate)||typeof profile.source!=='string'||!profile.source.trim()||typeof profile.listed!=='boolean')return null;
  const fields=['domesticEquity','debtMoneyMarket','qualifyingDebtFundUnits'];
  if(!fields.every(k=>Number.isFinite(profile[k])&&profile[k]>=0&&profile[k]<=100))return null;
  const specified=saleDate<'2025-04-01'?profile.domesticEquity<=35:profile.debtMoneyMarket>65||profile.qualifyingDebtFundUnits>=65;
  if(typeof profile.equityOriented!=='boolean'||(specified&&profile.equityOriented))return null;
  return {specified,cls:profile.equityOriented?'equity':profile.listed?'listedOther':'other',source:profile.source};
 }

function mk(n,c,b,s,u,cost,pro,profile=null){const specified=profile?b>='2023-04-01'&&profile.specified:b>='2023-04-01'&&(c==='debt'||c==='listedDebt'||(s<'2025-04-01'&&['listedOther','other'].includes(c)));const months=c==='equity'?12:['listedOther','listedDebt'].includes(c)&&s>='2024-07-23'?12:s>='2024-07-23'?24:36;const lt=!specified&&addM(b,months)<s;return{name:n,cls:c,buy:b,sell:s,units:u,cost,pro,gain:pro-cost,lt,specified,review:(c==='equity'&&b<'2018-02-01')||(lt&&c!=='equity'&&s<'2024-07-23')||c==='other'||c==='debt',fy:fyOf(s),bucket:c==='equity'?(lt?'eqLT':'eqST'):(lt?'otLT':'slab')}}
function calculateRealized(S){const ledger=fifoLedger(S.tx,'9999-12-31',S.corporateActions??[]),ledgerValid=ledger.every(h=>h.unmatched<=1e-9&&!h.rejectedActions?.length&&!h.rejectedTransactions?.length);const result=ledger.flatMap(h=>h.sales.map(l=>({...mk(h.name,verifiedFundTaxProfile(S.taxProfiles?.[h.type]?.[h.name]?.[fyOf(l.sell)],l.sell)?.cls??taxClass(h.name,S,h.type),l.buy,l.sell,l.units,l.cost,l.proceeds,verifiedFundTaxProfile(S.taxProfiles?.[h.type]?.[h.name]?.[fyOf(l.sell)],l.sell)),type:h.type,classificationSource: verifiedFundTaxProfile(S.taxProfiles?.[h.type]?.[h.name]?.[fyOf(l.sell)],l.sell)?'verified-profile':S.cls?.[h.name]===taxClass(h.name,S,h.type)&&new Set(S.tx.filter(t=>t?.name===h.name).map(t=>t.type)).size===1?'manual':'inferred',review:true,ledgerValid})));const adjusted=applyRecordedTaxBasis(result,S.taxBasisAdjustments);Object.defineProperty(adjusted,'ledgerValid',{value:ledgerValid,enumerable:false});return adjusted}
// Rate assumptions for eligible capital gains; not a complete income-tax computation.
export function capitalGainRules(saleDate,fy=fyOf(saleDate)){
 const revised=saleDate>='2024-07-23';
 return {eqST:revised?.20:.15,eqLT:revised?.125:.10,otLT:revised?.125:.20,exemption:fy<'2018-19'?Infinity:fy<'2024-25'?100000:125000,cess:.04,requiresReview:fy<'2018-19'||fy>='2026-27'};
}
function calculateTaxFY(L,fy,slab){const ledgerValid=L.ledgerValid!==false&&!L.some(g=>g.ledgerValid===false);const inputsValid=Number.isFinite(slab)&&slab>=0&&slab<=100&&/^\d{4}-\d{2}$/.test(fy)&&L.filter(g=>g.fy===fy).every(g=>['eqST','eqLT','slab','otLT'].includes(g.bucket)&&Number.isFinite(g.taxableGain??g.gain));const rt={eqST:0,eqLT:0,slab:0,otLT:0},pos={eqST:[0,0],eqLT:[0,0],otLT:[0,0]};
L.filter(g=>g.fy===fy).forEach(g=>{const gain=Number.isFinite(g.taxableGain)?g.taxableGain:g.gain;rt[g.bucket]+=gain;if(gain>0&&pos[g.bucket])pos[g.bucket][g.sell>='2024-07-23'?1:0]+=gain});
const x={...rt},offsets=[],off=(f,t)=>{if(x[f]<0&&x[t]>0){const u=Math.min(-x[f],x[t]);x[f]+=u;x[t]-=u;offsets.push({from:f,to:t,amount:u})}};
// Restricted long-term losses first, preserving flexible short-term losses.
off('eqLT','otLT');off('otLT','eqLT');
off('eqST','slab');off('slab','eqST');off('eqST','otLT');off('slab','otLT');off('eqST','eqLT');off('slab','eqLT');
const carryShort=Math.max(0,-x.eqST)+Math.max(0,-x.slab),carryLong=Math.max(0,-x.eqLT)+Math.max(0,-x.otLT);
const carry=Object.values(x).filter(v=>v<0).reduce((s,v)=>s-v,0),bl=(p,a,b)=>{const t=p[0]+p[1];return t?(p[0]*a+p[1]*b)/t:b};
const old=capitalGainRules('2024-07-22',fy),revised=capitalGainRules('2024-07-23',fy);
const lim=revised.exemption,tEqST=Math.max(x.eqST,0)*bl(pos.eqST,old.eqST,revised.eqST),tEqLT=fy<'2018-19'?0:Math.max(x.eqLT-lim,0)*bl(pos.eqLT,old.eqLT,revised.eqLT),tSlab=Math.max(x.slab,0)*slab/100,tOT=Math.max(x.otLT,0)*bl(pos.otLT,old.otLT,revised.otLT);
return{mixedRateApproximation:Object.values(pos).some(p=>p[0]>0&&p[1]>0),ledgerValid,ready:ledgerValid&&inputsValid,inputsValid,rulesReview:!inputsValid||!ledgerValid||revised.requiresReview||L.some(g=>g.fy===fy&&g.review)||Object.values(pos).some(p=>p[0]>0&&p[1]>0),estimateOnly:true,review:L.filter(g=>g.fy===fy&&g.review).length,raw:rt,net:x,carry,carryShort,carryLong,offsets,carryEligibilityVerified:false,carryForwardYears:8,carryForwardRequiresTimelyReturn:true,lim,tEqST,tEqLT,tSlab,tOT,tax:ledgerValid&&inputsValid?(tEqST+tEqLT+tSlab+tOT)*(1+revised.cess):null}}
function calculateRemainingLots(n,S){return fifoLedger(S.tx,'9999-12-31',S.corporateActions??[]).filter(h=>h.name===n).flatMap(h=>h.lots).filter(l=>l.u>1e-6)}

export { addM, fyOf, srt, taxAutoCls, taxClass, mk, calculateRealized, calculateTaxFY, calculateRemainingLots };

// Explicit per-lot tax basis helpers. Never mutate the accounting ledger.
// Caller must establish statutory eligibility and supply verified historical inputs.
export function grandfatheredEquityBasis(cost,proceeds,fairMarketValue){
 if(![cost,proceeds,fairMarketValue].every(v=>Number.isFinite(v)&&v>=0))return null;
 return Math.max(cost,Math.min(fairMarketValue,proceeds));
}
export function indexedAcquisitionBasis(cost,buyCII,sellCII){
 if(!Number.isFinite(cost)||cost<0||!Number.isInteger(buyCII)||buyCII<=0||!Number.isInteger(sellCII)||sellCII<buyCII)return null;
 return cost*sellCII/buyCII;
}

// Explicit opt-in: verified inputs are supplied for this particular realized lot.
// Keep accounting gain unchanged for attribution and reconciliation.
export function applyHistoricalTaxBasis(lot,adjustment){
 if(!lot||!adjustment||adjustment.verified!==true||!lot.lt)return lot;
 let basis=null;
 if(adjustment.kind==='grandfathering'&&lot.cls==='equity'&&lot.buy<'2018-02-01'&&lot.sell>='2018-04-01')
  basis=grandfatheredEquityBasis(lot.cost,lot.pro,adjustment.fairMarketValue);
 if(adjustment.kind==='indexation'&&lot.cls!=='equity'&&lot.sell<'2024-07-23'&&lot.bucket==='otLT')
  basis=indexedAcquisitionBasis(lot.cost,adjustment.buyCII,adjustment.sellCII);
 if(!Number.isFinite(basis))return lot;
 return {...lot,taxBasis:basis,taxableGain:lot.pro-basis,taxBasisKind:adjustment.kind};
}

// Read-only hypothetical redemption. No transaction or storage mutation.
export function simulateTaxHarvest(S,{name,type,date,units,price,fee=0,slab}){
 if(!['mf','stock'].includes(type)||typeof name!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(Date.parse(date)).toISOString().slice(0,10)!==date||![units,price,fee,slab].every(Number.isFinite)||units<=0||price<=0||fee<0||fee>units*price||slab<0||slab>100)return {ready:false,reason:'Invalid redemption inputs'};
 const tx=S.tx.filter(t=>!t||!t.date||t.date<=date);
 const ledger=fifoLedger(tx,date,S.corporateActions??[]);
 if(ledger.some(h=>h.unmatched>1e-9||h.rejectedActions?.length||h.rejectedTransactions?.length))return {ready:false,reason:'Invalid portfolio ledger'};
 const holding=ledger.find(h=>h.name===name&&h.type===type);
 if(!holding||units>holding.units+1e-9)return {ready:false,reason:'Insufficient units'};
 const fy=fyOf(date),before=calculateTaxFY(calculateRealized({...S,tx,corporateActions:(S.corporateActions??[]).filter(a=>a.date<=date)}),fy,slab);
 const proposed={name,type,date,units,price,fee,side:'sell'};
 const after=calculateTaxFY(calculateRealized({...S,tx:[...tx,proposed],corporateActions:(S.corporateActions??[]).filter(a=>a.date<=date)}),fy,slab);
 if(!before.ready||!after.ready||!Number.isFinite(before.tax)||!Number.isFinite(after.tax))return {ready:false,reason:'Tax estimate unavailable'};
 return {ready:true,estimateOnly:true,requiresReview:true,fy,before,after,netProceeds:units*price-fee,taxReduction:before.tax-after.tax,netTaxBenefit:before.tax-after.tax-fee,remainingEquityExemption:Math.max(0,after.lim-Math.max(0,after.net.eqLT))};
}

// Scan independently supplied dated market quotes; never use transaction prices as live quotes.
export function discoverTaxHarvest(S,{date,slab,quotes=[],maxAge=7,feeRate=0}){
 if(!Number.isFinite(feeRate)||feeRate<0||feeRate>1||!Number.isFinite(maxAge)||maxAge<0)return [];
 const results=[];
 for(const h of fifoLedger(S.tx,date,S.corporateActions??[])){
  if(h.units<=1e-9)continue;
  const q=quotes.filter(q=>q.name===h.name&&q.type===h.type&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(Date.parse(q.date))&&q.date<=date&&(Date.parse(date)-Date.parse(q.date))/864e5<=maxAge).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(!q)continue;
  let units=0,best=null;
  for(const lot of h.lots){
   units+=lot.u;
   const sim=simulateTaxHarvest(S,{name:h.name,type:h.type,date,units,price:q.price,fee:units*q.price*feeRate,slab});
   if(sim.ready&&sim.netTaxBenefit>0&&(!best||sim.netTaxBenefit>best.netTaxBenefit))best={...sim,name:h.name,type:h.type,units,price:q.price,quoteDate:q.date};
  }
  if(best)results.push(best);
 }
 return results.sort((a,b)=>b.netTaxBenefit-a.netTaxBenefit);
}

 // Exact matched-lot fingerprint; ambiguous duplicate lots never receive an adjustment.
 export const taxLotKey=l=>JSON.stringify([l.type,l.name,l.buy,l.sell,l.units,l.cost,l.pro]);
 export function applyRecordedTaxBasis(lots,adjustments){
  if(!Array.isArray(adjustments))return lots;
  const counts=new Map();for(const l of lots){const k=taxLotKey(l);counts.set(k,(counts.get(k)||0)+1)}
  return lots.map(l=>{const k=taxLotKey(l),matches=adjustments.filter(a=>a?.lotKey===k);
   if(counts.get(k)!==1||matches.length!==1||typeof matches[0].source!=='string'||!matches[0].source.trim())return l;
   return applyHistoricalTaxBasis(l,matches[0]);
  });
 }
