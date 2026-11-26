import {recordError} from '../core/errors.mjs';
export async function fetchWithTimeout(url,options={},timeout=25000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{return await fetch(url,{...options,signal:controller.signal})}
 catch(error){recordError('network');throw error}
 finally{clearTimeout(timer)}
}

export async function fetchJsonWithTimeout(url,options={},timeout=25000){
 const controller=new AbortController(),parent=options.signal;
 const cancel=()=>controller.abort();
 if(parent?.aborted)cancel();else parent?.addEventListener('abort',cancel,{once:true});
 const timer=setTimeout(cancel,timeout);
 try{const r=await fetch(url,{...options,signal:controller.signal});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}
 catch(error){recordError('network');throw error}
 finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel)}
}
