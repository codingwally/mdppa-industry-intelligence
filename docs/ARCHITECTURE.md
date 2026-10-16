# Current public evaluation mode

The project owner requested no sign-in. The deployed interface is public. The application automatically establishes a random HttpOnly, Secure, SameSite cookie and uses its hash to isolate each browser’s queue, recipients, configuration, evidence reviews and sandbox history. Review decisions do not overwrite shared source records. Public evaluation always disables live email. Manual collection is bounded per registered source, while service endpoints require a server-only collector token. The optional authenticated mode is retained in the API but is not required for Board evaluation.

# MDPPA Industry Intelligence — architecture

The full application is a public React/TypeScript application using Vite/Vinext, a server-only API and a durable D1 database. MDPPA's own site remains untouched. The original blue/yellow palette and supplied public brand icon are used in the evaluation interface; typography uses an Arial/Helvetica fallback to the site's proprietary fonts.

## Working flow

1. The fixed source registry declares supported RSS, HTML and document adapters. Planned agencies remain visible as manual-review sources.
2. A source check fetches robots.txt first, respects access restrictions, limits response size to 2 MB, times out requests and retries transient failures once. Individual detail requests are spaced. It does not bypass paywalls or challenges.
3. HTML/RSS extraction records the original URL and only established publication dates. Historic issue dates do not become publication dates. PDF links are retained as unverified candidates; PDF text/OCR is a later adapter.
4. Deterministic screening assesses actual motorcycle scope and five weighted criteria. The source content hash, discovery timestamp and scoring version are retained. No paid AI dependency is required.
5. D1 persists intelligence, source health, collection runs, recipients, queue entries, briefing history, review decisions and configuration. Source updates retain first discovery dates and expire human overrides when content changes.
6. Analysts inspect evidence, verify scope/status/dates, add written supporting provisions and re-score records. Overrides are audited; unsupported P0 cannot be forced by a priority dropdown.
7. Send This saves a review entry. Preview and approval are separate operations. The approval hash binds the reviewed content and recipient IDs; changed content requires a new preview. Idempotency keys prevent a duplicate provider submission from a repeated click.

## Boundaries

With `PUBLIC_DEMO=1`, the API creates a random anonymous session and rejects cross-origin JSON writes. Queues, recipients, scoring, reviews and sandbox history are namespaced to that session. The crawler service endpoints require the server-only `CRAWLER_SERVICE_TOKEN`. `PRIVATE_OWNER_SITE` remains off on the public deployment. The optional authenticated mode is available when `PUBLIC_DEMO` is disabled and the hosting access policy requires sign-in.

The service-status endpoint exposes only public-source records and crawler state. Recipient addresses are server-side and masked in the dashboard. They are never exported in the Pages snapshot. Emails escape source text and use BCC for authorized recipients. A successful email API request is labelled accepted by provider, never delivered to inbox without a verified webhook. Provider failure remains explicit.

Public-source records and collection runs are shared; browser review state is isolated. A multi-user production rollout needs role-based permissions, reviewer identities, retention policy, provider delivery webhooks, and source-review ownership before broader sharing.

## GitHub Pages

`pnpm build:pages` builds a separate public read-only frontend. It includes no private queue or recipient state. The full review workflow runs in the public application’s server, linked directly from Pages. The public repository is `codingwally/mdppa-industry-intelligence`. Its workflow publishes on `main` pushes and checks sources on scheduled/manual runs. Optional repository settings can refresh the public application using a server-only service credential stored as a GitHub secret.

## Limits to legal inference

Confidence is a source/extraction measure, not a legal opinion or statistical probability. EVIDA and EO 62 are historical baselines. Current amendments, specific model classification, tariff annexes and enforceability need review. The crawler never invents dates, obligations or bill enactment. Relevance criteria are explicit screening judgments rather than machine-verified legal conclusions.
