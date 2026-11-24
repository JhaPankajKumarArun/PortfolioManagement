const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inr=n=>'₹'+Math.round(n).toLocaleString('en-IN');
const cr=n=>{const a=Math.abs(n),s=n<0?'−':'';return s+(a>=1e7?'₹'+(a/1e7).toFixed(2)+' Cr':a>=1e5?'₹'+(a/1e5).toFixed(2)+' L':inr(a))};
const pc=n=>n==null||!isFinite(n)?'–':(n>0.05?'+':n<-0.05?'−':'')+Math.abs(n).toFixed(1)+'%';
const cls=n=>n>=0?'g':'l',today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`} ;
