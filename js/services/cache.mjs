const PWDB='pwa-wealth-cache-india-v2',PWSTORE='series',PWSTOCK='portfolio-stockh-v1',PWINDEX='portfolio-indexh-v1';
let PWDBP=null;
function pwDb(){if(PWDBP)return PWDBP;PWDBP=new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('IndexedDB unavailable'));const q=indexedDB.open(PWDB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(PWSTORE))db.createObjectStore(PWSTORE,{keyPath:'id'})};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});return PWDBP}
async function pwPut(id,kind,data,source){const db=await pwDb();return new Promise((resolve,reject)=>{const tx=db.transaction(PWSTORE,'readwrite');tx.objectStore(PWSTORE).put({id,kind,data,source,updated:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function pwGet(id){try{const db=await pwDb();return await new Promise((resolve,reject)=>{const q=db.transaction(PWSTORE).objectStore(PWSTORE).get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}catch(e){return null}}
async function pwAll(kind){try{const db=await pwDb();return await new Promise((resolve,reject)=>{const q=db.transaction(PWSTORE).objectStore(PWSTORE).getAll();q.onsuccess=()=>resolve(q.result.filter(x=>!kind||x.kind===kind));q.onerror=()=>reject(q.error)})}catch(e){return []}}

export { pwDb,pwPut,pwGet,pwAll,PWDB,PWSTORE,PWSTOCK,PWINDEX };

 // Only remove provider NAV copies; never user-imported stock or index series.
export function isDisposableNav(record){return record?.kind==='nav'&&record.source==='MFAPI.in'&&typeof record.id==='string'&&record.id.startsWith('nav:')}
export async function clearProviderNavCopies(){
 const db=await pwDb();
 return new Promise((resolve,reject)=>{
 const tx=db.transaction(PWSTORE,'readwrite'),store=tx.objectStore(PWSTORE);let count=0;
 const cursor=store.openCursor();
 cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(isDisposableNav(c.value)){c.delete();count++}c.continue()};
 tx.oncomplete=()=>resolve(count);tx.onabort=()=>reject(tx.error||Error('Cleanup aborted'));tx.onerror=()=>reject(tx.error||Error('Cleanup failed'));
 });
}
