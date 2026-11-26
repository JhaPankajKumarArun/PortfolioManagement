import {decodePortfolio,K} from './storage.mjs';
export function openSnapshotDB(factory){
 return new Promise((resolve,reject)=>{
  if(!factory){reject(Error('IndexedDB unavailable'));return}
  const r=factory.open('portfolio-local-snapshots',1);
  r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains('snapshots'))r.result.createObjectStore('snapshots')};
  r.onerror=()=>reject(r.error);r.onblocked=()=>reject(Error('Database upgrade blocked'));
  r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();resolve(r.result)};
 });
}
export function writeSnapshot(db,raw){
 decodePortfolio(raw);
 return new Promise((resolve,reject)=>{
  const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');
  const r=store.get('current');
  r.onsuccess=()=>{if(r.result?.raw===raw)return;if(r.result)store.put(r.result,'previous');store.put({raw,savedAt:new Date().toISOString()},'current')};
  tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error||Error('Snapshot aborted'));tx.onerror=()=>reject(tx.error);
 });
}
export function readSnapshot(db,key='current'){
 if(!['current','previous'].includes(key))return Promise.reject(Error('Invalid snapshot key'));
 return new Promise((resolve,reject)=>{const r=db.transaction('snapshots','readonly').objectStore('snapshots').get(key);r.onsuccess=()=>{try{resolve(r.result?decodePortfolio(r.result.raw):null)}catch(e){reject(e)}};r.onerror=()=>reject(r.error)});
}
export function createSnapshotMirror(storage,factory){
 let db,tail=Promise.resolve(),status='pending',error=null;
 function sync(){
  let raw;try{raw=storage.getItem(K)}catch(e){status='error';error=e.message;return Promise.resolve(false)}
  if(raw===null)return Promise.resolve(false);
  tail=tail.then(async()=>{try{db??=await openSnapshotDB(factory);await writeSnapshot(db,raw);status='saved';error=null;return true}catch(e){db?.close();db=null;status='error';error=e.message;return false}});
  return tail;
 }
 return {sync,status:()=>({status,error})};
}
