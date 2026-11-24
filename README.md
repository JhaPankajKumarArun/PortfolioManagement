# PortfolioManagement

Ordered classic scripts in js/: core, analytics, planning, controller, tax-prices, fund-analysis, market-data, performance and startup app.js. Four independent calculation engines in js/engines. ES module migration and further risk/tax/benchmark isolation remain pending. PDF.js payloads remain embedded. Portfolio data remains browser-local under portfolio-v1; never commit personal data.

Run python -m http.server 8000 --bind 127.0.0.1 from the repository root. Open http://localhost:8000. Run node tests/engines.mjs and node tests/amfi.mjs using Node 22. Browser/PWA regression testing remains required.
