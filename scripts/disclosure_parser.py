"""Generic table parser. Scheme identity and date must be verified by the caller."""
import csv, io, math, re, zipfile
from openpyxl import load_workbook

def tables(data, filename):
    ext=filename.lower().rsplit(".",1)[-1]
    if len(data)>40_000_000: raise ValueError("File too large")
    if ext=="csv":
        yield filename, list(csv.reader(io.StringIO(data.decode("utf-8-sig"))))
    elif ext in ("xlsx","xls"):
        if ext=="xlsx":
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if sum(x.file_size for x in z.infolist())>150_000_000: raise ValueError("Workbook too large")
            book=load_workbook(io.BytesIO(data),read_only=True,data_only=True)
            try:
                for sheet in book:
                    yield sheet.title, [[(c.value,c.number_format) for c in row] for row in sheet.iter_rows()]
            finally: book.close()
        else:
            import xlrd
            book=xlrd.open_workbook(file_contents=data)
            for sheet in book.sheets():
                yield sheet.name,[sheet.row_values(i) for i in range(sheet.nrows)]
    elif ext=="zip":
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            members=z.infolist()
            if len(members)>200 or sum(x.file_size for x in members)>150_000_000: raise ValueError("Archive too large")
            for item in members:
                if item.filename.lower().endswith((".xlsx",".xls",".csv")):
                    yield from tables(z.read(item),item.filename)
    else: raise ValueError("Unsupported file format")

def value(cell):
    return cell[0] if isinstance(cell,tuple) else cell

def label(cell):
    return re.sub(r"\s+"," ",str(value(cell) or "").strip().lower())

def allocation(cell):
    v=value(cell)
    if isinstance(v,bool): raise ValueError("Invalid allocation")
    if isinstance(v,str):
        v=float(v.strip().rstrip("%").replace(",",""))
    elif isinstance(v,(int,float)):
        v=float(v)*(100 if isinstance(cell,tuple) and "%" in cell[1] else 1)
    else: raise ValueError("Missing allocation")
    if not math.isfinite(v) or not 0<=v<=100: raise ValueError("Invalid allocation")
    return v

def parse_equity(rows):
    for i,row in enumerate(rows):
        labels=list(map(label,row))
        cols=[[j for j,x in enumerate(labels) if predicate(x)] for predicate in (
            lambda x:x in ("isin","isin code"),
            lambda x:x in ("name of instrument","instrument name","security name","name of security","name of the instrument"),
            lambda x:"%" in x and ("nav" in x or "net asset" in x))]
        if not all(len(c)==1 for c in cols): continue
        ic,nc,wc=[c[0] for c in cols]
        equity=False; result={}
        for r in rows[i+1:]:
            if len(r)<=max(ic,nc,wc): continue
            code=str(value(r[ic]) or "").strip()
            name=str(value(r[nc]) or "").strip()
            heading=" ".join(filter(None,(label(c) for c in r[:max(ic,nc)+1])))
            if not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]",code):
                if re.fullmatch(r"(?:[a-z]\.\s*)?(?:listed\s+)?equity(?:\s+(?:shares|(?:and|&) equity related(?: instruments)?|instruments))?",heading.strip()): equity=True
                elif heading.strip() and not re.fullmatch(r"(?:\(?[a-z]\)?[.)]?\s*)?(?:listed|unlisted|listed\s*/\s*awaiting listing on stock exchanges?)",heading.strip()): equity=False
                continue
            if not equity: continue
            w=allocation(r[wc])
            if not name: raise ValueError("Missing security name")
            if w:
                p=result.setdefault(code,{"isin":code,"name":name,"weight":0})
                p["weight"]+=w
        if result:
            if sum(p["weight"] for p in result.values())>100.05: raise ValueError("Invalid total allocation")
            return list(result.values())
    raise ValueError("No recognized equity disclosure")
