# Mobile Hardening Temp Checklist

Purpose: keep the remaining root + tenant SMS mobile layout fixes externalized so work can continue in small slices without drifting.

## Shared shell and layout

- [x] Move mobile sidebar chevron to the centered right edge of the drawer, offset like desktop.
- [x] Prevent FAB from peeking/floating when the sidebar drawer is open.
- [x] Restore desktop logout/footer placement after the mobile sidebar changes.
- [x] Fix bottom safe-area compensation for pages with bottom workspace tabs and FAB.
- [x] Ensure page content with bottom tabs gets enough bottom padding.
- [x] Keep workspace header/content relationships stable on mobile without breaking desktop.

## Root workspace

- [x] Make Subscription Management > Recovery expose the whole list and let the main content scroll.
- [x] Fix awkward empty space in Root Dashboard subscription mix list/cards on mobile.
- [x] Clean broken mobile table/card presentation on:
  - Root Users
  - Roles & Permissions
  - Subscription Management
  - Audits
- [x] Make Roles & Permissions > Matrix allow the permission list to extend naturally and scroll.

## Shared records/table behavior

- [x] Reduce broken mobile card conversion for tables/details/pills/actions.
- [x] Improve dense detail arrangements so labels, pills, dates, and actions do not form empty grid gaps.
- [x] Normalize KPI card heights on mobile rails.
- [x] Keep filter card compact on mobile: only `Options` and `Clear filters`, real filters live in the modal.

## Tenant SMS workspace

- [x] Move Dispatch `All assignments / My assignments` toggle below the KPI area.
- [x] Fix Reports mobile layout so KPI/filter do not trap scrolling incorrectly.
- [x] Replace Dispatch modal mobile footer with `Close` + `Options`, and make options open above if near bottom edge.
- [x] Fix Customer Portal audit tab layout issues inside Tenant SMS Audits.
- [x] Replace vague service costing tab icons with clearer ones.

## Follow-up screenshot fixes

- [x] Reduce overcompensated bottom safe-area padding in shared workspace scroll containers.
- [x] Keep filter-like card headers horizontal on mobile with text on the left and actions on the right.
- [x] Make Tenant SMS Reports KPI cards and reporting window scroll with the rest of the report content.
- [x] Move Tenant SMS Reports window controls into the mobile options modal, leaving only `Options` and `Reset window` on the card.
- [x] Split Tenant SMS Cost Control into bottom tabs for `Costing Worklist`, `Cost Categories`, and `Preset Coverage`.

## Second follow-up screenshot fixes

- [x] Collapse the mobile workspace header row when the header hides after scrolling down.
- [x] Make bottom padding conditional on fixed FABs and fixed bottom workspace tabs instead of always reserving the same space.
- [x] Make FAB bottom position adapt automatically when a fixed bottom workspace tab bar is present.
- [x] Reduce Tenant SMS Dispatch KPI rail vertical slack and make `All assignments` / `My assignments` fill the available width evenly.
- [x] Rewrite Tenant SMS Dispatch mobile assignment cards into basic details plus pills, then full-width `View` and `Options` actions.
- [x] Move secondary Dispatch assignment actions into a mobile options sheet.
- [x] Make inline Service Costing modal tabs text-based and horizontally scrollable instead of icon-only mobile tabs.
- [x] Move Tenant Billing renewal warnings into the scrollable billing content.
- [x] Render desktop logout confirmation outside the transformed sidebar so it covers the whole screen.

## Third follow-up screenshot fixes

- [x] Remove the retained mobile header area/flicker caused by conflicting hidden-header sizing.
- [x] Reduce default record scroll bottom padding so pages without bottom tabs do not reserve an empty FAB area.
- [x] Keep extra bottom padding conditional for pages that actually render fixed bottom workspace tabs.
- [x] Restore Dispatch `All assignments` / `My assignments` on desktop beside the top tabs and keep the mobile copy below the KPI rail.
- [x] Fix Dispatch assignment view toggle wrapper so `My assignments` is not clipped by an inline-flex/grid display conflict.
- [x] Apply the Dispatch Overview mobile assignment card layout to Assignment, My Assignment, Pending, and Archive dispatch tabs.
- [x] Make mobile Dispatch assignment action rows full-width, with overflow actions moved behind `Options`.
- [x] Convert Tenant SMS Customer and Platform Users mobile rows to detail-first cards with full-width evenly distributed action rows.
- [x] Split Customer Feedback CRM into bottom tabs for `Feedback Queue` and `Suggestion Themes`.
- [x] Replace numeric-only Operational Reports workload cards with labelled mobile detail groups.
- [x] Convert Audits mobile rows to detail-first cards with action/outcome context preserved.

## Fourth follow-up mobile table-card fixes

- [x] Add shared mobile table-card detail helpers for labelled values and explicit `No {ColumnName}` empty states.
- [x] Apply Dispatch-style mobile card rows to Tenant SMS Service Requests across New, Ongoing, and History tabs.
- [x] Apply labelled mobile card rows to Customer Feedback CRM > Feedback Queue.
- [x] Replace SMS Dashboard > Team Pressure numeric-only mobile cards with labelled details.
- [x] Apply horizontally scrollable mobile card rails to Reports > Window Comparison and Reports > Workload using the one/two/three-plus convention.
- [x] Add a reusable bottom-center toast and trigger it from fixed mobile workspace bottom tab presses.

## Fifth follow-up mobile polish

- [x] Raise `BottomCenterToast` above the bottom tab/FAB zone and add an opacity/position transition.
- [x] Stop shared mobile table CSS from forcing hidden last-column cells visible and duplicating row values.
- [x] Convert Parts and Cost Control > Costing Worklist mobile rows to the Dispatch Overview detail-plus-pills card layout.
- [x] Keep Parts and Cost Control KPI cards on a horizontal mobile rail so the first KPI is not clipped by the worklist panel.
- [x] Give Parts and Cost Control bottom tabs distinct worklist, categories, and preset coverage icons.

## Customer portal mobile polish

- [x] Anchor the customer portal sidebar `Sign out` action to the bottom of the drawer.
- [x] Move the customer portal drawer close chevron to the center-right edge with an offset.
- [x] Reuse `BottomCenterToast` for customer portal bottom-tab presses.
- [x] Replace timestamp-based bottom-tab toast keys with pure functional state updates for React dependency audit.

## Verification

- [x] `cmd /c npm run build` passed from `src/frontend/ServiFinance.Frontend` on 2026-05-14.
- [x] Follow-up screenshot fixes also passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-14.
- [x] Second follow-up screenshot fixes passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Third follow-up screenshot fixes passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Third follow-up screenshot fixes passed `git diff --check` on 2026-05-15.
- [x] Fourth follow-up mobile table-card fixes passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Fourth follow-up mobile table-card fixes passed `git diff --check` on 2026-05-15.
- [x] Fifth follow-up mobile polish passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Fifth follow-up mobile polish passed `git diff --check` on 2026-05-15.
- [x] Customer portal mobile polish passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Customer portal mobile polish passed `git diff --check` on 2026-05-15.
- [x] Customer portal bottom-tab purity fix passed `cmd /c npm run lint` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.
- [x] Customer portal bottom-tab purity fix passed `cmd /c npm run build` from `src/frontend/ServiFinance.Frontend` on 2026-05-15.

## Known user notes

- Ignore purely dimension-preset-specific bottom overflow that disappears with other phone presets.
- Do not break existing desktop web layout while finishing mobile behavior.
