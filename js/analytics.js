let overlapSelection=null,overlapRevision=0,overlapSection='overview';
function holdingOverlap(C){
 const funds=C.open.filter(h=>h.type==='mf');if(!funds.length)return '';
 return `<div class='chips ho-launch'><button type='button' id='hoOpen'>Analyze overlap · ${funds.length} funds ›</button></div>`;
}
function openHoldingOverlap(){
 if(document.getElementById('holdingOverlap'))return;
 const funds=calc().open.filter(h=>h.type==='mf');if(overlapSelection===null)overlapSelection=new Set(funds.map(h=>h.name));
 const root=document.createElement('dialog');root.id='holdingOverlap';root.className='ho-dialog';
 root.innerHTML=`<div class='ho-head'><button type='button' id='hoClose' aria-label='Back to holdings'>‹ Back</button><strong>Overlap intelligence</strong></div><div class='ho-body'><div class='card pad'><details class='ho-picker'><summary> Select funds <span id='hoCount'></span></summary><div class='chips'><button type='button' id='hoAll'>Select all</button><button type='button' id='hoNone'>Clear all</button></div>${funds.map((h,i)=>`<label class='ho-fund'><input type='checkbox' data-ho-index='${i}' ${overlapSelection.has(h.name)?'checked':''}><span>${esc(h.name)}</span><b>${cr(h.value)}</b></label>`).join('')}<button type='button' class='btn' id='hoApply'>Done</button></details></div><div class='seg ho-tabs'>${['overview','overlap','exposure'].map(k=>`<button type='button' data-ho-tab='${k}' class='${overlapSection===k?'on':''}'>${k[0].toUpperCase()+k.slice(1)}</button>`).join('')}</div><div id='hoResult' role='status'></div><p class='mut note'>Selection is a simulation. Disclosures are cached locally; refresh or import in Overview.</p></div>`;
 document.body.append(root);root.addEventListener('close',()=>{root.remove();document.getElementById('hoOpen')?.focus()},{once:true});root.showModal();updateHoldingOverlap();
}
async function updateHoldingOverlap(){
 const root=document.getElementById('holdingOverlap'),out=document.getElementById('hoResult');if(!root||!out||!root.open)return;
 const revision=++overlapRevision;
 try{
 const {overlapAnalysis}=await import('./engines/overlap.mjs');if(revision!==overlapRevision||!out.isConnected)return;
 const funds=calc().open.filter(h=>h.type==='mf'&&overlapSelection.has(h.name)),rows=JSON.parse(localStorage.getItem(overlapKey)||'[]'),p=overlapAnalysis(funds,rows,today());
 const pair=(a,b)=>p.pairs.find(x=>(x.a===a&&x.b===b)||(x.a===b&&x.b===a));
 root.querySelector('#hoCount').textContent=funds.length+' selected';
 const possible=funds.length*(funds.length-1)/2,avg=p.pairs.length?p.pairs.reduce((s,x)=>s+x.weight,0)/p.pairs.length:null;
 const equity=p.exposure.reduce((s,x)=>s+x.value,0),top=p.exposure.slice(0,10).reduce((s,x)=>s+x.weight,0),hhi=equity?p.exposure.reduce((s,x)=>s+(x.value/equity)**2,0):0;
 if(!p.exposure.length){out.innerHTML=`<div class='card pad ho-kpis'><div><small>Selected value</small><strong>${cr(p.total)}</strong></div><div><small>Comparable pairs</small><strong>0 / ${possible}</strong></div></div><div class='card pad ho-empty'><h3>${funds.length?'Disclosures unavailable':'Select funds to begin'}</h3><p class='mut'>${funds.length?'No usable cached equity disclosures for the selected funds. Overlap and exposure cannot be calculated.':'Choose mutual funds using Select funds above.'}</p></div>`;return}
 out.innerHTML=`<h3>${funds.length} selected · ${cr(p.total)}</h3><p class='mut'>Disclosure coverage by selected fund value: ${p.total?(100*p.covered/p.total).toFixed(1)+'%':'N/A'} · ${p.pairs.length}/${possible} comparable pairs</p><p class='mut'>Missing/stale: ${p.missing.map(esc).join(', ')||'None'} · Dates: ${p.dates.map(esc).join(', ')||'None'}</p>`+(funds.length<2?'<p>Select at least two funds for pairwise comparison.</p>':`<h3>Weighted overlap matrix</h3><p class='mut'>Tap a percentage for common holdings. N/A means no comparable disclosure.</p><div style='overflow:auto'><table style='border-collapse:separate;border-spacing:4px'><thead><tr><th></th>${funds.map((_,i)=>`<th>F${i+1}</th>`).join('')}</tr></thead><tbody>${funds.map((a,i)=>`<tr><th>F${i+1}</th>${funds.map((b,j)=>{const x=pair(a.name,b.name);return `<td>${i===j?'—':x?`<button type='button' data-ho-pair='${p.pairs.indexOf(x)}' style='padding:8px;background:rgba(220,100,40,${Math.min(.7,x.weight/100)});white-space:nowrap'>${x.weight.toFixed(1)}%</button>`:'N/A'}</td>`}).join('')}</tr>`).join('')}</tbody></table></div><p class='mut'>${funds.map((h,i)=>'F'+(i+1)+': '+esc(h.name)).join(' · ')}</p><div id='hoPair'></div>`)+`<h3>Selected fund analytics</h3><div class='ur'><span>Average comparable overlap</span><b>${avg===null?'N/A':avg.toFixed(1)+'%'}</b></div><div class='ur'><span>Unique disclosed securities</span><b>${p.exposure.length||'N/A'}</b></div><div class='ur'><span>Top 10 disclosed exposure / selected value</span><b>${equity?top.toFixed(1)+'%':'N/A'}</b></div><div class='ur'><span>Effective disclosed security count</span><b>${hhi?(1/hhi).toFixed(1):'N/A'}</b></div><p class='mut'>Effective count uses disclosed equity exposure only; mixed dates and incomplete disclosures can distort comparisons.</p><h3>Combined underlying exposure</h3>${p.exposure.slice(0,30).map(x=>`<div class='ur'><span>${esc(x.name)} · ${x.funds} funds</span><b>${cr(x.value)} · ${x.weight.toFixed(2)}%</b></div>`).join('')||'<p class="mut">No usable disclosures.</p>'}`;
 const headings=[...out.querySelectorAll('h3')];let section='overview';for(const el of [...out.children]){if(el.tagName==='H3'){if(el.textContent==='Weighted overlap matrix')section='overlap';else if(el.textContent==='Selected fund analytics')section='overview';else if(el.textContent==='Combined underlying exposure')section='exposure'}el.hidden=section!==overlapSection} 
 out.onclick=e=>{const b=e.target.closest('[data-ho-pair]');if(!b)return;const x=p.pairs[Number(b.dataset.hoPair)],detail=out.querySelector('#hoPair');if(!x||!detail)return;detail.innerHTML=`<h3>${esc(x.a)} vs ${esc(x.b)}</h3><p>${x.weight.toFixed(2)}% overlap · ${x.common} common securities · ${esc(x.date)}</p><div style='overflow:auto'><table><thead><tr><th>Security</th><th>First fund</th><th>Second fund</th><th>Shared</th></tr></thead><tbody>${x.details.map(h=>`<tr><td>${esc(h.name)}</td><td>${h.a.toFixed(2)}%</td><td>${h.b.toFixed(2)}%</td><td>${h.weight.toFixed(2)}%</td></tr>`).join('')}</tbody></table></div>`};
 }catch(e){out.textContent='Unable to analyze saved disclosures: '+e.message}
}
document.addEventListener('change',e=>{if(!e.target.matches('[data-ho-index]'))return;const h=calc().open.filter(h=>h.type==='mf')[Number(e.target.dataset.hoIndex)];if(!h)return;if(e.target.checked)overlapSelection.add(h.name);else overlapSelection.delete(h.name);updateHoldingOverlap()});
document.addEventListener('click',e=>{if(e.target.closest('#hoOpen')){openHoldingOverlap();return}const root=document.getElementById('holdingOverlap');if(!root)return;if(e.target.closest('#hoClose')){root.close();return}if(e.target.closest('#hoApply')){root.querySelector('.ho-picker').open=false;return}const t=e.target.closest('[data-ho-tab]');if(t){overlapSection=t.dataset.hoTab;root.querySelectorAll('[data-ho-tab]').forEach(x=>x.classList.toggle('on',x===t));updateHoldingOverlap();return}const b=e.target.closest('#hoAll,#hoNone');if(!b)return;const all=b.id==='hoAll';overlapSelection=new Set(all?calc().open.filter(h=>h.type==='mf').map(h=>h.name):[]);document.querySelectorAll('[data-ho-index]').forEach(x=>x.checked=all);updateHoldingOverlap()});
let overlapBusy=false,overlapAttempt=0,overlapMessage='';
async function refreshOverlap(force=false){
 if(!document.getElementById('overlapOutput'))return;
 await showOverlap();
 const status=()=>{const e=document.getElementById('overlapSyncStatus');if(e)e.textContent=overlapMessage};
 status();if(overlapBusy)return;
 if(!force&&(Date.now()-overlapAttempt<3600000||Date.now()-Number(localStorage.getItem('overlap-refresh-at')||0)<86400000))return;
 overlapBusy=true;overlapAttempt=Date.now();overlapMessage='Refreshing public holdings catalog…';status();
 try{
 const {publicDisclosures}=await import('./services/providers/disclosures.mjs');
 const {validateDisclosure}=await import('./engines/overlap.mjs');
 const names=calc().open.filter(h=>h.type==='mf').map(h=>h.name);
 if(!names.length)return;
 const p=await publicDisclosures(names);
 let rows=JSON.parse(localStorage.getItem(overlapKey)||'[]'),count=0;
 for(const d of p.rows){if(!validateDisclosure(d,today())||!calc().open.some(h=>h.type==='mf'&&h.name===d.scheme)||rows.some(x=>x.scheme===d.scheme&&x.date>d.date))continue;rows=rows.filter(x=>x.scheme!==d.scheme).concat(d);count++}
 localStorage.setItem(overlapKey,JSON.stringify(rows));if(!p.failures)localStorage.setItem('overlap-refresh-at',String(Date.now()));
 overlapMessage='Public catalog matched '+count+' of '+names.length+' funds; '+p.failures+' catalog downloads failed. Unmatched funds retain saved disclosures.';
 }catch(e){overlapMessage='Public holdings refresh unavailable; saved disclosures retained. '+e.message}
 finally{overlapBusy=false;status();await showOverlap()}
}
document.addEventListener('click',e=>{if(e.target.closest('#overlapRefresh'))refreshOverlap(true)});
function overlapCard(){return `<h2>Mutual fund overlap</h2><div class='card pad'><p class='mut'>Import normalized scheme equity disclosures from official AMC statements. Weights are percentages of entire scheme NAV, not normalized equity weights. Public catalog refresh downloads all available schemes, then matches locally. Coverage depends on the provider.</p><a href='https://www.amfiindia.com/' target='_blank' rel='noopener noreferrer'>AMFI disclosures</a><button type='button' class='btn' id='overlapRefresh'>Refresh public holdings</button><p id='overlapSyncStatus' role='status'></p><label>Optional manual disclosure JSON<input type='file' id='overlapFile' accept='.json,application/json'></label><button type='button' class='btn' id='overlapShow'>Calculate saved disclosures</button><div id='overlapOutput' role='status'></div><p class='mut'>Same-date pairs only; data older than 45 days excluded. Partial equity lists understate overlap and exposure. Direct stocks and indirect fund-of-fund holdings are excluded.</p></div>`}
const overlapKey='portfolio-overlap-v1';
async function showOverlap(file){
 const out=document.getElementById('overlapOutput');if(!out)return;
 try{
 const {validateDisclosure,overlapAnalysis}=await import('./engines/overlap.mjs');
 let rows=JSON.parse(localStorage.getItem(overlapKey)||'[]');
 if(file){if(file.size>5000000)throw Error('Disclosure file too large');const d=JSON.parse(await file.text());if(!validateDisclosure(d,today())||!calc().open.some(h=>h.type==='mf'&&h.name===d.scheme))throw Error('Invalid disclosure or scheme name does not exactly match an open mutual fund.');if(rows.some(x=>x.scheme===d.scheme&&x.date>d.date))throw Error('A newer disclosure is already saved.');rows=rows.filter(x=>x.scheme!==d.scheme).concat(d);localStorage.setItem(overlapKey,JSON.stringify(rows))}
 const p=overlapAnalysis(calc().open,rows,today());
 out.innerHTML=`<p>Disclosure coverage by fund value: ${p.total?(100*p.covered/p.total).toFixed(1):'0'}%</p><p class='mut'>Disclosure dates: ${p.dates.map(esc).join(', ')||'None'} · Missing/stale: ${p.missing.map(esc).join(', ')||'None'}</p><h3>Pairwise disclosed equity overlap</h3>`+(p.pairs.map(x=>`<div class='ur'><span>${esc(x.a)} / ${esc(x.b)}<small> · ${x.common} shared ISINs</small></span><b>${x.weight.toFixed(2)}%</b></div>`).join('')||'<p class="mut">Two matching-date disclosures required.</p>')+`<h3>Top disclosed underlying exposures</h3>`+p.exposure.slice(0,20).map(x=>`<div class='ur'><span>${esc(x.name)} · ${x.funds} funds</span><b>${cr(x.value)} · ${x.weight.toFixed(2)}%</b></div>`).join('');
 }catch(e){out.textContent=e.message||'Unable to read disclosures.'}
}
document.addEventListener('change',e=>{if(e.target.id==='overlapFile'&&e.target.files[0])showOverlap(e.target.files[0])});
document.addEventListener('click',e=>{if(e.target.closest('#overlapShow'))showOverlap()});
function allocationPlanner(C){return `<h2>Allocation & rebalancing planner</h2><div class='card pad' id='allocationPlanner'><p class='mut'>Set your own targets by holding type, not underlying equity/debt exposure. Mutual funds may hold multiple asset classes. Only recorded portfolio holdings are included.</p><label>Mutual funds target (%)<input id='allocMf' type='number' min='0' max='100' step='0.1'></label><label>Stocks target (%)<input id='allocStock' type='number' min='0' max='100' step='0.1'></label><label>Other target (%)<input id='allocOther' type='number' min='0' max='100' step='0.1' value='0'></label><label>New investment (₹)<input id='allocCash' type='number' min='0' value='0'></label><button type='button' class='btn' id='allocRun'>Calculate allocation plan</button><div id='allocResult' role='status'></div><p class='mut'>Contribution-only illustration; no sales, orders or transaction changes. Recorded prices may be stale. Targets are not investment recommendations.</p></div>`}
document.addEventListener('click',async e=>{
 if(!e.target.closest('#allocRun'))return;
 const out=document.getElementById('allocResult');
 try{
 const read=id=>{const v=document.getElementById(id).value;return v.trim()===''?NaN:Number(v)};
 const targets={mf:read('allocMf'),stock:read('allocStock'),other:read('allocOther')},cash=read('allocCash');
 const {allocationPlan}=await import('./engines/allocation.mjs');
 const p=allocationPlan(calc().open,targets,cash);
 if(!p){out.textContent='Enter non-negative targets totaling 100% and a valid investment amount.';return}
 const labels={mf:'Mutual funds',stock:'Stocks',other:'Other'},pct=v=>v===null?'N/A':v.toFixed(1)+'%';
 out.innerHTML=p.rows.map(x=>`<div class='ur'><span>${labels[x.key]}</span><b>${pct(x.weight)} → ${pct(x.projected)}</b></div><p class='mut'>Target ${pct(x.target)} · Drift ${x.drift===null?'N/A':x.drift.toFixed(1)+' pp'} · Suggested contribution ${cr(x.add)}</p>`).join('');
 }catch{out.textContent='Unable to calculate allocation plan.'}
});
function stressRiskTile(C){
 const a=financialFeatures.stressRisk(C.open);if(!a)return '';
 return `<h2>Portfolio stress testing</h2><div class='card pad'><div class='ur'><span>Largest holding</span><b>${esc(a.largest)} · ${a.largestWeight.toFixed(1)}%</b></div><div class='ur'><span>Top five weight</span><b>${a.top5.toFixed(1)}%</b></div><div class='ur'><span>Effective number of holdings</span><b>${a.effective.toFixed(1)}</b></div>${a.scenarios.map(x=>`<div class='ur'><span>${esc(x.label)}<small class='mut'> · remaining ${cr(x.remaining)}</small></span><b class='l'>−${cr(x.loss)}</b></div>`).join('')}<p class='mut note'>Hypothetical instantaneous shocks to recorded holding values, which may include stale or estimated prices. No probability, correlation, fund overlap, tax or recovery assumptions. Not a forecast.</p></div>`;
}
// Phase 2: cash-flow-adjusted portfolio risk analytics. All portfolio calculations run locally.
function paBuild(){return financialFeatures.riskSeries(S,perfEnd(),dnum,PWH,NH,today())}
function paStats(){return financialFeatures.riskStats(paBuild())}
function portfolioRiskTile(){const a=paStats(),months=a.months;
 if(!a.ready)return `<h2>Portfolio risk & rolling returns</h2><div class='card pad'><p class='mut'>Not enough complete monthly history yet. At least 4 complete monthly return periods are needed to show preliminary risk statistics. Annualised metrics become more meaningful with 12 or more periods.</p>${a.missing.length?`<p class='mut'>Missing or stale history: ${a.missing.slice(0,5).map(esc).join(', ')}${a.missing.length>5?' and '+(a.missing.length-5)+' more':''}. Load NAV history and import stock history to build a reliable series.</p>`:''}</div>`;
 const latest=a.points[a.points.length-1],roll=a.roll.slice(-12),maxroll=roll.length?Math.max(...roll.map(x=>x.r)):null,minroll=roll.length?Math.min(...roll.map(x=>x.r)):null;
 const metric=(l,v)=>`<div><small>${l}</small><b>${v}</b></div>`;
 const dd=a.dd.slice(-36),lo=Math.min(0,...dd.map(x=>x.dd)),hi=Math.max(0,...dd.map(x=>x.dd));
 const chart=dd.length>1?`<div class='ur'><span>Maximum drawdown over available continuous history</span><b class='l'>${pc(a.mdd)}</b></div><div class='stk' style='height:12px;background:var(--line);overflow:hidden'><i style='width:${Math.min(100,Math.abs(a.mdd))}%;background:var(--loss)'></i></div><div class='ur'><small>Current drawdown</small><b class='${dd[dd.length-1].dd<0?'l':'g'}'>${pc(dd[dd.length-1].dd*100)}</b></div>`:'';
 return `<h2>Portfolio risk & rolling returns</h2><div class='card pad'><div class='kv c3'>${metric('Annualised volatility',pc(a.vol))}${metric('Sharpe ratio',a.sh==null?'–':a.sh.toFixed(2))}${metric('Sortino ratio',a.so==null?'–':a.so.toFixed(2))}${metric('Maximum drawdown',pc(a.mdd))}${metric('Best month',pc(a.best))}${metric('Worst month',pc(a.worst))}${metric('Downside deviation (annualised)',pc(a.downsideVol))}${metric('Negative months',a.negativeMonths+' / '+months)}</div><p class='mut' style='margin-top:12px'>${months<12?'Preliminary estimates: fewer than 12 complete months. ':''}Based on ${months} complete monthly portfolio return periods through ${fd(latest.d)}. Returns are cash-flow-adjusted using a monthly Modified Dietz approximation, then geometrically linked. Risk-free rate assumption: ${a.rf.toFixed(1)}% a year.</p>${chart}${a.roll.length?`<h3 style='margin:16px 0 6px'>Rolling 1-year returns</h3><div class='ur'><span>Best in available rolling windows</span><b class='g'>${pc(maxroll)}</b></div><div class='ur'><span>Worst in available rolling windows</span><b class='${minroll<0?'l':'g'}'>${pc(minroll)}</b></div><div class='ur'><span>Latest rolling 1-year</span><b class='${a.roll[a.roll.length-1].r<0?'l':'g'}'>${pc(a.roll[a.roll.length-1].r)}</b></div>`:`<p class='mut'>Rolling 1-year returns need at least 13 complete monthly valuation points.</p>`}<p class='mut note'>These are portfolio-level estimates, not a daily time-weighted return. Missing/stale prices are excluded rather than fabricated. Benchmark comparison is not included until a compatible benchmark history can be aligned to the same dates.</p></div>`;
}


