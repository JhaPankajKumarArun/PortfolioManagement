const TT={wealth:'Net worth',insights:'Insights',planning:'Planning',more:'More',home:'Overview',list:'Holdings',sips:'SIP tracker',plan:'Plan',swp:'SWP',time:'Time Machine',tax:'Tax',data:'Import and backup'};
export function renderView({document,tab,html,busy}){
 document.querySelector('#app').innerHTML=html;
 document.querySelector('#ttl').textContent=TT[tab]||'Portfolio';
 const parent={wealth:'more',time:'insights',plan:'planning',sips:'planning',swp:'planning',tax:'more',data:'more'}[tab]||tab;
 const back=document.createElement('button');back.type='button';back.className='context-back';back.dataset.t=parent;back.textContent='‹ Back to '+(TT[parent]||parent);if(parent!==tab)document.querySelector('#app').prepend(back);
 document.querySelectorAll('#tabs button').forEach(b=>{const active=b.dataset.t===parent;b.classList.toggle('on',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.querySelector('#rfb').classList.toggle('spin',!!busy);
}
const sheetState=new WeakMap();
export function showSheet(document,h){
 const root=document.querySelector('#sheet');if(!sheetState.has(document)){
 const previous=document.activeElement;
 const key=e=>{const dialog=root.querySelector('[role=dialog]');if(!dialog)return;if(e.key==='Escape'){e.preventDefault();hideSheet(document);return}if(e.key!=='Tab')return;const items=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex="0"]')].filter(x=>x.getClientRects().length);if(!items.length){e.preventDefault();dialog.focus();return}const first=items[0],last=items[items.length-1];if(e.shiftKey&&(document.activeElement===first||!items.includes(document.activeElement))){e.preventDefault();last.focus()}else if(!e.shiftKey&&(document.activeElement===last||!items.includes(document.activeElement))){e.preventDefault();first.focus()}};
 sheetState.set(document,{previous,key});document.addEventListener('keydown',key);
 }
 root.innerHTML=`<div id="bd"><div class="sh" role="dialog" aria-modal="true" aria-label="Portfolio details" tabindex="-1">${h}</div></div>`;
 root.querySelector('[role=dialog]').focus({preventScroll:true});
}
export function hideSheet(document){document.querySelector('#sheet').innerHTML='';const state=sheetState.get(document);if(state){document.removeEventListener('keydown',state.key);sheetState.delete(document);if(state.previous?.isConnected)state.previous.focus({preventScroll:true})}}
