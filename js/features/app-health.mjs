import {diagnosticSummary,clearDiagnostics} from '../core/errors.mjs';
import {esc} from '../core/format.mjs';
export function installAppHealth({document,getTiming}){

function updateAppHealth(){
 const root=document.getElementById('app-health-report');if(!root)return;
 const renderTiming=getTiming(),report=diagnosticSummary(),labels={startup:'Startup',runtime:'Runtime',promise:'Async operation',network:'Network',render:'Rendering',storage:'Storage',cache:'Market cache',conflict:'Concurrent save'};
 root.innerHTML='<p><b>'+report.count+'</b> recent diagnostic events (maximum 50)</p><p>Render calls: '+renderTiming.count+' · Last: '+renderTiming.last.toFixed(1)+' ms · Slowest: '+renderTiming.max.toFixed(1)+' ms</p>'+Object.entries(report.counts).map(([k,v])=>`<div class="ur"><span>${labels[k]}</span><b>${v}</b></div>`).join('')+report.events.slice(0,10).map(e=>`<div class="ur"><span>${labels[e.category]}</span><small>${esc(e.time)}</small></div>`).join('')+'<p class="mut">Network failures can occur offline. For storage or conflict errors, copy a backup before reloading.</p>';
}
document.addEventListener('click',e=>{if(e.target.closest('#app-health-clear')){clearDiagnostics();updateAppHealth()}else if(e.target.closest('#app-health-refresh'))updateAppHealth()});

return updateAppHealth;
}
