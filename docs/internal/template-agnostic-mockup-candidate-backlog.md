# Template-agnostic mockup candidate backlog

StartLine should keep a large durable candidate warehouse, but only create mockups for the highest-value races first. Raw discovery volume is useful; it is not the active production queue.

## Layers

1. **Candidate warehouse**
   - Broad RunSignup/web discovery results.
   - Deduped by source platform/race ID, source URL, and normalized name/date/state.
   - Retained with `held`, `skipped`, and `inactive` records so future scans do not requeue poor fits.

2. **Qualified active backlog**
   - Candidates promoted only after scoring, source review, and contact viability checks.
   - Contact-form-only and no-contact candidates stay in research buckets while direct/routing-email candidates are available.

3. **Daily production queue**
   - The next few `generate_now` candidates ranked by StartLine value.
   - Before generation, do a lightweight revalidation of source URL, event date, verified contact, registration/current facts, and duplicate generation/outreach state.

## Template-fit fields

Every candidate should carry these derived fields in metadata/reporting:

- `primary_template_fit`
  - `community`
  - `performance`
  - `destination`
  - `trail_adventure`
  - `charity_cause`
  - `operator_portfolio`
- `secondary_template_fits`
- `template_fit_scores`
- `recommended_lane`
- `template_readiness_status`
- `contact_quality`
- `startline_value_score`

## Active backlog buckets

- `generate_now` — high StartLine value, source-rich, verified direct/routing/named email, no duplicate generation/outreach/hold.
- `research_contact_first` — good race fit but only form/no contact path.
- `research_source_first` — verified contact exists but source or template readiness needs review.
- `hold_later` — held/skipped/inactive, sensitive/complex, weak opportunity, or lower priority while stronger candidates exist.
- `exclude_existing` — existing mockup generation or outreach already exists.

## Ranking rules

Prioritize:

1. Verified contact path: named race director email, then direct race/org email, then strong routing inbox.
2. Source-rich race facts: date, location, distances, registration, schedule/logistics, story/cause, sponsors, images/logos.
3. Clear StartLine opportunity: RunSignup-first presence, weak/no standalone site, or confusing registration/contact flow.
4. Strong template fit for one of the ready template lanes.
5. 3–10 month outreach runway.
6. No duplicate job, outreach, hold, skip, or inactive status.

De-prioritize:

- contact-form-only races when direct-email candidates are available;
- no official/source-backed contact;
- stale/duplicate races;
- polished existing standalone sites with weak improvement opportunity;
- candidates that fit a template not yet mature enough for production-quality mockups.

## Refresh cadence

- Run broad discovery weekly/twice-weekly, or when the `generate_now` queue drops below ~15 candidates.
- Do not rerun broad scans before every mockup if the ranked queue is healthy.
- Re-rank and revalidate before a batch is generated or sent.

## Commands

Rank a discovery JSON file without writing to Supabase:

```bash
npm run rank:mockup-backlog -- \
  --input /tmp/discovery.json \
  --existing-prospects /tmp/existing-prospects.json \
  --existing-jobs /tmp/existing-jobs.json \
  --existing-outreach /tmp/existing-outreach.json \
  --now 2026-07-31T12:00:00Z
```

The command is review-only. It does not write to Supabase, generate mockups, submit forms, or send outreach.

## Future Supabase implementation notes

The ranking code is intentionally usable before a schema migration. A future migration can persist the derived fields in candidate metadata or dedicated columns. Until then, use the report output to choose reviewed refill batches.
