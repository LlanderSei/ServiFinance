# Implementation Summary

## Date: 2026-04-29

---

## Core Backend Fixes

### Customer Registration Foreign Key Issue
**Problem:** `RefreshSession.UserId` referenced `Users` table but customer registration creates a `Customer` record. Attempting to use a Customer ID as User ID caused FK constraint violation.

**Solution:**
- Added nullable `CustomerId` column to `RefreshSession` entity with optional FK to `Customers`
- Updated `JwtSessionTokenService`:
  - `CreateSessionAsync`: Sets `UserId` OR `CustomerId` based on `AuthenticationSurface` (`CustomerWeb` → `CustomerId`)
  - Added `GetAuthenticatedCustomerAsync` to load customers (with `IgnoreQueryFilters()`)
  - Updated `RefreshSessionAsync` to resolve user from either FK column
  - Extended `IsAllowedForSurface` to accept `CustomerWeb` surface with "Customer" role
- Database migration: `20260429013654_AddCustomerIdToRefreshSession`

**Files Modified:**
- `src/backend/ServiFinance.Domain/Entities.cs`
- `src/backend/ServiFinance.Infrastructure/Data/ServiFinanceDbContext.cs`
- `src/backend/ServiFinance.Infrastructure/Auth/JwtSessionTokenService.cs`
- `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs` (no change needed — already uses `AuthenticationSurface.CustomerWeb`)

---

## Frontend - TypeScript Fixes

### Session Type Corrections
**Problem:** `AuthSessionResponse` properties were accessed directly on session instead of `session.user`. The `CurrentSessionUser.surface` type also lacked `CustomerWeb`.

**Changes:**
1. `src/frontend/ServiFinance.Frontend/src/shared/api/contracts.ts`
   - Updated `CurrentSessionUser.surface` union: added `"CustomerWeb"`

2. `src/frontend/ServiFinance.Frontend/src/shared/auth/session.ts`
   - Refactored `normalizeSurface`: proper string/number handling; added `"CustomerWeb"` mapping from `3`
   - Fixed type comparison by checking `typeof surface === "string"` first

3. Customer pages — all updated to use `session.user`:
   - `CustomerDashboardPage.tsx`: `session.fullName` → `session.user.fullName`; removed non-existent fields (`mobileNumber`, `address`, `signedInAtUtc`) and replaced with placeholders
   - `CustomerLayout.tsx`, `CustomerLoginPage.tsx`, `CustomerRegisterPage.tsx`, `CustomerProtectedRoute.tsx`: fixed `tenantDomainSlug` access to `session.user.tenantDomainSlug` and pass `session.user` to navigation helpers
   - `CustomerFeedbackPage.tsx`: fixed tenant slug access
   - `CustomerRequestsPage.tsx`: fixed `RequestRow` prop type to use `CustomerRequest` directly instead of array index access on possibly-undefined

**Build result:** 0 errors after fixes.

---

## Frontend - HTTP Error Handling

**Problem:** `httpPostJson` attempted to parse JSON on error responses (e.g. 401/403), causing "Unexpected end of JSON input" on wrong credentials.

**Solution:** Added `Content-Type` header check before parsing error payload in:
- `httpPostJson`
- `httpPutJson`
- `httpPostFormData`
- `httpDelete`

**Files:** `src/frontend/ServiFinance.Frontend/src/shared/api/http.ts`

---

## Frontend - Customer UI/UX

### Logout Fix
**Problem:** Logout required two clicks — session clearing was not awaited before navigation.

**Solution:** Made `handleLogout` in `CustomerShell.tsx` async and `await logoutCustomerAccount()` before navigation.

**File:** `src/frontend/ServiFinance.Frontend/src/features/customer/CustomerShell.tsx`

---

## Frontend - Layout Redesign

### SMS Dashboard (`SmsDashboardPage.tsx`)
- Removed all implementation/phase notes
- Simplified KPI cards to 4 core metrics
- Replaced detailed module table with direct module navigation links
- Clean single-column layout with scroll stack

### SMS Dispatch (`SmsDispatchPage.tsx`)
**New layout:**
- Two-column: left sidebar (280px fixed) + main content (flexible)
- **Left sidebar:** KPI cards + View mode toggle (admin only) — independently scrollable
- **Right main:** Filter panel (inline), table (register view) OR timeline view — both inside `RecordScrollRegion`
- Filters are now inline with the content, not separate panels
- Mode toggles (Register/Timeline) moved to assignment register header
- Removed "Phase 6 rollout" notes panel
- Table now uses full available width; column headers slightly adjusted

### SMS Reports (`SmsReportsPage.tsx`)
- Already had proper scroll region; minor layout tuning
- Kept comprehensive reporting panels intact
- No phase notes present — already clean

---

## Global Cleanup

Removed all UI text referencing:
- "Phase X" labels
- "Implementation slice"
- "Next backend hook"/"Next slice"
- Roadmap/rollout descriptions

**Cleaned files:**
- `CustomerDashboardPage.tsx`
- `SmsDashboardPage.tsx`
- `SmsDispatchPage.tsx`

---

## Database Migration

**Migration:** `AddCustomerIdToRefreshSession`
- Adds nullable `CustomerId` column to `RefreshSessions`
- Creates FK: `RefreshSessions.CustomerId` → `Customers.Id` (SetNull)
- Creates index on `CustomerId`

**Apply with:**
```bash
cd src/backend/ServiFinance.Api
dotnet ef database update --project ../ServiFinance.Infrastructure/ServiFinance.Infrastructure.csproj
```

---

## Outstanding Tasks

1. **Apply database migration** to resolve FK constraint on customer login
2. **Test customer registration** end-to-end after migration
3. **Verify zoom/layout** at 125% on Dispatch page — sidebar/table split should prevent squeezing
4. **Consider table row height** adjustments if records still appear too small (CSS `min-h` on table rows)

---

## Notes

- All customer session flows (login, register, refresh, logout) now correctly store refresh sessions with `CustomerId` instead of `UserId`.
- Tenant SMS module is now production-clean UI-wise; no scaffolding notes remain.
- Backend and frontend type contracts are aligned: `CurrentSessionUser` now includes `CustomerWeb` surface.
