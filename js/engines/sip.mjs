function calculateSips(transactions,asOf){const m={},day=864e5,now=Date.parse(asOf);transactions.forEach(t=>{if(t.sip&&t.side==='buy')(m[t.name]=m[t.name]||[]).push(t)});
return Object.entries(m).map(([name,L])=>{L.sort((a,b)=>a.date<b.date?-1:1);const mo={};L.forEach(t=>{const k=t.date.slice(0,7);mo[k]=(mo[k]||0)+t.units*t.price+(t.fee||0)});
const ks=Object.keys(mo).sort(),last=L[L.length-1];let missed=0;for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i];missed+=(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7)-+a.slice(5,7))-1}
const ch=[];let pv=null;ks.forEach(k=>{const v=Math.round(mo[k]);if(pv===null||Math.abs(v-pv)>pv*.02)ch.push([k,v]);pv=v});
return{name,mo,ch,missed,last:last.date,first:L[0].date,n:L.length,amt:mo[ks[ks.length-1]],active:(now-Date.parse(last.date))/day<=40,total:L.reduce((s,t)=>s+t.units*t.price+(t.fee||0),0)}})}

export { calculateSips };
