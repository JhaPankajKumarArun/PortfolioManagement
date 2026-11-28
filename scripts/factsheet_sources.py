"""Public AMC source registry and dated document discovery."""
import datetime as dt
import calendar
import re
from urllib.parse import urlparse, unquote

DIRECTORY="https://www.amfiindia.com/online-center/download-factsheets"
SOURCES={
    "Baroda BNP Paribas":"https://www.barodabnpparibasmf.in/downloads/monthly-factsheet",
    "360 ONE":"https://www.360.one/asset/mutual-funds/downloads/",
    "Jio BlackRock":"https://www.jioblackrockamc.com/statutory-disclosure/fund-documents/factsheet",
    "Axis":"https://www.axismf.com/downloads",
    "Bandhan":"https://cmsnew.bandhanmutual.com/category/factsheet/",
    "Canara Robeco":"https://www.canararobeco.com/documents/forms-downloads/forms-information-documents/information-documents/factsheets/",
    "Quantum":"https://www.quantumamc.com/factsheets/combined/-1/0/0",
    "DSP":"https://www.dspim.com/factsheets",
    "Edelweiss":"https://www.edelweissmf.com/downloads/factsheets",
    "Franklin Templeton":"https://www.franklintempletonindia.com/downloads/fund-documents",
    "Groww":"https://www.growwmf.in/downloads/fact-sheet",
    "Helios":"https://www.heliosmf.in/downloads/",
    "ICICI Prudential":"https://www.archive.icicipruamc.com/downloads/factsheet-and-portfolio",
    "Invesco":"https://www.invescomutualfund.com/literature-and-form?tab=Factsheets",
    "ITI":"https://www.itiamc.com/downloads",
    "JM Financial":"https://www.jmfinancialmf.com/downloads/Factsheet/Factsheet",
    "Kotak":"https://www.kotakmf.com/Information/forms-and-downloads",
    "LIC":"https://www.licmf.com/downloads/factsheet",
    "Mahindra Manulife":"https://www.mahindramanulife.com/downloads#mandatory-disclosures",
    "Motilal Oswal":"https://www.motilaloswalmf.com/download/factsheets",
    "Navi":"https://navi.com/mutual-fund/downloads/factsheet",
    "Nippon India":"https://mf.nipponindiaim.com/investor-service/downloads/factsheet-portfolio-and-other-disclosures",
    "NJ":"https://downloads.njmutualfund.com/downloads.php",
    "Old Bridge":"https://www.oldbridgemf.com/factsheet.html",
    "PPFAS":"https://amc.ppfas.com/downloads/factsheet/",
    "PGIM":"https://www.pgimindiamf.com/forms-and-updates/fund-factsheet",
    "quant":"https://quantmutual.com/downloads/factsheet",
    "Samco":"https://www.samcomf.com/downloads",
    "SBI":"https://www.sbimf.com/factsheets",
    "Shriram":"https://www.shriramamc.in/factsheet",
    "Sundaram":"https://www.sundarammutual.com/Downloads",
    "Tata":"https://www.tatamutualfund.com/information-documents",
    "Taurus":"https://www.taurusmutualfund.com/factsheet",
    "Trust":"https://www.trustmf.com/downloads?activeTab=factsheets",
    "Union":"https://unionmf.com/about-us/downloads/factsheets",
    "UTI":"https://www.utimf.com/downloads/fact-sheet",
    "WhiteOak":"https://mf.whiteoakamc.com/download",
    "Zerodha":"https://www.zerodhafundhouse.com/resources/fund-documents/",
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


def discovery_candidates(pdfs,today):
    """Deduplicate links and retain bounded evidence for unrecognized dates."""
    unique={}
    for url,title in pdfs:
        unique.setdefault(url,set()).add(title)
    dated=set()
    unknown=[]
    for url,titles in sorted(unique.items()):
        matches={d for title in titles if (d:=dated_pdf(url,title,today))}
        if len(matches)==1:dated.update(matches)
        elif not matches and re.search(r"fact[\s_-]*sheet",url+" "+" ".join(titles),re.I):
            unknown.append({"url":url,"title":sorted(titles)[0][:200]})
    return sorted(dated),unknown[:12]
