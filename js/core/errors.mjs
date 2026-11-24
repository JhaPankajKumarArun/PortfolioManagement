const diagnostics=[];
const allowed=new Set(['startup','runtime','promise','network']);
export function recordError(category){const entry={category:allowed.has(category)?category:'runtime',time:new Date().toISOString()};diagnostics.push(entry);if(diagnostics.length>50)diagnostics.shift();return entry}
export function getDiagnostics(){return diagnostics.map(x=>({...x}))}
export function installErrorHandlers(target){target.addEventListener('error',()=>recordError('runtime'));target.addEventListener('unhandledrejection',()=>recordError('promise'))}
export function showStartupFailure(document){const node=document.querySelector('#app');if(node){node.textContent='Portfolio could not start. Reload the page and check your connection. Your saved data has not been erased.';node.setAttribute('role','alert')}}
