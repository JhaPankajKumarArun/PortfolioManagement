"""Conservative extraction of explicitly labelled scheme metrics."""
import re
FIELDS={"beta":("Beta",""),"sharpe":("Sharpe Ratio",""),"sortino":("Sortino Ratio",""),"stddev":("Standard Deviation","%"),"equityTurnover":("Equity Turnover","%"),"totalTurnover":("Total Turnover","%"),"riskFreeRate":("Risk free rate","%"),"ytm":("Yield to Maturity|YTM","%"),"modifiedDuration":("Modified Duration","Years"),"macaulayDuration":("Macaulay Duration","Years"),"largeCap":("Large Cap","%"),"midCap":("Mid Cap","%"),"smallCap":("Small Cap","%")}
def metrics(page):
    """Match explicit labels and units in isolated or multi-column rows."""
    result={}
    for key,(label,unit) in FIELDS.items():
        prefix=r"(?:^[ \t]*|[ \t]{2,})(?:\d+[.)]?[ \t]+)?(?:"+label+r")"
        num=r"(-?\d+(?:\.\d+)?)"
        end=r"(?=[ \t]*$|[ \t]{2,}\S)"
        suffix=r"[ \t]*:?[ \t]*"+num+r"[ \t]*"+re.escape(unit)
        patterns=[prefix+suffix+end]
        if unit:
            patterns.append(prefix+r"[ \t]*\("+re.escape(unit)+r"\)[ \t]*:?[ \t]*"+num+end)
        values={float(x) for pattern in patterns for x in re.findall(pattern,page,re.I|re.M)}
        if len(values)==1:
            v=values.pop()
            if v<0 and key not in ("beta","sharpe","sortino","ytm","riskFreeRate"):continue
            if key in ("largeCap","midCap","smallCap") and v>100:continue
            result[key]={"value":v,"unit":unit}
    return result


def hsbc_metrics(page):
    result=metrics(page)
    patterns={
        "stddev":(r"^\s*\d+\s+Standard Deviation\s*\(%\)\s+(\d+(?:\.\d+)?)","%"),
        "beta":(r"^\s*\d+\s+Beta\s+(-?\d+(?:\.\d+)?)",""),
        "sharpe":(r"^\s*\d+\s+Sharpe Ratio\s*\(%\)\s+(-?\d+(?:\.\d+)?)",""),
        "aum":(r"^\s*AUM \(as on [\d.]+\)\s+₹\s*([\d,]+(?:\.\d+)?)\s+Cr","Cr"),
        "averageAum":(r"^\s*AAUM \(for the month of [A-Za-z]+\)\s+₹\s*([\d,]+(?:\.\d+)?)\s+Cr","Cr"),
        "equityTurnoverMultiple":(r"(?:^|[ \t]{2,})a\)\s+Equity Turnover\s+(\d+(?:\.\d+)?)","x"),
        "grossTurnoverMultiple":(r"(?:^|[ \t]{2,})b\)\s+Gross Exposure Turnover\s+(\d+(?:\.\d+)?)","x"),
    }
    for key,(pattern,unit) in patterns.items():
        values={float(x.replace(",","")) for x in re.findall(pattern+r"(?=[ \t]{2,}|[ \t]*$)",page,re.I|re.M)}
        if len(values)==1:result[key]={"value":values.pop(),"unit":unit}
    return result


def hsbc_details(page):
    from datetime import datetime
    result={}
    lines=page.splitlines()
    dates=set()
    for line in lines:
        match=re.match(r"\s*Date of Inception / Allotment:\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b",line)
        if match:
            try: dates.add(datetime.strptime(match[1],"%d %B %Y").date().isoformat())
            except ValueError: pass
    if len(dates)==1:result["inceptionDate"]=dates.pop()
    # The month-end table explicitly labels BER, not total expense ratio.
    for i,line in enumerate(lines):
        if not re.match(r"\s*Plan\s+Base Expense Ratio \(BER\)",line,re.I):continue
        for row in lines[i+1:i+5]:
            hit=re.match(r"\s*(Regular(?:[¹1])?|Direct)\s+(\d+(?:\.\d+)?)\s*%",row,re.I)
            if hit and 0<=float(hit[2])<=10:
                key="directBER" if hit[1].lower()=="direct" else "regularBER"
                result[key]={"value":float(hit[2]),"unit":"%"}
    return result


