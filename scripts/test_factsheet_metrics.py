import unittest
from factsheet_metrics import metrics
class MetricsTest(unittest.TestCase):
    def test_values(self):
        self.assertEqual(metrics("Beta: 0.82\nStandard Deviation: 16.08%")["stddev"]["value"],16.08)
    def test_conflict(self):
        self.assertNotIn("beta",metrics("Beta: 0.8\nBeta: 0.9"))
    def test_invalid(self):
        self.assertNotIn("largeCap",metrics("Large Cap: 120%"))
if __name__=="__main__":unittest.main()


class HSBCProfileTests(unittest.TestCase):
    def test_real_layout(self):
        from refresh_amc_factsheets import hsbc_profile
        page = "HSBC Small Cap Fund\n\nType of Scheme: An open ended equity scheme predominantly investing in small cap stocks\nBenchmark Name: Nifty Smallcap 250 TRI                          Annualised               Returns %            Returns %"
        self.assertEqual(hsbc_profile(page, {"hsbc small cap fund": []}), ("hsbc small cap fund", "Nifty Smallcap 250 TRI"))

    def test_reject_non_profile(self):
        from refresh_amc_factsheets import hsbc_profile
        self.assertIsNone(hsbc_profile("HSBC Small Cap Fund\nAdditional Disclosure\nBenchmark Name: Nifty Smallcap 250 TRI", {"hsbc small cap fund": []}))


class LayoutMetricTests(unittest.TestCase):
    def test_adjacent_columns(self):
        self.assertEqual(metrics("Beta: 0.82    Other column")["beta"]["value"],0.82)
        self.assertEqual(metrics("Standard Deviation: 16.08%    Other column")["stddev"]["value"],16.08)
    def test_reject_truncated_benchmark(self):
        from refresh_amc_factsheets import hsbc_profile
        page="HSBC Small Cap Fund\nType of Scheme: Equity\nBenchmark Name: NIFTY 50 Hybrid Composite    Annualised"
        self.assertIsNone(hsbc_profile(page,{"hsbc small cap fund":[]}))


class HSBCActualMetricsTests(unittest.TestCase):
    def test_actual_layout(self):
        from factsheet_metrics import hsbc_metrics
        page="AUM (as on 31.10.26)            ₹ 17,267.32 Cr\nAAUM (for the month of Oct)     ₹ 17,945.21 Cr                   Returns for last 5\n 1 Standard Deviation (%)                    22.41                       Vijaya Diagnostic Centre Limited\n 2 Beta                                       0.95\n 4 Sharpe Ratio (%)                           0.30    Click Here\n    a) Equity Turnover                             0.35"
        m=hsbc_metrics(page)
        self.assertEqual(m["aum"]["value"],17267.32)
        self.assertEqual(m["averageAum"]["value"],17945.21)
        self.assertEqual(m["stddev"]["value"],22.41)
        self.assertEqual(m["beta"]["value"],0.95)
        self.assertEqual(m["sharpe"]["value"],0.30)
        self.assertEqual(m["equityTurnoverMultiple"]["value"],0.35)


class HSBCDetailsTests(unittest.TestCase):
    def test_profile(self):
        from factsheet_metrics import hsbc_details
        page="Date of Inception / Allotment: 12 May 2014    Compounded\nPlan   Base Expense Ratio (BER)    Other table\nRegular1    1.43%    Other table\nDirect    0.57%    Other table"
        d=hsbc_details(page)
        self.assertEqual(d["inceptionDate"],"2014-05-12")
        self.assertEqual(d["directBER"]["value"],0.57)
        self.assertEqual(d["regularBER"]["value"],1.43)
    def test_do_not_guess_ter(self):
        from factsheet_metrics import hsbc_details
        self.assertEqual(hsbc_details("Direct   0.57%"),{})


class HSBCPerformanceTests(unittest.TestCase):
    def test_printed_columns(self):
        from factsheet_metrics import hsbc_performance
        page="Fund Details    Fund Performance (CAGR)\nRegular Plan - Growth Option    ₹ 82.8350    Returns for last 1\n    2.03    3.07    -2.61\nRegular Plan - IDCW Option    ₹ 37.4848    year\nDirect Plan - Growth Option    ₹ 93.2503    Returns for last 3\nDirect Plan - IDCW Option    ₹ 44.2805    10.69    11.82    12.39\n    years"
        d=hsbc_performance(page)
        self.assertEqual(d["1Y"]["printedColumns"],[2.03,3.07,-2.61])
        self.assertEqual(d["3Y"]["printedColumns"],[10.69,11.82,12.39])
        self.assertFalse(d["1Y"]["planIdentityVerified"])
    def test_no_header(self):
        from factsheet_metrics import hsbc_performance
        self.assertEqual(hsbc_performance("Returns for last 1\n  2.03    3.07    -2.61"),{})


class AdapterTests(unittest.TestCase):
    def test_dispatch(self):
        from factsheet_adapters import adapter_for
        self.assertEqual(adapter_for("https://www.assetmanagement.hsbc.co.in/a.pdf").name,"hsbc")
        self.assertEqual(adapter_for("https://example.org/a.pdf").name,"generic")


