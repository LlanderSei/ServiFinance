# Superadmin Module Plan

This document maps the active SuperAdmin sidebar modules to the product use cases and lists what still needs to be added inside each module.

## Sidebar Module Groups

### Control Center

- `Overview`
- `System Health`

### Tenant Operations

- `Tenants`

### Commercial Catalog

- `Subscription Tiers`
- `Modules`

## Module Scope

### Overview

Purpose:

- Give the SuperAdmin a root-domain snapshot of platform activity.

Must add next:

- top-line tenant counts by status
- subscription counts by MSME segment and edition
- recent provisioning or registration activity
- quick warnings for overdue platform issues

### System Health

Purpose:

- Monitor whether the SaaS platform is operational.

Must add next:

- API health and uptime summary
- database connectivity and migration status
- background job / queue status if used
- desktop bridge health indicators for hybrid scenarios
- last deployment or build metadata

### Tenants

Purpose:

- Manage tenant accounts and inspect tenant subscription posture.

Must add next:

- tenant filtering by segment, edition, and status
- activate / suspend / reactivate flows
- tenant detail drawer or page
- module override visibility when tenant-specific exceptions are introduced

### Subscription Tiers

Purpose:

- Manage the MSME tier catalog used for pricing and access.

Must add next:

- create / edit / archive tier flow
- pricing and billing metadata editor
- channel summary for web vs desktop coverage
- ordering and highlight label management

### Modules

Purpose:

- Manage the platform module catalog and entitlement mapping source.

Must add next:

- module catalog table with code, name, channel, and lifecycle state
- module description and operator-facing purpose
- enable / disable modules at catalog level
- tier-to-module assignment interface
- validation rules preventing orphaned or duplicate module codes

## Why This Grouping

- `Control Center` keeps platform-wide monitoring separate from commercial configuration.
- `Tenant Operations` isolates tenant account management from catalog design.
- `Commercial Catalog` keeps pricing tiers and module entitlements together because they directly drive MSME access control.

This grouping matches the use cases without introducing extra superadmin modules that would increase complexity before the underlying workflows are implemented.
