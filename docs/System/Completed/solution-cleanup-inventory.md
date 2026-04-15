# Solution Cleanup Inventory

## Active Runtime Shape

- Web host: `src/backend/ServiFinance.Api`
- Desktop host: `src/desktop/ServiFinance.Desktop`
- Shared frontend: `src/frontend/ServiFinance.Frontend`
- Backend libraries: `src/backend/ServiFinance.Domain`, `src/backend/ServiFinance.Application`, `src/backend/ServiFinance.Infrastructure`

## Already Removed

- `ServiFinance.Web.Client/`
  - Removed from the repo after React and HybridWebView fully replaced the legacy Blazor WebAssembly client

- `ServiFinance.Shared/`
  - Removed from the repo after the active hosts stopped depending on shared Blazor-era assets and interfaces

- `ServiFinance.Web/Components/`
  - The web host no longer compiles or serves the legacy Blazor UI shell

- `ServiFinance.Web/Services/FormFactor.cs`
  - The web host no longer uses the shared `IFormFactor` abstraction

- `ServiFinance.Web/Components/Pages/Forbidden.razor`
  - Replaced by the React route `/forbidden`

- `ServiFinance.Web/Components/Pages/Error.razor`
  - Replaced by the React route `/error`

## Rename Or Move

- `ServiFinance.Web` -> `src/backend/ServiFinance.Api`
  - Physical move completed; the old root-level folder is now legacy cleanup only

- `ServiFinance` -> `src/desktop/ServiFinance.Desktop`
  - Physical move completed; the old root-level folder is now legacy cleanup only

- `ServiFinance.Infrastructure` -> `src/backend/ServiFinance.Infrastructure`
  - Physical move completed; the backend libraries now live under one root

## Keep

- `src/backend/ServiFinance.Domain`
- `src/backend/ServiFinance.Application`
- `src/frontend/ServiFinance.Frontend`
  - These match the target architecture and should remain the canonical product structure
