
const assetLabels={equity:'Domestic equity',debt:'Debt',gold:'Gold / commodities',international:'International equity',cash:'Cash',unclassified:'Unclassified / mixed'};
export function assetClassCard(){return `<h2>Asset-class allocation</h2><div class='card pad'><p class='mut'>Estimated whole-holding classification, not underlying exposure. Mixed funds remain unclassified unless you override them.</p><div id='assetClassOutput'></div><button class='btn ghost' id='assetClassRun'>View asset-class breakdown</button></div>`}
export function allocationPlanner(C){return `<h2>Allocation & rebalancing planner</h2><div class='card pad' id='allocationPlanner'><p class='mut'>Set your own targets by holding type, not underlying equity/debt exposure. Mutual funds may hold multiple asset classes. Only recorded portfolio holdings are included.</p><label>Mutual funds target (%)<input id='allocMf' type='number' min='0' max='100' step='0.1'></label><label>Stocks target (%)<input id='allocStock' type='number' min='0' max='100' step='0.1'></label><label>Other target (%)<input id='allocOther' type='number' min='0' max='100' step='0.1' value='0'></label><label>New investment (₹)<input id='allocCash' type='number' min='0' value='0'></label><button type='button' class='btn' id='allocRun'>Calculate allocation plan</button><div id='allocResult' role='status'></div><p class='mut'>Contribution-only illustration; no sales, orders or transaction changes. Recorded prices may be stale. Targets are not investment recommendations.</p></div>`}

export function installAllocation({doc,getPortfolio,getState,commit,cr,esc}){
doc.addEventListener('click',async e=>{
 if(!e.target.closest('#assetClassRun'))return;
 const out=doc.getElementById('assetClassOutput');
 try{const {assetAllocation}=await import('../engines/allocation.mjs');const p=assetAllocation(getPortfolio().open,getState().assetClasses||{});
 out.innerHTML=p.rows.map(r=>`<div class='ur'><span>${assetLabels[r.key]}</span><b>${cr(r.value)} · ${r.weight.toFixed(2)}%</b></div>`).join('')+`<details><summary>Review classifications</summary>${p.items.map((h,i)=>`<label>${esc(h.name)}<select data-asset-index='${i}'><option value='' ${h.manual?'':'selected'}>Automatic: ${assetLabels[h.key]}</option>${Object.entries(assetLabels).map(([k,v])=>`<option value='${k}' ${h.manual&&h.key===k?'selected':''}>${v}</option>`).join('')}</select></label>`).join('')}</details>`;
 out.onchange=ev=>{const el=ev.target.closest('[data-asset-index]');if(!el)return;const h=p.items[Number(el.dataset.assetIndex)];if(!h)return;const next={...(getState().assetClasses||{})};if(el.value)Object.defineProperty(next,h.name,{value:el.value,enumerable:true,configurable:true,writable:true});else delete next[h.name];const candidate={...getState(),assetClasses:next};try{commit(candidate);doc.getElementById('assetClassRun')?.click()}catch{alert('Classification could not be saved.')}}; 
 }catch{out.textContent='Unable to calculate asset classes.'}
});
doc.addEventListener('click',async e=>{
 if(!e.target.closest('#allocRun'))return;
 const out=doc.getElementById('allocResult');
 try{
 const read=id=>{const v=doc.getElementById(id).value;return v.trim()===''?NaN:Number(v)};
 const targets={mf:read('allocMf'),stock:read('allocStock'),other:read('allocOther')},cash=read('allocCash');
 const {allocationPlan}=await import('../engines/allocation.mjs');
 const p=allocationPlan(getPortfolio().open,targets,cash);
 if(!p){out.textContent='Enter non-negative targets totaling 100% and a valid investment amount.';return}
 const labels={mf:'Mutual funds',stock:'Stocks',other:'Other'},pct=v=>v===null?'N/A':v.toFixed(2)+'%';
 out.innerHTML=p.rows.map(x=>`<div class='ur'><span>${labels[x.key]}</span><b>${pct(x.weight)} → ${pct(x.projected)}</b></div><p class='mut'>Target ${pct(x.target)} · Drift ${x.drift===null?'N/A':x.drift.toFixed(1)+' pp'} · Suggested contribution ${cr(x.add)}</p>`).join('');
 }catch{out.textContent='Unable to calculate allocation plan.'}
});

}
