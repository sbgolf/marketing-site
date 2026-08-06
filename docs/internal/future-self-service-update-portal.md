# Future idea: controlled self-service update portal

Status: **parking-lot / do not implement yet**

Steve and Herbie agreed this is strategically attractive but too early to build until StartLine has paying template customers and real post-launch update patterns.

## Idea

StartLine could eventually offer customers a controlled update portal for recurring race-cycle changes while preserving the template quality, speed, SEO structure, and registration-focused design that StartLine provides.

The portal should edit structured race data, not arbitrary page layout.

## Strategic rationale

StartLine is building race sites from reusable templates plus race-specific config/data. That creates a natural foundation for recurring revenue because race sites need year-over-year updates:

- future race date
- registration URL/status
- pricing and deadline updates
- distances/events offered
- packet pickup and schedule changes
- sponsors and partner logos
- FAQ/logistics updates
- results/photo links
- hero image or announcement changes

The long-term product is not "race directors build a site from scratch." It is:

> StartLine builds the professional race website system, then gives the race director a controlled way to update the fields that actually change each year while StartLine maintains the template, speed, SEO, hosting, and quality.

## Recommended product shape

Do **not** build a WordPress/Squarespace-style editor unless customer evidence later proves it is needed.

Preferred future shape:

1. Customer logs into a race-specific dashboard.
2. They edit approved fields grouped by section.
3. Changes save as drafts.
4. StartLine can review/approve before publishing, at least initially.
5. Approved changes update the structured race config/data.
6. The static site rebuilds/deploys through the existing hosting pipeline.

This keeps the public site fast, static, validated, and hard to break.

## Editable fields to consider

Good self-service candidates:

- Race basics: date, location note, short announcement, registration status.
- Registration: registration URL, pricing notes, deadlines, CTA text within approved patterns.
- Events/distances: offered distances, start times, descriptions, age limits where sourced.
- Schedule/logistics: packet pickup, parking, aid stations, awards, race-day timeline.
- Sponsors: sponsor names, tiers, logos, verified links.
- FAQs: controlled Q&A items.
- Media: hero image replacement, source-approved photo links, results/photo gallery links.
- Contact: public support email, social links, official site links.

Avoid exposing:

- layout editing
- arbitrary HTML/CSS
- global typography/design tokens
- SEO-critical schema fields without validation
- unreviewed claims about registration growth, rankings, certifications, or guarantees

## Monetization paths to revisit

Start with the simpler recurring offer before building software:

1. **Annual Race Rollover**
   - yearly fee
   - StartLine updates next-year date, registration link, pricing, schedule, sponsors, stale copy, SEO freshness, and pre-race conversion checks

2. **Quarterly Website Update**
   - scoped content/logistics/sponsor/FAQ updates during the race cycle

3. **Managed Subscription**
   - hosting + support + capped assisted edits
   - optionally adds portal access later

4. **Hybrid model**
   - annual renewal includes hosting and one rollover
   - optional portal/support add-on for teams with frequent changes

## Build-later trigger

Revisit this after StartLine has enough paying customers to answer:

- What updates do customers repeatedly ask for?
- How often do they need changes?
- Are they willing to self-edit, or do they prefer StartLine to handle updates?
- Which fields can be safely customer-editable without quality loss?
- Does a portal reduce support burden enough to justify the build?
- Would review-before-publish be acceptable to customers?

Suggested trigger: after several paid launches plus at least one real renewal / next-race-cycle update request.

## Architecture implications to preserve now

Even before implementing a portal, keep building in ways that leave the option open:

- Keep race-specific content in structured config/data, not hardcoded template copy.
- Keep reusable template behavior in `sbgolf/race-templates`.
- Keep customer/prospect/lead lifecycle records in StartLine-owned data stores.
- Validate configs before deploy.
- Keep optional sections cleanly hidden when data is missing.
- Preserve provenance/source metadata separately from visible customer-facing copy.
- Avoid one-off customer forks that would make future editing inconsistent.
- Keep race template fields small, named, and semantically meaningful.

## Current decision

Do not implement now.

Near-term focus remains:

- winning paying template customers
- proving the build/migration workflow
- learning actual post-launch maintenance needs
- selling annual rollover / scoped update services before building portal software
