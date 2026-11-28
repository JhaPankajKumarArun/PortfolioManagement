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
