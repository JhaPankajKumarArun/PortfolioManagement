import io, unittest, zipfile
from openpyxl import Workbook
from disclosure_parser import tables, parse_equity
class ParserTests(unittest.TestCase):
    def test_csv(self):
        raw=b"Name of Instrument,ISIN,% of NAV\nEquity,,\nExample,INE040A01034,8.5%\nDebt,,\nBond,INE000000001,30\n"
        self.assertEqual(parse_equity(next(tables(raw,"test.csv"))[1]),[{"isin":"INE040A01034","name":"Example","weight":8.5}])
    def test_xlsx(self):
        b=Workbook();s=b.active
        s.append(["Name of Instrument","ISIN","% of NAV"])
        s.append(["Equity"]);s.append(["Example","INE040A01034",0.085]);s["C3"].number_format="0.00%"
        out=io.BytesIO();b.save(out)
        self.assertAlmostEqual(parse_equity(next(tables(out.getvalue(),"test.xlsx"))[1])[0]["weight"],8.5)
    def test_invalid(self):
        with self.assertRaises(ValueError):
            parse_equity([["Name of Instrument","ISIN","% of NAV"],["Equity","",""],["Example","INE040A01034",101]])
    def test_zip(self):
        out=io.BytesIO()
        with zipfile.ZipFile(out,"w") as z:z.writestr("a.csv","a,b")
        self.assertEqual(next(tables(out.getvalue(),"test.zip"))[1],[["a","b"]])
if __name__=="__main__": unittest.main()
