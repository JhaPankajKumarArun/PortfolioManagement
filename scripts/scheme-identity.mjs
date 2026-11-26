// Candidate groups are not proof of a shared portfolio.
export function underlyingName(name){
 return String(name).normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
 .replace(/(?:\s+(?:direct|regular)(?:\s+plan)?|\s+(?:growth|idcw|dividend)(?:\s+(?:option|payout|reinvestment))?|\s+plan|\s+option)+$/g,'').trim();
}
export function buildIdentityCandidates(registry){
 const groups=new Map();
 for(const s of registry.schemes){
  const key=JSON.stringify([s.amc,s.category,underlyingName(s.name)]);
  if(!groups.has(key))groups.set(key,{key,amc:s.amc,category:s.category,name:underlyingName(s.name),plans:[]});
  groups.get(key).plans.push({code:s.code,name:s.name,isins:s.isins});
 }
 return [...groups.values()].map(g=>({...g,status:'candidate'}));
}
export function resolveVerifiedPlan(registry, mappings, {code,isin}){
 if(!code&&!isin)return null;
 const plans=registry.schemes.filter(s=>(!code||s.code===String(code))&&(!isin||s.isins.includes(isin)));
 if(plans.length!==1)return null;
 const plan=plans[0];
 const matches=mappings.filter(m=>m.amc===plan.amc&&m.verified===true&&typeof m.source==='string'&&m.source.startsWith('https://')&&m.planCodes.includes(plan.code));
 return matches.length===1?matches[0]:null;
}
