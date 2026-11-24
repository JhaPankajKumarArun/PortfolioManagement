import {refreshManager} from '../refresh.mjs';
import {fetchWithTimeout} from '../http.mjs';
async function amfiLatest(pd){let r;try{if(/^https?:$/.test(location.protocol)){const c=await fetchWithTimeout('./data/amfi-nav.txt',{cache:'no-cache'},5000);if(c.ok&&!(c.headers.get('content-type')||'').includes('text/html'))r=c;}}catch(e){}if(!r)r=await fetchWithTimeout('https://portal.amfiindia.com/spages/NAVAll.txt',{},15000);if(!r.ok)throw Error('AMFI HTTP '+r.status);const rows=(await r.text()).split(/\r?\n/).map(l=>l.split(';')).filter(c=>/^\d+$/.test(c[0])&&Number(c[4])>0&&pd(c[5]));if(!rows.length)throw Error('Invalid AMFI response');return rows.map(c=>({schemeCode:c[0],isinGrowth:c[1],isinDivReinvestment:c[2],schemeName:c[3],nav:c[4],date:c[5]}))}
async function indiaLatest(pd){try{return (await refreshManager.run('amfi',()=>amfiLatest(pd),{ttl:300000}))||null}catch(e){return null}}

export { amfiLatest,indiaLatest };
