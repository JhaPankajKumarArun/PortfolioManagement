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
