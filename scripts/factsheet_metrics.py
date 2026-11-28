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
