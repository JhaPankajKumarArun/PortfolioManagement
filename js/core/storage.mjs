export const K='portfolio-v1';
export const $=s=>document.querySelector(s);
export function loadPortfolio(storage){try{const d=JSON.parse(storage.getItem(K));if(d&&Array.isArray(d.tx))return d}catch(e){}return {tx:[],px:{}}}
export function persistPortfolio(storage,portfolio){try{storage.setItem(K,JSON.stringify(portfolio))}catch(e){}}
