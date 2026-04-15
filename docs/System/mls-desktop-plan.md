# MLS Desktop Implementation Plan

## Purpose

This document turns the existing ServiFinance docs and desktop deliverables into a concrete implementation plan for the MLS desktop side.

The target is the Premium desktop finance terminal for:

- invoice review
- invoice-to-loan conversion
- amortization generation
- payment posting
- customer financial history
- ledger visibility

## Source Basis

This plan is based on:

- `docs/System/service-management-system-outline.md`
- `docs/System/implementation-status.md`
- `docs/System/root-saas-auth-split-status.md`
- `docs/System/msme-tiering-and-module-matrix.md`
- `docs/System/tenant-sms-phased-implementation.md`
- `docs/System/Completed/restructure-transition-roadmap.md`
- `docs/Data Dict & ERD/data-dictionary.md`
- `docs/Deliverables/Gantt Chart.html`
- `docs/Deliverables/IT13/IT13 Proposal Update 1.docx`
- `docs/Deliverables/IT15/Villacino_8466_1stDeliverables.pdf`
- `docs/Use Cases/Use Case IT13.drawio`

## What Already Exists In The Repo

- `src/desktop/ServiFinance.Desktop` already exists as the MAUI hybrid host.
- The desktop bridge and secure storage wiring already exist.
- The desktop host can bootstrap the local API.
- The shared frontend now has normalized MLS desktop routing at `/t/mls/*`.
- The MLS desktop login is implemented and uses tenant credentials without exposing tenant slug in the URL.
- Browser access to `/t/mls/*` is blocked and redirected to a desktop-required page.
- The backend schema already includes `Invoices`, `InvoiceLines`, `MicroLoans`, `AmortizationSchedules`, and `LedgerTransaction`.
- SMS already finalizes invoices and exposes finance handoff state so service work can move into MLS.
- The MLS desktop shell now includes these working modules:
  - MLS dashboard
  - customer financial records
  - invoice-to-loan conversion
  - standalone loans
  - loan accounts and payment posting
  - collections queue
  - ledger review
  - audit review

## Main Gaps To Close

- The core MLS desktop modules are now present, but reporting is still thinner than the deliverable language implies.
- `Generate Financial / Ledger Reports` is only partially covered by the current ledger screen; dedicated report outputs and exports are still missing.
- Premium entitlement visibility can still be made more explicit inside the MLS desktop UI, even though route-level gating already exists.
- The shared finance workflows need more hardening around validation, reconciliation safety, and corrective edge cases.
- The desktop shell and MLS screens still need visual cleanup, responsive tightening, and theme consistency passes.
- Audit coverage should be reviewed to ensure every finance action is captured, not only displayed.

## Desktop Deliverables To Satisfy

The docs and deliverables consistently point to these desktop-side capabilities:

- access desktop terminal
- convert service invoice to micro-loan
- process standalone loans
- manage customer financial records
- calculate amortization
- post loan payment
- generate financial or ledger reports
- view audit logs

Current coverage against the use case is now:

- covered:
  - access desktop terminal
  - convert service invoice to micro-loan
  - process standalone loans
  - manage customer financial records
  - calculate amortization
  - post loan payment
  - view audit logs
- partially covered:
  - generate financial or ledger reports

The practical remaining work is therefore no longer building all MLS modules from scratch. The remaining work is mainly:

- report depth
- entitlement clarity
- finance-grade hardening
- cleanup and UI tightening

## Recommended Delivery Order

### Phase 1: Completed Core MLS Foundation

Goal:
Turn the desktop app into a real tenant-scoped MLS client instead of a placeholder shell.

Work:

- normalized MLS routes to `/t/mls/*`
- implemented MLS desktop login using tenant credentials
- blocked browser access to MLS web routes
- replaced the placeholder MLS surface with authenticated desktop navigation
- enforced desktop session surface and tenant-scoped MLS access
- split MLS desktop navigation from SMS web navigation

Output:

- working desktop sign-in
- normalized tenant-safe MLS route model
- desktop-only MLS workspace shell

