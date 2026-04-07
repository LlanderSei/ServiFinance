# ServiFinance MSME Tiering And Module Matrix

Last updated: 2026-04-08

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

`W7` is a lightweight added module for `Small` and `Medium`. It should only show technician workload, today's assignments, and pending jobs. It should not become a separate planning subsystem.

### 2.2 Desktop Modules

- `D1` Service-Linked Micro-Loan Processing
- `D2` Standalone Loan Processing
- `D3` Customer Financial Records
- `D4` Amortization And Payment Posting
- `D5` Financial And Ledger Reports
- `D6` Audit Log Review
- `D7` Collections Queue

`D7` is a lightweight added module for `Small` and `Medium`. It should only show due today, overdue, and partially paid accounts. It should not become a full collections management suite.

## 3. Recommended Tier Matrix

### 3.1 Access Levels

- `Included`: full module is available
- `Limited`: simplified workflow is available, but advanced screens are hidden
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

`Medium` tenants do not need many new subsystems. They mainly need stronger control and visibility:

- broader team coordination
- richer financial reporting
- audit visibility for management

Recommendation:

- `Medium Standard` can use the same web modules as `Small Standard`.
- `Medium Premium` can use the same finance modules as `Small Premium` plus `Audit Log Review`.
- Prefer broader limits and stronger reporting over introducing many medium-only modules.

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

Recommended rules:

- Every tenant must have a `BusinessSizeSegment`.
- Every tenant must have a `SubscriptionEdition`.
- Effective access is computed from `BusinessSizeSegment + SubscriptionEdition`.
- `Premium` extends `Standard`; it does not replace it.
- Superadmin may apply explicit tenant overrides only as exceptions, not as the primary model.

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

Add lightweight reference data for:

- `SubscriptionTiers`
  - `Code`
  - `BusinessSizeSegment`
  - `SubscriptionEdition`
  - `DisplayName`
- `ModuleCatalog`
  - `Code`
  - `Name`
  - `Channel`
- `TenantModuleEntitlements`
  - `TenantId`
  - `ModuleCode`
  - `AccessLevel`
  - `Source`

`Source` should distinguish whether the access came from:

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
