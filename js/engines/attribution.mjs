function calculateAttribution(C,gains){
 const map=new Map();
 const get=(n,type)=>{const key=JSON.stringify([type??null,n]);if(!map.has(key))map.set(key,{name:n,type,realised:0,unrealised:0,value:0,cost:0});return map.get(key)};
 const types=new Map();for(const h of [...C.open,...gains]){if(h.type==null)continue;if(!types.has(h.name))types.set(h.name,new Set());types.get(h.name).add(h.type);}
 gains.forEach(g=>{get(g.name,g.type??(types.get(g.name)?.size===1?[...types.get(g.name)][0]:undefined)).realised+=g.gain});
 C.open.forEach(h=>{const x=get(h.name,h.type);x.unrealised+=h.pl;x.value+=h.value;x.cost+=h.cost;x.type=h.type});
 const rows=[...map.values()].map(x=>({...x,total:x.realised+x.unrealised,weight:C.tv>0?x.value/C.tv*100:0}));
 const totalReal=rows.reduce((a,x)=>a+x.realised,0),totalUnreal=rows.reduce((a,x)=>a+x.unrealised,0),net=totalReal+totalUnreal;
 const live=rows.filter(x=>x.value>0).sort((a,b)=>b.value-a.value),top3=live.slice(0,3).reduce((a,x)=>a+x.weight,0),hhi=live.reduce((a,x)=>a+Math.pow(x.weight,2),0);
 return{rows:rows.sort((a,b)=>b.total-a.total),totalReal,totalUnreal,net,top3,hhi,largest:live[0]||null};
}

export { calculateAttribution };
