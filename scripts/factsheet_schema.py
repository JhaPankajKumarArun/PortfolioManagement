"""Shared validation contract for all public AMC adapters."""
import math
from datetime import date

UNITS={"aum":"Cr","averageAum":"Cr","beta":"","sharpe":"","sortino":"","stddev":"%","directBER":"%","regularBER":"%","equityTurnoverMultiple":"x","grossTurnoverMultiple":"x","equityTurnover":"%","totalTurnover":"%","riskFreeRate":"%","ytm":"%","modifiedDuration":"Years","macaulayDuration":"Years","largeCap":"%","midCap":"%","smallCap":"%"}
def number(v):
    return type(v) in (int,float) and math.isfinite(v)
def validate_fields(fields,asof):
    clean={}
    for key,value in fields.items():
        if key in UNITS:
            if not isinstance(value,dict) or value.get("unit")!=UNITS[key]:continue
            v=value.get("value")
            if not number(v):continue
            if key not in ("beta","sharpe","sortino","ytm","riskFreeRate") and v<0:continue
            if key in ("largeCap","midCap","smallCap") and v>100:continue
            if key in ("directBER","regularBER") and v>10:continue
            clean[key]={"value":v,"unit":UNITS[key]}
        elif key=="inceptionDate":
            try:
                if date.fromisoformat(value)<=date.fromisoformat(asof):clean[key]=value
            except (ValueError,TypeError):pass
        elif key=="publishedPerformance" and isinstance(value,dict):
            periods={}
            for period,row in value.items():
                if period not in ("1Y","3Y","5Y") or not isinstance(row,dict):continue
                cols=row.get("printedColumns")
                if row.get("unit")=="%" and row.get("planIdentityVerified") is False and isinstance(cols,list) and len(cols)==3 and all(number(v) and -100<=v<=1000 for v in cols):
                    periods[period]={"printedColumns":cols,"unit":"%","planIdentityVerified":False}
            if periods:clean[key]=periods
    return clean
