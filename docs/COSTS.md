# Indicative recurring costs — 16 October 2026

Planning assumptions: 12 supported source adapters, one daily run, at most five selected detail pages per source, fewer than 25 reviewers, one digest/day and 20 recipients. This is approximately 600 recipient-deliveries/month. No paid plan was purchased and no paid AI API is used.

| Component | Pilot estimate | Condition |
|---|---:|---|
| Deterministic collection/scoring | $0 AI/API fees | Uses public sources; engineering and source-review labor excluded |
| GitHub public read-only frontend | $0 hosting on eligible GitHub Free public repositories | Correct repository account/access and Pages setup required |
| GitHub Actions | $0 for standard public-repository runners under GitHub's published terms | Private repositories use their plan's included minutes/overages |
| Separate self-managed Cloudflare backend / D1 | May fit a $0 prototype allocation | Workers free CPU limits can be too small for HTML parsing; measure before choosing a plan |
| Resend transactional email | $0 while within the free allowance | Current published free allowance is 3,000/month and 100/day; domain verification and recipient-count limits apply |
| Full private Site | Depends on the user's current platform entitlement and quotas | This deployment is platform-managed; standalone Cloudflare prices are not a quote for Sites |
| Domain, maintenance, legal review | Not included | Existing subdomain can avoid a new domain; assign staff review time |

The practical pilot service-cost target is $0 incremental usage where existing entitlements and free allocations suffice. This is an assumption, not a guaranteed operating bill. Growth, a CPU-capable paid backend, paid scheduled tasks, private CI usage, monitoring/retention or higher email volume can introduce charges. Verify actual plan entitlements before adoption. No USD/PHP conversion is assumed.

Official pricing and limits checked for this estimate:

- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/platform/pricing/
- https://resend.com/pricing

An organizational rollout should budget source-adapter maintenance, legal verification and governance as well as infrastructure.
