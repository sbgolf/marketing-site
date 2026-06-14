# Marketing Site

Baseline branch. Active implementation is on `staging` for Steve review.

## Netlify production environment

The audit request form posts to `netlify/functions/submit-audit-request.mjs`, which writes to Supabase and can notify Steve by email after a successful insert.

Required for submissions:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side Netlify Function only; do not expose client-side)
- `STARTLINE_SITE_URL=https://startlinesites.com`

Recommended for lead notifications via Resend REST API:

- `RESEND_API_KEY` or `STARTLINE_RESEND_API_KEY`
- `STARTLINE_LEAD_NOTIFY_EMAIL` (falls back to `STARTLINE_ADMIN_EMAIL`, then `support@startlinesites.com`)
- `STARTLINE_NOTIFY_FROM` (optional; must be a sender/domain verified in Resend; defaults to `StartLine Sites <support@startlinesites.com>`)

Optional:

- `STARTLINE_IP_HASH_SALT` for stable one-way IP hashing independent of the Supabase service role key.
