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
    return re.sub(r"\s+(?:direct|regular|growth|idcw|dividend)\b.*$","",norm(s))
def links(url):
    soup=BeautifulSoup(load(url).text,"html.parser")
    return [(urljoin(url,a["href"]),a.get_text(" ",strip=True)) for a in soup.select("a[href]")]
def extract(page, names):
    lines=[norm(x) for x in page.splitlines() if x.strip()]
    # Only accept a unique exact scheme heading and an explicit primary benchmark label.
    matches={n for n in names if n in lines}
    if not matches:
        # Layout extraction can place a heading beside another column.
        matches={n for n in names if any(line.startswith(n+" ") for line in lines[:12])}
        matches={n for n in matches if not any(m.startswith(n+" ") for m in matches)}
    if len(matches)!=1:return None
    hits=re.findall(r"(?im)^\s*(?:AMFI\s+)?(?:Tier\s*I\s+)?Benchmark(?:\s+Index)?\s*[:\-]?\s*(Nifty\s+(?:50|500|Next\s+50|Midcap\s+150|Smallcap\s+250)\s*(?:\(\s*TRI\s*\)|TRI|Total Returns Index))\s*$",page)
    values={re.sub(r"\s+(?:\(\s*TRI\s*\)|TRI|Total Returns Index)$"," TRI",v,flags=re.I).strip() for v in hits}
    if len(values)!=1:return None
    return next(iter(matches)),next(iter(values))
def hsbc_profile(page,names):
    lines=[line.strip() for line in page.splitlines() if line.strip()]
    if not lines:return None
    name=norm(lines[0])
    if not name.startswith("hsbc ") or name not in names:return None
    if not any(line.startswith("Type of Scheme:") for line in lines[:8]):return None
    hits=set()
    for line in lines:
        m=re.match(r"(?i)^Benchmark Name:\s*(.+)$",line)
        if m:
            value=re.split(r"\s{2,}",m[1],maxsplit=1)[0].strip()
            # Accept only complete, explicitly identified TRI labels until other layouts are verified.
            if re.fullmatch(r"(?:Nifty|BSE|MSCI)\s+[A-Za-z0-9 &:/().+%-]+?\s+TRI",value,re.I) and not re.search(r"annualised|returns|benchmark|[+%]",value,re.I):hits.add(value)
    if len(hits)==1:return name,hits.pop()
    return None

def hsbc_benchmarks(page,names):
    # Comparative performance tables explicitly distinguish primary and additional benchmarks.
    pattern=r"(?im)^\s*(HSBC[^\n]+?)\s*-\s*(?:Direct|Regular)\s+Plan\s*~~\s*Inception Date:[^\n]*"
    headings=list(re.finditer(pattern,page))
    for i,h in enumerate(headings):
        name=norm(h[1])
        if name not in names:continue
        block=page[h.end():headings[i+1].start() if i+1<len(headings) else len(page)]
        hits={re.sub(r"\s+"," ",x).strip() for x in re.findall(r"Scheme Benchmark\s*\(([^()]{1,120})\)",block,re.I)}
        if len(hits)==1:
            value=hits.pop()
            if re.fullmatch(r"[A-Za-z0-9 &:/.-]+",value):yield name,value

def main():
    nav=load("https://www.amfiindia.com/spages/NAVAll.txt").text
    names={}
    for line in nav.splitlines():
        p=line.split(";")
        if len(p)>=6 and p[0].isdigit():
            names.setdefault(scheme_name(p[3]),[]).append((p[0],[x for x in p[1:3] if x.startswith("INF")]))
    print("AMFI normalized schemes:",len(names),flush=True)
    print("HSBC catalog names:",[n for n in names if n.startswith("hsbc ")],flush=True)
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
                m=re.search(r"(?i)\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s%_-]+(?:20)?(\d{2})\b",t+" "+u.replace("%20"," "))
                if m:
                    month=dt.datetime.strptime(m[1][:3].title(),"%b").month
                    dated.append((dt.date(2000+int(m[2]),month,1),u))
            print("Discovery:",url,"PDF links:",len(pdfs),"dated:",len(dated),flush=True)
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
                print("PDF:",u,"pages:",len(content.split("\f")),"characters:",len(content),flush=True)
                if urlparse(u).hostname=="www.assetmanagement.hsbc.co.in":
                    samples=0
                    for number,page in enumerate(content.split("\f"),1):
                        lines=page.splitlines()
                        relevant=[i for i,line in enumerate(lines) if re.search(r"scheme benchmark|hsbc small cap fund|inception date",line,re.I)]
                        if not relevant:continue
                        if samples>=8:break
                        print("HSBC layout sample page",number,flush=True)
                        indices=set(range(min(8,len(lines))))
                        for i in relevant[:6]:indices.update(range(max(0,i-1),min(len(lines),i+3)))
                        for i in sorted(indices):print(repr(lines[i][:350]),flush=True)
                        samples+=1
                matched_pages=0
                for page in content.split("\f"):
                    match=extract(page,names)
                    rows=[(match[0],match[1],metrics(page))] if match else []
                    if urlparse(u).hostname=="www.assetmanagement.hsbc.co.in":
                        profile=hsbc_profile(page,names)
                        if profile:
                            fields=metrics(page)
                            rows.append((profile[0],profile[1],fields))
                            print("Profile:",profile[0],"benchmark:",profile[1],"metrics:",sorted(fields),flush=True)
                            for line in page.splitlines():
                                if re.search(r"AUM|expense ratio|sharpe|sortino|standard deviation|turnover|beta|date of inception",line,re.I):
                                    print("Metric layout:",repr(line[:300]),flush=True)
                    for n,value,fields in rows:
                        matched_pages+=1
                        for code,isins in names[n]:
                            found.setdefault(code,[]).append({"name":value,"isins":isins,"source":u,"verifiedAsOf":asof,"metrics":fields})
                print("Matched pages:",matched_pages,flush=True)
        except Exception as e:print("Source failed:",url,str(e),flush=True)
    for code,rows in found.items():
        latest=max(x["verifiedAsOf"] for x in rows)
        candidates=[x for x in rows if x["verifiedAsOf"]==latest]
        if len({norm(x["name"]) for x in candidates})!=1:continue
        old=prior["schemes"].get(code,{})
        if latest>=old.get("verifiedAsOf",""):
            chosen=max(candidates,key=lambda x:len(x["metrics"]))
            if any(x["metrics"] and x["metrics"]!=chosen["metrics"] for x in candidates):continue
            history=dict(old.get("history",{}))
            if old.get("verifiedAsOf"):history[old["verifiedAsOf"]]={k:v for k,v in old.items() if k!="history"}
            history[latest]=dict(chosen)
            prior["schemes"][code]={**chosen,"history":history}
    print("Extracted candidates:",len(found),"catalog total:",len(prior["schemes"]))
    if not found:raise SystemExit("No unambiguous mappings extracted; prior catalog retained.")
    ROOT.parent.mkdir(parents=True,exist_ok=True)
    ROOT.write_text(json.dumps(prior,indent=2,sort_keys=True)+"\n")
if __name__=="__main__":main()
