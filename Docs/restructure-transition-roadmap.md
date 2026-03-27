# ServiFinance Restructure Transition Roadmap

This repo now has the first implementation slice of the planned restructure:

- `src/backend/ServiFinance.Domain`
- `src/backend/ServiFinance.Application`
- token-oriented `/api/auth/*` foundations in the current web host
- `src/frontend/ServiFinance.Frontend` as the future shared React workspace
- `/`, `/register`, `/dashboard`, `/tenants`, `/subscriptions`, `/{tenant}/sms/*`, and `/{tenant}/mls/*` now handed off to the built React app from the current web host
- `ServiFinance` now hosts the shared React bundle through MAUI `HybridWebView`
- desktop secure-storage bridge wiring is now live for token refresh and shell context

## Current Transitional State

- `ServiFinance.Web` is still the active web host, but it now primarily acts as the API + static React host during transition.
- The root marketing, registration, superadmin pages, and tenant SMS/MLS pages are now served from the React build output under `src/frontend/ServiFinance.Frontend/dist`.
- `ServiFinance.Infrastructure` now references `Domain` and `Application`.
- `ServiFinance.Shared` and `ServiFinance.Web.Client` are still present as legacy Blazor-era projects.
- `ServiFinance` is still the active MAUI desktop host, and it now loads the shared React bundle through `HybridWebView` instead of `BlazorWebView`.

## Next Implementation Slices

1. Replace the handwritten frontend contracts with generated OpenAPI TypeScript clients.
2. Remove `ServiFinance.Web.Client`.
3. Retire `ServiFinance.Shared` and the remaining duplicated Blazor page implementations after the React surfaces are verified.
4. Physically rename/move the active hosts to the final `Api` and `Desktop` folder/project names once the transition is stable.
5. Add a configurable desktop API base URL source instead of relying on the current localhost default.
