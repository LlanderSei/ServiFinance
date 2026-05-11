# ServiFinance MSME Tiering And Module Matrix

Last updated: 2026-05-09

## 1. Product Tiering Decision

ServiFinance should stay as one product with two gating dimensions:

- `Business size segment`: `Micro`, `Small`, `Medium`
- `Subscription edition`: `Standard`, `Premium`

Recommended commercial rule:

- `Standard` gives access to the web-based Service Management System.
- `Premium` includes everything in `Standard` and adds the desktop Financial and Micro-Lending Terminal.

Recommended product design rule:

- Do not create a completely different module set for `Small` and `Medium`.
- Keep the same core product shape across MSMEs.
- Trim complexity mainly for `Micro`.
- Add only a few lightweight operational and finance screens for `Small` and `Medium` where the use cases clearly need them.

This keeps the solution aligned with the diagrams and avoids an unnecessary number of product variants.

## 2. Module Catalog

### 2.1 Web Modules

- `W1` Service Intake And Customer Records
- `W2` Staff Accounts And Role Assignment
- `W3` Scheduling And Dispatch
- `W4` Job Status Updates And Job Photos
- `W5` Invoicing And Customer Self-Service
- `W6` Operational Reports
- `W7` Workforce Overview
- `W8` SLA Escalations
- `W9` Customer Feedback CRM
- `W10` Parts And Cost Control

`W7` is a lightweight added module for `Small` and `Medium`. It should only show technician workload, today's assignments, and pending jobs. It should not become a separate planning subsystem.

`W8`, `W9`, and `W10` are Medium SMS control modules. They should not duplicate the core request, dispatch, reporting, or pricing pages. They should expose stronger management views:

- `W8`: overdue service windows, due-today risk, unscheduled requests, and escalation priority
- `W9`: ratings, pending feedback, expired feedback windows, low-rating follow-up, and suggestion themes
- `W10`: costing gaps, invoice readiness, active preset coverage, category totals, and transparent cost exposure

### 2.2 Desktop Modules

- `D1` Service-Linked Micro-Loan Processing
- `D2` Standalone Loan Processing
- `D3` Customer Financial Records
- `D4` Amortization And Payment Posting
- `D5` Financial And Ledger Reports
- `D6` Audit Log Review
- `D7` Collections Queue
- `D8` Portfolio Risk Dashboard
- `D9` Loan Approval Workflow
- `D10` Finance Policy Control

`D7` is a lightweight added module for `Small` and `Medium`. It should only show due today, overdue, and partially paid accounts. It should not become a full collections management suite.

`D8`, `D9`, and `D10` are Medium Premium MLS control modules. They should not replace the core loan, collection, ledger, or audit pages. They should expose stronger management views:

- `D8`: aging buckets, overdue exposure, due-this-week exposure, portfolio-at-risk rate, and borrower risk rows
- `D9`: loan approval readiness, payment-review blockers, released standalone loans, and release-control signals
- `D10`: interest-rate range, repayment-term bands, principal exposure, and policy exception visibility

## 3. Recommended Tier Matrix

### 3.1 Access Levels

- `Included`: full module is available
- `Limited`: simplified workflow is available, but advanced screens/actions are hidden or blocked
- `Not Included`: module is not available for the tier

### 3.2 Web Access Matrix

| Module | Micro Standard | Micro Premium | Small Standard | Small Premium | Medium Standard | Medium Premium |
|---|---|---|---|---|---|---|
| `W1` Service Intake And Customer Records | Included | Included | Included | Included | Included | Included |
| `W2` Staff Accounts And Role Assignment | Limited | Limited | Included | Included | Included | Included |
| `W3` Scheduling And Dispatch | Limited | Limited | Included | Included | Included | Included |
| `W4` Job Status Updates And Job Photos | Limited | Limited | Included | Included | Included | Included |
| `W5` Invoicing And Customer Self-Service | Included | Included | Included | Included | Included | Included |
| `W6` Operational Reports | Not Included | Not Included | Included | Included | Included | Included |
| `W7` Workforce Overview | Not Included | Not Included | Included | Included | Included | Included |
| `W8` SLA Escalations | Not Included | Not Included | Not Included | Not Included | Included | Included |
| `W9` Customer Feedback CRM | Not Included | Not Included | Not Included | Not Included | Included | Included |
| `W10` Parts And Cost Control | Not Included | Not Included | Not Included | Not Included | Limited | Included |

