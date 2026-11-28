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
