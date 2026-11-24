const addM=(s,m)=>{const [y,mo,day]=s.split('-').map(Number),first=new Date(Date.UTC(y,mo-1+m,1)),yy=first.getUTCFullYear(),mm=first.getUTCMonth(),last=new Date(Date.UTC(yy,mm+1,0)).getUTCDate();return new Date(Date.UTC(yy,mm,Math.min(day,last))).toISOString().slice(0,10)};
const fyOf=d=>{const y=+d.slice(0,4),s=+d.slice(5,7)>=4?y:y-1;return s+'-'+String((s+1)%100).padStart(2,'0')};
const srt=(a,b)=>a.date.localeCompare(b.date)||(a.side===b.side?0:a.side==='buy'?-1:1);
function taxAutoCls(n,S){const t=S.tx.find(x=>x.name===n);if(t&&t.type==='stock')return 'equity';const x=n.toLowerCase();
if(/liquid|overnight|money market|ultra short|low duration|short duration|medium duration|long duration|corporate bond|gilt|credit risk|banking and psu|banking & psu|floater|dynamic bond|bond fund|debt/.test(x))return 'debt';
if(/gold|silver|commodit|fund of fund|fof|international|overseas|global|nasdaq|s&p 500/.test(x))return 'other';return 'equity'}
const taxClass=(n,S)=>(S.cls&&S.cls[n])||taxAutoCls(n,S);
function mk(n,c,b,s,u,cost,pro){const lt=c==='debt'?false:addM(b,c==='equity'?12:24)<s;return{name:n,cls:c,buy:b,sell:s,units:u,cost,pro,gain:pro-cost,lt,fy:fyOf(s),bucket:c==='equity'?(lt?'eqLT':'eqST'):c==='debt'?'slab':(lt?'otLT':'slab')}}
function calculateRealized(S){const out=[];[...new Set(S.tx.map(t=>t.name))].forEach(n=>{const L=[],c=taxClass(n,S);S.tx.filter(t=>t.name===n).sort(srt).forEach(t=>{if(t.side==='buy')L.push({d:t.date,u:t.units,p:(t.units*t.price+(t.fee||0))/t.units});else{let u=t.units;for(const l of L){if(u<=1e-9)break;if(l.u<=1e-9)continue;const x=Math.min(l.u,u);out.push(mk(n,c,l.d,t.date,x,x*l.p,x*t.price-(t.fee||0)*x/t.units));l.u-=x;u-=x}}})});return out}
function calculateTaxFY(L,fy,slab){const rt={eqST:0,eqLT:0,slab:0,otLT:0},pos={eqST:[0,0],eqLT:[0,0],otLT:[0,0]};
L.filter(g=>g.fy===fy).forEach(g=>{rt[g.bucket]+=g.gain;if(g.gain>0&&pos[g.bucket])pos[g.bucket][g.sell>='2024-07-23'?1:0]+=g.gain});
const x={...rt},off=(f,t)=>{if(x[f]<0&&x[t]>0){const u=Math.min(-x[f],x[t]);x[f]+=u;x[t]-=u}};
off('eqST','slab');off('slab','eqST');off('eqST','eqLT');off('eqST','otLT');off('slab','eqLT');off('slab','otLT');off('eqLT','otLT');off('otLT','eqLT');
const carry=Object.values(x).filter(v=>v<0).reduce((s,v)=>s-v,0),bl=(p,a,b)=>{const t=p[0]+p[1];return t?(p[0]*a+p[1]*b)/t:b};
const lim=fy<'2018-19'?Infinity:fy<'2024-25'?1e5:125000,tEqST=Math.max(x.eqST,0)*bl(pos.eqST,.15,.2),tEqLT=fy<'2018-19'?0:Math.max(x.eqLT-lim,0)*bl(pos.eqLT,.1,.125),tSlab=Math.max(x.slab,0)*slab/100,tOT=Math.max(x.otLT,0)*bl(pos.otLT,.2,.125);
return{raw:rt,net:x,carry,lim,tEqST,tEqLT,tSlab,tOT,tax:(tEqST+tEqLT+tSlab+tOT)*1.04}}
function calculateRemainingLots(n,S){const L=[];S.tx.filter(t=>t.name===n).sort(srt).forEach(t=>{if(t.side==='buy')L.push({d:t.date,u:t.units,p:(t.units*t.price+(t.fee||0))/t.units});else{let u=t.units;for(const l of L){if(u<=1e-9)break;const x=Math.min(l.u,u);l.u-=x;u-=x}}});return L.filter(l=>l.u>1e-6)}

export { addM, fyOf, srt, taxAutoCls, taxClass, mk, calculateRealized, calculateTaxFY, calculateRemainingLots };
