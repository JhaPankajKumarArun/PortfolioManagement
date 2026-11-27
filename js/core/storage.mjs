import {verifiedFundTaxProfile} from '../engines/tax.mjs';
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
function validateTaxProfiles(profiles){if(!record(profiles))throw Error('Invalid tax profiles');for(const [type,names] of Object.entries(profiles)){if(!['mf','stock'].includes(type)||!record(names))throw Error('Invalid tax profile identity');for(const [name,years] of Object.entries(names)){if(!name.trim()||!record(years))throw Error('Invalid tax profile holding');for(const [fy,p] of Object.entries(years)){if(!/^\d{4}-\d{2}$/.test(fy)||fy.slice(5)!==String((Number(fy.slice(0,4))+1)%100).padStart(2,'0')||!verifiedFundTaxProfile(p,fy.slice(0,4)+'-04-01'))throw Error('Invalid annual tax profile');}}}}
let snapshotHook=null;
export function setSnapshotHook(fn){snapshotHook=fn}
export const K='portfolio-v1';
export const RECOVERY_KEY=K+'-recovery';
export const $=s=>document.querySelector(s);
export function decodePortfolio(raw){const d=JSON.parse(raw);if(!d||!Array.isArray(d.tx)||typeof d!=='object')throw Error('Invalid portfolio format');if(Object.hasOwn(d,'corporateActions')){if(!Array.isArray(d.corporateActions))throw Error('Invalid corporate actions');const seen=new Set();for(const a of d.corporateActions){if(!a||typeof a.name!=='string'||!a.name.trim()||!['stock','mf'].includes(a.type)||!['split','bonus'].includes(a.kind)||!Number.isFinite(a.ratio)||a.ratio<=0||typeof a.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(a.date)||!Number.isFinite(Date.parse(a.date))||new Date(Date.parse(a.date)).toISOString().slice(0,10)!==a.date)throw Error('Invalid corporate action');const key=JSON.stringify([a.type,a.name,a.date,a.kind]);if(seen.has(key))throw Error('Duplicate corporate action');seen.add(key)}}if(Object.hasOwn(d,'taxProfiles'))validateTaxProfiles(d.taxProfiles);return d}
export function loadPortfolio(storage){const raw=storage.getItem(K);if(raw==null)return {tx:[],px:{}};return decodePortfolio(raw)}
const baselines=new WeakMap();
export function trackPortfolioVersion(storage){baselines.set(storage,storage.getItem(K))}
export function portfolioVersionChanged(storage){return baselines.has(storage)&&baselines.get(storage)!==storage.getItem(K)}
function assertCurrent(storage){if(portfolioVersionChanged(storage)){const e=new Error('Portfolio changed in another tab. Copy unsaved changes before reloading.');e.name='PortfolioConflictError';throw e}}
function advanceVersion(storage,raw){if(baselines.has(storage))baselines.set(storage,raw)}
export function persistPortfolio(storage,portfolio){
 assertCurrent(storage);
 const next=JSON.stringify(portfolio);decodePortfolio(next);
 const old=storage.getItem(K);
 if(old===next)return true;
 if(old!=null){decodePortfolio(old);storage.setItem(RECOVERY_KEY,old)}
 storage.setItem(K,next);advanceVersion(storage,next);try{snapshotHook?.()}catch{}return true;
}
export function readRecovery(storage){const raw=storage.getItem(RECOVERY_KEY);return raw==null?null:decodePortfolio(raw)}

// Explicit recovery only. Preserve the damaged primary before replacing it.
export const DAMAGED_KEY=K+'-damaged';
export function restoreDamagedPortfolio(storage,candidate){
 assertCurrent(storage);
 const next=JSON.stringify(candidate);decodePortfolio(next);
 const raw=storage.getItem(K);
 if(raw===null)throw Error('No damaged primary to recover');
 let damaged=false;try{decodePortfolio(raw)}catch{damaged=true}
 if(!damaged)throw Error('Primary portfolio is valid; use normal restore');
 storage.setItem(DAMAGED_KEY,raw);
 storage.setItem(K,next);advanceVersion(storage,next);try{snapshotHook?.()}catch{}return true;
}

export const LEGACY_GOALS_KEY='portfolio-goals-v1';
export function withLegacyGoals(storage,portfolio){
 if(Object.hasOwn(portfolio,'goals')){if(!Array.isArray(portfolio.goals))throw Error('Invalid saved goals');return portfolio}
 const raw=storage.getItem(LEGACY_GOALS_KEY);if(raw===null)return portfolio;
 const goals=JSON.parse(raw);if(!Array.isArray(goals))throw Error('Invalid legacy goals');
 return {...portfolio,goals};
}

export const REPLACEMENT_KEY=K+'-before-replacement';
export function persistReplacement(storage,candidate){
 assertCurrent(storage);
 decodePortfolio(JSON.stringify(candidate));
 const old=storage.getItem(K);
 if(old!==null){const previous=withLegacyGoals(storage,decodePortfolio(old));if(!previous.sample&&(previous.tx.length||previous.corporateActions?.length||Object.keys(previous.taxProfiles??{}).length||previous.goals?.length||previous.wealth||storage.getItem(REPLACEMENT_KEY)===null))storage.setItem(REPLACEMENT_KEY,JSON.stringify(previous));}
 return persistPortfolio(storage,candidate);
}
export function readReplacement(storage){const raw=storage.getItem(REPLACEMENT_KEY);return raw===null?null:decodePortfolio(raw)}

export function storageFootprint(storage){
 const keys=[K,RECOVERY_KEY,DAMAGED_KEY,REPLACEMENT_KEY,LEGACY_GOALS_KEY];
 return keys.map(key=>{const raw=storage.getItem(key);return {key,present:raw!==null,bytes:raw===null?0:new TextEncoder().encode(raw).length}});
}
export function quotaSummary(estimate){
 const {usage,quota}=estimate||{};
 if(!Number.isFinite(usage)||!Number.isFinite(quota)||usage<0||quota<=0)return null;
 return {usage,quota,percent:100*usage/quota,remaining:Math.max(0,quota-usage),warning:usage/quota>=0.8};
}

export function restoreMissingPortfolio(storage,candidate){
 assertCurrent(storage);
 if(storage.getItem(K)!==null)throw Error('Primary already exists');
 return persistPortfolio(storage,candidate);
}
