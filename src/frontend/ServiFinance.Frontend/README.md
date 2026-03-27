# ServiFinance Frontend

Shared React + TypeScript workspace for:

- root public marketing and registration flows
- superadmin web surfaces
- tenant SMS web surfaces
- tenant MLS web surfaces
- future MAUI `HybridWebView` desktop host

## Commands

```bash
npm install
npm run dev
```

The frontend expects the ASP.NET backend host to expose:

- `/api/auth/*`
- `/api/catalog/subscription-tiers`
- future `/api/superadmin/*`
- future `/api/tenants/{tenantSlug}/sms/*`
- future `/api/tenants/{tenantSlug}/mls/*`
