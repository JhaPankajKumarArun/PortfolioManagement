"""Public AMC source registry and dated document discovery."""
import datetime as dt
import calendar
import re
from urllib.parse import urlparse, unquote

DIRECTORY="https://www.amfiindia.com/online-center/download-factsheets"
SOURCES={
    "HDFC":"https://www.hdfcfund.com/mutual-funds/factsheets",
    "HSBC":"https://www.assetmanagement.hsbc.co.in/en/mutual-funds/investor-resources?Doc=fund-factsheets",
    "Mirae Asset":"https://www.miraeassetmf.co.in/downloads/factsheet",
}
# Official document URLs already referenced by the application; fallback only,
# not a substitute for discovering future monthly publications.
FALLBACKS=[
"https://www.motilaloswalmf.com/content/dam/motilal-mf/downloads/mf/factsheet/2026/nov/Factsheet%20October%202026%20Active.pdf",
"https://www.pgimindia.com/api/v1/brochure/about-us/image/Factsheet-October2026.pdf",
"https://www.sbimf.com/docs/default-source/scheme-factsheets/all-sbimf-schemes-factsheet-october-2026.pdf",
]
def is_pdf(url):
    return urlparse(url).scheme=="https" and urlparse(url).path.lower().endswith(".pdf")
def dated_pdf(url,title,today):
    if not is_pdf(url):return None
    text=title+" "+unquote(urlparse(url).path.rsplit("/",1)[-1])
    if not re.search(r"factsheet|fact sheet|the asset as on",text,re.I):return None
    dates=set()
    for m in re.finditer(r"(?i)\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[\s_-]*(?:20)?(\d{2})\b",text):
        month=dt.datetime.strptime(m[1][:3].title(),"%b").month
        year=2000+int(m[2])
        dates.add(dt.date(year,month,1))
    if len(dates)!=1:return None
    d=dates.pop()
    return (d,url) if d.replace(day=calendar.monthrange(d.year,d.month)[1])<=today else None
