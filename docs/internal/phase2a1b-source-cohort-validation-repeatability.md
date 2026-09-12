# Phase 2A-1B Source Cohort Validation Repeatability Lock

This document is the public-safe operating contract for the one-time CMO Phase 2A-1B source-cohort validation gate. It intentionally contains no prospect email addresses, private tokens, credentials, production connection strings, or raw production-history dumps.

## Versioned policy

- Policy version: `phase2a1b-source-cohort-validation-v1.0.0`
- Source authorization: `StartLineSites CMO Phase 2A-1B — Source Cohort Validation Gate`
- Scope: existing nine Phase 2A-1B READY / NEEDS_STEVE_DECISION records only: `5, 10, 13, 15, 17, 19, 22, 24, 30`
- Final states allowed by the runner:
  - `APPROVE_FOR_ASSET_PREPARATION`
  - `NEEDS_STEVE_DECISION`
  - `EXCLUDE`

The runner fails closed if the bounded nine candidate numbers are missing, duplicated, or if schema fields are invalid.

## No-side-effect boundary

The deterministic runner reads a local JSON evidence file and writes only local artifacts. It does not perform network calls, Supabase mutations, customer/prospect sends, contact-form submissions, mockup creation, cron creation, or cron activation.

Keep enabled and unchanged outside this runner:

- StartLine audit request watcher + draft
- StartLine Phase 3B-1 transaction reconciliation monitor

Keep paused outside this runner:

- outbound growth jobs
- sourcing jobs
- Lane D jobs
- mockup generation jobs
- engagement follow-up jobs

Do not create a recurring sourcing cron for this gate.

## Input schema summary

Each candidate evidence row must include:

- `candidateNumber`
- `raceName`
- `runSignupUrl`
- `individualRaceNotOperator`
- `raceLevelRunSignupPage`
- `futureDate`
- `leadTimeDays`
- `identityAndOrganizerVerified`
- `websiteNeedSeverity`: `HIGH`, `MEDIUM`, or `LOW`
- `strongMediumNeed`
- `commercialCapacity`: `HIGH`, `MEDIUM`, or `LOW`
- `eventDetailReliability`: `CURRENT_AND_CONSISTENT`, `STALE_OR_CONFLICTING`, or `UNVERIFIED`
- `contactStatus`: `VERIFIED_RACE_DIRECT`, `VERIFIED_ORGANIZER_ROUTING`, `PLAUSIBLE_REQUIRES_STEVE_CONFIRMATION`, `INVALID_OR_WRONG_ORGANIZATION`, or `NO_CONTACT`
- `suppressionClear`
- `duplicateResult`
- `laneAFit`
- `obviousIncrementalValue`
- `historyMatches[]` with `source`, `recordId`, `stableKey`, `classification`, and `implication`
- `officialSourceUrls[]`
- `evidenceHashes[]`

## Fixed rubrics

Approval requires all hard gates to pass:

- exact race identity/date/current details verified
- Lane A fit
- website need is `HIGH` or strong `MEDIUM`
- commercial capacity is `MEDIUM` or `HIGH`
- no real prior contact or duplicate ambiguity
- one verified race-direct or organizer-routing contact
- 120+ day lead time unless Steve later approves a limited-runway exception
- no suppression
- obvious incremental Community-site value

Owner-decision state is reserved for one narrow unresolved issue after hard safety gates pass:

- 90–119 day runway
- plausible but not fully verified contact
- borderline `MEDIUM` website need
- strategic tier fit
- ambiguous but documented non-customer history

Hard exclusions include:

- `LOW` website need
- existing meaningful official event page
- unresolved prior outreach or duplicate ambiguity
- wrong organization/contact
- stale details that cannot be verified
- weak commercial capacity
- no suitable contact
- under 90-day runway
- not a narrow Community offer fit

## State machine

1. `SCHEMA_PREFLIGHT`
2. `BOUNDED_COHORT_CHECK`
3. `SOURCE_EVIDENCE_REPLAY`
4. `RUBRIC_CLASSIFICATION`
5. `HISTORY_DUPLICATE_RECONCILIATION`
6. `OWNER_DECISION_LEDGER_WRITE_LOCAL`
7. `RUN_MANIFEST_WRITE_LOCAL`
8. `NO_SIDE_EFFECT_CERTIFICATION`
9. `PACKAGE_FOR_PRIVATE_REVIEW`
10. `STOP_FOR_INDEPENDENT_REVIEW`

Any schema, bounded-cohort, history, duplicate, stale-source, or contact-integrity defect transitions to `EXCLUDE` or fails closed before packaging.

## Corrected yield reporting

The runner emits both required views:

- Independent filter counts across all deeply reviewed candidates.
- True sequential waterfall using the fixed stage order from the validation gate.

The runner also returns one of:

- `SAMPLED LANE A SUPPLY — STRONG`
- `SAMPLED LANE A SUPPLY — MODERATE`
- `SAMPLED LANE A SUPPLY — WEAK`
- `SAMPLED LANE A SUPPLY — INCONCLUSIVE`

The report must not describe the 11-state directional sample as the national Lane A market.

## Golden fixture replay

The test fixture in `tests/fixtures/phase2a1b-source-cohort-validation-input.json` proves deterministic replay, fixed classification outcomes, separate independent-vs-sequential waterfall counts, and no-side-effect manifest output.

Run:

```bash
npm run validate:phase2a1b-source-cohort -- --input tests/fixtures/phase2a1b-source-cohort-validation-input.json --output-dir /tmp/phase2a1b-fixture --golden-manifest tests/fixtures/phase2a1b-source-cohort-validation-golden.json
npm test -- tests/phase2a1b-source-cohort-validation.test.mjs
```

## Private evidence deliverables

A real validation run writes:

- `STARTLINESITES_CMO_PHASE2A1B_SOURCE_COHORT_VALIDATION_REPORT.md`
- `STARTLINESITES_CMO_PHASE2A1B_FINAL_OWNER_SOURCE_COHORT.md`
- `STARTLINESITES_CMO_PHASE2A1B_CANDIDATE_RECLASSIFICATION_TABLE.md`
- `STARTLINESITES_CMO_PHASE2A1B_CORRECTED_YIELD_WATERFALL.md`
- `STARTLINESITES_CMO_PHASE2A1B_HISTORY_MATCH_RECONCILIATION.md`
- `STARTLINESITES_CMO_PHASE2A1B_SOURCE_URL_MANIFEST.md`
- `STARTLINESITES_CMO_PHASE2A1B_OWNER_DECISION_LEDGER.json`
- `STARTLINESITES_CMO_PHASE2A1B_RUN_MANIFEST.json`
- `STARTLINESITES_CMO_PHASE2A1B_NO_SIDE_EFFECT_CERTIFICATION.json`

Zip these into `STARTLINESITES_CMO_PHASE2A1B_SOURCE_COHORT_VALIDATION_EVIDENCE.zip`, scan for unmasked emails/secrets/tokens, return the package privately, and stop for Steve + independent CMO review.
