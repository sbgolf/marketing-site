# RunSignup Community mockup prospect pipeline

This is the first guarded automation layer for finding local/regional races that are good fits for the StartLine Community/Hometown template, generating a private mockup candidate, and preparing owner-approved outreach.

## Steve-approved pilot scope

- Geography: local/regional only for now.
- Source priority: RunSignup first.
- Daily volume: at most 1 generated mockup per day; discovery/scoring may surface 3–5 candidates for review.
- Send approval: Steve approval is required before every race-director/customer send.
- Contact method: RunSignup contact forms are acceptable when no direct email is available.
- Digest: Telegram approval digest with `approve`, `skip`, `needs edits`, or `generate mockup` style actions is the preferred first version, but can be modified later.
- Auto-send: disabled. Do not auto-send until Steve explicitly changes this rule.

## Source of truth tables

### `public.race_mockup_prospects`

Stores discovered/scored candidate races before a mockup is generated.

Important fields:

- Race identity: `race_name`, `race_slug`, `race_city`, `race_state`, `region`, `event_date`.
- Discovery/source: `source_platform`, `source_url`, `source_race_id`, `source_urls`, `extracted_facts`, `source_coverage`.
- Registration/contact: `registration_url`, `registration_platform`, `registration_race_id`, `official_url`, `official_domain`, `contact_sources`.
- Scoring: `community_fit_score`, `business_opportunity_score`, `source_quality_score`, `outreach_viability_score`, `total_score`.
- Decisioning: `qualification_status`, `qualification_reason`, `disqualifiers`, `owner_approval_status`, `owner_decision_notes`.

### `public.race_mockup_generation_jobs`

Stores mockup generation and QA status after a prospect is qualified.

Important fields:

- `prospect_id`
- `job_status`
- `template`
- `mockup_token`
- `mockup_url`
- `config_path`
- `branch_name`
- `pull_request_url`
- `deploy_preview_url`
- `source_bundle`
- `source_coverage`
- `qa_status`
- `qa_report`
- `site_auditor_status`
- `owner_approval_status`
- `outreach_id`

### Existing send log: `public.race_mockup_outreach`

The final send gate remains `race_mockup_outreach`. A prospect/mockup generation job can only become customer-sendable after:

1. Mockup generation completes.
2. Automated QA passes.
3. Site Auditor review passes.
4. Steve approves send.
5. Duplicate checks pass against `race_mockup_outreach`.
6. The branded send gate accepts the email/contact-form workflow and logs provider/contact metadata.

## Qualification thresholds

Use `scripts/lib/mockup-prospect-scoring.mjs` as the deterministic baseline.

Scoring bands:

- `80–100`: `qualified_for_mockup` if no disqualifiers.
- `65–79`: `needs_review`.
- `45–64`: `scored`; keep in queue but do not generate yet.
- `<45`: `skipped`.

Score components:

- Community fit: 35 points.
- Business opportunity: 25 points.
- Source quality: 20 points.
- Outreach viability: 20 points.

Disqualifiers force review/skip even when the numeric score is high:

- No RunSignup source in this first pilot.
- Performance/BQ-coded positioning.
- Destination-positioned language.
- Trail/ultra positioning.
- Race date too close for first-wave outreach.

## Daily operating sequence

1. Discover local/regional RunSignup races.
2. Normalize source URL, registration race ID, city/state, date, distance list, and contact path.
3. Score candidates with the deterministic scoring module.
4. Store candidates in `race_mockup_prospects`.
5. Select at most 1 `qualified_for_mockup` candidate per day for generation.
6. Generate a source-backed Community private mockup config in `race-templates`.
7. Run race-template validation/build/rendered private mockup checks.
8. Run Site Auditor readiness review.
9. Prepare a Telegram owner digest with:
   - race name/location/date
   - score and top reasons
   - source quality notes
   - mockup/deploy-preview link when available
   - proposed subject/body when outreach is drafted
   - decision options: approve, skip, needs edits, generate mockup
10. Send only after Steve approves that specific race/director send.
11. Log the accepted send/contact-form submission in `race_mockup_outreach`.

## Customer-facing quality gates

Before a mockup can be included in outreach:

- Use source-backed facts only.
- Do not invent pricing, schedules, GPX/elevation, sponsors, packet pickup, or awards.
- Hide unavailable sections entirely instead of rendering blank panels, `TBD`, or reserved gaps.
- Suppress GPX/elevation/profile/course visual shells when source data is unavailable.
- Keep provenance/uncertainty notes internal.
- Preserve `noindex,nofollow` on private mockup routes.
- Keep all visible copy runner/race-director-facing.
- Block internal/private chrome such as `no-index`, `source-backed concept`, `private preview`, or provenance labels unless Steve explicitly asks for internal review chrome.
- Avoid Steve-rejected email wording such as `no-index` and `Bailey`.
- Do not disparage the race's current site.
- Every outreach send remains reversible and logged.

## Current implementation status

Implemented:

- Supabase migration for prospect and generation-job tables.
- Deterministic Community fit scoring module.
- Supabase prospect payload/upsert CLI: `npm run upsert:mockup-prospect -- --input prospects.json`.
- Dry-run RunSignup discovery CLI: `npm run discover:runsignup-prospects -- --state TN --start-date 2026-10-01 --end-date 2027-05-01`.
- Telegram-ready owner approval digest CLI: `npm run digest:mockup-prospects -- --input discovery-output.json`.
- Owner-gated Community private mockup config generator: `npm run generate:mockup-config -- --input discovery-output.json --candidate-index 2 --owner-approved --output /tmp/race-config.json`.
- Supabase generation-job recorder for generated configs: `npm run record:mockup-generation-job -- --input race-config.json --prospect-id <uuid> --mockup-base-url https://mockups.startlinesites.com --dry-run`.
- Dry-run outreach handoff from approved generation jobs: `npm run prepare:mockup-outreach-from-job -- --generation-job job.json --prospect prospect.json --to director@example.test --owner-approved-send --dry-run`.
- Node tests for known pilot behaviors:
  - local RunSignup community races qualify;
  - non-RunSignup races are not send-ready in this pilot;
  - Performance/trail races are disqualified from Community-first automation;
  - prospect input normalizes into a scored Supabase payload with duplicate lookup filters;
  - RunSignup public race API results normalize into source-backed scored prospect candidates;
  - scored discovery output renders as a Steve approval digest with explicit generate/skip/edit/collect-more-info decisions;
  - approved qualified prospects generate race-template-compatible Community private mockup config JSON while omitting unavailable optional data;
  - generated configs produce idempotent `race_mockup_generation_jobs` payloads without running QA or customer outreach;
  - approved generation jobs can prepare branded outreach payloads only after QA, Site Auditor, owner approval, and an explicit per-send owner flag.

Not yet implemented:

- Supabase-backed one-command send from approved generation jobs.
