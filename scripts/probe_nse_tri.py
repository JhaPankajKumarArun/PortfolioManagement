import datetime as dt
import json
import math
import urllib.request
import urllib.error
import http.cookiejar

page = "https://www.niftyindices.com/reports/historical-data"
routes = ("/BackPage/getTotalReturnIndexString", "/Backpage.aspx/getTotalReturnIndexString")
host = "https://www.niftyindices.com"
names = ("NIFTY 50", "NIFTY 500", "NIFTY MIDCAP 150", "NIFTY SMALLCAP 250")
end = dt.date.today() - dt.timedelta(days=1)
start = end - dt.timedelta(days=14)
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
headers = {"User-Agent": "PortfolioManagement TRI connectivity test/1.0", "Accept": "application/json", "Content-Type": "application/json; charset=UTF-8", "X-Requested-With": "XMLHttpRequest", "Referer": page, "Origin": host}
def probe(route, fmt, name):
    payload = {"cinfo": "{'name':'%s','startDate':'%s','endDate':'%s','indexName':'%s'}" % (name,start.strftime(fmt),end.strftime(fmt),name)}
    req = urllib.request.Request(host+route, data=json.dumps(payload).encode(), headers=headers)
    with opener.open(req, timeout=20) as res:
        body = res.read(2000000)
        print("HTTP",res.status,"type",res.headers.get_content_type(),"URL",res.geturl(), "bytes",len(body),flush=True)
        if res.geturl()!=host+route: raise ValueError("Redirected")
        data=json.loads(body)
        if isinstance(data,dict): data=data.get("d")
        if isinstance(data,str): data=json.loads(data)
        if not isinstance(data,list): raise ValueError("Not an array")
        dates=set()
        for row in data:
            if row["Index Name"].strip().upper()!=name: raise ValueError("Index mismatch")
            date=dt.datetime.strptime(row["Date"].replace("-"," "),"%d %b %Y").date()
            v=float(row["TotalReturnsIndex"])
            if not start<=date<=end or not math.isfinite(v) or v<=0: raise ValueError("Invalid observation")
            dates.add(date)
        if len(dates)<2: raise ValueError("Insufficient observations")
        print("PASS",name,len(dates),min(dates),max(dates),flush=True)
try:
    with opener.open(urllib.request.Request(page,headers={"User-Agent":headers["User-Agent"]}),timeout=20) as res:
        print("Session",res.status,res.geturl())
except Exception as e:
    print("Session failed",str(e))
winner=None
for route in routes:
    for fmt in ("%d-%b-%Y","%d %b %Y"):
        print("PROBE",route,fmt,flush=True)
        try:
            probe(route,fmt,names[0])
            winner=(route,fmt)
            break
        except urllib.error.HTTPError as e:
            print("FAIL",e)
            if e.code in (401,403,429): raise SystemExit("Provider denied or limited access; stopping")
        except Exception as e:
            print("FAIL",type(e).__name__,str(e))
    if winner: break
if not winner: raise SystemExit("No verified endpoint")
for name in names[1:]: probe(*winner,name)
print("All four indices passed short-range connectivity only; long-range coverage and permissions remain unverified.")
