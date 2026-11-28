// Infer only conservative monthly MF purchase sequences; never mutate stored transactions.
function inferMonthlySips(transactions,asOf){
 const groups=new Map(), inferred=new Set();
 for(const t of transactions){
  if(t.type!=='mf'||t.side!=='buy'||t.date>asOf||!Number.isFinite(Date.parse(t.date))||!(t.units>0&&t.price>0))continue;
  if(!groups.has(t.name))groups.set(t.name,[]);
  groups.get(t.name).push(t);
 }
 const amount=t=>Number(t.units)*Number(t.price)+Number(t.fee||0);
 const month=t=>Number(t.date.slice(0,4))*12+Number(t.date.slice(5,7));
 const close=(a,b)=>month(b)-month(a)===1&&Math.abs(Number(a.date.slice(8,10))-Number(b.date.slice(8,10)))<=7&&Math.abs(amount(a)-amount(b))<=Math.max(amount(a),amount(b))*.02;
 for(const list of groups.values()){
  list.sort((a,b)=>a.date.localeCompare(b.date));
  for(const a of list){
   const next=list.filter(b=>close(a,b));
   if(next.length!==1)continue;
   const b=next[0], third=list.filter(c=>close(b,c));
   if(third.length!==1)continue;
   const c=third[0];
   if(list.filter(x=>close(x,b)).length!==1||list.filter(x=>close(x,c)).length!==1)continue;
   for(const t of [a,b,c])if(!t.sip)inferred.add(t);
  }
 }
 return inferred;
}
function calculateSips(transactions,asOf){const m=Object.create(null),day=864e5,now=Date.parse(asOf),inferred=inferMonthlySips(transactions,asOf);transactions.forEach(t=>{if((t.sip===true||inferred.has(t))&&t.side==='buy'&&t.date<=asOf)(m[t.name]=m[t.name]||[]).push(t)});
return Object.entries(m).map(([name,L])=>{L.sort((a,b)=>a.date.localeCompare(b.date));const mo={};L.forEach(t=>{const k=t.date.slice(0,7);mo[k]=(mo[k]||0)+Number(t.units)*Number(t.price)+Number(t.fee||0)});
const ks=Object.keys(mo).sort(),last=L[L.length-1];let missed=0;for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i];missed+=(+b.slice(0,4)-+a.slice(0,4))*12+(+b.slice(5,7)-+a.slice(5,7))-1}
const ch=[];let pv=null;ks.forEach(k=>{const v=Math.round(mo[k]);if(pv===null||Math.abs(v-pv)>pv*.02)ch.push([k,v]);pv=v});
return{name,inferred:L.filter(t=>inferred.has(t)).length,mo,ch,missed,last:last.date,first:L[0].date,n:L.length,amt:mo[ks[ks.length-1]],active:(now-Date.parse(last.date))/day<=40,total:L.reduce((s,t)=>s+Number(t.units)*Number(t.price)+Number(t.fee||0),0)}})}

export { calculateSips };