### 3.3 Desktop Access Matrix

| Module | Micro Standard | Micro Premium | Small Standard | Small Premium | Medium Standard | Medium Premium |
|---|---|---|---|---|---|---|
| `D1` Service-Linked Micro-Loan Processing | Not Included | Included | Not Included | Included | Not Included | Included |
| `D2` Standalone Loan Processing | Not Included | Not Included | Not Included | Included | Not Included | Included |
| `D3` Customer Financial Records | Not Included | Limited | Not Included | Included | Not Included | Included |
| `D4` Amortization And Payment Posting | Not Included | Included | Not Included | Included | Not Included | Included |
| `D5` Financial And Ledger Reports | Not Included | Limited | Not Included | Included | Not Included | Included |
| `D6` Audit Log Review | Not Included | Not Included | Not Included | Not Included | Not Included | Included |
| `D7` Collections Queue | Not Included | Not Included | Not Included | Included | Not Included | Included |
| `D8` Portfolio Risk Dashboard | Not Included | Not Included | Not Included | Not Included | Not Included | Included |
| `D9` Loan Approval Workflow | Not Included | Not Included | Not Included | Not Included | Not Included | Included |
| `D10` Finance Policy Control | Not Included | Not Included | Not Included | Not Included | Not Included | Included |

## 4. Recommended Interpretation Per Segment

### 4.1 Micro

`Micro` tenants should get a simplified operating model:

- They usually need service intake, job progress, invoicing, and customer-facing status tracking.
- They may need financing, but usually only when it originates from a service invoice.
- They usually do not need separate loan products, collections queues, or audit review screens.

Recommendation:

- Keep `Micro Standard` focused on service work and invoicing.
- Use `Micro Premium` only for service-linked lending, amortization, payment posting, and a simple customer financial view.
- Do not expose standalone loans or advanced reporting to `Micro`.

### 4.2 Small

`Small` tenants commonly need a fuller team workflow:

- more staff accounts
- clearer dispatching
- visibility into workload
- recurring use of both service-linked and standalone loans

Recommendation:

- `Small Standard` should expose the full service-management web workflow.
- `Small Premium` should expose the full service workflow plus the practical finance terminal modules needed by a cashier or loan officer.
- `Small Premium` should get the lightweight `Collections Queue`, but not the more formal `Audit Log Review`.

### 4.3 Medium

`Medium` tenants do not need a separate product. They mainly need stronger control and visibility:

- broader team coordination
- richer financial reporting
- audit visibility for management
- stronger SLA, feedback, CRM, and costing oversight

Recommendation:

- `Medium Standard` uses the full web baseline plus `W8`, `W9`, and limited `W10`.
- `Medium Premium` uses full `W8`, `W9`, and `W10`, plus the finance modules from `Small Premium`, `D6 Audit Log Review`, and focused MLS control modules `D8`, `D9`, and `D10`.
- Prefer focused management/control modules over broad new subsystems.

## 5. Answer To The Module Design Question

Recommended answer:

- Yes, some modules should be unavailable to `Micro`.
- No, `Small` and `Medium` do not need many brand-new modules.

The cleanest product shape is:

- Trim down `Micro`
- Keep `Small` as the full operational baseline
- Let `Medium` mostly share `Small` modules, with stronger reporting and audit visibility

This is preferable to building separate systems for each MSME segment because:

- the use cases already define a coherent shared workflow
- the project scope remains manageable for one implementation
- module enforcement becomes easier to explain and test
- tenants can upgrade without learning a completely different product

## 6. Entitlement And Enforcement Rules

Module access should not rely only on UI hiding. The backend should enforce it too.

Current rules:

- Every tenant must have a `BusinessSizeSegment`.
- Every tenant must have a `SubscriptionEdition`.
- Every tenant should reference an active `SubscriptionTier`.
- Effective module access is resolved from `SubscriptionTierModules`, not from hard-coded tier names.
- `Included` and `Limited` both unlock the module surface; full-only routes/actions require `Included`.
- `Not Included`, `Excluded`, missing links, and inactive catalog modules deny the module.
- Superadmin manages tier-to-module links through the subscription catalog instead of changing code.

