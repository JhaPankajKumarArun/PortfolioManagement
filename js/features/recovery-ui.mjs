import {K,decodePortfolio,readRecovery,readReplacement,restoreDamagedPortfolio,restoreMissingPortfolio} from '../core/storage.mjs';
import {openSnapshotDB,readSnapshot} from '../core/indexed-storage.mjs';
import {auditTransactions,blockingIssues} from '../core/integrity.mjs';
export function showRecovery(doc,storage,factory,reload,confirmRestore,allowMissing=false){
 const raw=storage.getItem(K);if(raw===null&&!allowMissing)return false;
 if(raw!==null){try{decodePortfolio(raw);return false}catch{}}
 const root=doc.querySelector('#app');if(!root)return false;
 root.textContent='';
 const add=(tag,text)=>{const el=doc.createElement(tag);el.textContent=text;root.appendChild(el);return el};
 add('h2','Portfolio recovery');add('p',raw===null?'Your primary portfolio is missing. Choose a local backup. Nothing is restored until you confirm.':'Your saved portfolio cannot be read. Choose a local backup. Nothing is replaced until you confirm.');
 const status=add('p','Select a recovery source.');status.setAttribute('role','status');
 let candidate=null,sequence=0;
 const restore=add('button','Restore selected backup');restore.disabled=true;
 async function select(label,load){
  const id=++sequence;candidate=null;restore.disabled=true;status.textContent='Reading '+label+'…';
  try{const value=await load();if(id!==sequence)return;if(!value)throw Error('No backup available');
   decodePortfolio(JSON.stringify(value));if(blockingIssues(auditTransactions(value.tx)).length)throw Error('Backup contains invalid transactions');
   candidate=value;status.textContent=label+': '+value.tx.length+' transactions. Review before restoring.';restore.disabled=false;
  }catch(e){if(id===sequence)status.textContent='Backup unavailable or invalid: '+label;}
 }
 function button(label,load){const b=add('button',label);b.onclick=()=>select(label,load)}
 button('Last local backup',()=>readRecovery(storage));
 button('Before last replacement',()=>readReplacement(storage));
 for(const key of ['current','previous'])button('IndexedDB '+key,async()=>{const db=await openSnapshotDB(factory);try{return await readSnapshot(db,key)}finally{db.close()}});
 add('p','Or select a portfolio JSON backup from your device.');
 const file=add('input','');file.type='file';file.accept='.json,application/json';file.onchange=()=>{const f=file.files[0];if(f)select('JSON file',async()=>decodePortfolio(await f.text()))};
 restore.onclick=()=>{if(!candidate||!confirmRestore(raw===null?'Restore '+candidate.tx.length+' transactions to missing primary storage?':'Replace the damaged portfolio with '+candidate.tx.length+' transactions? The damaged data will be preserved.'))return;
  try{if(storage.getItem(K)!==raw)throw Error('Primary changed');if(raw===null)restoreMissingPortfolio(storage,candidate);else restoreDamagedPortfolio(storage,candidate);restore.disabled=true;reload()}catch{status.textContent='Recovery failed. Check available storage or reload if another tab changed the portfolio.'}
 };
 return true;
}
