import {loadPortfolio,persistPortfolio} from './storage.mjs';
export function createState(storage){
 const state={S:loadPortfolio(storage),tab:'home',flt:'all',dr:{},cur:'',armed:'',pl:{sip:10000,step:10,yrs:15,ret:12,inf:6}};
 return {state,save:()=>{try{return persistPortfolio(storage,state.S)}catch(error){if(typeof globalThis.alert==='function')globalThis.alert('Portfolio could not be saved. Changes may exist only in memory. Export your backup before closing this application.');throw error}}};
}
// Transitional accessors preserve classic feature reads and assignments.
export function exposeLegacyState(store,target){
 for(const key of Object.keys(store.state)){
  if(Object.prototype.hasOwnProperty.call(target,key))throw Error('State binding already exists: '+key);
  Object.defineProperty(target,key,{configurable:true,enumerable:false,get:()=>store.state[key],set:value=>{store.state[key]=value}});
 }
 target.save=store.save;
}
