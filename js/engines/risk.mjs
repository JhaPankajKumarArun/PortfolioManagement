const PA_RF=0.065;
function paMonthEnd(s){const y=+s.slice(0,4),m=+s.slice(5,7)-1;return new Date(Date.UTC(y,m+1,0)).toISOString().slice(0,10)}
function riskHistPrice(S,PWH,NH,asOf,dnum,name,type,d){
 if(d===asOf&&S.px&&S.px[name]>0&&S.pxd&&S.pxd[name]&&S.pxd[name]<=d&&dnum(d)-dnum(S.pxd[name])<=7)return S.px[name];
 let rows=type==='stock'?(PWH&&PWH[name]||[]):(NH&&NH[name]&&NH[name].d||[]);
 if(!rows.length)return null;
 let v=null,dt='';for(const r of rows){if(r[0]<=d&&r[0]>=dt&&Number.isFinite(r[1])&&r[1]>0){v=r[1];dt=r[0]}}
 return v>0&&dt&&dnum(d)-dnum(dt)<=7?v:null;
}
function riskPortfolioAt(S,price,d){const pos=Object.create(null);S.tx.filter(t=>t.date<=d).forEach(t=>{const p=pos[t.name]||(pos[t.name]={u:0,type:t.type});p.u+=(t.side==='buy'?1:-1)*t.units});let value=0,missing=[];
 Object.entries(pos).forEach(([n,p])=>{if(p.u>1e-6){const q=price(n,p.type,d);if(q==null)missing.push(n);else value+=p.u*q}});
 return{value,missing};
}
function calculateRiskSeries(S,end,dnum,price){const tx=S.tx.filter(t=>t.date<=end).sort((a,b)=>a.date.localeCompare(b.date));if(!tx.length)return{points:[],missing:[]};const first=tx[0].date,start=paMonthEnd(first),dates=[];let y=+start.slice(0,4),m=+start.slice(5,7)-1;
 for(let guard=0;guard<1200;guard++){let d=paMonthEnd(`${y}-${String(m+1).padStart(2,'0')}-01`);if(d>end)d=end;if(!dates.length||dates[dates.length-1]!==d)dates.push(d);if(d===end)break;m++;if(m>11){m=0;y++}}
 const points=[],missingSet=new Set();let prev=null,index=100;
 dates.forEach(d=>{const v=riskPortfolioAt(S,price,d);v.missing.forEach(n=>missingSet.add(n));if(v.missing.length){prev=null;points.length=0;index=100;return}
 if(prev){const flows=tx.filter(t=>t.date>prev.d&&t.date<=d).map(t=>({date:t.date,amt:(t.side==='buy'?1:-1)*(t.units*t.price+(t.side==='buy'?(t.fee||0):-(t.fee||0)))}));const net=flows.reduce((a,x)=>a+x.amt,0),span=Math.max(1,dnum(d)-dnum(prev.d)),weighted=flows.reduce((a,x)=>a+x.amt*(dnum(d)-dnum(x.date))/span,0),den=prev.value+weighted;
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