class SchemaTests(unittest.TestCase):
    def test_validation(self):
        from factsheet_schema import validate_fields
        fields={"aum":{"value":100,"unit":"Cr"},"beta":{"value":float("nan"),"unit":""},"directBER":{"value":0.5,"unit":"%"},"largeCap":{"value":101,"unit":"%"},"inceptionDate":"2027-01-01"}
        self.assertEqual(set(validate_fields(fields,"2026-10-31")),{"aum","directBER"})


class GenericLayoutTests(unittest.TestCase):
    def test_numbered_and_prefix_units(self):
        d=metrics(" 1 Standard Deviation (%)    22.41    Other column\n 2 Beta    0.95\nModified Duration (Years)    2.4")
        self.assertEqual(d["stddev"]["value"],22.41)
        self.assertEqual(d["beta"]["value"],0.95)
        self.assertEqual(d["modifiedDuration"]["value"],2.4)
    def test_conflicting_layouts(self):
        self.assertNotIn("stddev",metrics("Standard Deviation: 12%\n1 Standard Deviation (%)    13"))
    def test_unit_required(self):
        self.assertNotIn("equityTurnover",metrics("Equity Turnover    0.35"))


class SourceTests(unittest.TestCase):
    def test_dates(self):
        from factsheet_sources import dated_pdf
        from datetime import date
        today=date(2026,11,28)
        self.assertEqual(dated_pdf("https://example.org/Factsheet-October2026.pdf","",today)[0],date(2026,10,1))
        self.assertIsNone(dated_pdf("https://example.org/Factsheet-November2026.pdf","",today))
        self.assertIsNone(dated_pdf("https://example.org/Factsheet-October2026.pdf","September 2026",today))


class MultiAMCProfileTests(unittest.TestCase):
    def test_profiles(self):
        from factsheet_adapters import adapter_for
        for host,name,benchmark in [
            ("www.motilaloswalmf.com","Motilal Oswal Large Cap Fund","NIFTY 100 TRI"),
            ("www.pgimindia.com","PGIM INDIA LARGE CAP FUND","NIFTY 100 TRI"),
            ("www.sbimf.com","SBI LARGE CAP FUND","BSE 100 (TRI)")]:
            page=name+"\nType of Scheme : Equity\nFund Details    Fund Performance\nBenchmark Name : "+benchmark+"    Other column\nBeta: 0.95"
            rows=adapter_for("https://"+host+"/a.pdf").rows(page,{name.lower():[]})
            self.assertEqual(len(rows),1)
            self.assertEqual(rows[0][2]["beta"]["value"],0.95)
    def test_incomplete_benchmark(self):
        from factsheet_adapters import adapter_for
        a=adapter_for("https://www.sbimf.com/a.pdf")
        self.assertEqual(a.rows("SBI Large Cap Fund\nType of Scheme: Equity\nFund Details\nBenchmark Index : NIFTY Large",{"sbi large cap fund":[]}),[])


class ProfileMetricTests(unittest.TestCase):
    def test_observed_layouts(self):
        from factsheet_metrics import profile_metrics
        for page,expected in [
            ("AUM    \x60 2,936.67 Crore    Benchmark Riskometer\nAAUM \x60 2,919.30 Crore\nStandard Deviation (Annualised) 14.5%    Power\nSharpe Ratio@ (Annualised) 0.9",{"aum":2936.67,"averageAum":2919.30,"stddev":14.5,"sharpe":0.9}),
            ("AUM : \x60 506.08 Crore\nStandard Deviation Scheme (%): 13.05\nStandard Deviation Benchmark (%): 13.82",{"aum":506.08,"stddev":13.05}),
            ("AUM as on 30/10/2026: \x60 52,416.37 Cr",{"aum":52416.37})]:
            self.assertEqual({k:v["value"] for k,v in profile_metrics(page).items()},expected)
    def test_conflicting_values(self):
        from factsheet_metrics import profile_metrics
        self.assertNotIn("stddev",profile_metrics("Standard Deviation 10%\nStandard Deviation Scheme (%): 12"))


class FundCatalogTests(unittest.TestCase):
    def test_catalog_projection(self):
        from factsheet_catalog import build_catalog
        row={"name":"Nifty 50 TRI","isins":["INF123"],"source":"https://example.org/factsheet.pdf","verifiedAsOf":"2026-10-31","metrics":{"aum":{"value":123,"unit":"Cr"}}}
        catalog=build_catalog({"schemes":{"1":row,"2":row}},{"Example Mutual Fund":{"1"}})
        self.assertEqual(set(catalog["schemes"]),{"1"})
        self.assertEqual(catalog["schemes"]["1"]["snapshots"]["2026-10-31"]["metrics"]["aum"]["value"],123)