// Phase 3: local performance attribution and concentration analysis.
// Realised profit uses the app's existing FIFO/fee-aware tax-lot engine.
function paAttribution(C){return financialFeatures.attribution(C,realized())}
function portfolioAttributionTile(C){
 const a=paAttribution(C),fmt=n=>cr(n),row=x=>`<div class='ur' style='gap:8px'><span style='flex:1;min-width:0;text-align:left;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>${esc(x.name)} <small class='mut'>${x.value>0?x.weight.toFixed(1)+'% of portfolio':'closed'}</small></span><b class='${x.total>=0?'g':'l'}'>${x.total>=0?'+':''}${fmt(x.total)}</b></div>`;
 const leaders=a.rows.slice(0,4),laggards=[...a.rows].reverse().filter(x=>x.total<0).slice(0,3);
 return `<h2>Performance attribution & concentration</h2><div class='card pad'><div class='kv c3'><div><small>Realised gains</small><b class='${a.totalReal>=0?'g':'l'}'>${fmt(a.totalReal)}</b></div><div><small>Unrealised gains</small><b class='${a.totalUnreal>=0?'g':'l'}'>${fmt(a.totalUnreal)}</b></div><div><small>Combined gain</small><b class='${a.net>=0?'g':'l'}'>${fmt(a.net)}</b></div></div>
 ${leaders.length?`<h3 style='margin:16px 0 6px'>Holding contribution (realised + unrealised)</h3>${leaders.map(row).join('')}`:'<p class="mut">No holding-level gain data is available yet.</p>'}
 ${laggards.length?`<h3 style='margin:16px 0 6px'>Largest negative contributors</h3>${laggards.map(row).join('')}`:''}
 <h3 style='margin:16px 0 6px'>Concentration</h3><div class='ur'><span>Top 3 holdings</span><b>${a.top3.toFixed(1)}%</b></div><div class='ur'><span>Largest holding</span><b>${a.largest?esc(a.largest.name)+' · '+a.largest.weight.toFixed(1)+'%':'–'}</b></div><div class='ur'><span>Concentration index (HHI)</span><b>${a.hhi.toFixed(0)} / 10,000</b></div>
 <p class='mut note'>Attribution combines FIFO realised gains (including recorded transaction fees) with current unrealised gains on open positions. Closed holdings remain included. Concentration uses current market value only. This is profit attribution, not a formal Brinson sector attribution.</p></div>`;
}