Implemented full-only examples:

- `W2 Staff Accounts And Role Assignment`: limited access keeps basic platform-user administration available, while SMS Roles & Permissions management requires full access.
- `W3 Scheduling And Dispatch`: limited access keeps the dispatch register and basic scheduling available, while timeline, reschedule, and handover workflows require full access.
- `W4 Job Status Updates And Job Photos`: limited access keeps status updates available, while technician evidence upload, evidence editing, and evidence deletion require full access.
- `W5 Invoicing And Customer Self-Service`: limited access can keep service-facing invoice flow available, while tenant Pricing policy and preset management require full access.
- `W6 Operational Reports`: limited access supports standard report windows, while custom windows and export/print actions require full access.
- `W8 SLA Escalations`: Medium tenants can review overdue, due-today, and unscheduled service risk from a dedicated control surface.
- `W9 Customer Feedback CRM`: Medium tenants can review ratings, customer suggestions, low-rating follow-up, and pending feedback windows.
- `W10 Parts And Cost Control`: Medium Standard can review costing exposure and invoice gaps; Medium Premium should own full cost-control governance.
- `D5 Financial And Ledger Reports`: limited access supports standard MLS report summaries, while long-range/custom windows, exports, and ledger drilldown require full access.
- `D8 Portfolio Risk Dashboard`: Medium Premium can review overdue exposure, aging buckets, due-this-week balances, and portfolio-at-risk summaries from existing loans and amortization schedules.
- `D9 Loan Approval Workflow`: Medium Premium can review approval readiness and blockers, request service-linked loan approval, and approve or reject service-linked and standalone loan release through persisted maker-checker decisions.
- `D10 Finance Policy Control`: Medium Premium can review interest, term, principal, and policy-exception signals across the MLS portfolio.

Default balance:

- `Micro Standard` stays SMS-focused and does not unlock MLS desktop modules.
- `Micro Premium` unlocks service-linked MLS finance, amortization/payment posting, and limited finance reporting.
- `Small Premium` unlocks practical MLS finance operations and collections, but not audit review.
- `Medium Premium` unlocks the full SMS + MLS set, including `D6` audit review and `D8` to `D10` control modules.

Customer portal rule:

- Do not gate the whole customer portal to `Small Standard` and above.
- The portal belongs to `W5` Invoicing And Customer Self-Service, which is included from `Micro Standard`.
- Gate advanced customer-facing capabilities by module/access level when needed, but keep basic request tracking, invoice visibility, payment entry, and feedback available to all active SMS tiers that include `W5`.

Recommended enforcement points:

- navigation and menus
- route guards
- API authorization and module checks
- desktop shell visibility
- backend command handlers for restricted workflows

## 7. Suggested Data Model Support

To support the tiering model cleanly, the SaaS platform should eventually store:

### 7.1 Tenant Fields

Add or formalize the following fields on `Tenants`:

- `BusinessSizeSegment`
- `SubscriptionEdition`
- `SubscriptionPlan`
- `SubscriptionStatus`

### 7.2 Reference Tables

Current lightweight reference data:

- `SubscriptionTiers`
  - `Code`
  - `BusinessSizeSegment`
  - `SubscriptionEdition`
  - `DisplayName`
- `PlatformModules`
  - `Code`
  - `Name`
  - `Channel`
- `SubscriptionTierModules`
  - `SubscriptionTierId`
  - `PlatformModuleId`
  - `AccessLevel`

Future tenant-specific overrides can still add a separate `TenantModuleEntitlements` table if promotional or exception access is needed. `Source` should distinguish whether access came from:

- tier default
- superadmin override
- future promotional or migration rule

## 8. Minimum Implementation Impact

The minimum implementation change set should be:

1. Add `BusinessSizeSegment` and `SubscriptionEdition` to tenant configuration.
2. Create a server-side module entitlement resolver.
3. Hide or disable disallowed routes and menus in web and desktop clients.
4. Enforce restricted modules in API endpoints and desktop actions.

This is enough to support the documented tiering model without over-expanding scope.
