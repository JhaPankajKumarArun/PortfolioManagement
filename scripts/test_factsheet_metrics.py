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
