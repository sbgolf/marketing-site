# Private mockup handoff email template

Use this as the customer-facing email shape when a race director receives an approved private StartLine mockup.

## Conversion goal

The email should not simply say “here is a preview.” It should guide the director through one clear decision path:

1. Review the private mockup.
2. See why the recommended first-year package fits.
3. Click the recommended deposit / package CTA when ready.
4. Reply if they want changes, scope questions, or a short review before paying.

## Brand tokens

Use the StartLine site palette:

- Ink: `#0E1729`
- Ink 2: `#1A2438`
- Paper: `#FAFAF7`
- Paper 2: `#F0EDE5`
- Accent / primary CTA: `#FF4D3D`
- Accent deep: `#D43B2D`
- Teal support: `#1FB8C4`
- Gold highlight: `#F5C04A`
- Muted text: `#8A93A6`

Email-safe fonts:

- Body: `Plus Jakarta Sans`, `Inter`, `Segoe UI`, Arial, sans-serif fallback.
- Display headings: Georgia / serif fallback when `Instrument Serif` is unavailable.

## Required customer-facing structure

- **Preheader:** concrete next step, not generic preview language.
- **Hero card:** race name, private preview CTA, short benefit statement.
- **Why this matters:** 3–4 concise bullets tied to runner clarity and registration confidence.
- **Recommended package:** identify the recommended fit and deposit amount when known.
- **Primary CTA:** direct payment/deposit URL when a non-proposal package is recommended and approved.
- **Secondary CTA:** private mockup URL.
- **Reply fallback:** clear language that they can reply with questions or requested changes.
- **Footer:** StartLine Sites brand line, respectful no-pressure note, no internal workflow terms.

## Plain-text fallback

```text
Subject: Madeline Island Marathon preview + recommended next step

Hi [Contact name],

I put together a private StartLine Sites preview for Madeline Island Marathon & Half Marathon:
[Private mockup URL]

The preview shows how the race website could make the destination experience, ferry planning, race-day logistics, and official Race Roster path easier for runners to understand before they register.

What I would recommend next:
The Standard first-year package looks like the best fit because this race needs more than a basic landing page: destination logistics, course/registration confidence, mobile clarity, and room for race-cycle updates.

Standard first-year package:
- $2,500 first year
- $1,250 deposit to start
- Final $1,250 invoice at launch
- Includes the website build, richer race details/logistics sections, sponsor/photo areas when provided, conversion review, tracking setup, and scoped first-year race-cycle support.

If you like the direction and want StartLine to move this toward a polished production version, you can start here:
[Standard deposit URL]

If you want to talk through changes first, reply with any notes and I’ll help confirm what should stay, what should change, and whether Standard is still the right fit.

Thanks,
Steve
StartLine Sites
```

## Branded HTML template

