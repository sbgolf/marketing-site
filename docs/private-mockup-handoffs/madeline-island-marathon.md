# Madeline Island Marathon private mockup handoff

## Approval gate

Steve approval is required before this handoff, the private URL, or any related note is sent to a race director, owner, or prospect. Do not merge this into any customer-delivery workflow or send outreach without Steve's explicit approval.

## Private review URL

- Review URL: https://mockups.startlinesites.com/private/mockups/1df440859d5fc4a775302c32796ae129/?v=600cc75
- Audience: internal review by Steve first; owner-facing delivery only after approval.
- Privacy gate checked: external HTTPS URL returned HTTP 200 and includes `noindex,nofollow` robots directives.

## What we improved

- Respectful race-weekend framing that presents Madeline Island as a distinctive destination event without criticizing the current site.
- Clearer runner path for ferry timing, island logistics, lodging context, and race-day planning.
- Stronger official-registration trust by keeping Race Roster as the registration destination and making the registration path easy to recognize.
- Mobile conversion focus with a simplified above-the-fold decision path for runners reviewing the event from a phone.
- Measurable registration-click path so Steve can review whether the preview makes the official registration action easier to find.

## Owner-facing email copy for Steve to approve or edit

Use the branded template in `docs/private-mockup-handoffs/private-mockup-email-template.md` for HTML sends. The plain-text fallback below keeps the same funnel shape if a client renders a simplified version.

Subject: Madeline Island Marathon preview + recommended next step

Hi [Name],

I put together a private StartLine Sites preview for Madeline Island Marathon & Half Marathon:
https://mockups.startlinesites.com/private/mockups/1df440859d5fc4a775302c32796ae129/?v=600cc75

The preview shows how the race website could make the destination experience, ferry planning, race-day logistics, and official Race Roster path easier for runners to understand before they register.

What I would recommend next:
The Standard first-year package looks like the best fit because this race needs more than a basic landing page: destination logistics, course and registration confidence, mobile clarity, and room for race-cycle updates.

Standard first-year package:

- $2,500 first year
- $1,250 deposit to start
- Final $1,250 invoice at launch
- Includes the website build, richer race details/logistics sections, sponsor/photo areas when provided, conversion review, tracking setup, and scoped first-year race-cycle support.

If you like the direction and want StartLine to move this toward a polished production version, you can start here:
https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01

If you want to talk through changes first, reply with any notes and I’ll help confirm what should stay, what should change, and whether Standard is still the right fit.

Thanks,
Steve
StartLine Sites

## Recommended next step and approval options

Steve can choose one of these paths after reviewing the private mockup and this handoff:

1. **Approve for owner delivery as-is**: send the branded HTML email after replacing `[Name]`, confirming the recipient, and confirming the recommended package/deposit link.
2. **Approve with edits**: revise the email copy, recommendation, package CTA, or framing bullets, then re-check the URL and privacy gate before sending.
3. **Hold for mockup changes**: request changes to the rendered mockup before any owner-facing delivery.
4. **Send a follow-up after the first email**: because an earlier simpler email was already sent, use the updated template as a follow-up only after Steve approves the follow-up send.
5. **Do not send**: keep this as an internal example only.

## Evidence pointers

Use these only for internal review and approval support; they are not customer-facing copy.

- The private URL is on the external review domain: `mockups.startlinesites.com`.
- Smoke check on 2026-07-03 returned HTTP 200 for the tokenized private URL.
- Robots meta includes `noindex,nofollow,noarchive,nosnippet`.
- Source-backed runner-planning proof points observed in the rendered page include Bayfield-La Pointe ferry context, Joni's Beach location context, and limited-field/status messaging.
- The rendered mockup did not expose the checked debug/provenance phrases in visible copy during handoff review.

## Do-not-send reminders

- Do not include PR numbers, repository details, debug terms, provenance notes, or implementation uncertainty in customer-facing messages.
- Do not claim guaranteed registration growth.
- Do not frame the existing race site negatively.
- Do not send a follow-up email to the race director or owner before Steve approves the exact follow-up.
