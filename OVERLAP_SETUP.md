 # Mutual fund overlap

Export equity holdings from an official AMC portfolio disclosure into one JSON file per scheme. Use exact portfolio holding name, disclosure date, source URL, unique underlying security ISINs and percentage of total scheme NAV (not percentage of equity allocation). Consolidate repeated ISIN rows first. Do not include cash, debt, derivatives or fund-of-fund holdings in this equity-only import. The app validates structure but cannot authenticate the source. Example (synthetic):

```json
{
  "scheme": "Exact scheme name",
  "date": "2026-10-31",
  "source": "Official AMC disclosure URL",
  "holdings": [
    {
      "isin": "INE000A01010",
      "name": "Illustrative security",
      "weight": 5
    }
  ]
}
```

Import under Overview > Mutual fund overlap. Coverage is the share of fund value with accepted disclosures, not the completeness of underlying equity data. Pairwise overlap sums minimum shared weights, only for identical dates. Combined exposure may use mixed dates and current recorded fund values. Missing and older-than-45-day disclosures are excluded. No live data provider or automatic spreadsheet conversion is implemented.
