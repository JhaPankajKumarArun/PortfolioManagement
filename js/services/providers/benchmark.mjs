export async function loadBenchmark(id,asOf,cached){
 const r=await fetch('./data/benchmarks/'+id+'.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
 if(!r.ok)throw Error('Provider HTTP '+r.status);
 const j=await r.json();if(j.id!==id||j.series!=='TRI'||!Array.isArray(j.rows))throw Error('Unexpected benchmark series');
 const rows=j.rows.filter(x=>Array.isArray(x)&&/^\d{4}-\d{2}-\d{2}$/.test(x[0])&&x[0]<=asOf&&typeof x[1]==='number'&&Number.isFinite(x[1])&&x[1]>0);
 if(rows.length!==j.rows.length||rows.length<2||rows.some((x,i)=>i&&x[0]<=rows[i-1][0]))throw Error('Invalid benchmark history');
 if(cached?.data?.rows?.length&&rows[rows.length-1][0]<cached.data.rows[cached.data.rows.length-1][0])throw Error('Provider history is older than local cache');

return rows;
}
