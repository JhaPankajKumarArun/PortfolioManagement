"""Initial PPFAS adapter. Reject ambiguous spreadsheet layouts."""
import calendar, datetime as dt, io, json, re, pathlib, math
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from disclosure_parser import tables, parse_equity, value

PAGE="https://amc.ppfas.com/downloads/portfolio-disclosure/"
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
    schemes={"PPFCF":"Parag Parikh Flexi Cap Fund","PPLCF":"Parag Parikh Large Cap Fund","PPCHF":"Parag Parikh Conservative Hybrid Fund","PPDAAF":"Parag Parikh Dynamic Asset Allocation Fund","PPAF":"Parag Parikh Arbitrage Fund","PPLF":"Parag Parikh Liquid Fund","PPTSF":"Parag Parikh ELSS Tax Saver Fund"}
    found=[]
    for key,scheme in schemes.items():
        links=set()
        for a in soup.select("a[href]"):
            url=urljoin(PAGE,a["href"])
            if urlparse(url).hostname!="amc.ppfas.com": continue
            if re.search(r"/"+key+r"_",url,re.I) and end.strftime("%B").lower() in url.lower() and str(end.year) in url and url.lower().endswith(".xlsx"): links.add(url)
        if len(links)!=1:
            print(scheme,"ambiguous or missing monthly file",len(links)); continue
        url=links.pop()
        try: found.append(parse(get(url).content,scheme,end.isoformat(),url))
        except Exception as e: print(scheme,str(e))
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
