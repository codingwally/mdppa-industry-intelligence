# MDPPA Industry Intelligence & Regulatory Monitoring

A working, public proof of concept with no sign-in requirement for the Motorcycle Development Program Participants Association. It collects public-source developments, screens actual motorcycle applicability, explains relevance/priority, supports evidence review, and prepares human-approved briefings. It does not modify mdppa.site.

Open the [working application](https://mdppa-industry-intelligence.wallyesteban1993.chatgpt.site) without signing in. The GitHub Pages Board dashboard is published from this repository’s `main` branch through GitHub Actions.

## What is working

- Responsive executive dashboard, intelligence feed, impact drawer, source health, scoring configuration, audit history and seven-screen Board presentation.
- RSS/HTML/document collection with robots checks, bounded responses, timeouts, rate spacing and honest failures.
- Seven real initial records: two historical legal baselines and five MDPPA industry updates. Current source availability can change. Historical material is not labelled as a new publication.
- Explainable weighted scoring with confidence and urgency gates, conservative scope handling and separate threat/opportunity flags.
- Server-side persistent queue and recipient list, email preview, approval hashes, idempotency and explicit sandbox/provider status.
- Analyst evidence verification, scope/status/date review, re-scoring and audited priority overrides.
- GitHub Pages Board dashboard with a daily public-source collection workflow for approximately 06:00 Asia/Manila.

## Run and check

Node 24 and pnpm 11.25 are used. In an ordinary Node environment:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm crawl
pnpm build:pages
```

The full public application uses the included Sites/Vinext integration. Its source manifest declares a DB binding and migrations in `drizzle/`. Changes are built with the supported Sites build helper; hosted publication provisions D1 and applies the schema migrations. Initial records seed idempotently outside migrations. Keep `.sites-runtime/`, credentials, `.env*`, local databases and build output out of source control.

For local development outside the managed environment, use `pnpm dev` with the starter's documented D1 migration setup. In this managed environment, use the supported preview workflow only when the control-browser skill is available. The hosted collector and persistent database were exercised successfully after deployment. No browser UI test was available during the initial build; TypeScript, production builds and the API/core test suite are verified separately.

## Deployment

The full application opens publicly without sign-in. An automatic secure cookie separates each browser’s queues, recipients, scoring settings, reviews and sandbox briefing history. Public evaluation always forces sandbox email. GitHub Pages hosts the public **read-only** Board dashboard, including filters, analysis, source checks, CSV export and the seven-slide presentation. Its notice links directly to the working application for server-backed actions.

Repository: `codingwally/mdppa-industry-intelligence`. In **Settings → Pages**, use **GitHub Actions**. The `Publish Board dashboard` workflow tests, type-checks and publishes `dist-pages/` on pushes to `main`. Scheduled and manual runs also collect public sources and retain their history before publishing. No recipient, queue, email history or review data is included in the static snapshot. Check the Actions run and Pages deployment result before sharing a newly changed URL.

Optional settings for refreshing the full application: repository variable `MDPPA_SITE_ORIGIN` and secret `MDPPA_SITE_SERVICE_TOKEN`. They are used only by `scripts/refresh-hosted.ts`; without them, the Pages collection still runs independently. Avoid duplicate crawler schedules. See `docs/SCHEDULE.md`.

## Email configuration

The default is `EMAIL_MODE=sandbox`. No real email has been sent by this build. Add authorized recipients through Email center; addresses are saved in the browser session’s server-side storage and masked in views.

For a later live rollout, configure these server-only runtime values using the hosting secret manager:

- `EMAIL_MODE=live`
- `RESEND_API_KEY` as a secret
- `EMAIL_FROM` as a verified sender address

A sending provider and verified domain are not supplied. Each digest must still be previewed and approved in the interface. A provider acceptance is not proof of inbox delivery. Fictional fixtures are blocked from live sends.

## Coverage and interpretation limits

The registry includes 22 sources, 12 currently enabled adapters. Some government sites return errors or block automation; these states remain visible. Planned sources explicitly show manual review. Full PDF extraction/OCR, exhaustive LGU coverage, semantic cross-publisher deduplication, authoritative amendment tracking and role-based multi-user governance remain later work.

Source/extraction confidence is separate from legal validity. Publication, enactment and enforceability are distinct. Bills are not laws. No missing effective date or compliance deadline is guessed. Exact motorcycle model/class coverage and specific tariff lines require evidence. The initial EVIDA and EO 62 records are historical baselines, not claims of new regulation today.

Read:

- [Architecture and security](docs/ARCHITECTURE.md)
- [Scoring and fixtures](docs/SCORING.md)
- [Board demonstration guide](docs/BOARD_GUIDE.md)
- [Indicative operating costs](docs/COSTS.md)
- [Daily collection contract](docs/SCHEDULE.md)

## Scheduling

The GitHub workflow requests daily checks around 06:00 Asia/Manila; GitHub may delay scheduled runs. Activity log shows completed collection runs and explicit source errors. This schedule updates the public Pages snapshot. Refreshing the full application requires the optional server-only settings described above. Manual collection remains available in the public application.

## Public evaluation access

The owner requested no sign-in. PUBLIC_DEMO=1 enables anonymous browser sessions; email delivery is always sandbox-only in this mode. Review data is isolated by an opaque HttpOnly session cookie. Shared source collection is throttled to one check per source per five-minute window. Service endpoints require CRAWLER_SERVICE_TOKEN even on the public site; the secret is server-side only. No contact address is exposed across browser sessions.
