# StartLine Sites Launch Readiness customer email templates

Status: current implemented baseline for branded customer-facing Launch Readiness email copy. The shared dark email shell lives in `netlify/functions/lib/branded-email.mjs` and the live post-deposit customer send uses the `depositKickoff` template from that helper.

This document describes the standardized customer templates used or prepared for the Launch Readiness workflow. Templates are intentionally operational: they ask the customer to confirm facts, identify owners, and grant safe access without implying that public launch can happen before dependencies are ready.

## Runtime requirements

The post-deposit customer email sends after a processed setup deposit when these Netlify environment variables are configured:

- `STARTLINE_INTAKE_FORM_URL=https://startlinesites.com/intake`
- `STARTLINE_ASSET_CHECKLIST_URL=https://startlinesites.com/asset-checklist`
- `STARTLINE_ACCESS_GUIDES_URL=https://startlinesites.com/access-guides` (optional; defaults to the production access guide)
- `RESEND_API_KEY` or `STARTLINE_RESEND_API_KEY`

If either required URL is missing, the webhook skips the customer email and leaves the customer record in manual-ready state. If a Launch Readiness Kit was already sent for the customer record, the webhook must not send another customer email on a later checkout event for the same session.

## Shared customer email rules

- Use the dark StartLine Sites branded shell with light/dark mode safeguards.
- Sign as Steve, CEO & Founder, with StartLineSites.com.
- Keep CTA labels specific: “Open Launch Readiness Checklist,” “Review the Asset Hub,” “Open access guides,” “Open staging preview,” or “Review final preview.”
- Separate build-start inputs from launch dependencies.
- Do not ask customers to email passwords. Prefer owner names, delegated access, or screenshares.
- Keep race ownership clear: domain, email, analytics, registration accounts, and final approval stay with the race team.
- Do not include ranking, traffic, or registration-volume guarantees.

## Template set

The helper exports these template names:

```text
depositKickoff
launchReadiness
missingDependency
accessRequest
assetRequest
stagingReview
launchApproval
```

## 1. Deposit kickoff / Launch Readiness Kit

**Subject:** `Next steps for [race name]`

**Primary CTA:** Open Launch Readiness Checklist
**Secondary CTA:** Review the Asset Hub
**Third CTA:** Open access guides

```text
Hi [customer name],

Thanks — we received the [$deposit] [tier] setup deposit for [race name]. Use the Launch Readiness Kit to confirm what StartLine found, add what only your team knows, and gather the access-owner notes needed before launch.

What to do now:
1. Confirm the public race facts StartLine found.
2. Add private details only your team knows.
3. Share one asset folder and identify any access owners.

Open Launch Readiness Checklist: [STARTLINE_INTAKE_FORM_URL]
Review the Asset Hub: [STARTLINE_ASSET_CHECKLIST_URL]
Open access guides: [STARTLINE_ACCESS_GUIDES_URL]

Reply here if anything changed or if a different account owner should be included.

Thanks,
Steve, CEO & Founder
StartLineSites.com
```

## 2. Launch Readiness checklist reminder

Use when the customer needs a direct checklist nudge after deposit.

**Primary CTA:** Open Launch Readiness Checklist
**Secondary CTA:** Review access guides

Customer asks:

- Confirm race identity, date, location, distances, and official registration link.
- Choose “I don’t know yet” for technical access items another owner controls.
- Name one final approver before launch review starts.

## 3. Missing dependency follow-up

Use when intake was submitted but launch/build dependencies still need owner names or statuses.

**Primary CTA:** Open access guides
**Secondary CTA:** Update Launch Readiness

Customer asks:

- Owner or status for any missing domain, email, analytics, registration, asset, or approval dependency.
- Delegated access or a screenshare path where account changes are needed.
- No passwords by email — owner names and next steps are enough.

## 4. Safe access request

Use when StartLine needs help from a domain, analytics, registration, current-site, or email-platform owner.

**Primary CTA:** Open access guides
**Secondary CTA:** Open Launch Readiness Checklist

Customer asks:

- Add StartLine as a temporary user where the platform supports it.
- Schedule a screenshare if delegated access is not available.
- Keep the race team as the account owner and avoid emailing passwords.

## 5. Asset request

Use when the build can continue faster with better source files, permission labels, or owner notes.

**Primary CTA:** Open Asset Hub
**Secondary CTA:** Update Launch Readiness

Customer asks:

- Share one folder for logos, race-day photos, maps, sponsors, policies, and registration screenshots.
- Label anything permission-pending instead of stalling the whole folder.
- Name the person who can approve photo, sponsor, or old-site reuse.

## 6. Staging review

Use when a staging preview is ready for customer review.

**Primary CTA:** Open staging preview
**Secondary CTA:** Review access guides

Customer asks:

- Check date, location, distances, pricing, policies, sponsor order, and registration CTA truth.
- Send one consolidated list of committee feedback.
- Flag anything that must be fixed before public launch.

## 7. Launch approval

Use when the final preview is ready and StartLine needs explicit customer launch approval.

**Primary CTA:** Review final preview
**Secondary CTA:** Open Launch Readiness Checklist

Customer asks:

- Confirm the registration CTA, prices, deadlines, and policy copy match the provider.
- Confirm DNS/email safety, analytics/search ownership, and final approver are ready.
- Reply with approval only when the race team is ready for StartLine to launch.

## Record updates after successful post-deposit send

- `kickoff_status = started`
- `intake_status = sent`
- `launch_readiness_status = sent`
- `launch_readiness_sent_at = now()`
- `launch_readiness_updated_at = now()`
- `intake_sent_at = now()`
- `metadata.kickoff_email.sent_at = now()`
- `metadata.kickoff_email.template = depositKickoff`
- `metadata.kickoff_email.provider = resend`
- `metadata.kickoff_email.provider_message_id = [Resend email id when available]`
- `metadata.kickoff_email.access_guides_url = [configured or default access guide URL]`

## Guardrails

- Do not send any customer email from docs-only or template-only PRs.
- Do not imply the delivery clock has started until build-critical intake details and usable assets are complete.
- Do not imply public launch is safe until DNS/email safety, registration truth, analytics/search ownership, final approver, and customer approval are ready.
- Do not include Premium language unless the proposal has already been reviewed and approved.
