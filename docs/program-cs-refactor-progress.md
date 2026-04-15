# Program.cs Refactor Progress

## Goal
Reduce `src/backend/ServiFinance.Api/Program.cs` to host bootstrap and composition only, while moving endpoint groups, contracts, and helper logic into area-based files.

## Current Pass
Completed:
- extracted platform API mappings to `src/backend/ServiFinance.Api/Endpoints/PlatformApiEndpointMappings.cs`
- extracted auth API mappings to `src/backend/ServiFinance.Api/Endpoints/AuthApiEndpointMappings.cs`
- extracted superadmin API mappings to `src/backend/ServiFinance.Api/Endpoints/SuperadminApiEndpointMappings.cs`
- extracted tenant SMS API mappings to `src/backend/ServiFinance.Api/Endpoints/TenantSmsApiEndpointMappings.cs`
- extracted web account form-post routes to `src/backend/ServiFinance.Api/Endpoints/WebAccountEndpointMappings.cs`
- extracted React/static frontend mapping to `src/backend/ServiFinance.Api/Endpoints/FrontendAppEndpointMappings.cs`
- extracted shared helper logic to `src/backend/ServiFinance.Api/Infrastructure/ProgramEndpointSupport.cs`
- extracted request/response contracts to `src/backend/ServiFinance.Api/Contracts/ProgramApiContracts.cs`
- reduced `Program.cs` to builder, middleware, and endpoint composition

## Remaining Cleanup
Not required for this pass, but still sensible follow-up work:
- split `TenantSmsApiEndpointMappings.cs` further by feature area:
  - users
  - customers
  - service requests
  - dispatch
  - reports
- split `ProgramApiContracts.cs` by area instead of one file
- consider replacing anonymous response objects in superadmin endpoints with named response contracts
- add endpoint-focused tests once endpoint files are stable

## Refactor Rule
Keep `Program.cs` focused on:
- service registration
- middleware/pipeline
- endpoint composition only
