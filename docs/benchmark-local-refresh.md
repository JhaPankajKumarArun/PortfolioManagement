# Local TRI refresh (Windows)

The official source is https://www.niftyindices.com/reports/historical-data. Use only if your access and redistribution are permitted by the provider. Do not bypass access restrictions. No portfolio files are needed.

From a clean checkout of refactor/modular-architecture, run in PowerShell:

    git pull --ff-only
    py -3 scripts/refresh_benchmark_tri.py

The script uses the Python standard library only. Inspect the output and data/benchmarks/*.json. If the provider permits redistribution, publish only those verified public snapshots:

    git add data/benchmarks/*.json
    git commit -m "Refresh permitted official TRI history"
    git push origin HEAD:refactor/modular-architecture

If HTML is returned even locally, stop and use an authorized TRI provider. Do not substitute price indices, ETF prices or invented values. A failed refresh preserves prior validated snapshots.