// Phase 4: whole-portfolio benchmark intelligence. Benchmark histories are cached locally.
const PBMS=[{id:'nifty50',name:'Nifty 50',symbol:'^NSEI'},{id:'nifty500',name:'Nifty 500',symbol:'^CRSLDX'},{id:'midcap150',name:'Nifty Midcap 150',symbol:'^NSEMDCP150'},{id:'smallcap250',name:'Nifty Smallcap 250',symbol:'^NSESMCP250'},{id:'sensex',name:'Sensex',symbol:'^BSESN'}];
let PBMSEL='nifty50',PBMMSG='',PBMBUSY=false;
const PBM_ATTEMPTS={};
async function pbmLoad(id,force=false){
 const b=PBMS.find(x=>x.id===id);if(!b||PBMBUSY)return;
 if(!force&&Date.now()-(PBM_ATTEMPTS[id]||0)<3600000)return;
 PBM_ATTEMPTS[id]=Date.now();PBMBUSY=true;PBMMSG='Fetching '+b.name+' TRI history…';updatePbmUi();
 try{
 const cached=await pwGet('benchmark:'+id);
 if(!force&&cached?.source==='Automatic TRI provider'&&Date.now()-cached.updated<43200000){PBMMSG='Cached TRI history ready.';return}
 const rows=await marketProviders.benchmark.loadBenchmark(id,today(),cached);
 await pwPut('benchmark:'+id,'benchmark',{rows,series:'TRI'},'Automatic TRI provider');PBMMSG=b.name+' TRI ready.';
 }catch(e){PBMMSG='Automatic '+b.name+' history unavailable: '+e.message+'. Existing cache retained.'}
 finally{PBMBUSY=false;updatePbmUi();if(PBMSEL!==id)pbmLoad(PBMSEL)}
}
async function pbmRows(id){const x=await pwGet('benchmark:'+id);return x&&x.data&&x.data.rows||[]}
function pbmCalc(id,portfolio){return pbmRows(id).then(rows=>financialFeatures.benchmark(rows,portfolio,S.tx,dnum))}
async function portfolioBenchmarkTile(){const a=paBuild(),b=PBMS.find(x=>x.id===PBMSEL),cache=await pbmRows(PBMSEL);let c=null;if(cache.length)c=await pbmCalc(PBMSEL,a);const p=a.points||[],portRet=p.length>1?(p[p.length-1].index/p[0].index-1)*100:null;return `<h2>Whole-portfolio benchmark intelligence</h2><div class='card pad'><p class='mut'>Compare your complete portfolio with a market index using the same dated investment and redemption cash flows. Automatically load available TRI history and cache it locally. CSV import is optional.</p><div class='chips'>${PBMS.map(x=>`<button data-pbm='${x.id}' class='${PBMSEL===x.id?'on':''}'>${x.name}</button>`).join('')}</div>${PBMBUSY?`<p class='mut'>${esc(PBMMSG)}</p>`:c&&c.ready&&!c.missing&&c.points.length===p.length&&portRet!=null?`<div class='kv c3' style='margin-top:12px'><div><small>Portfolio return</small><b class='${portRet>=0?'g':'l'}'>${pc(portRet)}</b></div><div><small>${esc(b.name)} return</small><b class='${c.ret>=0?'g':'l'}'>${pc(c.ret)}</b></div><div><small>Relative difference</small><b class='${portRet-c.ret>=0?'g':'l'}'>${portRet-c.ret>=0?'+':''}${(portRet-c.ret).toFixed(2)} pp</b></div></div><p class='mut'>Aligned period: ${fd(p[0].d)} to ${fd(p[p.length-1].d)}. ${c.missing?c.missing+' benchmark dates were skipped due to missing/stale prices. ':''}Returns use monthly Modified Dietz cash-flow adjustment and are indicative, not a daily time-weighted index.</p>`:`<p class='mut' style='margin-top:12px'>${esc(PBMMSG||'No benchmark history cached yet. Load it to calculate a comparable return.')}</p>`}<p class='mut'>${esc(PBMMSG)} ${cache.length?'Latest cached date: '+cache[cache.length-1][0]:''}</p><a href='https://www.niftyindices.com/reports/historical-data' target='_blank' rel='noopener noreferrer'>Official NSE Indices downloads</a><label>Import CSV for ${esc(b.name)}<input type='file' accept='.csv,text/csv' data-india-bm='${b.id}'></label><button class='btn' data-a='pbmrefresh' ${PBMBUSY?'disabled':''}>${cache.length?'Refresh':'Load'} ${b.name} history</button><p class='mut note'>Use one index and one series type per CSV; importing replaces previous history. Verify the selected index before importing. Price-index returns exclude dividends; TRI includes reinvested dividends. Index returns exclude fund expense ratios, tracking error and investor taxes; the comparison is not an investable product return. Missing prices are not invented. Debt benchmark comparison is not included because a suitable verified debt-index series is not configured.</p></div>`}

