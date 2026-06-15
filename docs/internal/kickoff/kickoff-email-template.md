# StartLine Sites kickoff email template

This is the customer-facing email sent after a processed setup deposit when these Netlify environment variables are configured:

- `STARTLINE_INTAKE_FORM_URL`
- `STARTLINE_ASSET_CHECKLIST_URL`
- `RESEND_API_KEY` or `STARTLINE_RESEND_API_KEY`

If either URL is missing, the webhook skips the customer email and leaves the customer record in manual-ready state.

## Subject

```text
Next steps for [race name]
```

## Body

```text
Hi [customer name],

Thanks — we received the [$deposit] [tier] setup deposit for [race name].

Next step: complete the intake form and gather the assets we need to build the site.

Intake form: [STARTLINE_INTAKE_FORM_URL]
Asset checklist: [STARTLINE_ASSET_CHECKLIST_URL]

The build timeline starts once we have complete intake details and usable assets. If anything is unclear or missing, we’ll follow up with a short list instead of making you redo the whole form.

Reply here if you have questions.

— StartLine Sites
```

## Record updates after successful send

- `kickoff_status = started`
- `intake_status = sent`
- `intake_sent_at = now()`
- `metadata.kickoff_email.sent_at = now()`

## Guardrails

- Keep this short and operational; do not include traffic/ranking promises.
- Do not imply the delivery clock has started until complete intake/assets are received.
- Do not include Premium language unless the proposal has already been reviewed and approved.
