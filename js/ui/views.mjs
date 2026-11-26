const TT={insights:'Insights',planning:'Planning',more:'More',home:'Overview',list:'Holdings',sips:'SIP tracker',plan:'Plan',swp:'SWP',time:'Time Machine',tax:'Tax',data:'Import and backup'};
export function renderView({document,tab,html,busy}){
 document.querySelector('#app').innerHTML=html;
 document.querySelector('#ttl').textContent=TT[tab]||'Portfolio';
 const parent={time:'insights',plan:'planning',sips:'planning',swp:'planning',tax:'more',data:'more'}[tab]||tab;
 document.querySelectorAll('#tabs button').forEach(b=>{const active=b.dataset.t===parent;b.classList.toggle('on',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')});
 document.querySelector('#rfb').classList.toggle('spin',!!busy);
}
export function showSheet(document,h){document.querySelector('#sheet').innerHTML=`<div id="bd"><div class="sh" role="dialog" aria-modal="true">${h}</div></div>`}
export function hideSheet(document){document.querySelector('#sheet').innerHTML=''}
