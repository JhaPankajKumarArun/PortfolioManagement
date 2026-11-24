import {randomBytes,pbkdf2Sync,createCipheriv,createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const {KITE_API_KEY,KITE_API_SECRET,KITE_REQUEST_TOKEN,BROKER_EXPORT_PASSWORD}=process.env;
let KITE_ACCESS_TOKEN=process.env.KITE_ACCESS_TOKEN;
if(!KITE_API_KEY||(!KITE_ACCESS_TOKEN&&!(KITE_API_SECRET&&KITE_REQUEST_TOKEN))||!BROKER_EXPORT_PASSWORD||BROKER_EXPORT_PASSWORD.length<24)throw Error('Missing required secrets or export password too short');
if(KITE_REQUEST_TOKEN){
 if(!KITE_API_SECRET)throw Error('API secret required for request token exchange');
 const checksum=createHash('sha256').update(KITE_API_KEY+KITE_REQUEST_TOKEN+KITE_API_SECRET).digest('hex');
 const response=await fetch('https://api.kite.trade/session/token',{method:'POST',headers:{'X-Kite-Version':'3','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({api_key:KITE_API_KEY,request_token:KITE_REQUEST_TOKEN,checksum}),redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('Session exchange failed: HTTP '+response.status);
 const result=await response.json();
 if(result.status!=='success'||typeof result.data?.access_token!=='string'||!result.data.access_token)throw Error('Invalid session response');
 KITE_ACCESS_TOKEN=result.data.access_token;
}
async function get(path){
 const r=await fetch('https://api.kite.trade'+path,{headers:{'X-Kite-Version':'3',Authorization:'token '+KITE_API_KEY+':'+KITE_ACCESS_TOKEN},redirect:'error',signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error(r.status===401||r.status===403?'Broker authorization expired or denied; renew credentials':'Broker request failed: HTTP '+r.status);
 const j=await r.json();if(j.status!=='success'||!Array.isArray(j.data))throw Error('Unexpected broker response');
 return j.data;
}
const [equity,mutualFunds]=await Promise.all([get('/portfolio/holdings'),get('/mf/holdings')]);
const snapshot={schema:'broker-snapshot-v1',broker:'zerodha',fetchedAt:new Date().toISOString(),data:{equity,mutualFunds}};
const salt=randomBytes(16),iv=randomBytes(12),key=pbkdf2Sync(BROKER_EXPORT_PASSWORD,salt,600000,32,'sha256');
const cipher=createCipheriv('aes-256-gcm',key,iv);
const encrypted=Buffer.concat([cipher.update(JSON.stringify(snapshot),'utf8'),cipher.final()]);
writeFileSync('broker-encrypted.json',JSON.stringify({schema:'broker-encrypted-v1',kdf:'pbkdf2-sha256',iterations:600000,salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:encrypted.toString('base64')}),{mode:0o600,flag:'wx'});
