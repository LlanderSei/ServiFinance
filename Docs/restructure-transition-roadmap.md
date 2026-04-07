# ServiFinance Restructure Transition Roadmap

This repo now has the first implementation slice of the planned restructure:

- `src/backend/ServiFinance.Domain`
- `src/backend/ServiFinance.Application`
- token-oriented `/api/auth/*` foundations in the current web host
- `src/frontend/ServiFinance.Frontend` as the future shared React workspace
- `/`, `/register`, `/dashboard`, `/tenants`, `/subscriptions`, `/t/{tenant}/sms/*`, and `/t/{tenant}/mls/*` now handed off to the built React app from the current web host
- `ServiFinance` now hosts the shared React bundle through MAUI `HybridWebView`
- desktop secure-storage bridge wiring is now live for token refresh and shell context

## Current Transitional State

- `src/backend/ServiFinance.Api` is now the active web host, and it primarily acts as the API + static React host during transition.
- The root marketing, registration, superadmin pages, and tenant SMS/MLS pages are now served from the React build output under `src/frontend/ServiFinance.Frontend/dist`.
- `src/backend/ServiFinance.Infrastructure` now references `Domain` and `Application`.
- `ServiFinance.Shared` and `ServiFinance.Web.Client` have been removed from the active repo after the React migration replaced their delivery paths.
- `src/desktop/ServiFinance.Desktop` is now the active MAUI desktop host, and it loads the shared React bundle through `HybridWebView` instead of `BlazorWebView`.

## Next Implementation Slices

1. Replace the handwritten frontend contracts with generated OpenAPI TypeScript clients.
2. Delete the now-obsolete root-level host folders after the new paths are stable in day-to-day use.
3. Add a configurable desktop API base URL source instead of relying on the current localhost default.
