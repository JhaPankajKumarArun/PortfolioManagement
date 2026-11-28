"""Public factsheet page adapters; no portfolio data or network access."""
import re
from urllib.parse import urlparse
from factsheet_metrics import metrics, hsbc_metrics, hsbc_details, hsbc_performance
def norm(s):
    return re.sub(r"[^a-z0-9]+"," ",s.lower()).strip()
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


class GenericAdapter:
    name="generic"
    def rows(self,page,names):
        match=extract(page,names)
        return [(match[0],match[1],metrics(page))] if match else []

class HSBCAdapter(GenericAdapter):
    name="hsbc"
    def rows(self,page,names):
        rows=super().rows(page,names)
        profile=hsbc_profile(page,names)
        if profile:
            fields={**hsbc_metrics(page),**hsbc_details(page)}
            performance=hsbc_performance(page)
            if performance:fields["publishedPerformance"]=performance
            rows.append((profile[0],profile[1],fields))
        return rows

class ProfileAdapter(GenericAdapter):
    def __init__(self,name,prefix):
        self.name=name
        self.prefix=prefix
    def rows(self,page,names):
        lines=[line.strip() for line in page.splitlines() if line.strip()]
        if not lines:return []
        name=norm(lines[0])
        if name not in names or not name.startswith(self.prefix+" "):return []
        if not any(re.match(r"Type of Scheme\s*:",line,re.I) for line in lines[:8]):return []
        if not any(re.match(r"Fund Details\b",line,re.I) for line in lines):return []
        hits={}
        for line in lines:
            m=re.match(r"Benchmark (?:Name|Index)\s*:\s*(.+)",line,re.I)
            if not m:continue
            value=re.split(r"\s{2,}",m[1],maxsplit=1)[0].strip()
            value=re.sub(r"\s*\(TRI\)$"," TRI",value,flags=re.I)
            if re.fullmatch(r"(?:Nifty|BSE|MSCI)\s+[A-Za-z0-9 &:/.-]+?\s+TRI",value,re.I) and not re.search(r"annualised|returns|benchmark",value,re.I):
                hits[norm(value)]=value
        if len(hits)!=1:return []
        return [(name,next(iter(hits.values())),metrics(page))]

ADAPTERS={
    "www.assetmanagement.hsbc.co.in":HSBCAdapter(),
    "www.motilaloswalmf.com":ProfileAdapter("motilal-oswal","motilal oswal"),
    "www.pgimindia.com":ProfileAdapter("pgim","pgim india"),
    "www.sbimf.com":ProfileAdapter("sbi","sbi"),
}
def adapter_for(url):
    return ADAPTERS.get(urlparse(url).hostname,GenericAdapter())
