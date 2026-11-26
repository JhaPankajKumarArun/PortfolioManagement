"""Initial PPFAS adapter. Reject ambiguous spreadsheet layouts."""
import calendar, datetime as dt, io, json, re, pathlib, math
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup
from openpyxl import load_workbook

PAGE="https://amc.ppfas.com/downloads/portfolio-disclosure/"
def get(url):
    r=requests.get(url,timeout=40)
    r.raise_for_status()
    if urlparse(r.url).hostname!="amc.ppfas.com": raise ValueError("Unexpected source host")
    return r
def parse(data, scheme, date, url):
    book=load_workbook(io.BytesIO(data),read_only=True,data_only=True)
    for sheet in book:
        rows=list(sheet.iter_rows())
        for i,row in enumerate(rows):
            labels=[str(c.value or "").lower().strip() for c in row]
            isin=[j for j,x in enumerate(labels) if x=="isin"]
            weight=[j for j,x in enumerate(labels) if "%" in x and ("nav" in x or "net asset" in x)]
            name=[j for j,x in enumerate(labels) if "instrument" in x or "security name" in x]
            if not (len(isin)==len(weight)==len(name)==1): continue
            result={}
            equity=False
            for r in rows[i+1:]:
                code=str(r[isin[0]].value or "").strip()
                # Indian equity ISINs alone do not identify asset class; require an equity section.
                label=" ".join(str(c.value or "") for c in r[:2]).lower()
                if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]",code):
                    if "equity" in label and "derivative" not in label: equity=True
                    elif any(x in label for x in ("debt","money market","treasury","cash","derivative","mutual fund","repo","government","total")): equity=False
                    continue
                if not equity: continue
                c=r[weight[0]]
                if not isinstance(c.value,(float,int)): raise ValueError("Non-numeric allocation")
                w=float(c.value)*(100 if "%" in c.number_format else 1)
                if not math.isfinite(w) or not 0<=w<=100: raise ValueError("Invalid weight")
                n=str(r[name[0]].value or "").strip()
                if w and n:
                    item=result.setdefault(code,{"isin":code,"name":n,"weight":0})
                    item["weight"]+=w
            if result and sum(x["weight"] for x in result.values())<=100.05:
                return dict(scheme=scheme,date=date,source=url,holdings=list(result.values()))
    raise ValueError("No recognized equity portfolio")
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
