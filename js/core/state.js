
const K='portfolio-v1',$=s=>document.querySelector(s);
let S={tx:[],px:{}},tab='home',flt='all',dr={},cur='',armed='',pl={sip:10000,step:10,yrs:15,ret:12,inf:6};
try{const d=JSON.parse(localStorage.getItem(K));if(d&&Array.isArray(d.tx))S=d}catch(e){}
const save=()=>{try{localStorage.setItem(K,JSON.stringify(S))}catch(e){}};
