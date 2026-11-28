"""Conservative public factsheet extraction; no portfolio inputs."""
import datetime as dt
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse
from factsheet_schema import validate_fields
from factsheet_catalog import build_catalog
from factsheet_adapters import adapter_for, extract, hsbc_profile
import requests
from bs4 import BeautifulSoup

ROOT = Path("data/factsheets/benchmarks.json")
from factsheet_sources import DIRECTORY, SOURCES, FALLBACKS, is_pdf, dated_pdf
HEADERS = {"User-Agent":"PortfolioManagement public factsheet reader/1.0"}
def load(url):
    if urlparse(url).scheme != "https": raise ValueError("HTTPS required")
    for attempt in range(3):
        try:
            r = requests.get(url, headers=HEADERS, timeout=(15,45))
            r.raise_for_status()
            return r
        except (requests.ConnectionError, requests.Timeout, requests.HTTPError) as exc:
            if isinstance(exc,requests.HTTPError) and exc.response.status_code not in (429,500,502,503,504):raise
            if attempt==2:raise
            print("Retry",attempt+1,url,type(exc).__name__,flush=True)
            time.sleep(2**(attempt+1))
def norm(s):
    return re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
def scheme_name(s):
    return re.sub(r"\s+(?:direct|regular|growth|idcw|dividend)\b.*$","",norm(s))
def links(url):
    soup=BeautifulSoup(load(url).text,"html.parser")
    return [(urljoin(url,a["href"]),a.get_text(" ",strip=True)) for a in soup.select("a[href]")]
