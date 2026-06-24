# CDO backlog template

Use this template to convert a CDO audit report into implementation-ready backlog items. Each implementation PR should select exactly one agent-actionable item unless Steve explicitly approves a broader scope.

## Backlog metadata

- **Source audit:**
- **Audit date:**
- **Backlog owner:**
- **Last updated:**
- **Live site audited:** https://startlinesites.com/

## Prioritization rules

- **High:** Clear buyer-impacting issue, conversion friction, trust/proof safety risk, broken path, or high-confidence SEO/mobile improvement.
- **Medium:** Useful clarity, polish, or supporting-path improvement that is not blocking the buyer.
- **Low:** Nice-to-have refinement, optional polish, or item that depends on higher-priority work first.
- **Blocked / approval-needed:** Requires Steve approval, real customer proof, pricing/package decisions, legal terms, operational commitments, or private data.

## Agent-actionable queue

### High priority

#### [H1] Item title

- **Status:** Agent-actionable
- **Page/path:**
- **Problem:**
- **Evidence from audit:**
- **Buyer impact:**
- **Smallest useful change:**
- **Acceptance criteria:**
  - [ ]
  - [ ]
- **Verification:**
  - [ ] `git diff --check`
  - [ ] Changed files match intended scope
  - [ ] Build/test/smoke check appropriate to touched area
- **Claim/proof safety notes:**
- **Suggested branch name:**
- **Suggested PR title:**
- **Out of scope:**

### Medium priority

#### [M1] Item title

- **Status:** Agent-actionable
- **Page/path:**
- **Problem:**
- **Evidence from audit:**
- **Buyer impact:**
- **Smallest useful change:**
- **Acceptance criteria:**
  - [ ]
  - [ ]
- **Verification:**
  - [ ] `git diff --check`
  - [ ] Changed files match intended scope
  - [ ] Build/test/smoke check appropriate to touched area
- **Claim/proof safety notes:**
- **Suggested branch name:**
- **Suggested PR title:**
- **Out of scope:**

### Low priority

#### [L1] Item title

- **Status:** Agent-actionable
- **Page/path:**
- **Problem:**
- **Evidence from audit:**
- **Buyer impact:**
- **Smallest useful change:**
- **Acceptance criteria:**
  - [ ]
  - [ ]
- **Verification:**
  - [ ] `git diff --check`
  - [ ] Changed files match intended scope
  - [ ] Build/test/smoke check appropriate to touched area
- **Claim/proof safety notes:**
- **Suggested branch name:**
- **Suggested PR title:**
- **Out of scope:**

## Blocked / approval-needed

Use this section for ideas that may be valuable but should not be implemented until Steve provides the missing approval or business input.

### [B1] Item title

- **Status:** Steve-needed
- **Page/path:**
- **Problem/opportunity:**
- **Evidence from audit:**
- **Buyer impact:**
- **Decision needed from Steve:**
- **Risk if implemented without approval:**
- **Safe interim action, if any:**
- **Can become agent-actionable when:**

## Next PR selection

Before starting implementation, choose one item and fill this out.

- **Selected item ID:**
- **Why this is first:**
- **Branch name:**
- **PR title:**
- **Minimum change required:**
- **Files likely to change:**
- **Checks to run:**
- **Steve approval needed before merge:** Yes / No

## Completed items

Move items here after PR review/merge so future audits can see what changed.

### [Done] Item title

- **PR:**
- **Merged or reviewed date:**
- **Verification:**
- **Score movement:**
- **Follow-up needed:**
