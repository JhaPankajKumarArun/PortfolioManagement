// Source configuration is independent of user portfolios.
export const officialSources=Object.freeze([
 {id:'ppfas',names:['PPFAS Mutual Fund'],page:'https://amc.ppfas.com/downloads/portfolio-disclosure/',hosts:['amc.ppfas.com'],strategy:'html-links',formats:['xlsx'],adapter:'ppfas',status:'experimental'}
]);
export function normalizeAmc(name){return String(name).toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
export function buildSourceRegistry(registry,sources=officialSources){
 return registry.amcs.map(amc=>{
  const matches=sources.filter(s=>s.names.some(n=>normalizeAmc(n)===normalizeAmc(amc.name)));
  return {amc:amc.name,schemeCount:amc.codes.length,source:matches.length===1?matches[0]:null,status:matches.length===1?matches[0].status:matches.length?'ambiguous':'unconfigured'};
 });
}
export function allowedDownload(source,url){
 try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&source.hosts.includes(u.hostname)&&source.formats.some(f=>u.pathname.toLowerCase().endsWith('.'+f));}catch{return false}
}