def main():
    cache=ROOT.with_name("amfi-nav-catalog.txt")
    try:
        nav=load("https://www.amfiindia.com/spages/NAVAll.txt").text
        if sum(line.split(";")[0].isdigit() for line in nav.splitlines())<1000:
            raise ValueError("Invalid or incomplete AMFI catalog")
        cache.parent.mkdir(parents=True,exist_ok=True)
        cache.write_text(nav,encoding="utf-8")
        nav_status="live"
    except (requests.RequestException,ValueError) as exc:
        if not cache.exists():raise RuntimeError("AMFI unavailable and no validated cache exists; previous factsheets retained") from exc
        nav=cache.read_text(encoding="utf-8")
        if sum(line.split(";")[0].isdigit() for line in nav.splitlines())<1000:raise ValueError("Invalid cached AMFI catalog")
        nav_status="cached"
        print("AMFI unavailable; using last validated public catalog",flush=True)
    names={}
    amcs={}
    current_amc=None
    for line in nav.splitlines():
        p=line.split(";")
        if ";" not in line and re.search(r"\bMutual Fund\s*$",line.strip(),re.I):
            current_amc=line.strip()
        if len(p)>=6 and p[0].isdigit():
            if current_amc:amcs.setdefault(current_amc,set()).add(p[0])
            names.setdefault(scheme_name(p[3]),[]).append((p[0],[x for x in p[1:3] if x.startswith("INF")]))
    print("AMFI normalized schemes:",len(names),flush=True)
    print("HSBC catalog names:",[n for n in names if n.startswith("hsbc ")],flush=True)
    prior=json.loads(ROOT.read_text()) if ROOT.exists() else {"schema":1,"schemes":{}}
    pages=set(SOURCES.values()) | set(FALLBACKS)
    try:
        for u,t in links(DIRECTORY):
            if "factsheet" in (u+" "+t).lower() and urlparse(u).hostname!=urlparse(DIRECTORY).hostname and urlparse(u).scheme=="https":pages.add(u)
    except requests.RequestException as e:print("Directory unavailable:",e)
    found={}
    report={"sources":[],"documents":[],"acceptedCodes":0,"amfiCatalogStatus":nav_status}
    for url in sorted(pages):
        source={"url":url,"status":"pending","pdfLinks":0,"datedLinks":0}
        report['sources'].append(source)
        try:
            pdfs=[(url,"")] if is_pdf(url) else [(u,t) for u,t in links(url) if is_pdf(u)]
            dated=[d for u,t in pdfs if (d:=dated_pdf(u,t,dt.date.today()))]
            print("Discovery:",url,"PDF links:",len(pdfs),"dated:",len(dated),flush=True)
            source.update(pdfLinks=len(pdfs),datedLinks=len(dated),status='discovered' if dated else 'no_dated_pdf')
            if not dated:continue
            newest=max(d for d,u in dated)
            for date,u in sorted(set(dated),reverse=True):
                if date!=newest or date>dt.date.today():continue
                doc={'url':u,'status':'downloading'}
                report['documents'].append(doc)
                response=load(u)
                if not response.content.startswith(b"%PDF"):
                    doc["status"]="not_pdf"
                    continue
                with tempfile.TemporaryDirectory() as tmp:
                    f=Path(tmp)/"factsheet.pdf";f.write_bytes(response.content)
                    content=subprocess.check_output(["pdftotext","-layout",str(f),"-"],timeout=90).decode("utf-8",errors="replace")
                import calendar
                asof=date.replace(day=calendar.monthrange(date.year,date.month)[1]).isoformat()
                if asof>dt.date.today().isoformat():continue
                print("PDF:",u,"pages:",len(content.split("\f")),"characters:",len(content),flush=True)
                # Bounded layout evidence for all accessible AMC documents.
                samples=0
                for number,page in enumerate(content.split("\f"),1):
                    lines=page.splitlines()
                    relevant=[i for i,line in enumerate(lines) if re.search(r"\b(?:benchmark|fund manager|assets under management|average aum|expense ratio|standard deviation)\b",line,re.I)]
                    if not relevant:continue
                    if samples>=8:break
                    print("Layout sample",urlparse(u).hostname,"page",number,flush=True)
                    indices=set(range(min(10,len(lines))))
                    for i in relevant[:8]:indices.update(range(max(0,i-1),min(len(lines),i+3)))
                    for i in sorted(indices):print(repr(lines[i][:350]),flush=True)
                    samples+=1
                adapter=adapter_for(u)
                coverage=set()
                field_codes={}
                codes=set()
                matched_names=set()
                matched_pages=0
                for page in content.split("\f"):
                    rows=adapter.rows(page,names)
                    for name,benchmark,fields in rows:
                        matched_names.add(name)
                    for n,value,fields in rows:
                        validated=validate_fields(fields,asof)
                        if set(fields)-set(validated):print('Rejected fields:',n,sorted(set(fields)-set(validated)),flush=True)
                        fields=validated
                        coverage.update(fields.keys())
                        matched_pages+=1
                        for code,isins in names[n]:
                            codes.add(code)
                            for key in fields:field_codes.setdefault(key,set()).add(code)
                            found.setdefault(code,[]).append({"name":value,"isins":isins,"source":u,"verifiedAsOf":asof,"metrics":fields})
                doc.update(status="extracted" if codes else "no_matches",adapter=adapter.name,reportingMonth=asof,distinctSchemes=len(matched_names),candidateCodes=len(codes),fieldCodeCounts={k:len(v) for k,v in field_codes.items()})
                print("Matched pages:",matched_pages,"adapter:",adapter.name,"distinct schemes:",len(matched_names),"fields:",sorted(coverage),flush=True)
        except Exception as e:
            source.update(status="failed",errorType=type(e).__name__)
            print("Source failed:",url,str(e),flush=True)
    accepted=0
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
            accepted+=1
    print("Extracted candidates:",len(found),"catalog total:",len(prior["schemes"]))
    report["amcUniverse"]=[{"name":name,"amfiCodes":len(codes),
        "catalogCodes":len(codes & set(prior["schemes"])),
        "candidateCodes":len(codes & set(found)),
        "codesWithMetrics":sum(bool(prior["schemes"].get(code,{}).get("metrics")) for code in codes)}
        for name,codes in sorted(amcs.items())]
    report["amcCount"]=len(amcs)
    report["unclassifiedAmfiCodes"]=len({code for entries in names.values() for code,_ in entries}-set().union(*amcs.values()))
    report.update(acceptedCodes=accepted,candidateCodes=len(found),catalogCodes=len(prior["schemes"]),amfiCodes=len({code for entries in names.values() for code,_ in entries}))
    ROOT.parent.mkdir(parents=True,exist_ok=True)
    ROOT.with_name("coverage.json").write_text(json.dumps(report,indent=2,sort_keys=True)+"\n")
    if not accepted:raise SystemExit("No unambiguous mappings extracted; prior catalog retained.")
    ROOT.parent.mkdir(parents=True,exist_ok=True)
    catalog=build_catalog(prior,amcs)
    ROOT.with_name("fund-intelligence.json").write_text(json.dumps(catalog,indent=2,sort_keys=True)+"\n")
    ROOT.write_text(json.dumps(prior,indent=2,sort_keys=True)+"\n")
if __name__=="__main__":main()