Replace bracketed variables before sending. Keep the inline CSS; many email clients strip embedded styles.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>[Race name] private StartLine preview</title>
  </head>
  <body style="margin:0;padding:0;background:#F0EDE5;color:#0E1729;font-family:'Plus Jakarta Sans','Inter','Segoe UI',Arial,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
      Review your private StartLine preview, then choose whether to start the recommended first-year package.
    </div>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F0EDE5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#FAFAF7;border:1px solid rgba(14,23,41,.12);border-radius:28px;overflow:hidden;box-shadow:0 24px 70px rgba(14,23,41,.12);">
            <tr>
              <td style="background:#0E1729;padding:26px 26px 30px;color:#FAFAF7;">
                <div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:#F5C04A;margin-bottom:16px;">StartLine Sites private preview</div>
                <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:38px;line-height:1.02;letter-spacing:-.02em;color:#FAFAF7;">A clearer website path for [Race name]</h1>
                <p style="margin:18px 0 0;color:rgba(250,250,247,.78);font-size:16px;line-height:1.6;">I built a private preview to show how your race website could make the destination story, runner logistics, and official registration path easier to understand before runners decide.</p>
                <div style="margin-top:24px;">
                  <a href="[Private mockup URL]" style="display:inline-block;background:#FF4D3D;color:#ffffff;text-decoration:none;font-weight:800;border-radius:999px;padding:14px 20px;font-size:15px;box-shadow:0 10px 26px rgba(255,77,61,.32);">Review the private preview →</a>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 26px 8px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:#1A2438;">Hi [Contact name],</p>
                <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#1A2438;">The preview focuses on the runner questions that often matter most before registration: what makes the race worth the trip, how logistics fit together, and where the official registration handoff happens.</p>

                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:22px 0;border-collapse:separate;border-spacing:0 10px;">
                  <tr>
                    <td style="background:#ffffff;border:1px solid rgba(14,23,41,.10);border-radius:18px;padding:16px 18px;">
                      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#D43B2D;margin-bottom:5px;">What improves</div>
                      <div style="font-size:15px;line-height:1.6;color:#1A2438;">The page makes the race-weekend experience, ferry/travel planning, course context, and Race Roster path easier to scan on mobile.</div>
                    </td>
                  </tr>
                  <tr>
                    <td style="background:#ffffff;border:1px solid rgba(14,23,41,.10);border-radius:18px;padding:16px 18px;">
                      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;color:#D43B2D;margin-bottom:5px;">Recommended fit</div>
                      <div style="font-size:15px;line-height:1.6;color:#1A2438;">[Recommended package] looks like the best next step because [package-fit reason].</div>
                    </td>
                  </tr>
                </table>

                <div style="background:linear-gradient(135deg,rgba(255,77,61,.10),rgba(245,192,74,.18));border:1px solid rgba(255,77,61,.20);border-radius:24px;padding:22px;margin:24px 0;">
                  <div style="font-size:12px;letter-spacing:.16em;text-transform:uppercase;font-weight:900;color:#D43B2D;margin-bottom:8px;">Recommended next step</div>
                  <h2 style="margin:0 0 10px;font-family:Georgia,'Times New Roman',serif;font-weight:400;font-size:30px;line-height:1.08;color:#0E1729;">Start the [Recommended package] first-year package.</h2>
                  <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#1A2438;">[Package summary and deposit terms]</p>
                  <a href="[Primary package/deposit URL]" style="display:inline-block;background:#FF4D3D;color:#ffffff;text-decoration:none;font-weight:900;border-radius:999px;padding:14px 20px;font-size:15px;">Start with the deposit →</a>
                  <p style="margin:14px 0 0;font-size:13px;line-height:1.55;color:rgba(26,36,56,.72);">Prefer to talk through changes first? Reply to this email with notes, and I’ll help confirm the final scope before you pay anything.</p>
                </div>

                <p style="margin:0 0 18px;font-size:16px;line-height:1.65;color:#1A2438;">No pressure if you want edits first. The goal of the preview is to make the decision concrete: keep what works, adjust what does not, and only move forward if the package feels like the right fit.</p>
                <p style="margin:0 0 8px;font-size:16px;line-height:1.65;color:#1A2438;">Thanks,<br />Steve</p>
              </td>
            </tr>

            <tr>
              <td style="padding:22px 26px 28px;background:#0E1729;color:#FAFAF7;">
                <div style="font-family:Georgia,'Times New Roman',serif;font-size:24px;letter-spacing:-.02em;margin-bottom:6px;">StartLine Sites</div>
                <div style="font-size:13px;line-height:1.55;color:rgba(250,250,247,.72);">Fast, SEO-optimized race websites for race directors — built for search, speed, and signups.</div>
                <div style="margin-top:14px;font-size:12px;color:#F5C04A;">Built with the same colors and conversion language used across startlinesites.com.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Madeline Island recommended values

- `[Race name]`: `Madeline Island Marathon & Half Marathon`
- `[Contact name]`: contact name from the audit request record.
- `[Private mockup URL]`: `https://mockups.startlinesites.com/private/mockups/1df440859d5fc4a775302c32796ae129/?v=600cc75`
- `[Recommended package]`: `Standard`
- `[package-fit reason]`: `the race benefits from richer destination logistics, mobile planning clarity, course/registration confidence, sponsor/photo areas when provided, and a conversion review before launch.`
- `[Package summary and deposit terms]`: `Standard is a $2,500 first-year package. The $1,250 deposit starts the project; the final $1,250 invoice is due at launch.`
- `[Primary package/deposit URL]`: `https://buy.stripe.com/28EeV65RI3II3H5bzn9fW01`

## Do not include

- Repository, PR, Supabase, Resend, analytics-debug, or internal approval details.
- Guaranteed registration growth.
- Language that shames the current race website.
- A vague ending like “No pressure either way” without a concrete CTA.
