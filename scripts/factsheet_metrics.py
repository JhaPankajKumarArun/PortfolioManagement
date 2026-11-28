"""Conservative extraction of explicitly labelled scheme metrics."""
import re
FIELDS={"beta":("Beta",""),"sharpe":("Sharpe Ratio",""),"sortino":("Sortino Ratio",""),"stddev":("Standard Deviation","%"),"equityTurnover":("Equity Turnover","%"),"totalTurnover":("Total Turnover","%"),"riskFreeRate":("Risk free rate","%"),"ytm":("Yield to Maturity|YTM","%"),"modifiedDuration":("Modified Duration","Years"),"macaulayDuration":("Macaulay Duration","Years"),"largeCap":("Large Cap","%"),"midCap":("Mid Cap","%"),"smallCap":("Small Cap","%")}
def metrics(page):
    result={}
    for key,(label,unit) in FIELDS.items():
        pattern=r"(?im)(?:^[ \t]*|[ \t]{2,})(?:"+label+r")[ \t]*:?[ \t]*(-?\d+(?:\.\d+)?)[ \t]*"+re.escape(unit)+r"(?:[ \t]*$|[ \t]{2,}\S)"
        values={float(x) for x in re.findall(pattern,page)}
        if len(values)==1:
            v=values.pop()
            if v<0 and key not in ("beta","sharpe","sortino"):continue
            if key in ("largeCap","midCap","smallCap") and v>100:continue
            result[key]={"value":v,"unit":unit}
    return result
