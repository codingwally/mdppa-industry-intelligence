# Explainable scoring

Score = sum(weight × rating ÷ 5), rounded to an integer. Ratings range from 0 to 5.

| Criterion | Default weight |
|---|---:|
| Actual motorcycle applicability | 30 |
| Regulatory / compliance consequences | 20 |
| Financial / operational consequences | 20 |
| Affected stakeholder breadth | 15 |
| Strategic significance | 15 |

The separate confidence figure assesses source/extraction quality. It does not add points to relevance. Unverified or uncertain motorcycle coverage caps relevance at 59. Express non-applicability caps it at 20. Unknown deadlines never establish urgency.

P2 starts at 35. Below 35 is archived. P1 starts at 70, with verified scope and confidence of at least 85. P0 starts at 85 and additionally requires urgency, evidenced adverse consequences and an operative legal status. Urgency requires a verified effective/compliance date within 14 days, or an evidenced severe current operational disruption. Proposed, suspended, repealed and unverified legal statuses cannot produce P0. A high-impact proposal can still merit P1 review.

Routine news starts with conservative screening ratings because a sector reference does not establish material financial or regulatory consequences. Analysts can record evidence, rate the five criteria, confirm scope and dates, and let the engine re-score. Every review records the actor, time and supporting source.

P1/P2/archive overrides require a written reason. They change priority only, keeping independent importance/urgency flags distinct. Source-content changes expire overrides. Configuration changes are audited. Source-document deduplication is deliberately conservative: canonical URL, identifiable document key with matching year/path, and source hash; the system does not merge unrelated documents just because a title looks similar.

## Fixtures

- Real: RA 11697 (EVIDA) is a historical high-priority framework. Its original statute date is stored; no specific new compliance deadline is claimed.
- Real: EO 62 body text is relevant to tariffs but insufficient to verify motorcycle tariff lines. Coverage remains uncertain pending Annex A/current-amendment review.
- Fictional: near-term motorcycle certification requirement tests P0 gates.
- Fictional: general vehicle restamping with uncertain two-wheel scope tests the uncertainty cap.
- Fictional: proposed motorcycle bill tests importance without enforceability or urgency.

Fictional fixtures are visibly labelled, excluded from live dashboard metrics and barred from the live provider.
