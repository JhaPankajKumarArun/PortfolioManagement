import os, traceback, urllib.error, json, urllib.request, datetime as d, pathlib, math, time
import http.cookiejar, re
today=d.date.today()
page="https://www.niftyindices.com/reports/historical-data"
agent="PortfolioManagement TRI connectivity test/1.0"
opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def warm_session():
    with opener.open(urllib.request.Request(page,headers={"User-Agent":agent,"Accept":"text/html"}),timeout=30) as response:
        print("Session page:",response.status,response.geturl(),flush=True)
        response.read()

root=pathlib.Path(__file__).resolve().parents[1]/'data'/'benchmarks'
root.mkdir(parents=True,exist_ok=True)
urls=["https://www.niftyindices.com/BackPage/getTotalReturnIndexString","https://www.niftyindices.com/Backpage.aspx/getTotalReturnIndexString"]
names={"nifty500":"NIFTY 500","nifty50":"NIFTY 50","midcap150":"NIFTY MIDCAP 150","smallcap250":"NIFTY SMALLCAP 250"}
def fetch_endpoint(url,name,start,end):
    payload={"cinfo":"{'name':'%s','startDate':'%s','endDate':'%s','indexName':'%s'}"%(name,start.strftime("%d-%b-%Y"),end.strftime("%d-%b-%Y"),name)}
    req=urllib.request.Request(url,data=json.dumps(payload).encode(),headers={"Content-Type":"application/json; charset=UTF-8","X-Requested-With":"XMLHttpRequest","Referer":"https://www.niftyindices.com/reports/historical-data","User-Agent":agent,"Accept":"application/json","Origin":"https://www.niftyindices.com"})
    print(f"Requesting {url}: {name}: {start} to {end}", flush=True)
    try:
        with opener.open(req,timeout=45) as response:
            print(f"HTTP {response.status}; content type {response.headers.get('Content-Type')}", flush=True)
            body=response.read()
            if response.geturl()!=url:
                raise RuntimeError("Unexpected redirect: "+response.geturl())
            try:
                payload_response=json.loads(body)
            except (ValueError,UnicodeError) as exc:
                raise RuntimeError("Response is not valid JSON; content type "+response.headers.get_content_type()) from exc
            raw=payload_response.get("d") if isinstance(payload_response,dict) else payload_response
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"{name}: HTTP {exc.code} {exc.reason}") from exc
    rows=json.loads(raw) if isinstance(raw,str) else raw
    out={}
    for row in rows:
        if row["Index Name"].strip().upper()!=name: raise ValueError("Index mismatch")
        date=d.datetime.strptime(row["Date"].replace("-"," "),"%d %b %Y").date()
        value=float(row["TotalReturnsIndex"])
        if not start<=date<=end or not math.isfinite(value) or value<=0: raise ValueError("Invalid TRI")
        out[date.isoformat()]=value
    if len(out)<2: raise ValueError("Insufficient TRI observations")
    return out
def fetch(name,start,end):
    failures=[]
    for url in list(urls):
        try:
            rows=fetch_endpoint(url,name,start,end)
            urls.remove(url)
            urls.insert(0,url)
            print(f"Validated {len(rows)} TRI observations from {url}",flush=True)
            return rows
        except Exception as exc:
            failures.append(f"{url}: {exc}")
            if isinstance(exc.__cause__,urllib.error.HTTPError) and exc.__cause__.code in (401,403,429):
                raise
            print("Endpoint failed:",failures[-1],flush=True)
    raise RuntimeError("; ".join(failures))
failed=[]
try:
    warm_session()
except Exception as e:
    print('Session initialization failed:',repr(e),flush=True)
for id,name in names.items():
    try:
        path=root/(id+".json")
        old=json.loads(path.read_text()) if path.exists() else {}
        rows=dict(old.get("rows",[])) if old.get("source")=="NSE Indices gross TRI" and old.get("id")==id else {}
        begin=today-d.timedelta(days=365*6+10)
        if rows and min(rows)<=begin.isoformat():
            begin=max(begin,d.date.fromisoformat(max(rows))-d.timedelta(days=14))
        while begin<=today:
            end=min(today,begin+d.timedelta(days=364))
            rows.update(fetch(name,begin,end))
            begin=end+d.timedelta(days=1)
            time.sleep(1)
        if len(rows)<1100 or min(rows)>(today-d.timedelta(days=365*5+7)).isoformat() or max(rows)<(today-d.timedelta(days=7)).isoformat(): raise ValueError("Incomplete or stale history")
        result={"id":id,"series":"TRI","source":"NSE Indices gross TRI","rows":sorted(rows.items())}
        tmp=path.with_suffix(".tmp")
        tmp.write_text(json.dumps(result,separators=(",",":"))+"\n")
        tmp.replace(path)
        print(id,len(rows),max(rows))
    except Exception as e:
        failed.append(id)
        print(id,"FAILED",repr(e),flush=True)
        traceback.print_exc()
        summary=os.environ.get("GITHUB_STEP_SUMMARY")
        if summary:
            with open(summary,"a") as f:
                f.write(f"- {id}: {type(e).__name__}: {e}\n")
if failed: raise SystemExit("Failed indices: "+", ".join(failed))
