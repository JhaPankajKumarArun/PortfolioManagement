export function allocationPlan(holdings,targets,contribution=0){
 const keys=['mf','stock','other'];
 if(!Array.isArray(holdings)||!Number.isFinite(contribution)||contribution<0||keys.some(k=>!Number.isFinite(targets?.[k])||targets[k]<0||targets[k]>100)||Math.abs(keys.reduce((s,k)=>s+targets[k],0)-100)>1e-6)return null;
 const values={mf:0,stock:0,other:0};
 for(const h of holdings){if(!Number.isFinite(h.value)||h.value<0)return null;values[keys.includes(h.type)?h.type:'other']+=h.value}
 const total=keys.reduce((s,k)=>s+values[k],0),after=total+contribution;
 const gaps=keys.map(k=>Math.max(0,after*targets[k]/100-values[k])),sum=gaps.reduce((a,b)=>a+b,0);
 return {total,contribution,rows:keys.map((k,i)=>{const add=sum?contribution*gaps[i]/sum:0;return {key:k,value:values[k],weight:total?100*values[k]/total:null,target:targets[k],drift:total?100*values[k]/total-targets[k]:null,add,projected:after?100*(values[k]+add)/after:null}})};
}

export const assetClasses=['equity','debt','gold','international','cash','unclassified'];
export function classifyAsset(h){
 const n=String(h.name||'').toLowerCase();
 if(/gold|silver|commodit/.test(n))return 'gold';
 if(/international|overseas|global|nasdaq|s&p 500/.test(n))return 'international';
 if(/hybrid|balanced|multi.asset|asset allocation|fund of fund|fof|arbitrage/.test(n))return 'unclassified';
 if(/liquid|overnight|money market|duration|corporate bond|gilt|credit risk|banking and psu|banking & psu|floater|dynamic bond|debt/.test(n))return 'debt';
 if(h.type==='stock'||/equity|small.cap|mid.cap|large.cap|flexi.cap|multi.cap|elss|nifty|sensex|focused fund|value fund/.test(n))return 'equity';
 return 'unclassified';
}
export function assetAllocation(holdings,overrides={}){
 const values=Object.fromEntries(assetClasses.map(k=>[k,0])),items=[];
 for(const h of holdings){if(!Number.isFinite(h.value)||h.value<0)continue;
 const manual=Object.hasOwn(overrides,h.name)&&assetClasses.includes(overrides[h.name]);
 const key=manual?overrides[h.name]:classifyAsset(h);
 values[key]+=h.value;items.push({name:h.name,key,value:h.value,manual});
 }
 const total=Object.values(values).reduce((s,v)=>s+v,0);
 return {total,items,rows:assetClasses.map(key=>({key,value:values[key],weight:total?100*values[key]/total:0}))};
}
