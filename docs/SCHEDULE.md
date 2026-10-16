# Daily collection contract

The GitHub Actions workflow requests checks at approximately 06:00 Asia/Manila daily (22:00 UTC on the preceding UTC date). GitHub cron may be delayed. Check Actions and Activity log for evidence of completed collection; a workflow file alone is not evidence of a successful run.

Pushes to `main` test, type-check, build and publish the Board dashboard. Scheduled/manual runs additionally crawl the fixed public-source registry, retain public-source history and deploy the resulting snapshot. Source errors remain visible; a run can complete with unavailable sources. No private recipient or review-session data enters the snapshot. The initial deployment does not wait for a new crawl.

The full public application exposes these protected service endpoints:

- GET `/api/service-status`: public-source registry, real records and collection runs.
- POST `/api/crawl-service`: JSON `{"sourceIds":["evida"]}`; one to three enabled registered source IDs. Use one per request for bounded work.

They require `Authorization: Bearer <CRAWLER_SERVICE_TOKEN>`. The hosted platform also accepts its existing service token in `OAI-Sites-Authorization`; the optional refresh script sends both headers only to the configured Site. Never expose the token in source, workflow text or logs.

To refresh that application from GitHub, configure repository variable `MDPPA_SITE_ORIGIN` and repository secret `MDPPA_SITE_SERVICE_TOKEN`. Without them, hosted refresh is explicitly skipped and Pages public-source collection still works. Avoid duplicate crawler schedules.

A run checks enabled sources sequentially, respects robots.txt and access controls, limits request size/time, records failures and preserves first-discovery dates. Routine collection never sends email. Briefing delivery remains a separate reviewed sandbox action in public evaluation mode.
