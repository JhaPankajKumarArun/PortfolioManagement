import {randomBytes,scryptSync,createCipheriv} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const {KITE_API_KEY,KITE_ACCESS_TOKEN,BROKER_EXPORT_PASSWORD}=process.env;
if(!KITE_API_KEY||!KITE_ACCESS_TOKEN||!BROKER_EXPORT_PASSWORD||BROKER_EXPORT_PASSWORD.length<24)throw Error('Missing required secrets or export password too short');
async function get(path){
 const r=await fetch('https://api.kite.trade'+path,{headers:{'X-Kite-Version':'3',Authorization:'token '+KITE_API_KEY+':'+KITE_ACCESS_TOKEN},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Broker request failed: HTTP '+r.status);
 const j=await r.json();if(j.status!=='success'||!Array.isArray(j.data))throw Error('Unexpected broker response');
 return j.data;
}
const [equity,mutualFunds]=await Promise.all([get('/portfolio/holdings'),get('/mf/holdings')]);
const snapshot={schema:'broker-snapshot-v1',broker:'zerodha',fetchedAt:new Date().toISOString(),data:{equity,mutualFunds}};
const salt=randomBytes(16),iv=randomBytes(12),key=scryptSync(BROKER_EXPORT_PASSWORD,salt,32);
const cipher=createCipheriv('aes-256-gcm',key,iv);
const encrypted=Buffer.concat([cipher.update(JSON.stringify(snapshot),'utf8'),cipher.final()]);
writeFileSync('broker-encrypted.json',JSON.stringify({schema:'broker-encrypted-v1',kdf:'scrypt',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}),{mode:0o600,flag:'wx'});
