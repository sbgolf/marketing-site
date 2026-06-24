# StartLineSites.com live-site audit backlog — 2026-06-24

Docs-only backlog created after the prior StartLine UX/conversion and cold race-director UX backlogs were closed out. This PR establishes the next fresh live-site audit record and captures the proposed next item for Steve approval; it does **not** implement any production/site changes.

## Context

- The original StartLine UX conversion audit backlog is complete through its listed implementation items.
- The cold race-director UX audit backlog is complete/closed, with no existing unblocked next item found during follow-up inspection.
- A fresh live-site audit found one candidate around search index hygiene for customer kickoff pages.
- This candidate is **approval-dependent** because the previous H-07/L-02 decision in PR #79 explicitly kept `/intake/` and `/asset-checklist/` indexable for now unless Steve later asks to remove them from search discovery.

## Live evidence captured 2026-06-24

Checked against `https://startlinesites.com/`:

- `https://startlinesites.com/intake/`
  - HTTP status: `200`
  - Robots meta tag: none found
  - Sitemap presence: listed in `https://startlinesites.com/sitemap-0.xml`
- `https://startlinesites.com/asset-checklist/`
  - HTTP status: `200`
  - Robots meta tag: none found
  - Sitemap presence: listed in `https://startlinesites.com/sitemap-0.xml`
- Sitemap index: `https://startlinesites.com/sitemap-index.xml` points to `https://startlinesites.com/sitemap-0.xml`.

Interpretation: both customer kickoff pages are currently live, crawlable/indexable by default, and discoverable via the XML sitemap.

## Operating rule for this backlog

Do not implement metadata, sitemap, robots, route, link, or copy changes from this document until Steve explicitly approves the item. Each approved implementation should be a small, reversible branch/PR with build/test verification and a PR body mapping the change to the acceptance criteria below.

## Proposed approval-dependent item

### P0-01 — De-index customer kickoff pages while keeping direct links live

- **Status**: In review — PR #96.
- **Impact**: High if Steve wants customer kickoff resources excluded from organic discovery; reduces chance that cold prospects land first on post-deposit/customer-only workflows.
- **Effort**: Low to medium.
- **Category**: SEO / index hygiene / customer-prospect path separation.
- **Prior decision guardrail**: PR #79 decided that `/intake/` and `/asset-checklist/` should remain indexable for now because they were reframed clearly as customer kickoff resources. Treat this item as a proposal only unless Steve explicitly reverses or updates that decision.

#### Scope if approved

- Add page-level `noindex` metadata for:
  - `/intake/`
  - `/asset-checklist/`
- Remove those two URLs from generated XML sitemap output.
- Keep both routes publicly reachable by direct URL and by any intentional customer/kickoff links.
- Do not block the pages in `robots.txt`; crawlers need to access the pages to see `noindex`.
- Do not remove the pages, forms, customer copy, kickoff workflow, or direct-link behavior.
- Do not change package/pricing/payment strategy as part of this item.

#### Why this matters

These pages are useful after a customer is ready for kickoff, but they are not ideal first-touch search landing pages for cold race directors. If Steve decides search discovery is no longer desired for these workflows, `noindex` plus sitemap removal would preserve direct-link access while making the intended buyer journey clearer in search.

#### Acceptance criteria if approved

- `/intake/` returns `200` and includes a robots directive equivalent to `noindex`.
- `/asset-checklist/` returns `200` and includes a robots directive equivalent to `noindex`.
- XML sitemap output no longer includes `https://startlinesites.com/intake/`.
- XML sitemap output no longer includes `https://startlinesites.com/asset-checklist/`.
- Direct navigation to both pages still works.
- Any existing customer kickoff links still resolve to the live pages.
- `robots.txt` does not disallow these pages in a way that would prevent crawlers from seeing `noindex`.
- The PR body explicitly notes that Steve approved changing the PR #79/L-02 indexability decision.

#### Verification plan if approved

1. Run `npm run build`.
2. Inspect built HTML for both pages and confirm the robots meta directive contains `noindex`.
3. Inspect generated sitemap output and confirm both kickoff URLs are absent.
4. Start the local preview/server if needed and verify both routes return `200`.
5. Check direct links or page references that intentionally send customers to `/intake/` and `/asset-checklist/` still point to live pages.
6. Confirm `public/robots.txt` does not block those paths.
7. Include exact command output in the implementation PR.

## Explicit non-scope for this PR

- No product code changes.
- No metadata changes.
- No sitemap changes.
- No robots.txt changes.
- No route/form/workflow changes.
- No public copy changes.

This PR only creates the backlog record and documents the approval-dependent candidate for a future implementation PR.
