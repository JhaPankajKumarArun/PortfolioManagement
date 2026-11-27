# PortfolioManagement

Privacy-first personal wealth management PWA for mutual funds and stocks.

## Architecture and privacy

- UI scripts in js/; calculation engines in js/engines/; integrity and storage modules in js/core/; market-data providers in js/services/providers/.
- Portfolio records use browser-local portfolio-v1 storage. Historical public market data is cached locally in IndexedDB. Public data requests require network access; offline use depends on installed service-worker assets.
- Never commit personal transactions, backups or credentials. Export independent backups before replacing data.

## Run locally

Use Node 22 for tests. From the repository root:

```sh
python -m http.server 8000 --bind 127.0.0.1
```

Open http://127.0.0.1:8000. GitHub Actions runs integration and Chromium/WebKit browser regression suites. See the workflow files for authoritative test commands and dependencies.

## Financial methodology

- FIFO accounting includes recorded transaction charges. Lifetime gain is realized plus unrealized gain; cash flows are separate from market gain.
- Period gain is closing value minus opening value minus net contributions. Percentage uses Modified Dietz; lifetime XIRR is annualized and withheld when a unique supported root cannot be determined.
- Missing historical valuations are not zero. Carried-forward transaction prices are estimates. Benchmark comparisons require aligned dates and valid returns; monthly Dietz is not exact daily TWRR.
- Optional corporateActions records support split and bonus accounting. Historical stock imports require explicit price-basis selection; split-adjusted series require a verified cutoff. Bonus-adjusted history is not automatically normalized.
- Tax estimates are provisional: classifications may be inferred, mixed-rate periods use blended rates, and exemptions, historical basis, loss allocation and current statutory rules require verification. Do not use estimates as filing-ready advice.

## Phase 1 release gates

- Confirm integration, browser regression and deployment success on the release commit.
- Validate actual iPhone Safari and installed PWA, including offline reload, backup/restore, overlap navigation and historical imports.
- Verify populated overlap pair navigation and remaining financial edge cases.
- Complete statutory tax review or retain explicit estimate-only limitations.
- Create a release tag only after reviewing these gates. Passing automated tests alone does not establish production readiness.
