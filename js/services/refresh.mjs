// Per-task single flight, expiry and bounded retry cooldown.
export function createRefreshManager({now=Date.now,online=()=>globalThis.navigator?.onLine!==false}={}){
 const tasks=new Map();
 function run(key,work,{ttl=0,force=false,baseDelay=1000,maxDelay=60000}={}){
  let s=tasks.get(key);if(!s){s={lastSuccess:null,failures:0,nextRetry:0,pending:null,value:undefined};tasks.set(key,s)}
  if(s.pending)return s.pending;
  if(!online()||(!force&&(now()<s.nextRetry||(s.lastSuccess!==null&&now()-s.lastSuccess<ttl))))return Promise.resolve(s.value);
  s.pending=Promise.resolve().then(work).then(value=>{s.value=value;s.lastSuccess=now();s.failures=0;s.nextRetry=0;return value},error=>{s.failures++;s.nextRetry=now()+Math.min(maxDelay,baseDelay*2**Math.min(s.failures-1,20));throw error}).finally(()=>{s.pending=null});
  return s.pending;
 }
 function status(key){const s=tasks.get(key);return s?{lastSuccess:s.lastSuccess,failures:s.failures,nextRetry:s.nextRetry,busy:!!s.pending}:null}
 return {run,status};
}
export const refreshManager=createRefreshManager();
export function installRefreshTriggers({document,window,refresh,interval=1800000}){
 const trigger=()=>{if(!document.hidden&&window.navigator?.onLine!==false)Promise.resolve().then(refresh).catch(()=>{})};
 document.addEventListener('visibilitychange',trigger);window.addEventListener('online',trigger);
 const timer=window.setInterval(trigger,interval);
 return ()=>{document.removeEventListener('visibilitychange',trigger);window.removeEventListener('online',trigger);window.clearInterval(timer)};
}
