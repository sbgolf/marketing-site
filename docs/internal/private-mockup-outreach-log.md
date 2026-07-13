# Private mockup outreach log

StartLine tracks race-director private mockup outreach in Supabase so we do not resend the same mockup to races that already received one.

## Source of truth

Table: `public.race_mockup_outreach`

Required fields for every send:

- `race_name`
- `race_slug`
- `mockup_url`
- `mockup_template` — the race-template family used to create the mockup, for example `community`, `performance`, or `destination`
- `to_emails`
- `outreach_status`

Recommended fields for duplicate prevention:

- `official_url`
- `official_domain`
- `registration_url`
- `registration_platform`
- `registration_race_id` when a provider ID is available
- `cc_emails`
- `resend_email_id`
- `sent_at`

## Duplicate-send checks

Before sending a future private mockup email, check for prior outreach by:

1. Exact `mockup_url`.
2. Registration provider + provider race ID.
3. Race slug + official domain.
4. Any To/CC recipient overlap.

If any prior `approved`, `sent`, `replied`, `bounced`, or `do_not_contact` record exists, block the send and review the existing row first.

## Manual record command

Use the script after Resend accepts a race-director email:

```bash
node scripts/record-mockup-outreach.mjs \
  --race-name "Example 10K" \
  --city "Nashville" \
  --state "TN" \
  --official-url "https://example-race.test" \
  --registration-url "https://runsignup.com/Race/TN/Nashville/Example10K" \
  --registration-platform "runsignup" \
  --registration-race-id "12345" \
  --mockup-url "https://mockups.startlinesites.com/private/mockups/exampletoken/" \
  --mockup-template "community" \
  --to "director@example-race.test" \
  --cc "events@example-race.test" \
  --subject "A Nashville-local website mockup for Example 10K" \
  --from "steve@startlinesites.com" \
  --reply-to "support@startlinesites.com" \
  --resend-email-id "provider-message-id"
```

Add `--dry-run` first to inspect the payload and duplicate filters without touching Supabase.

## Richland Creek Run first record

The Richland Creek Run send should be recorded with:

- Race: Richland Creek Run XX
- City/state: Nashville, TN
- Mockup template: `community`
- Mockup URL: `https://mockups.startlinesites.com/private/mockups/221df003f466f745f7bb7119890f97f9/`
- Subject: `A Nashville-local website mockup for Richland Creek Run`
- From: `steve@startlinesites.com`
- Reply-To: `support@startlinesites.com`
- Resend message ID: `a7a48245-6d08-46b2-87b5-15e4df05dc8e`

Do not commit real recipient lists to git. Keep real recipient addresses in Supabase and provider logs only.

## Operational rule

The eventual branded send gate should write this table automatically after provider acceptance. Until then, every manual send must be followed by a `record-mockup-outreach` run.
