export function goalProjection(g){
 const {target,saved,monthly,years,rate,inflation}=g;
 if(![target,saved,monthly,years,rate,inflation].every(Number.isFinite)||target<=0||saved<0||monthly<0||years<1/12||years>50||rate< -50||rate>40||inflation<0||inflation>30)return null;
 const months=Math.round(years*12),r=Math.expm1(Math.log1p(rate/100)/12),growth=Math.exp(months*Math.log1p(r)),factor=r===0?months:Math.expm1(months*Math.log1p(r))/r;
 const futureTarget=target*Math.pow(1+inflation/100,months/12),projected=saved*growth+monthly*factor;
 return {months,futureTarget,projected,shortfall:Math.max(0,futureTarget-projected),requiredMonthly:Math.max(0,(futureTarget-saved*growth)/factor),funded:100*projected/futureTarget,currentProgress:100*saved/target};
}

export function fundingPlan(goals,available,monthlyBudget){
 if(!Array.isArray(goals)||![available,monthlyBudget].every(x=>Number.isFinite(x)&&x>=0))return null;
 const rows=goals.map(g=>({goal:g,projection:g&&goalProjection(g)}));
 if(rows.some(r=>!r.projection))return null;
 const saved=rows.reduce((s,r)=>s+r.goal.saved,0),committed=rows.reduce((s,r)=>s+r.goal.monthly,0),required=rows.reduce((s,r)=>s+r.projection.requiredMonthly,0);
 const extra=rows.reduce((s,r)=>s+Math.max(0,r.projection.requiredMonthly-r.goal.monthly),0);
 return {saved,committed,required,extra,unallocated:Math.max(0,available-saved),overallocated:Math.max(0,saved-available),budgetGap:Math.max(0,committed+extra-monthlyBudget),rows};
}
