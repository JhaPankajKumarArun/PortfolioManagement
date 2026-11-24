# PortfolioManagement — modular architecture branch

This branch retains the existing browser-based Personal Wealth Management application and its PWA, market-data, and TRI workflows.

## Source layout

- `index.html`: application HTML and embedded PDF.js vendor payloads (retained for compatibility).
- `css/app.css`: extracted application styling.
- `js/app.js`: extracted existing application logic, still in classic-script mode.
- `js/register-sw.js`: service worker registration.
- `sw.js`: offline app shell cache, updated to include extracted assets.
- `.github/workflows/portfolio-tests.yml`: AMFI parsing test, updated to read `js/app.js`.

This is an intentionally **behavior-preserving first refactor**, not yet a fully dependency-isolated ES-module rewrite. The next steps are to isolate state and financial engines with test coverage, then incrementally move features into ES modules.

## Running locally

From the repository root:

```bash
python -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000.

## Data and privacy

Portfolio data remains in browser-local storage using the existing `portfolio-v1` key. No personal holding data should be committed to this public repository. The app fetches public market data when online, but portfolio records should remain local. Make a portfolio backup before switching origins, devices, or browsers.

## Architectural safety notes

The two PDF.js payloads remain embedded as `text/plain` script elements because the existing code expects this form. Splitting them requires a separate PDF import regression test. Likewise, `js/app.js` is kept as a classic script so all existing global bindings and event handlers retain their ordering; do not change it to `type="module"` without isolating dependencies.

