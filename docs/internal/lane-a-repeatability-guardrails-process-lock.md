# Lane A Repeatability Guardrails Process Lock

This public-safe document supersedes the narrower Phase 2A-1B source-cohort validation replay note for PR #190.

## Authority

- Authoritative specification: `STARTLINESITES_CMO_LANE_A_REPEATABILITY_GUARDRAILS.md`
- Required specification SHA-256: `fa6d777eb065456ad5da3b0877761cf79cf5f50e4dcd2283c3cac48f6419144c`
- Canonical policy file: `config/startline-lane-a-sourcing-policy-v1.json`
- Policy ID/version: `startline-lane-a-sourcing-policy` / `1.0.0`

The policy JSON is the source of truth for enums, hard exclusions, scoring rubrics, evidence freshness, no-send/no-write controls, state transitions, output artifacts, and recurring-cron certification rules. Material policy changes require a new version, PR, focused tests, and Steve approval.

## Commands

Fixture regression replay:

```bash
npm run cmo:lane-a:replay-fixtures
```

Owner-invoked certified fixture runner shape:

```bash
npm run cmo:lane-a:source -- --policy config/startline-lane-a-sourcing-policy-v1.json --run-id <id> --mode fixture --input <local-evidence.json> --output-dir <private-output-dir>
```

PR #190 certifies frozen fixture replay and governance scaffolding only. `--mode live-read-only` is intentionally disabled and exits fail-closed with `LIVE_READ_ONLY_MODE — NOT CERTIFIED` until a separate adapter is certified to perform live public discovery, history checks, and suppression verification. Do not treat a local evidence file as live verification.

The legacy `validate:phase2a1b-source-cohort` command remains a bounded regression subsystem for the original nine-candidate fixture replay. It is not the future generic sourcing process.

## Boundaries

This PR does **not** authorize:

- fresh candidate sourcing;
- mockup generation;
- prospect/customer contact;
- contact-form submission;
- production prospect writes;
- outbound job activation;
- recurring sourcing cron creation;
- Phase 2A-1C;
- Phase 2A-2.

Safety monitors remain outside this runner and must stay enabled/unchanged. Outbound growth, sourcing, Lane D, mockup, CDO, and engagement-follow-up jobs remain paused.

## Repeatability controls

The runner enforces:

- machine-readable policy loading with manifest policy SHA-256;
- fixed JSON schemas and enum checks, including duplicate, suppression, lead-time, Lane A fit, incremental-value, official-site classification, and timestamp evidence;
- component-based website-need scoring;
- component-based commercial-capacity scoring;
- hard exclusions that owner decisions cannot override;
- at most one unresolved owner-decision issue for narrow `NEEDS_STEVE_DECISION`;
- explicit deviation records for blocked process steps;
- stage-gated candidate transitions with no skip allowed;
- no-send/no-write environment sanitization;
- private-only run outputs and manifest hashes;
- separated monotonic sequential filters and outcome branch reconciliation.

## Corrected frozen fixture truth

The frozen sanitized nine-candidate replay is locked to:

- Candidate 17: `APPROVE_FOR_ASSET_PREPARATION`
- Candidate 10: `NEEDS_STEVE_DECISION` — `LIMITED_RUNWAY`
- Candidate 5: `NEEDS_STEVE_DECISION` — `CONTACT_VERIFICATION`
- Candidates 13, 15, 19, 22, 24, 30: `EXCLUDE`

Count lock:

- `APPROVE_FOR_ASSET_PREPARATION`: 1
- `NEEDS_STEVE_DECISION`: 2
- `EXCLUDE`: 6

The fixture is a sanitized regression snapshot only. It is not fresh sourcing evidence and does not authorize Candidate 17 to enter Phase 2A-1C. Before any later Phase 2A-1C step, live read-only history/suppression checks, freshness checks, Steve source approval, and an owner-decision ledger entry are still required.

## Private outputs

A run writes private artifacts such as:

- `STARTLINESITES_CMO_LANE_A_REPEATABILITY_SOP.md`
- `STARTLINESITES_CMO_LANE_A_STATE_MACHINE.md`
- `STARTLINESITES_CMO_LANE_A_DEVIATION_POLICY.md`
- `STARTLINESITES_CMO_LANE_A_OWNER_DECISION_LEDGER_TEMPLATE.md`
- `STARTLINESITES_CMO_LANE_A_GOLDEN_FIXTURE_REPLAY_REPORT.md`
- `STARTLINESITES_CMO_LANE_A_REPEATABILITY_CERTIFICATION_REPORT.md`
- `candidate-decisions.json`
- `run-manifest.json`
- `postflight-no-side-effect-report.json`

Private evidence packages may include internal manifests, owner-ledger templates, and sanitized source-evidence snapshots. Do not commit raw prospect evidence, owner decisions, raw production history, private candidate dossiers, credentials, or unmasked contact data.
