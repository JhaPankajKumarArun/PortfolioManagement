# Account Aggregator integration

NADL onboarding is informational only. No AA API or consent session is implemented. Obtain written confirmation of production eligibility and official FIU/partner API documentation before implementing consent creation, callback validation, encrypted data retrieval, revocation and normalization. Do not collect OTPs or scrape AA portals. Preserve CAS import and local ledger; reconcile holdings without fabricating transactions.

Remove any previously configured KITE_API_KEY, KITE_API_SECRET, KITE_REQUEST_TOKEN, KITE_ACCESS_TOKEN and BROKER_EXPORT_PASSWORD secrets from GitHub repository/environment settings, revoke broker sessions, and delete old workflow artifacts. Removing files on this branch does not remove secrets, historical commits, artifacts or workflows on other branches. Review the default branch separately. No live AA access or browser regression tests have been performed.