def hsbc_performance(page):
    """Preserve printed column order until plan headers are independently verified."""
    lines=page.splitlines()
    result={}
    if not any("Fund Performance (CAGR)" in line for line in lines):return result
    for i,line in enumerate(lines):
        hit=re.search(r"Returns for last\s+(1|3|5)\s*$",line)
        if not hit:continue
        for row in lines[i+1:i+3]:
            cells=re.split(r"\s{2,}",row.strip())
            nums=[]
            for cell in reversed(cells):
                if re.fullmatch(r"-?\d+\.\d{2}",cell):nums.insert(0,float(cell))
                else:break
            if len(nums)==3 and all(-100<=v<=1000 for v in nums):
                result[hit[1]+"Y"]={"printedColumns":nums,"unit":"%","planIdentityVerified":False}
                break
    return result


def profile_metrics(page):
    """Explicit single-scheme profile labels observed in AMC PDF layouts."""
    result=metrics(page)
    patterns={
        "aum":(r"^ *AUM(?: as on \d{1,2}/\d{1,2}/\d{4})? *:? *[\x60₹] *(\d[\d,]*(?:\.\d+)?) +(?:Crore|Cr)","Cr"),
        "averageAum":(r"^ *AAUM *:? *[\x60₹] *(\d[\d,]*(?:\.\d+)?) +(?:Crore|Cr)","Cr"),
        "stddev":(r"^ *Standard Deviation (?:\(Annualised\) *:? *(\d+(?:\.\d+)?) *%|Scheme *\(%\) *: *(\d+(?:\.\d+)?))","%"),
        "sharpe":(r"^ *Sharpe Ratio@? *\(Annualised\) *:? *(-?\d+(?:\.\d+)?)",""),
    }
    for key,(pattern,unit) in patterns.items():
        values={float(next(x for x in hit.groups() if x is not None).replace(",",""))
                for hit in re.finditer(pattern+r"(?=[ \t]{2,}|[ \t]*$)",page,re.I|re.M)}
        if key in result:values.add(result[key]["value"])
        if len(values)==1:result[key]={"value":values.pop(),"unit":unit}
        elif len(values)>1:result.pop(key,None)
    return result


def profile_details(page):
    """Read explicit profile labels and bounded manager blocks."""
    from datetime import datetime
    result={}
    lines=[re.split(r" {2,}",line.strip(),maxsplit=1)[0] for line in page.splitlines()]
    types={m[1].strip() for line in lines[:12] if (m:=re.fullmatch(r"Type of Scheme\s*:\s*(.+)",line,re.I))}
    if len(types)==1:result["schemeType"]=types.pop()
    managers=[]
    active=False
    pending=None
    for line in lines:
        if re.fullmatch(r"Name of Fund Managers?\s*:",line,re.I):
            active=True
            continue
        if not active:continue
        if re.match(r"(?:Expense Ratio|NAV|Portfolio|Risk Ratios|Investment Objective)\b",line,re.I):
            break
        hit=re.fullmatch(r"(?:Mr|Ms|Mrs|Dr)\.?\s+([A-Za-z][A-Za-z .'-]{2,100})",line)
        if hit:
            pending={"name":hit[1].strip()}
            managers.append(pending)
        elif pending and (hit:=re.fullmatch(r"Managing Since:\s*(\d{1,2} [A-Za-z]+,? \d{4})",line,re.I)):
            try:pending["managingSince"]=datetime.strptime(hit[1].replace(",",""),"%d %B %Y").date().isoformat()
            except ValueError:pass
            pending=None
    if managers:result["fundManagers"]=managers
    return result


def expense_metrics(page):
    """Accept only explicitly identified BER/TER columns, never generic expense labels."""
    lines=page.splitlines()
    candidates={}
    for i,line in enumerate(lines):
        header=re.match(r"^\s*(?:Plan\s+)?(BER|TER)[~*]?\s{2,}(BER|TER)[~*]?(?=\s{2,}|$)",line,re.I)
        if not header or header[1].upper()==header[2].upper():continue
        if not any(re.match(r"\s*Expense Ratio\b",x,re.I) for x in lines[max(0,i-5):i]):continue
        for row in lines[i+1:i+7]:
            hit=re.match(r"^\s*(Direct|Regular)(?: Plan)?[~*¹1]?\s+(\d+(?:\.\d+)?)\s*%\s+(\d+(?:\.\d+)?)\s*%(?=\s|$)",row,re.I)
            if not hit:continue
            for col,value in zip(header.groups(),hit.groups()[1:]):
                candidates.setdefault(hit[1].lower()+col.upper(),set()).add(float(value))
    return {key:{"value":next(iter(values)),"unit":"%"} for key,values in candidates.items() if len(values)==1 and 0<=next(iter(values))<=10}
