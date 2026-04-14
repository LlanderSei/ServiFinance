# Frontend Tailwind + DaisyUI Migration

This document tracks the active migration of the React frontend at `src/frontend/ServiFinance.Frontend` from custom, hardcoded CSS toward Tailwind CSS and DaisyUI.

## Migration intent

- install Tailwind and DaisyUI in the actual React frontend, not only the backend host
- let the authenticated shell light/dark toggle drive Daisy theme tokens
- move repeated shell primitives first so superadmin and tenant surfaces benefit together
- migrate page-level compositions gradually instead of rewriting the whole interface at once

## Current baseline

Tailwind and DaisyUI are now installed and active in:

- `src/frontend/ServiFinance.Frontend/package.json`
- `src/frontend/ServiFinance.Frontend/vite.config.ts`
- `src/frontend/ServiFinance.Frontend/src/tailwind.css`
- `src/frontend/ServiFinance.Frontend/src/main.tsx`

Two Daisy themes are now defined:

- `servifinance-light`
- `servifinance-dark`

The authenticated shell now publishes those themes through `data-theme`.

## First migrated shared surfaces

These shared primitives now include DaisyUI/Tailwind-backed structure while still preserving the existing CSS safety net:

- `src/frontend/ServiFinance.Frontend/src/shared/auth/AuthenticatedShell.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/auth/shell/AuthSidebar.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordWorkspace.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordDetailsModal.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordFormModal.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceFabDock.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordTable.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/MetricCard.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceControls.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspacePanel.tsx`

The authenticated shell layout is now more utility-driven as well:

- `src/frontend/ServiFinance.Frontend/src/shared/auth/AuthenticatedShell.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/auth/shell/AuthSidebar.tsx`

The old sidebar structure in `src/frontend/ServiFinance.Frontend/src/styles.css` has been reduced so Tailwind and DaisyUI now own more of the rail sizing, nav item layout, and footer alignment.

The shared form and modal layer is now utility-backed too:

- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceControls.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordWorkspace.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordFormModal.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordDetailsModal.tsx`

Tenant SMS create/finalize/schedule modals now use those wrappers directly instead of the older `tenant-inline-form*`, `record-modal__button`, `record-filter`, `record-action-button`, and `record-status-pill` CSS hooks.

The first record and dashboard pages now consume those primitives instead of owning raw hardcoded table/button/card markup:

- `src/frontend/ServiFinance.Frontend/src/features/superadmin/TenantsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/SubscriptionsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/ModulesPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/DashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/SystemHealthPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsUsersPage.tsx`

## Latest completed slice

The shared panel and table layout layer is now utility-backed rather than CSS-anchored:

- `src/frontend/ServiFinance.Frontend/src/shared/records/MetricCard.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordTable.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspacePanel.tsx`

The remaining superadmin and tenant dashboard/report wrappers now consume those shared surfaces directly:

- `src/frontend/ServiFinance.Frontend/src/features/superadmin/TenantsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/DashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/SystemHealthPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDispatchPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsReportsPage.tsx`

That allowed the old `record-table*`, `record-toolbar`, `superadmin-metric-grid`, `superadmin-panel*`, `superadmin-subtable*`, and `superadmin-detail-grid*` structural selectors to be removed from `src/frontend/ServiFinance.Frontend/src/styles.css`.

The remaining authenticated helper surfaces are now utility-backed too:

- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceControls.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspacePanel.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/DashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/SystemHealthPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/TenantModuleScaffold.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDispatchPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsReportsPage.tsx`

That removed the remaining authenticated helper selectors from `src/frontend/ServiFinance.Frontend/src/styles.css`, including:

- `record-toggle-group`
- `record-inline-note`
- `report-distribution-*`
- `tenant-note-list`
- `superadmin-tenant-cell`
- `superadmin-warning*`

The public shell layer is now also utility-backed through shared primitives:

- `src/frontend/ServiFinance.Frontend/src/shared/public/PublicPrimitives.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/public/PublicHeader.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/public/PublicFooter.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/public/RootLoginModal.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/public/TenantLoginModal.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/public/RootLandingPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/public/RegisterPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/TenantLandingPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/system/NotFoundPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/system/ForbiddenPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/system/ErrorPage.tsx`

That allowed the old public structural selectors to be removed from `src/frontend/ServiFinance.Frontend/src/styles.css`, including:

- `marketing-page*`
- `public-header*`
- `button*`
- `hero*`
- `surface-card*`
- `detail-section*`
- `section-heading*`
- `detail-grid`
- `tier-grid*`
- `workflow-list`
- `register-*`
- `public-footer*`
- `modal-card*`
- `login-form*`
- `public-login-*`

The last live generic helpers are now utility-backed as well:

- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceControls.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/auth/ProtectedRoute.tsx`
- `src/frontend/ServiFinance.Frontend/src/app/shell.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/TenantDashboardPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsUsersPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsCustomersPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsServiceRequestsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDispatchPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsReportsPage.tsx`

That removed the last live generic legacy helpers from `src/frontend/ServiFinance.Frontend/src/styles.css`, including:

- `eyebrow`
- `status-note`
- `form-error`
- `module-pill*`
- `surface-list*`
- `data-table*`

The shell frame and floating action dock are now utility-backed too:

- `src/frontend/ServiFinance.Frontend/src/shared/auth/AuthenticatedShell.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordWorkspace.tsx`
- `src/frontend/ServiFinance.Frontend/src/shared/records/WorkspaceFabDock.tsx`

That removed the remaining shell-owned structural selectors from `src/frontend/ServiFinance.Frontend/src/styles.css`, including:

- `authed-shell*`
- `authed-page`
- `record-page`
- `record-workspace`
- `workspace-fab-dock*`

The remaining record-content stack helpers are now componentized too:

- `src/frontend/ServiFinance.Frontend/src/shared/records/RecordWorkspace.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/superadmin/TenantsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/TenantModuleScaffold.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsUsersPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsCustomersPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsServiceRequestsPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsDispatchPage.tsx`
- `src/frontend/ServiFinance.Frontend/src/features/tenant/sms/SmsReportsPage.tsx`

That removed the last record-content layout selectors from `src/frontend/ServiFinance.Frontend/src/styles.css`, including:

- `record-content-stack*`

## Next migration slices

1. Keep `styles.css` limited to global tokens, base document styles, and reduced-motion fallback.
2. When new layout primitives are needed, add them to shared React components first instead of reintroducing page-scoped CSS selectors.

## Constraint

Do not mix random Tailwind classes into isolated pages without first moving their shared primitive. The migration should stay centered on reusable shell surfaces so both superadmin and tenant UIs converge on the same system.
