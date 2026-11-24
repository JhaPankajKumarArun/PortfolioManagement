export function goalProjection(g){
 const {target,saved,monthly,years,rate,inflation}=g;
 if(![target,saved,monthly,years,rate,inflation].every(Number.isFinite)||target<=0||saved<0||monthly<0||years<1/12||years>50||rate< -50||rate>40||inflation<0||inflation>30)return null;
 const months=Math.round(years*12),r=Math.expm1(Math.log1p(rate/100)/12),growth=Math.exp(months*Math.log1p(r)),factor=r===0?months:Math.expm1(months*Math.log1p(r))/r;
 const futureTarget=target*Math.pow(1+inflation/100,months/12),projected=saved*growth+monthly*factor;
 return {months,futureTarget,projected,shortfall:Math.max(0,futureTarget-projected),requiredMonthly:Math.max(0,(futureTarget-saved*growth)/factor),funded:100*projected/futureTarget,currentProgress:100*saved/target};
}
