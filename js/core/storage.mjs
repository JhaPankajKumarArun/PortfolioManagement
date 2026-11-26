let snapshotHook=null;
export function setSnapshotHook(fn){snapshotHook=fn}
export const K='portfolio-v1';
export const RECOVERY_KEY=K+'-recovery';
export const $=s=>document.querySelector(s);
export function decodePortfolio(raw){const d=JSON.parse(raw);if(!d||!Array.isArray(d.tx)||typeof d!=='object')throw Error('Invalid portfolio format');return d}
export function loadPortfolio(storage){const raw=storage.getItem(K);if(raw==null)return {tx:[],px:{}};return decodePortfolio(raw)}
export function persistPortfolio(storage,portfolio){
 const next=JSON.stringify(portfolio);decodePortfolio(next);
 const old=storage.getItem(K);
 if(old===next)return true;
 if(old!=null){decodePortfolio(old);storage.setItem(RECOVERY_KEY,old)}
 storage.setItem(K,next);try{snapshotHook?.()}catch{}return true;
}
export function readRecovery(storage){const raw=storage.getItem(RECOVERY_KEY);return raw==null?null:decodePortfolio(raw)}

// Explicit recovery only. Preserve the damaged primary before replacing it.
export const DAMAGED_KEY=K+'-damaged';
export function restoreDamagedPortfolio(storage,candidate){
 const next=JSON.stringify(candidate);decodePortfolio(next);
 const raw=storage.getItem(K);
 if(raw===null)throw Error('No damaged primary to recover');
 let damaged=false;try{decodePortfolio(raw)}catch{damaged=true}
 if(!damaged)throw Error('Primary portfolio is valid; use normal restore');
 storage.setItem(DAMAGED_KEY,raw);
 storage.setItem(K,next);try{snapshotHook?.()}catch{}return true;
}

export const LEGACY_GOALS_KEY='portfolio-goals-v1';
export function withLegacyGoals(storage,portfolio){
 if(Object.hasOwn(portfolio,'goals')){if(!Array.isArray(portfolio.goals))throw Error('Invalid saved goals');return portfolio}
 const raw=storage.getItem(LEGACY_GOALS_KEY);if(raw===null)return portfolio;
 const goals=JSON.parse(raw);if(!Array.isArray(goals))throw Error('Invalid legacy goals');
 return {...portfolio,goals};
}
