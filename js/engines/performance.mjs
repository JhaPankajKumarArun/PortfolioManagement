function calculatePerformance({S,ser,PWH,pxAt,navCovers,dnum},start,end){const span=Math.max(1,dnum(end)-dnum(start)),rows=[];let v0=0,v1=0,cf=0,den=0,est=false;const missing=[];
const groups=new Map(),types=new Map();
for(const t of S.tx){const key=JSON.stringify([t.type,t.name]);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(t);if(!types.has(t.name))types.set(t.name,new Set());types.get(t.name).add(t.type);}
groups.forEach(tx=>{const {name:n,type}=tx[0],ambiguous=types.get(n).size>1;let u0=0,u1=0,c=0,d=0;tx.forEach(t=>{if(t.date<=start)u0+=t.side==='buy'?t.units:-t.units;if(t.date<=end)u1+=t.side==='buy'?t.units:-t.units;if(t.date>start&&t.date<=end){const a=t.side==='buy'?t.units*t.price+(t.fee||0):-(t.units*t.price-(t.fee||0));c+=a;d+=a*(dnum(end)-dnum(t.date))/span}});
const sp=u0>1e-6?(ambiguous?null:pxAt(ser,n,start)):null,ep=u1>1e-6?(ambiguous?null:pxAt(ser,n,end)):null;if(u0>1e-6&&!(Number.isFinite(sp)&&sp>0)||u1>1e-6&&!(Number.isFinite(ep)&&ep>0))missing.push(n);const a0=u0>1e-6?(Number.isFinite(sp)&&sp>0?u0*sp:null):0,a1=u1>1e-6?(Number.isFinite(ep)&&ep>0?u1*ep:null):0;if(u0>1e-6||c!==0||u1>1e-6){rows.push({n,type,v0:a0,v1:a1,cf:c,gain:a0===null||a1===null?null:a1-a0-c,den:a0===null?null:a0+d});v0+=a0;v1+=a1;cf+=c;den+=a0+d;
const h=tx[0],sh=PWH&&PWH[n],stockCovered=h&&h.type==='stock'&&sh&&sh.length&&dnum(start)>=dnum(sh[0][0])&&dnum(end)<=dnum(sh[sh.length-1][0]);if(h&&h.type==='stock'&&!stockCovered||h&&h.type==='mf'&&(!navCovers(n,start)||!navCovers(n,end)))est=true}});
if(missing.length)return {hist:true,missing,v0:null,v1:null,cf,gain:null,pct:null,vch:null,vpct:null,rows,est:true,start,end};
const gain=v1-v0-cf;return{hist:missing.length>0,missing,v0,v1,cf,gain,pct:den>1?gain/den*100:null,vch:v1-v0,vpct:v0>1?(v1-v0)/v0*100:null,rows,est,start,end}}

export { calculatePerformance };
