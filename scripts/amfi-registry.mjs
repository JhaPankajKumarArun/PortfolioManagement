export function parseAmfiRegistry(text){
 const amcs=new Map(), schemes=new Map();let amc='',category='';
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim();if(!line)continue;
  const fields=line.split(';');
  if(fields.length===1){
   if(/^(open ended|close ended|interval fund)/i.test(line)){category=line;amc='';}
   else {amc=line;if(!amcs.has(amc))amcs.set(amc,{name:amc,codes:[]});}
   continue;
  }
  const [code,a,b,name]=fields.map(x=>x.trim());
  if(!/^\d+$/.test(code)||!name||!amc)continue;
  const isins=[...new Set([a,b].filter(x=>/^INF[A-Z0-9]{8}[0-9]$/.test(x)))];
  if(schemes.has(code))throw Error('Duplicate AMFI code '+code);
  schemes.set(code,{code,name,amc,category,isins});amcs.get(amc).codes.push(code);
 }
 return {amcs:[...amcs.values()].filter(x=>x.codes.length),schemes:[...schemes.values()]};
}
export function schemeIdentity(name){
 return String(name).toLowerCase().replace(/\b(?:direct|regular)\s+(?:plan|growth|idcw)\b/g,' ').replace(/\b(?:direct|regular|growth|plan|option|idcw|dividend|payout|reinvestment)\b/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
}
export function resolveScheme(registry,{code,isin,name,amc}){
 let matches=registry.schemes;
 if(code)matches=matches.filter(x=>x.code===String(code));
 if(isin)matches=matches.filter(x=>x.isins.includes(isin));
 if(amc)matches=matches.filter(x=>x.amc===amc);
 if(!code&&!isin){if(!name)return null;matches=matches.filter(x=>schemeIdentity(x.name)===schemeIdentity(name));}
 return matches.length===1?matches[0]:null;
}