### Phase 2: Completed Core MLS Workflows

Goal:
Deliver the baseline use-case workflows required by the MLS desktop.

Work:

- built invoice-to-loan conversion
- built standalone loan processing
- implemented amortization preview and schedule generation
- implemented loan account review and payment posting
- added collections queue and posting flow
- added borrower-level financial record view
- added ledger review and audit review
- connected MLS workflows to tenant-safe backend endpoints

Output:

- functional MLS desktop baseline aligned with the IT13 use case
- working finance-side tenant workflows
- coverage for most documented desktop modules

### Phase 3: Reporting And Entitlement Tightening

Goal:
Close the only major functional gap left in the IT13 use case and make access rules more explicit.

Work:

- add a dedicated MLS reports screen instead of relying only on raw ledger review
- add report slices for collections, payments, loan portfolio, and aging or overdue balances
- add export-friendly outputs for CSV, print, or PDF if required by deliverables
- expose MLS entitlement or subscription state clearly when desktop access is unavailable
- make the desktop shell surface blocked or downgraded states clearly for non-Premium tenants

Output:

- explicit completion of `Generate Financial / Ledger Reports`
- clearer Premium entitlement behavior in the desktop UX

### Phase 4: Finance Hardening

Goal:
Move the MLS desktop from functional to finance-safe and demo-safe.

Work:

- tighten validation for money, date, and term inputs
- verify duplicate-post prevention and repeat-submit handling
- review installment allocation order and balance recomputation edge cases
- add clearer success, warning, and failure feedback to finance actions
- support corrective or reversible finance workflows if the deliverables require them
- ensure audit events exist for login, conversion, standalone creation, payment, and collection posting

Output:

- safer finance operations
- fewer reconciliation risks
- stronger demo and submission readiness

### Phase 5: Cleanup And UX Tightening

Goal:
Refine the existing MLS modules instead of adding large new scope.

Work:

- standardize light and dark theme behavior across all MLS pages
- tighten empty states, loading states, spacing, and responsive behavior
- improve table filtering, search, and date-range interactions in ledger, audit, and collections
- remove any remaining SMS-oriented copy from the MLS desktop shell
- unify panel hierarchy, table density, and action button placement across modules

Output:

- a cleaner and more coherent MLS operator experience
- reduced UI friction without expanding the module list

### Phase 6: Deliverable Closure

Goal:
Align the implemented MLS desktop with the final deliverables and presentation flow.

Work:

- prepare screenshots and walkthrough flow for the MLS desktop side
- document the final desktop workflow from login to loan creation, payment posting, ledger review, and audit review
- map finished screens to the use case diagram and desktop module matrix
- prepare demo script for login, conversion, amortization, standalone loans, payment, collections, ledger, and audit review
- record any remaining report or correction-flow limitations if they remain partial by submission time

Output:

- final presentation-ready desktop deliverable package

## Immediate Next Coding Tasks

The next highest-value tasks are now:

1. add a dedicated MLS reports module for financial and ledger reporting
2. tighten entitlement visibility and blocked-state handling for non-Premium desktop access
3. harden finance actions with stronger validation, duplicate-submit protection, and audit completeness
4. improve filtering and date-range controls in ledger, audit, and collections
5. continue UI cleanup and consistency passes across light and dark theme

## Definition Of Done For MLS Desktop MVP

The MLS desktop side is in a usable MVP state when:

- a Premium tenant user can sign in from the desktop client
- the user can see finance-ready invoices produced by SMS
- one invoice can be converted into one micro-loan
- the system generates a correct amortization schedule
- payments reduce balances correctly and create ledger entries
- the user can review customer loan history and transaction history
- tenant and entitlement rules are enforced in both UI and API

## Deferred Unless Time Allows

These should not block the current working MLS milestone:

- advanced reporting exports if baseline reporting already satisfies the deliverable
- corrective or reversal workflows if the current deliverable only expects normal posting flows
- deeper portfolio analytics beyond aging, collections, and ledger summaries
- further shell redesign beyond consistency and usability improvements
