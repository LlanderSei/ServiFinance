import { createBrowserRouter, createHashRouter } from "react-router-dom";
import { AppShell } from "./shell";
import { DashboardPage } from "@/features/superadmin/DashboardPage";
import { RegisterPage } from "@/features/public/RegisterPage";
import { RootLandingPage } from "@/features/public/RootLandingPage";
import { TenantLandingPage } from "@/features/tenant/TenantLandingPage";
import { TenantsPage } from "@/features/superadmin/TenantsPage";
import { SubscriptionsPage } from "@/features/superadmin/SubscriptionsPage";
import { SmsDashboardPage } from "@/features/tenant/SmsDashboardPage";
import { SmsUsersPage } from "@/features/tenant/SmsUsersPage";
import { MlsDashboardPage } from "@/features/tenant/MlsDashboardPage";
import { isDesktopShell } from "@/platform/runtime";

const routes = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootLandingPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "tenants", element: <TenantsPage /> },
      { path: "subscriptions", element: <SubscriptionsPage /> },
      { path: ":tenantDomainSlug/sms", element: <TenantLandingPage system="sms" /> },
      { path: ":tenantDomainSlug/sms/dashboard", element: <SmsDashboardPage /> },
      { path: ":tenantDomainSlug/sms/users", element: <SmsUsersPage /> },
      { path: ":tenantDomainSlug/mls", element: <TenantLandingPage system="mls" /> },
      { path: ":tenantDomainSlug/mls/dashboard", element: <MlsDashboardPage /> }
    ]
  }
];

export const router = isDesktopShell()
  ? createHashRouter(routes)
  : createBrowserRouter(routes);
