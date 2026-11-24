// Read-only validation; never changes or deletes portfolio records.
export function auditTransactions(tx,asOf){
 const issues=[],balances=new Map();
 if(!Array.isArray(tx))return [{code:'invalid-ledger'}];
 const valid=[];
 tx.forEach((t,i)=>{
 const date=t?.date,parsed=typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)?Date.parse(date):NaN;
 if(!t||typeof t.name!=='string'||!t.name.trim()||!['mf','stock'].includes(t.type)||!['buy','sell'].includes(t.side)||!Number.isFinite(t.units)||t.units<=0||!Number.isFinite(t.price)||t.price<=0||!Number.isFinite(t.fee??0)||(t.fee??0)<0||!Number.isFinite(parsed)||new Date(parsed).toISOString().slice(0,10)!==date){issues.push({code:'invalid-transaction',row:i+1});return}
 if(date>asOf)issues.push({code:'future-transaction',row:i+1});
 if(t.side==='sell'&&(t.fee??0)>t.units*t.price)issues.push({code:'fee-exceeds-proceeds',row:i+1});
 valid.push({t,i});
 });
 valid.sort((a,b)=>a.t.date.localeCompare(b.t.date)||a.i-b.i);
 for(const {t,i} of valid){const key=t.type+'\u0000'+t.name;const u=(balances.get(key)||0)+(t.side==='buy'?t.units:-t.units);if(u< -1e-6)issues.push({code:'oversold',row:i+1});balances.set(key,u)}
 return issues;
}
export function blockingIssues(issues){return issues.filter(x=>x.code!=='future-transaction')}
export function integrityNotice(issues){return issues.length?'Data quality warning: '+issues.length+' transaction issue(s). Review Import and backup before relying on calculated returns.':''}

 // Independent cash-flow reconciliation, using the same valuation date as Overview.
export function reconcilePortfolio(S,C,asOf){
 const issues=auditTransactions(S.tx,asOf), rows=[], ledger=new Map();
 if(blockingIssues(issues).length)return {ready:false,issues,rows};
 for(const t of S.tx){
  if(t.date>asOf)continue;
  const h=ledger.get(t.name)||{name:t.name,type:t.type,units:0,bought:0,sold:0};
  if(h.type!==t.type){issues.push({code:'asset-name-collision',name:t.name});continue}
  const gross=t.units*t.price,fee=t.fee||0;
  if(t.side==='buy'){h.units+=t.units;h.bought+=gross+fee}else{h.units-=t.units;h.sold+=gross-fee}
  ledger.set(t.name,h);
 }
 const holdings=new Map(C.open.map(h=>[h.name,h]));
 const near=(a,b)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=Math.max(.01,Math.abs(a)*1e-9);
 for(const h of ledger.values()){
  const p=holdings.get(h.name),open=h.units>1e-4;
  if(open&&(!p||Math.abs(p.units-h.units)>1e-6))issues.push({code:'unit-mismatch',name:h.name});
  if(!open&&p)issues.push({code:'unexpected-holding',name:h.name});
  if(open){
   if(!Number.isFinite(S.px?.[h.name])||S.px[h.name]<=0)issues.push({code:'missing-current-price',name:h.name});
   else if(!S.pxd?.[h.name])issues.push({code:'undated-price',name:h.name});
   else if(S.pxd[h.name]>asOf)issues.push({code:'future-price',name:h.name});
   else if((Date.parse(asOf)-Date.parse(S.pxd[h.name]))/864e5>7)issues.push({code:'stale-price',name:h.name});
  }
  const value=p?.value??0,cost=p?.cost??0,realized=h.sold-(h.bought-cost),unrealized=value-cost;
  rows.push({...h,value,cost,realized,unrealized,totalGain:value+h.sold-h.bought});
 }
 for(const p of C.open)if(!ledger.has(p.name))issues.push({code:'unexpected-holding',name:p.name});
 const totals=rows.reduce((s,h)=>{for(const k of Object.keys(s))s[k]+=h[k];return s},{bought:0,sold:0,value:0,cost:0,realized:0,unrealized:0,totalGain:0});
 if(!near(totals.value,C.tv)||!near(totals.cost,C.tc)||!near(totals.unrealized,C.pl)||!near(totals.totalGain,totals.realized+totals.unrealized))issues.push({code:'portfolio-total-mismatch'});
 return {ready:!issues.some(x=>['asset-name-collision','unit-mismatch','unexpected-holding','portfolio-total-mismatch'].includes(x.code)),issues,rows,totals};
}

 // Coverage measures held month-end snapshots plus today, not trading-day completeness.
export function historicalCoverage(S,NH,PWH,asOf,maxAge=7){
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(Date.parse(d)).toISOString().slice(0,10)===d;
 if(!validDate(asOf))return {rows:[],covered:0,required:0,percent:null};
 const groups=new Map();
 for(const t of S.tx||[]){if(!validDate(t.date)||t.date>asOf||!Number.isFinite(t.units)||t.units<=0||!['buy','sell'].includes(t.side))continue;const key=JSON.stringify([t.type,t.name]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t)}
 const rows=[];
 for(const tx of groups.values()){
  tx.sort((a,b)=>a.date.localeCompare(b.date));const {name,type}=tx[0];
  const prices=(type==='stock'?PWH?.[name]:NH?.[name]?.d)||[];
  const dates=[...new Set(prices.filter(r=>validDate(r?.[0])&&r[0]<=asOf&&Number.isFinite(r[1])&&r[1]>0).map(r=>r[0]))].sort();
  const first=tx[0].date, cursor=new Date(first.slice(0,7)+'-01T00:00:00Z'), snapshots=[];
  while(cursor.toISOString().slice(0,10)<=asOf){const end=new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,0)).toISOString().slice(0,10);snapshots.push(end<asOf?end:asOf);cursor.setUTCMonth(cursor.getUTCMonth()+1)}
  let i=0,j=0,units=0,required=0,covered=0;const missing=[];
  for(const d of snapshots){while(i<tx.length&&tx[i].date<=d){units+=(tx[i].side==='buy'?1:-1)*tx[i].units;i++}while(j<dates.length&&dates[j]<=d)j++;if(units<=1e-6)continue;required++;if(j&& (Date.parse(d)-Date.parse(dates[j-1]))/864e5<=maxAge)covered++;else missing.push(d)}
  const latest=dates.at(-1)||null,age=latest?(Date.parse(asOf)-Date.parse(latest))/864e5:null;
  rows.push({name,type,required,covered,missing,latest,age,open:units>1e-6,percent:required?100*covered/required:null});
 }
 const required=rows.reduce((s,r)=>s+r.required,0),covered=rows.reduce((s,r)=>s+r.covered,0);
 return {rows,required,covered,percent:required?100*covered/required:null};
}
