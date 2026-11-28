"""Shared validation contract for all public AMC adapters."""
import math
from datetime import date

UNITS={"aum":"Cr","averageAum":"Cr","beta":"","sharpe":"","sortino":"","stddev":"%","directBER":"%","regularBER":"%","equityTurnoverMultiple":"x","grossTurnoverMultiple":"x","equityTurnover":"%","totalTurnover":"%","riskFreeRate":"%","ytm":"%","modifiedDuration":"Years","macaulayDuration":"Years","largeCap":"%","midCap":"%","smallCap":"%"}
UNITS.update({"directTER":"%","regularTER":"%","alpha":"%","averageMaturity":"Years","minimumInvestment":"INR","minimumSIP":"INR","peRatio":"x","pbRatio":"x"})
TEXT_FIELDS={"schemeCategory","investmentObjective","exitLoad","schemeType","secondaryBenchmark"}
ALLOCATION_FIELDS={"assetAllocation","sectorAllocation","creditQuality","marketCapAllocation"}
RISK_LEVELS={"Low","Low to Moderate","Moderate","Moderately High","High","Very High"}
def safe_text(v,limit=2000):
    return isinstance(v,str) and 0<len(v.strip())<=limit and not any(ord(c)<32 for c in v)
def number(v):
    return type(v) in (int,float) and math.isfinite(v)
def validate_fields(fields,asof):
    clean={}
    for key,value in fields.items():
        if key in UNITS:
            if not isinstance(value,dict) or value.get("unit")!=UNITS[key]:continue
            v=value.get("value")
            if not number(v):continue
            if key not in ("beta","sharpe","sortino","ytm","riskFreeRate","alpha") and v<0:continue
            if key in ("largeCap","midCap","smallCap") and v>100:continue
            if key in ("directBER","regularBER","directTER","regularTER") and v>10:continue
            clean[key]={"value":v,"unit":UNITS[key]}
        elif key in TEXT_FIELDS and safe_text(value):
            clean[key]=value.strip()
        elif key in ("schemeRiskometer","benchmarkRiskometer") and isinstance(value,str) and value in RISK_LEVELS:
            clean[key]=value
        elif key=="fundManagers" and isinstance(value,list):
            managers=[]
            for row in value:
                if not isinstance(row,dict) or not safe_text(row.get("name"),200):continue
                manager={"name":row["name"].strip()}
                if "managingSince" in row:
                    try:
                        if date.fromisoformat(row["managingSince"])<=date.fromisoformat(asof):
                            manager["managingSince"]=row["managingSince"]
                    except (ValueError,TypeError):pass
                if manager not in managers:managers.append(manager)
            if managers:clean[key]=managers
        elif key in ALLOCATION_FIELDS or key=="holdings":
            if not isinstance(value,dict) or value.get("coverage") not in ("full","partial","unknown"):continue
            rows=value.get("rows")
            if not isinstance(rows,list) or not rows:continue
            if any(not isinstance(r,dict) or not safe_text(r.get("name"),300) or not number(r.get("weight")) or not 0<=r["weight"]<=100 for r in rows):continue
            if len({r["name"].strip().casefold() for r in rows})!=len(rows):continue
            if sum(r["weight"] for r in rows)>100.5:continue
            clean[key]={"coverage":value["coverage"],"rows":[{"name":r["name"].strip(),"weight":r["weight"]} for r in rows],"unit":"%"}
        elif key=="inceptionDate":
            try:
                if date.fromisoformat(value)<=date.fromisoformat(asof):clean[key]=value
            except (ValueError,TypeError):pass
        elif key=="publishedPerformance" and isinstance(value,dict):
            periods={}
            for period,row in value.items():
                if period not in ("1Y","3Y","5Y","10Y","SinceInception") or not isinstance(row,dict):continue
                if row.get("unit")=="%" and row.get("planIdentityVerified") is True:
                    vals={k:row[k] for k in ("direct","regular","benchmark") if k in row}
                    if vals and all(number(v) and -100<=v<=1000 for v in vals.values()):
                        periods[period]={**vals,"unit":"%","planIdentityVerified":True}
                    continue
                cols=row.get("printedColumns")
                if row.get("unit")=="%" and row.get("planIdentityVerified") is False and isinstance(cols,list) and len(cols)==3 and all(number(v) and -100<=v<=1000 for v in cols):
                    periods[period]={"printedColumns":cols,"unit":"%","planIdentityVerified":False}
            if periods:clean[key]=periods
    return clean
