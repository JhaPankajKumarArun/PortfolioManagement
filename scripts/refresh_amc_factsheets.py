"""Conservative public factsheet extraction; no portfolio inputs."""
import datetime as dt
import json
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.parse import urljoin, urlparse
from factsheet_metrics import metrics
import requests
from bs4 import BeautifulSoup

ROOT = Path("data/factsheets/benchmarks.json")
DIRECTORY = "https://www.amfiindia.com/online-center/download-factsheets"
SEEDS = ["https://www.hdfcfund.com/mutual-funds/factsheets",
"https://www.assetmanagement.hsbc.co.in/en/mutual-funds/investor-resources?Doc=fund-factsheets",
"https://www.miraeassetmf.co.in/downloads/factsheet"]
HEADERS = {"User-Agent":"PortfolioManagement public factsheet reader/1.0"}
def load(url):
    if urlparse(url).scheme != "https": raise ValueError("HTTPS required")
    r = requests.get(url, headers=HEADERS, timeout=45)
    r.raise_for_status()
    return r
def norm(s):
    return re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
def scheme_name(s):
    return norm(re.split(r"\s+-\s+",s,maxsplit=1)[0])
def links(url):
    soup=BeautifulSoup(load(url).text,"html.parser")
    return [(urljoin(url,a["href"]),a.get_text(" ",strip=True)) for a in soup.select("a[href]")]
def extract(page, names):
    lines=[norm(x) for x in page.splitlines() if x.strip()]
    # Only accept a unique exact scheme heading and an explicit primary benchmark label.
    matches={n for n in names if n in lines}
    if len(matches)!=1:return None
    hits=re.findall(r"(?im)^\s*(?:AMFI\s+)?(?:Tier\s*I\s+)?Benchmark(?:\s+Index)?\s*[:\-]?\s*(Nifty\s+(?:50|500|Next\s+50|Midcap\s+150|Smallcap\s+250)\s*(?:\(\s*TRI\s*\)|TRI|Total Returns Index))\s*$",page)
    values={re.sub(r"\s+(?:\(\s*TRI\s*\)|TRI|Total Returns Index)$"," TRI",v,flags=re.I).strip() for v in hits}
    if len(values)!=1:return None
    return next(iter(matches)),next(iter(values))
def main():
    nav=load("https://www.amfiindia.com/spages/NAVAll.txt").text
    names={}
    for line in nav.splitlines():
        p=line.split(";")
        if len(p)>=6 and p[0].isdigit():
            names.setdefault(scheme_name(p[3]),[]).append((p[0],[x for x in p[1:3] if x.startswith("INF")]))
    prior=json.loads(ROOT.read_text()) if ROOT.exists() else {"schema":1,"schemes":{}}
    pages=set(SEEDS)
    try:
        for u,t in links(DIRECTORY):
            if "factsheet" in (u+" "+t).lower() and urlparse(u).hostname!=urlparse(DIRECTORY).hostname and not u.lower().endswith(".pdf"):pages.add(u)
    except requests.RequestException as e:print("Directory unavailable:",e)
    found={}
    for url in sorted(pages):
        try:
            pdfs=[(u,t) for u,t in links(url) if urlparse(u).path.lower().endswith(".pdf") and ("factsheet" in (u+" "+t).lower() or "the asset as on" in (u+" "+t).lower())]
            # Require explicit month/year, select newest dated documents.
            dated=[]
            for u,t in pdfs:
                m=re.search(r"(?i)\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s%_-]+(?:20)?(\d{2})\b",t)
                if m:
                    month=dt.datetime.strptime(m[1][:3].title(),"%b").month
                    dated.append((dt.date(2000+int(m[2]),month,1),u))
            if not dated:continue
            newest=max(d for d,u in dated)
            for date,u in sorted(set(dated),reverse=True):
                if date!=newest or date>dt.date.today():continue
                response=load(u)
                if not response.content.startswith(b"%PDF"):continue
                with tempfile.TemporaryDirectory() as tmp:
                    f=Path(tmp)/"factsheet.pdf";f.write_bytes(response.content)
                    content=subprocess.check_output(["pdftotext","-layout",str(f),"-"],timeout=90).decode("utf-8",errors="replace")
                import calendar
                asof=date.replace(day=calendar.monthrange(date.year,date.month)[1]).isoformat()
                if asof>dt.date.today().isoformat():continue
                for page in content.split("\f"):
                    match=extract(page,names)
                    if not match:continue
                    n,value=match
                    fields=metrics(page)
                    for code,isins in names[n]:
                        found.setdefault(code,[]).append({"name":value,"isins":isins,"source":u,"verifiedAsOf":asof,"metrics":fields})
        except Exception as e:print("Source failed:",url,str(e))
    for code,rows in found.items():
        latest=max(x["verifiedAsOf"] for x in rows)
        candidates=[x for x in rows if x["verifiedAsOf"]==latest]
        if len({norm(x["name"]) for x in candidates})!=1:continue
        old=prior["schemes"].get(code,{})
        if latest>=old.get("verifiedAsOf",""):
            chosen=candidates[0]
            if any(x["metrics"]!=chosen["metrics"] for x in candidates):continue
            history=dict(old.get("history",{}))
            if old.get("verifiedAsOf"):history[old["verifiedAsOf"]]={k:v for k,v in old.items() if k!="history"}
            history[latest]=dict(chosen)
            prior["schemes"][code]={**chosen,"history":history}
    print("Extracted candidates:",len(found),"catalog total:",len(prior["schemes"]))
    if not found:raise SystemExit("No unambiguous mappings extracted; prior catalog retained.")
    ROOT.parent.mkdir(parents=True,exist_ok=True)
    ROOT.write_text(json.dumps(prior,indent=2,sort_keys=True)+"\n")
if __name__=="__main__":main()
