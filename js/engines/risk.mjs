import {fifoLedger} from './ledger.mjs';
import {resolvePrice,normalizeHistoricalPrice} from './valuation.mjs';
const PA_RF=0.065;
function paMonthEnd(s){const y=+s.slice(0,4),m=+s.slice(5,7)-1;return new Date(Date.UTC(y,m+1,0)).toISOString().slice(0,10)}
function riskHistPrice(S,PWH,NH,asOf,dnum,name,type,d,bases=new Map()){
 // Legacy stock histories have no verified adjustment basis. Do not mix pre-action prices with raw FIFO quantities.
 const actions=S.corporateActions??[],basis=bases.get(name)??'unknown';const stockRows=(PWH?.[name]??[]).map(([date,price])=>[date,normalizeHistoricalPrice({price,date,name,type,basis,actions})]).filter(([date])=>!actions.some(a=>a.name===name&&a.type===type&&a.date>date&&a.date<=d));
 const p=resolvePrice(d,[{rows:type==='stock'?stockRows:NH?.[name]?.d,source:'history'},{rows:d===asOf&&new Set((S.tx||[]).filter(t=>t.name===name).map(t=>t.type)).size<=1?[[S.pxd?.[name],S.px?.[name]]]:[],source:'cached market'}]);
 return p.status==='market'?p.price:null;
}
function riskPortfolioAt(S,price,d){const holdings=fifoLedger(S.tx,d,S.corporateActions??[]);let value=0,missing=[];
 for(const h of holdings){if(h.unmatched>1e-9||h.rejectedActions?.length||h.rejectedTransactions?.length){missing.push(h.name);continue}if(h.units>1e-9){const q=price(h.name,h.type,d);if(!Number.isFinite(q)||q<=0)missing.push(h.name);else value+=h.units*q}}
 return{value,missing};
}
function calculateRiskSeries(S,end,dnum,price){const invalid=fifoLedger(S.tx,end,S.corporateActions??[]).filter(h=>h.rejectedTransactions?.length);if(invalid.length)return {points:[],missing:invalid.map(h=>h.name??'Invalid transaction')};const tx=S.tx.filter(t=>t&&t.date<=end).sort((a,b)=>a.date.localeCompare(b.date));if(!tx.length)return{points:[],missing:[]};const first=tx[0].date,start=paMonthEnd(first),dates=[];let y=+start.slice(0,4),m=+start.slice(5,7)-1;
 for(let guard=0;guard<1200;guard++){let d=paMonthEnd(`${y}-${String(m+1).padStart(2,'0')}-01`);if(d>end)d=end;if(!dates.length||dates[dates.length-1]!==d)dates.push(d);if(d===end)break;m++;if(m>11){m=0;y++}}
 const points=[],missingSet=new Set();let prev=null,index=100;
 dates.forEach(d=>{const v=riskPortfolioAt(S,price,d);v.missing.forEach(n=>missingSet.add(n));if(v.missing.length){prev=null;points.length=0;index=100;return}
 if(prev){const flows=fifoLedger(tx,d,S.corporateActions??[]).flatMap(h=>h.flows).filter(([date])=>date>prev.d&&date<=d).map(([date,flow])=>({date,amt:-flow}));const net=flows.reduce((a,x)=>a+x.amt,0),span=Math.max(1,dnum(d)-dnum(prev.d)),weighted=flows.reduce((a,x)=>a+x.amt*(dnum(d)-dnum(x.date))/span,0),den=prev.value+weighted;
 const r=den>0?(v.value-prev.value-net)/den:null;if(r!==null&&Number.isFinite(r)&&r>-1){index*=1+r;points.push({d,value:v.value,r,index})}else{points.length=0;index=100;if(v.value>0)points.push({d,value:v.value,r:null,index:100})}
 }else if(v.value>0){points.push({d,value:v.value,r:null,index:100})}
 prev={d,value:v.value};
 });return{points,missing:[...missingSet]};
}
function calculateRiskStats(B){const p=B.points,monthly=p.filter((x,i)=>i>0&&x.r!=null&&x.d===paMonthEnd(x.d)&&p[i-1].d===paMonthEnd(p[i-1].d)&&(+x.d.slice(0,4)-+p[i-1].d.slice(0,4))*12+(+x.d.slice(5,7)-+p[i-1].d.slice(5,7))===1),rets=monthly.map(x=>x.r);if(rets.length<4)return{...B,ready:false,months:rets.length};const avg=rets.reduce((a,x)=>a+x,0)/rets.length,sd=Math.sqrt(rets.reduce((a,x)=>a+(x-avg)**2,0)/Math.max(1,rets.length-1)),rf=Math.pow(1+PA_RF,1/12)-1,down=Math.sqrt(rets.reduce((a,x)=>a+Math.min(0,x-rf)**2,0)/rets.length),vol=sd*Math.sqrt(12),sh=vol>0?((avg-rf)*12)/vol:null,so=down>0?((avg-rf)*12)/(down*Math.sqrt(12)):null;
 let peak=0,mdd=0;const dd=p.map(x=>{peak=Math.max(peak,x.index);const z=peak>0?x.index/peak-1:0;mdd=Math.min(mdd,z);return{d:x.d,dd:z}});
 const roll=[];for(let i=12;i<p.length;i++){const a=p[i-12].index,b=p[i].index;if(a>0&&p[i].d===paMonthEnd(p[i].d)&&p[i-12].d===paMonthEnd(p[i-12].d)&&monthly.includes(p[i])&&p.slice(i-11,i+1).every(x=>monthly.includes(x)))roll.push({d:p[i].d,r:(Math.pow(b/a,1)-1)*100})}
 const best=rets.length?Math.max(...rets):null,worst=rets.length?Math.min(...rets):null;
 return{...B,ready:true,months:rets.length,negativeMonths:rets.filter(x=>x<0).length,downsideVol:down*Math.sqrt(12)*100,vol:vol*100,sh,so,mdd:mdd*100,dd,roll,best:best*100,worst:worst*100,rf:PA_RF*100};
}

export { PA_RF, paMonthEnd, riskHistPrice, riskPortfolioAt, calculateRiskSeries, calculateRiskStats };

 // Deterministic shocks on recorded holding values; not a forecast or look-through analysis.
export function stressExposure(holdings){
 const rows=holdings.filter(h=>Number.isFinite(h.value)&&h.value>0).sort((a,b)=>b.value-a.value);
 const total=rows.reduce((s,h)=>s+h.value,0);
 if(!total)return null;
 const weights=rows.map(h=>h.value/total),hhi=weights.reduce((s,w)=>s+w*w,0);
 const scenarios=[10,20,30].map(p=>({label:'All holdings −'+p+'%',loss:total*p/100,remaining:total*(1-p/100)}));
 scenarios.push({label:'Largest holding −30%',loss:rows[0].value*.3,remaining:total-rows[0].value*.3});
 return {total,largest:rows[0].name,largestWeight:weights[0]*100,top5:weights.slice(0,5).reduce((s,w)=>s+w,0)*100,effective:1/hhi,scenarios};
}
