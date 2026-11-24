export function sipConsistency(rows){
 return rows.map(x=>{
 const months=Object.keys(x.mo).length,span=months+x.missed;
 return {name:x.name,months,span,coverage:span?100*months/span:null,missed:x.missed,inferred:x.inferred,active:x.active,monthly:x.amt};
 });
}
export function sipScenario({monthly,years,rate,step}){
 if(![monthly,years,rate,step].every(Number.isFinite)||monthly<0||!Number.isInteger(years)||years<1||years>50||rate< -50||rate>40||step<0||step>30)return null;
 const r=Math.expm1(Math.log1p(rate/100)/12);
 let value=0,invested=0,flat=0;
 for(let i=0;i<years*12;i++){
 const amount=monthly*Math.pow(1+step/100,Math.floor(i/12));
 value=value*(1+r)+amount;flat=flat*(1+r)+monthly;invested+=amount;
 }
 return {value,invested,flat,extra:value-flat,finalMonthly:monthly*Math.pow(1+step/100,years-1)};
}