function home(C){if(!C.open.length)return empty();const pg=portChg(C);
return(S.sample?`<div class='warn'>You’re viewing sample data.<button data-a='clear'>Clear it and start with your own</button></div>`:'')+`<section class='hero'><div class='hl'><span class='lab'>Current value</span>${pill(C.pl,ap(C.plp))}</div><h1>${cr(C.tv)}</h1><p class='sub'>${pg?`${pg.abs>=0?'▲':'▼'} ${cr(Math.abs(pg.abs))} (${ap(pg.pct)}) since ${fd(pg.since)}`:`${C.pl>=0?'Up':'Down'} ${cr(Math.abs(C.pl))} overall`}</p><div class='kp'><div><small>Invested</small><strong>${cr(C.tc)}</strong></div><div><small>Returns</small><strong>${cr(C.pl)}</strong><small>${pc(C.plp)}</small></div><div><small>XIRR</small><strong>${pc(C.xirr)}</strong><small>a year</small></div></div></section>
<div class='gap'>${priceCard(C)}</div>${perfTile(C)}${portfolioRiskTile()}${stressRiskTile(C)}${portfolioAttributionTile(C)}<div id="pbmw"><p class="mut">Loading benchmark comparison…</p></div><h2>If you redeemed today</h2><div class='card pad'>${redeemRows(redeemSim())}</div>${bmOverview(C)}<h2>Allocation</h2>${alloc(C)}${allocationPlanner(C)}${overlapCard()}${elssCard()}<h2>Worth a look</h2>${insights(C).map(([k,t])=>`<p class='ins ${k}'>${t}</p>`).join('')}<h2>Biggest holdings</h2><div class='list'>${[...C.open].sort((a,b)=>b.value-a.value).slice(0,5).map(h=>bar(h,C.tv)).join('')}</div><button class='btn ghost' data-t='list'>See all ${C.open.length} funds</button>`}

