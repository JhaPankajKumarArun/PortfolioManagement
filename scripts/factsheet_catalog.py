"""Versioned public fund intelligence projection; legacy benchmark catalog stays compatible."""
from factsheet_schema import validate_fields

def build_catalog(prior, amcs):
    owners={code:name for name,codes in amcs.items() for code in codes}
    schemes={}
    for code,row in prior["schemes"].items():
        if code not in owners:continue
        snapshots={}
        for date,record in {**row.get("history",{}),row["verifiedAsOf"]:row}.items():
            snapshots[date]={"source":record["source"],"benchmark":record["name"],
                "metrics":validate_fields(record.get("metrics",{}),date)}
        schemes[code]={"amc":owners[code],"isins":row.get("isins",[]),
            "latestReportingDate":row["verifiedAsOf"],"snapshots":snapshots}
    return {"schema":1,"kind":"public-fund-intelligence","schemes":schemes}
