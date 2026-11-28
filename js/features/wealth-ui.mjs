import {wealthFields,wealthSummary} from '../engines/wealth.mjs';
import {cr,esc} from '../core/format.mjs';
const labels={property:'Your share of property value',cash:'Cash and bank deposits outside tracked portfolio',otherAssets:'Other assets outside tracked portfolio',loans:'Total outstanding liabilities',income:'Monthly take-home income',expenses:'Monthly expenses excluding EMI',emi:'Monthly EMI and debt payments',emergency:'Emergency reserve included in cash above'};
export function wealthView(C,S){
 if(S.sample)return '<p class="mut">Clear sample data before entering your personal financial profile.</p>';
 const profile=S.wealthProfile;
 const p=wealthSummary(C.tv,profile);
 return `<h2>Net worth & financial health</h2><p class='mut'>Portfolio valuation uses recorded prices, which may be stale. Enter only your ownership share and avoid double counting. All figures are in rupees.</p>`+(p?`<section class='hero'><span class='lab'>Estimated net worth</span><h1>${cr(p.netWorth)}</h1><div class='kp two'><div><small>Total assets</small><strong>${cr(p.assets)}</strong></div><div><small>Liabilities</small><strong>${cr(p.liabilities)}</strong></div></div></section><div class='card pad'>${[['Tracked investments',cr(C.tv)],['Monthly surplus',cr(p.surplus)],['Emergency coverage',p.emergencyMonths===null?'N/A':p.emergencyMonths.toFixed(1)+' months'],['Six-month reserve gap',cr(p.emergencyGap)],['EMI / take-home income',p.emiRatio===null?'N/A':p.emiRatio.toFixed(2)+'%']].map(([k,v])=>`<div class='ur'><span>${k}</span><b>${v}</b></div>`).join('')}</div>`:'<p class="mut">Complete and save your financial profile to calculate net worth.</p>')+`<div class='card pad'>${wealthFields.map(k=>`<label>${labels[k]} (₹)<input type='number' min='0' step='any' id='wealth-${k}' value='${esc(profile?.[k]??'')}' placeholder='0 if none'></label>`).join('')}<button type='button' class='btn' id='wealthSave'>Save financial profile</button><p id='wealthStatus' role='status'></p><p class='mut'>Emergency reserve is a subset of cash, not an additional asset. Six months is an illustrative reserve target. Monthly surplus excludes new investment contributions.</p></div>`;
}
export function installWealth({doc,getState,getPortfolio,commit,render}){
 doc.addEventListener('click',e=>{
 if(!e.target.closest('#wealthSave'))return;
 const status=doc.getElementById('wealthStatus');
 try{const profile=Object.fromEntries(wealthFields.map(k=>{const v=doc.getElementById('wealth-'+k).value.trim();return [k,v===''?NaN:Number(v)]}));
 if(!wealthSummary(getPortfolio().tv,profile))throw Error('Enter non-negative amounts in every field; emergency reserve cannot exceed cash.');
 if(getState().sample)throw Error('Clear sample data first.');
 commit({...getState(),wealthProfile:profile});render();const next=doc.getElementById('wealthStatus');if(next)next.textContent='Financial profile saved locally.';
 }catch(err){if(status)status.textContent=err.message||'Unable to save financial profile.'}
 });
}
