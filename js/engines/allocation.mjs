export function allocationPlan(holdings,targets,contribution=0){
 const keys=['mf','stock','other'];
 if(!Array.isArray(holdings)||!Number.isFinite(contribution)||contribution<0||keys.some(k=>!Number.isFinite(targets?.[k])||targets[k]<0||targets[k]>100)||Math.abs(keys.reduce((s,k)=>s+targets[k],0)-100)>1e-6)return null;
 const values={mf:0,stock:0,other:0};
 for(const h of holdings){if(!Number.isFinite(h.value)||h.value<0)return null;values[keys.includes(h.type)?h.type:'other']+=h.value}
 const total=keys.reduce((s,k)=>s+values[k],0),after=total+contribution;
 const gaps=keys.map(k=>Math.max(0,after*targets[k]/100-values[k])),sum=gaps.reduce((a,b)=>a+b,0);
 return {total,contribution,rows:keys.map((k,i)=>{const add=sum?contribution*gaps[i]/sum:0;return {key:k,value:values[k],weight:total?100*values[k]/total:null,target:targets[k],drift:total?100*values[k]/total-targets[k]:null,add,projected:after?100*(values[k]+add)/after:null}})};
}
