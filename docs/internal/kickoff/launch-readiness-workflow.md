# StartLine Launch Readiness workflow

Status: approved direction for the 7-PR implementation sequence. This document defines the post-deposit operating model before the form, data model, email, and automation PRs change runtime behavior.

## Why this exists

StartLine can discover a lot from a race's public site, registration platform, and public assets before a customer pays. The post-deposit customer experience should therefore avoid a blank, homework-heavy intake. It should feel like a premium launch handoff:

> Confirm what we found. Add what only you know. Grant access when needed.

The customer does not need to understand DNS, GA4, Search Console, or hosting. StartLine owns the technical path; the race director confirms facts, shares usable assets, identifies account owners, and gives safe access where public research is not enough.

## Position in the customer journey

### Pre-deposit: discovery and proposal only

Keep this lightweight. Before payment, collect only what is needed to qualify the race, prepare an audit/private mockup, and recommend a package.

Minimum pre-deposit inputs:

- Race name.
- Current website URL.
- Registration platform URL, if different.
- Contact name and email.
- Main issue the director wants fixed.
- Target launch window or race date.
- Package interest, if already known.

Do not ask for DNS access, GA4 ownership, sponsor files, full policies, or committee approval details before the customer has committed.

### Deposit paid: Launch Readiness Kit

A successful approved setup deposit triggers the Launch Readiness step. This is the customer-facing replacement for the old generic "20–30 minute intake" framing.

The branded kickoff email should say, in plain language:

- You're officially in the StartLine build queue.
- We already pulled what we could from your public site and registration page.
- Please confirm the visible race details, add anything only you know, and prepare the private access items needed before launch.
- The build timeline starts once minimum build inputs and usable assets are complete.
- Domain/analytics access can be prepared now, but final launch still waits for approval and safe DNS timing.

### Build start gate

StartLine may start production once the minimum build inputs are available. Do not wait for every launch dependency if the site can be built safely from confirmed content and public sources.

Needed to start build:

- Confirmed race name, date, location, and distances.
- Confirmed official registration URL and current registration state.
- Confirmed template/package scope.
- Enough public or customer-provided branding/assets to create the first build pass.
- Primary customer contact and final approver identified.
- Any known fact conflicts from public scraping resolved or marked for follow-up.

### Launch gate

The site does not launch on the customer domain until launch dependencies are resolved and Steve/customer approval gates are satisfied.

Needed before launch:

- Domain/DNS owner or delegated access path confirmed.
- Domain email/MX safety checked.
- GA4 and Google Search Console ownership/access path confirmed or StartLine-created properties approved.
- Final registration URL/status/pricing reconfirmed.
- Customer final approver signs off on staging facts and launch timing.
- Steve approval remains required where the venture pipeline or current workflow requires it.

## Customer-owned dependency groups

### 1. Confirm what StartLine found

This section should be prefilled whenever possible from public research, audit data, private mockup data, registration pages, and prior customer records.

Customer confirms or corrects:

- Race name.
- Date and location.
- Distances.
- Start/finish details.
- Public schedule.
- Course facts and certification/qualifying claims.
- Existing FAQ/policies.
- Existing sponsor list.
- Social/contact links.
- Public registration link.

Customer options should include: `Looks correct`, `Needs update`, `Not sure`, and a short correction field.

### 2. Add what only the race knows

These are facts that public scraping cannot safely infer.

Ask for:

- Whether public content is current for this race year.
- Known course, venue, parking, packet pickup, or permit changes.
- Sponsor changes or sponsor display requirements.
- Refund, transfer, deferment, weather, and access-code rules.
- Which runner questions cause the most support emails.
- Any internal deadline, board/committee, city, timer, or sponsor approval requirements.

### 3. Confirm registration truth

Registration is the highest-conversion handoff, so this gets its own section.

Ask the director to confirm:

- Official registration URL runners should use.
- Registration platform.
- Current state: open, not-yet-open, closed, sold out, waitlist-only, transfer-only, invite/access-code-only, or other.
- Current prices and whether public prices include provider fees.
- Future price increase/open/close dates.
- Public refund/transfer/deferment policy.
- Whether StartLine should link to a status page, registration start page, or access-code instructions.

Never infer that a race is registerable just because a platform URL exists.

### 4. Prepare domain, DNS, and email safety

Ask for the lowest-risk access path first.

Preferred order:

1. Customer adds StartLine as a delegated user/admin in the registrar or DNS provider.
2. Customer screenshares while StartLine guides the DNS update.
3. Customer copies exact records from StartLine instructions.
4. Temporary credential sharing only if unavoidable, never by default, and never committed to repo/docs.

Ask:

- Who manages the domain?
- Where is DNS hosted, if different from the registrar?
- Does the race use domain email such as `info@race.com`?
- Who provides domain email: Google Workspace, Microsoft 365, registrar forwarding, old web host, or unknown?

