import {recordError} from '../core/errors.mjs';
export async function fetchWithTimeout(url,options={},timeout=25000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),timeout);
 try{return await fetch(url,{...options,signal:controller.signal})}
 catch(error){recordError('network');throw error}
 finally{clearTimeout(timer)}
}
