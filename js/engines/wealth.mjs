export const wealthFields=['property','cash','otherAssets','loans','income','expenses','emi','emergency'];
export function wealthSummary(portfolio,profile){
 if(!Number.isFinite(portfolio)||portfolio<0||!profile||!wealthFields.every(k=>Number.isFinite(profile[k])&&profile[k]>=0))return null;
 const {property,cash,otherAssets,loans,income,expenses,emi,emergency}=profile;
 if(emergency>cash)return null;
 const assets=portfolio+property+cash+otherAssets,monthlyOutgo=expenses+emi;
 return {assets,liabilities:loans,netWorth:assets-loans,monthlyOutgo,surplus:income-monthlyOutgo,emergencyMonths:monthlyOutgo?emergency/monthlyOutgo:null,emiRatio:income?100*emi/income:null,emergencyGap:Math.max(0,6*monthlyOutgo-emergency)};
}