let lsort='value';
function list(C){const key={value:h=>h.value,ret:h=>h.plp==null?-1e9:h.plp,gain:h=>h.pl,xirr:h=>h.xirr==null?-1e9:h.xirr}[lsort],L=C.open.filter(h=>flt==='all'||h.type===flt).sort((a,b)=>key(b)-key(a)),tot=L.reduce((s,h)=>s+h.value,0);
return `<div class='chips'><button data-hist=''>All transactions</button><button data-a='prices'>Update prices</button>${elssData().length?`<button data-a='elss'>ELSS lock-in</button>`:''}</div><div class='seg'>${[['all','All'],['mf','Mutual funds'],['stock','Stocks']].map(([k,t])=>`<button class='${flt===k?'on':''}' data-f='${k}'>${t}</button>`).join('')}</div>${flt!=='stock'?holdingOverlap(C):''}<div class='srt'><span>Sort by</span>${[['value','Value'],['ret','Returns %'],['gain','Gain'],['xirr','XIRR']].map(([k,t])=>`<button data-s='${k}' class='${lsort===k?'on':''}'>${t}</button>`).join('')}</div><p class='mut' style='margin:0 4px 10px'>${L.length} fund${L.length===1?'':'s'} worth ${cr(tot)}</p><div class='list'>`+(L.map(h=>{const c=chgOf(h);return `<button class='hc' data-h='${esc(h.name)}'><div class='hct'>${av(h.name)}<div class='hm'><b>${esc(h.name)}</b><small>${c?(c.abs>=0?'▲ ':'▼ ')+cr(Math.abs(c.abs))+' ('+ap(c.pct)+') since '+fd(c.since):(+h.units.toFixed(3)).toLocaleString('en-IN')+' '+(h.type==='mf'?'units':'shares')+' at '+px(h.price)}</small></div>${pill(h.pl,ap(h.plp))}</div><div class='mg'><div><small>Invested</small><b>${cr(h.cost)}</b></div><div><small>Current</small><b>${cr(h.value)}</b></div><div><small>Total gain</small><b class='${cls(h.pl)}'>${cr(h.pl)}</b></div></div></button>`}).join('')||'<p class="mut">Nothing in this group yet.</p>')+`</div><p class='mut note'>Tap a fund for its chart, details and tax if redeemed.</p>`}

