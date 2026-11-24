const PWDB='pwa-wealth-cache-india-v2',PWSTORE='series',PWSTOCK='portfolio-stockh-v1',PWINDEX='portfolio-indexh-v1';
let PWDBP=null;
function pwDb(){if(PWDBP)return PWDBP;PWDBP=new Promise((resolve,reject)=>{if(!window.indexedDB)return reject(Error('IndexedDB unavailable'));const q=indexedDB.open(PWDB,1);q.onupgradeneeded=()=>{const db=q.result;if(!db.objectStoreNames.contains(PWSTORE))db.createObjectStore(PWSTORE,{keyPath:'id'})};q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)});return PWDBP}
async function pwPut(id,kind,data,source){const db=await pwDb();return new Promise((resolve,reject)=>{const tx=db.transaction(PWSTORE,'readwrite');tx.objectStore(PWSTORE).put({id,kind,data,source,updated:Date.now()});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function pwGet(id){try{const db=await pwDb();return await new Promise((resolve,reject)=>{const q=db.transaction(PWSTORE).objectStore(PWSTORE).get(id);q.onsuccess=()=>resolve(q.result||null);q.onerror=()=>reject(q.error)})}catch(e){return null}}
async function pwAll(kind){try{const db=await pwDb();return await new Promise((resolve,reject)=>{const q=db.transaction(PWSTORE).objectStore(PWSTORE).getAll();q.onsuccess=()=>resolve(q.result.filter(x=>!kind||x.kind===kind));q.onerror=()=>reject(q.error)})}catch(e){return []}}

export { pwDb,pwPut,pwGet,pwAll,PWDB,PWSTORE,PWSTOCK,PWINDEX };