Guardrail: StartLine should not touch MX/email records unless explicitly scoped. DNS launch instructions must say what StartLine changes and what StartLine leaves alone.

### 5. Connect analytics and search ownership

Ask:

- Does the race already have GA4?
- Which Google account should own race analytics?
- Should StartLine be added to an existing property or create one?
- Is Google Search Console already verified?

Frame this as the website scoreboard, not as technical homework. Explain that StartLine tracks website traffic and outbound registration-click intent, not private runner/payment data.

### 6. Collect assets and permissions

The asset checklist should be a companion page, not a giant inline form.

Ask for:

- Best logo file available.
- Hero/race photos.
- Sponsor logos.
- Course map files or links.
- Race guide/flyer PDFs if useful.
- Permission to reuse public images already visible on the current race site.
- Required photo credits or usage restrictions.

Use a `best / okay / send what you have` tone so imperfect assets do not stall the customer.

### 7. Identify the review/approval path

Ask:

- One final approver for staging and launch.
- Optional reviewers who should provide feedback through that approver.
- Whether board, sponsor, city, timer, or partner approval is required.
- Preferred launch timing and any blackout dates.

Guardrail: avoid open-ended committee feedback loops. Ask the customer to consolidate feedback before sending revisions.

## Customer-facing pages and emails this workflow depends on

The following PRs in the 7-PR sequence should implement or update these surfaces:

1. **Workflow docs** — this PR. No runtime behavior changes.
2. **Readiness data model** — add durable fields/status metadata for Launch Readiness.
3. **Launch Readiness `/intake/` UX** — reframe the old intake as a post-deposit confirmation checklist.
4. **Asset checklist polish** — make `/asset-checklist/` a branded asset/permission hub.
5. **Access guide pages** — domain/DNS, email safety, GA4/GSC, registration confirmation, and current-site access guides.
6. **Branded customer email templates** — reusable customer-facing StartLine dark email shell and specific Launch Readiness emails.
7. **Post-deposit automation** — deposit webhook sends the Launch Readiness Kit and stores send metadata safely.

## Email standard for customer communications

Every customer-facing Launch Readiness email should use the branded StartLine Sites customer email shell unless Steve explicitly approves a different campaign style.

Required characteristics:

- Dark StartLine-branded HTML shell.
- Plain-language subject and preheader.
- One clear next action.
- Links to the Launch Readiness checklist and asset checklist when appropriate.
- Short explanation of why access/items matter.
- `I don't know` / reply fallback language for technical items.
- Approved customer signature:
  - `Thanks,`
  - `Steve, CEO & Founder`
  - linked `StartLineSites.com`

Avoid:

- Plain unbranded customer HTML.
- Technical jargon without an immediate plain-English translation.
- Traffic/ranking/registration guarantees.
- Telling customers to email passwords as the default access path.
- Implying the build clock starts before minimum build inputs and usable assets are complete.

## Status values for later PRs

The exact database shape belongs in the data-model PR, but this workflow expects statuses that can answer these questions:

- Was the Launch Readiness Kit sent?
- Did the customer submit/confirm the checklist?
- Are minimum build inputs complete?
- Are assets usable enough to start?
- Are launch dependencies complete?
- Which dependency is blocking launch?

Recommended high-level statuses:

- `not_started`
- `ready_to_send`
- `sent`
- `submitted`
- `needs_follow_up`
- `build_ready`
- `launch_blocked`
- `launch_ready`

Recommended dependency statuses:

- `unknown`
- `not_needed`
- `requested`
- `customer_unsure`
- `delegated_access_ready`
- `screen_share_needed`
- `confirmed`
- `blocked`

## Definition of done for the complete 7-PR sequence

The sequence is complete when:

1. A paid deposit can create/update the customer record.
2. A branded Launch Readiness email can be sent safely after deposit.
3. The email links to a polished Launch Readiness checklist and asset checklist.
4. The checklist captures registration truth, domain/DNS, domain email, GA4/GSC, final approver, assets, and private race details.
5. Customer-facing guide pages explain the nontechnical access steps.
6. Backend records show which dependencies are complete, unknown, or blocking launch.
7. Duplicate webhook deliveries do not double-send customer kickoff emails.
8. StartLine can clearly tell Steve/customer whether the account is build-ready, launch-blocked, or launch-ready.

## Steve/customer approval guardrails

- This workflow does not authorize live customer sends by itself. Runtime PRs must preserve the repo's existing customer-delivery guards and test-mode safety.
- Steve approval is still required before merge/publish where current repo workflow requires it.
- If the real customer recipient, package, or payment state is ambiguous, do not send; store manual-ready state and alert Steve.
- Keep all credentials, tokens, customer payment data, and sensitive account access out of git.
