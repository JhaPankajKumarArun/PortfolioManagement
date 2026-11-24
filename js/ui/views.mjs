const TT={home:'Overview',list:'Holdings',sips:'SIP tracker',plan:'Plan',swp:'SWP',time:'Time Machine',tax:'Tax',data:'Import and backup'};
export function renderView({document,tab,html,busy}){
 document.querySelector('#app').innerHTML=html;
 document.querySelector('#ttl').textContent=TT[tab]||'Portfolio';
 document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===tab));
 document.querySelector('#rfb').classList.toggle('spin',!!busy);
}
export function showSheet(document,h){document.querySelector('#sheet').innerHTML=`<div id="bd"><div class="sh" role="dialog" aria-modal="true">${h}</div></div>`}
export function hideSheet(document){document.querySelector('#sheet').innerHTML=''}
