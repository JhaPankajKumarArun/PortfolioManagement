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
def parse(data, scheme, date, url):
    expected=dt.date.fromisoformat(date)
    def norm(s): return re.sub(r"[^a-z0-9]+"," ",str(s).lower()).strip()
    matches=[]
    for title,rows in tables(data,urlparse(url).path):
        cells=[value(c) for row in rows[:25] for c in row]
        identity=any(norm(scheme) in norm(c) for c in [title,*cells] if c is not None)
        date_ok=any((isinstance(c,dt.datetime) and c.date()==expected) or (isinstance(c,dt.date) and c==expected) or any(expected.strftime(fmt).lower() in str(c).lower() for fmt in ("%d %B %Y","%d-%b-%Y","%d/%m/%Y","%Y-%m-%d","%d-%m-%Y")) for c in cells)
        if not identity or not date_ok: continue
        try: holdings=parse_equity(rows)
        except ValueError: continue
        matches.append(dict(scheme=scheme,date=date,source=url,holdings=holdings))
    if len(matches)!=1: raise ValueError("Missing or ambiguous verified scheme/date table")
    return matches[0]
def collect_ppfas(source,end):
    page=source["page"]
    soup=BeautifulSoup(get(page,source).text,"html.parser")
    found=[]
    links=set()
    for a in soup.select("a[href]"):
        url=urljoin(page,a["href"])
        if urlparse(url).scheme!="https" or urlparse(url).hostname not in source["hosts"]: continue
        if end.strftime("%B").lower() in url.lower() and str(end.year) in url and urlparse(url).path.lower().endswith(".xlsx") and a.get_text(strip=True).lower()!="consolidated": links.add(url)
    for url in sorted(links):
        try:
            data=get(url,source).content
            names=set()
            for title,rows in tables(data,urlparse(url).path):
                for row in rows[:15]:
                    for cell in row:
                        v=value(cell)
                        if isinstance(v,str) and re.fullmatch(r"Parag Parikh [A-Za-z0-9 &()/-]+ Fund",v.strip(),re.I):
                            names.add(v.strip())
            if len(names)!=1: raise ValueError("Missing or ambiguous scheme title")
            found.append(parse(data,names.pop(),end.isoformat(),url))
        except Exception as e: print(url,str(e))
    return found

ADAPTERS={"ppfas":collect_ppfas}
def main():
    end=dt.date.today().replace(day=1)-dt.timedelta(days=1)
    manifest=json.loads(pathlib.Path("data/amc-sources.json").read_text())
    found=[]
    for entry in manifest["sources"]:
        source=entry.get("source")
        if not source: continue
        adapter=ADAPTERS.get(source.get("adapter"))
        if not adapter:
            print("Unsupported adapter",entry["amc"])
            continue
        try: found.extend(adapter(source,end))
        except Exception as e: print("Source failed",entry["amc"],str(e))
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
