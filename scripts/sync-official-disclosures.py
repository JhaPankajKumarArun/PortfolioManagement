"""Initial PPFAS adapter. Reject ambiguous spreadsheet layouts."""
import calendar, datetime as dt, io, json, re, pathlib, math
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from disclosure_parser import tables, parse_equity, value

PAGE="https://amc.ppfas.com/downloads/portfolio-disclosure/"
# Discover scheme names from the official workbook rather than a user portfolio.
def get(url):
    r=requests.get(url,timeout=40)
    r.raise_for_status()
    if urlparse(r.url).hostname!="amc.ppfas.com": raise ValueError("Unexpected source host")
    return r
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
def main():
    now=dt.date.today()
    end=now.replace(day=1)-dt.timedelta(days=1)
    soup=BeautifulSoup(get(PAGE).text,"html.parser")
    found=[]
    links=set()
    for a in soup.select("a[href]"):
        url=urljoin(PAGE,a["href"])
        if urlparse(url).scheme!="https" or urlparse(url).hostname!="amc.ppfas.com": continue
        if end.strftime("%B").lower() in url.lower() and str(end.year) in url and url.lower().endswith(".xlsx"): links.add(url)
    for url in sorted(links):
        try:
            data=get(url).content
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
