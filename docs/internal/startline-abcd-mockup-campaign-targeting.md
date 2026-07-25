# StartLine A/B/C/D Mockup Campaign Targeting

Status: proposed first implementation for owner-gated prospect discovery and send safety.

This document defines the first four outreach-test lanes Steve approved for private mockup prospecting. The goal is to compare response quality across segments without mixing email copy between segments.

## Non-negotiable send rules

- No race-director/customer outreach goes out until Steve approves the specific prospect.
- Contact-form-only prospects remain blocked unless Steve explicitly overrides a specific item.
- Every candidate digest must show the campaign lane, evidence, contact quality, and selected email template.
- The race-management/operator email is locked to lane D and must not be used for lanes A, B, or C.
- StartLine complements registration platforms such as RunSignup; email copy must not imply replacement.

## Campaign lanes

### Lane A — RunSignup-only community race

Purpose: the current control group.

Use when:

- Race is registration-platform-first, usually RunSignup-only.
- No meaningful standalone runner-facing landing page is found.
- Race is local/community-oriented: 5K, 10K, fun run, walk, school/church/community fundraiser, annual local race.
- Direct/routing email is available, or the item is held for contact research.

Email template key: `individual_mockup_v1`

Primary pitch: a dedicated StartLine landing page complements RunSignup by giving runners a clearer front door before registration.

### Lane B — sponsor-heavy charity/community race

Purpose: test whether sponsor/fundraising value creates a stronger reason to reply.

Use when at least one strong sponsor/cause signal is present:

- 5+ sponsor logos/names found.
- Charity, foundation, memorial, scholarship, school, church, ministry, nonprofit, crisis/support cause, or donation/fundraising page.
- Race has community proof or sponsor visibility needs that RunSignup/Facebook does not showcase well.

Email template key: `sponsor_visibility_v1`

Primary pitch: a landing page can make sponsor value, cause story, donation/trust cues, and registration path easier to see.

### Lane C — outdated standalone race website

Purpose: test prospects that already believe in owning a website.

Use when:

- Race has its own official domain/site.
- Site appears stale, outdated, slow, broken, hard to use on mobile, or has registration buried under PDFs/flyers/old navigation.
- Registration still happens through RunSignup/Race Roster or another provider.

Email template key: `outdated_site_modernization_v1`

Primary pitch: StartLine can modernize the existing race front door and make the registration path clearer without changing their registration platform.

### Lane D — race management / timing / event company portfolio

Purpose: test higher-leverage buyers where one relationship may turn into multiple race sites.

Use only when there is verified multi-event operator evidence, such as:

- Company manages, produces, or times multiple races.
- Company site has an event calendar or portfolio.
- Same organization/contact appears across multiple active race pages.
- Company describes itself as race management, event production, timing, sports management, or endurance event services.
- At least 3 active/known events are tied to the operator.

Email template key: `operator_portfolio_v1`

Primary pitch: a repeatable race-site system can give each race a stronger landing page and give the operator a clearer portfolio hub, while keeping registration on RunSignup/Race Roster.

## Initial scoring model

The first implementation scores each lane on a 100-point scale:

- Budget / willingness signal: 25 points
- Website pain: 25 points
- Conversion upside: 20 points
- Contact quality: 20 points
- Lane-specific fit: 10 points

Typical owner-review threshold in the first scoring pass:

- Lane A: 50+
- Lane B: 60+
- Lane C: 55+
- Lane D: 35+

These thresholds are intentionally lower than a final send-readiness score because the first pass is an owner-review queue, not an auto-send decision. Hard disqualifiers can still hold a high-scoring item for research. Examples:

- event date too close,
- no usable contact path,
- contact form only,
- lane C missing standalone site evidence,
- lane D missing multi-event operator evidence or company/routing recipient.

## Template guardrail matrix

- `individual_mockup_v1`
  - Allowed lane: A
  - Allowed prospect type: `runsignup_only_community_race`

- `sponsor_visibility_v1`
  - Allowed lane: B
  - Allowed prospect type: `sponsor_heavy_charity_race`

- `outdated_site_modernization_v1`
  - Allowed lane: C
  - Allowed prospect type: `outdated_standalone_race_site`

- `operator_portfolio_v1`
  - Allowed lane: D only
  - Allowed prospect type: `race_management_company`
  - Requires `operator_event_count >= 3`
  - Requires at least 2 segment evidence items
  - Requires company/org/routing recipient type

## Current implementation notes

The first code pass stores campaign classification in `race_mockup_prospects.metadata` rather than requiring immediate Supabase schema changes:

- `campaign_lane`
- `campaign_lane_label`
- `prospect_type`
- `email_template_key`
- `contact_quality`
- `operator_event_count`
- `send_eligibility_status`
- `segment_evidence`
- `campaign_disqualifiers`
- `campaign_scores`

This lets us start producing lane-aware digests quickly. A later migration can promote these metadata fields to first-class columns if we need reporting/query performance.

## First campaign batch recommendation

Start small:

- Lane A: 3–5 prospects
- Lane B: 3–5 prospects
- Lane C: 3–5 prospects
- Lane D: 2–3 prospects

Generate/send only after Steve approves each item. Compare replies/clicks/quality before scaling.
