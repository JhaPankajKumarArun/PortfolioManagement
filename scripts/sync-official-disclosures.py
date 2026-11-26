"""Initial PPFAS adapter. Reject ambiguous spreadsheet layouts."""
import calendar, datetime as dt, io, json, re, pathlib, math
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from disclosure_parser import tables, parse_equity, value

# Discover scheme names from the official workbook rather than a user portfolio.
def get(url, source):
    for _ in range(5):
        u=urlparse(url)
        if u.scheme!="https" or u.hostname not in source["hosts"] or u.username or u.password:
            raise ValueError("Unexpected source host")
        r=requests.get(url,timeout=40,allow_redirects=False)
        if r.is_redirect:
            url=urljoin(url,r.headers["Location"])
            continue
        r.raise_for_status()
        return r
    raise ValueError("Too many redirects")
def reporting_dates(c):
    if isinstance(c,dt.datetime): return {c.date()}
    if isinstance(c,dt.date): return {c}
    s=re.sub(r"(\d)(?:st|nd|rd|th)\b",r"\1",str(c),flags=re.I)
    result=set()
    for pattern,formats in [
        (r"\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b",("%Y-%m-%d",)),
        (r"\b\d{1,2}[-/.]\d{1,2}[-/.]\d{4}\b",("%d-%m-%Y",)),
        (r"\b\d{1,2}[\s,./-]+[A-Za-z]{3,9}[\s,./-]+\d{4}\b",("%d %B %Y","%d %b %Y")),
        (r"\b[A-Za-z]{3,9}[\s,./-]+\d{1,2}[\s,./-]+\d{4}\b",("%B %d %Y","%b %d %Y")),
    ]:
        for token in re.findall(pattern,s):
            for fmt in formats:
                normalized=re.sub(r"[\s,./-]+"," " if " " in fmt else "-",token)
                try: result.add(dt.datetime.strptime(normalized,fmt).date()); break
                except ValueError: pass
    return result

def parse(data, scheme, date, url, diagnostic=None):
    expected=dt.date.fromisoformat(date)
    def norm(s): return re.sub(r"[^a-z0-9]+"," ",str(s).lower()).strip()
    matches=[]
    identity_count=date_count=0
    errors=[]
    date_samples=[]
    for title,rows in tables(data,urlparse(url).path):
        cells=[value(c) for row in rows[:25] for c in row]
        identity=any(norm(scheme) in norm(c) for c in [title,*cells] if c is not None)
        dates=set().union(*(reporting_dates(c) for c in cells if c is not None))
        date_ok=expected in dates
        if identity: date_samples.extend(sorted(d.isoformat() for d in dates))
        if identity: identity_count+=1
        if identity and date_ok: date_count+=1
        if not identity or not date_ok: continue
        try: holdings=parse_equity(rows)
        except ValueError as e:
            errors.append(str(e))
            if diagnostic is not None:
                diagnostic["layoutSamples"]=[
                    {"row":i+1,"cells":[{"column":j+1,"text":str(value(c))[:160]} for j,c in enumerate(row) if value(c) is not None]}
                    for i,row in enumerate(rows[:35])
                ]
            continue
        matches.append(dict(scheme=scheme,date=date,source=url,holdings=holdings))
    if len(matches)!=1: raise ValueError(f"Matching identity sheets={identity_count}, matching date sheets={date_count}, valid tables={len(matches)}, observed dates={date_samples}, parser errors={errors}")
    return matches[0]
def collect_ppfas(source,end,report):
    page=source["page"]
    soup=BeautifulSoup(get(page,source).text,"html.parser")
    found=[]
    links=set()
    for a in soup.select("a[href]"):
        url=urljoin(page,a["href"])
        if urlparse(url).scheme!="https" or urlparse(url).hostname not in source["hosts"]: continue
        if end.strftime("%B").lower() in url.lower() and str(end.year) in url and urlparse(url).path.lower().endswith(".xlsx") and a.get_text(strip=True).lower()!="consolidated": links.add(url)
    report["discovered"]=len(links)
    for url in sorted(links):
        item={"url":url,"stage":"download"}
        report["files"].append(item)
        try:
            data=get(url,source).content
            item["stage"]="scheme_identity"
            names=set()
            title_samples=[]
            for title,rows in tables(data,urlparse(url).path):
                for row in rows[:15]:
                    for cell in row:
                        v=value(cell)
                        if isinstance(v,str):
                            if len(title_samples)<25: title_samples.append(v[:200])
                            match=re.search(r"\bParag Parikh [A-Za-z0-9 &()/-]+? Fund\b",v,re.I)
                            if match: names.add(match.group(0).strip())
            if len(names)!=1:
                item["titleSamples"]=title_samples
                item["candidateNames"]=sorted(names)
                raise ValueError("Missing or ambiguous scheme title")
            item["stage"]="table_validation"
            found.append(parse(data,names.pop(),end.isoformat(),url,item))
            item["stage"]="accepted"
            item["scheme"]=found[-1]["scheme"]
            item["holdings"]=len(found[-1]["holdings"])
        except Exception as e:
            item["error"]=str(e)[:500]
            print(url,str(e))
    return found

ADAPTERS={"ppfas":collect_ppfas}
def main():
    end=dt.date.today().replace(day=1)-dt.timedelta(days=1)
    manifest=json.loads(pathlib.Path("data/amc-sources.json").read_text())
    found=[]
    reports=[]
    for entry in manifest["sources"]:
        source=entry.get("source")
        report={"amc":entry["amc"],"status":entry["status"],"files":[],"discovered":0}
        reports.append(report)
        if not source: continue
        adapter=ADAPTERS.get(source.get("adapter"))
        if not adapter:
            report["error"]="Unsupported adapter"
            print("Unsupported adapter",entry["amc"])
            continue
        try:
            records=adapter(source,end,report)
            found.extend(records)
            report["accepted"]=len(records)
        except Exception as e:
            report["error"]=str(e)[:500]
            print("Source failed",entry["amc"],str(e))
    diagnostic=pathlib.Path("data/disclosure-diagnostics.json")
    diagnostic.parent.mkdir(exist_ok=True)
    tmp=diagnostic.with_suffix(".tmp")
    tmp.write_text(json.dumps({"generatedAt":dt.datetime.now(dt.timezone.utc).isoformat(),"targetDate":end.isoformat(),"accepted":len(found),"sources":reports}))
    tmp.replace(diagnostic)
    if not found: raise RuntimeError("No verified official records")
    path=pathlib.Path("data/disclosures.json")
    old=json.loads(path.read_text()) if path.exists() else {"rows":[]}
    rows=old["rows"]
    for d in found:
        rows=[r for r in rows if not (r["scheme"]==d["scheme"] and r["date"]<=d["date"])]
        if not any(r["scheme"]==d["scheme"] and r["date"]>d["date"] for r in rows): rows.append(d)
    path.parent.mkdir(exist_ok=True)
    tmp=path.with_suffix(".tmp")
    tmp.write_text(json.dumps(dict(generatedAt=dt.datetime.now(dt.timezone.utc).isoformat(),rows=rows)))
    tmp.replace(path)
    print("Official records",len(found))
if __name__=="__main__": main()