class ComprehensiveSchemaTests(unittest.TestCase):
    def test_extended_fields(self):
        from factsheet_schema import validate_fields
        fields={"directTER":{"value":0.8,"unit":"%"},"fundManagers":[{"name":"Example Manager","managingSince":"2020-01-01"}],"schemeRiskometer":"High","holdings":{"coverage":"partial","rows":[{"name":"Example Ltd","weight":5}]},"publishedPerformance":{"10Y":{"direct":12,"benchmark":10,"unit":"%","planIdentityVerified":True}}}
        self.assertEqual(set(validate_fields(fields,"2026-10-31")),set(fields))
    def test_invalid_allocations(self):
        from factsheet_schema import validate_fields
        self.assertNotIn("holdings",validate_fields({"holdings":{"coverage":"full","rows":[{"name":"A","weight":80},{"name":"B","weight":40}]}},"2026-10-31"))


class ProfileDetailsTests(unittest.TestCase):
    def test_manager_block(self):
        from factsheet_metrics import profile_details
        page="Motilal Oswal Large Cap Fund\nType of Scheme : An open-ended equity scheme\nName of Fund Managers:    10.00\nMr. Ajay Khandelwal    Other column\nManaging Since: 06 February, 2024\nExpense Ratio\nMr. Unrelated Person"
        result=profile_details(page)
        self.assertEqual(result["schemeType"],"An open-ended equity scheme")
        self.assertEqual(result["fundManagers"],[{"name":"Ajay Khandelwal","managingSince":"2024-02-06"}])


class ExpenseMetricTests(unittest.TestCase):
    def test_explicit_columns(self):
        from factsheet_metrics import expense_metrics
        page="Expense Ratio\n    BER~           TER~\nRegular Plan    1.20%    1.50%\nDirect Plan    0.40%    0.60%"
        self.assertEqual({k:v["value"] for k,v in expense_metrics(page).items()},{"regularBER":1.2,"regularTER":1.5,"directBER":0.4,"directTER":0.6})
    def test_ambiguous_label(self):
        from factsheet_metrics import expense_metrics
        self.assertEqual(expense_metrics("Expense Ratio\nRegular: 2.62%\nDirect: 0.80%"),{})


class LabelledPerformanceTests(unittest.TestCase):
    def test_explicit_cagr(self):
        from factsheet_metrics import labelled_performance
        page="Fund Performance (CAGR)\nPeriod    Regular Plan    Benchmark    Direct Plan\n3 Years    10%    11%    12%"
        self.assertEqual(labelled_performance(page)["3Y"],{"regular":10,"benchmark":11,"direct":12,"unit":"%","planIdentityVerified":True})
    def test_chart_not_cagr(self):
        from factsheet_metrics import labelled_performance
        self.assertEqual(labelled_performance("FY 2025-26\nRegular Plan    Direct Plan    Benchmark"),{})


class HoldingsMetricTests(unittest.TestCase):
    def test_partial_table(self):
        from factsheet_metrics import holdings_metrics
        from factsheet_schema import validate_fields
        page="Top 2 Holdings\nCompany Name    % of Net Assets\nExample Ltd    6.2%\nOther Ltd    4.1%"
        result=validate_fields(holdings_metrics(page),"2026-10-31")
        self.assertEqual(result["holdings"]["coverage"],"partial")
        self.assertEqual(len(result["holdings"]["rows"]),2)
    def test_reject_changes_and_incomplete(self):
        from factsheet_metrics import holdings_metrics
        self.assertEqual(holdings_metrics("Top 10 changes in Holding\nCompany Name    % of Net Assets\nExample Ltd    6.2%"),{})
        self.assertEqual(holdings_metrics("Top 2 Holdings\nCompany Name    % of Net Assets\nExample Ltd    6.2%"),{})


class AllocationMetricTests(unittest.TestCase):
    def test_explicit_total(self):
        from factsheet_metrics import allocation_metrics
        from factsheet_schema import validate_fields
        page="Asset Allocation\nAsset Class    % of NAV\nEquity    75%\nDebt    20%\nCash    5%\nTotal    100%"
        result=validate_fields(allocation_metrics(page),"2026-10-31")
        self.assertEqual(result["assetAllocation"]["coverage"],"full")
        self.assertEqual(len(result["assetAllocation"]["rows"]),3)
    def test_partial_and_wrong_basis(self):
        from factsheet_metrics import allocation_metrics
        page="Sector Allocation\nSector    % of NAV\nFinance    20%"
        self.assertEqual(allocation_metrics(page)["sectorAllocation"]["coverage"],"partial")
        self.assertEqual(allocation_metrics(page.replace("% of NAV","% of Equity")), {})
    def test_inconsistent_total(self):
        from factsheet_metrics import allocation_metrics
        self.assertEqual(allocation_metrics("Asset Allocation\nAsset Class    % of NAV\nEquity    75%\nTotal    100%"),{})


class DiscoveryIntegrationTests(unittest.TestCase):
    def test_refresh_discovery_binding(self):
        import datetime as dt
        from refresh_amc_factsheets import discovery_candidates
        url="https://example.org/factsheet-October-2026.pdf"
        dated,unknown=discovery_candidates([(url,"October 2026 factsheet"),(url,"October 2026 factsheet")],dt.date(2026,11,28))
        self.assertEqual(dated,[(dt.date(2026,10,1),url)])
        self.assertEqual(unknown,[])
