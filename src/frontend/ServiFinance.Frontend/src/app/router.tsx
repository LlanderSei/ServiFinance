import { lazy } from "react";
import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { createBrowserRouter, createHashRouter, useParams } from "react-router-dom";
import { AppShell } from "./shell";
import { isDesktopShell } from "@/platform/runtime";

function lazyPage<TModule extends Record<string, unknown>, TKey extends keyof TModule & string>(
  loader: () => Promise<TModule>,
  exportName: TKey,
) {
  return lazy(async () => {
    const module = await loader();
    return {
      default: module[exportName] as ComponentType<any>
    };
  });
}

const RootLandingPage = lazyPage(() => import("@/features/public/RootLandingPage"), "RootLandingPage");
const RegisterPage = lazyPage(() => import("@/features/public/RegisterPage"), "RegisterPage");
const DashboardPage = lazyPage(() => import("@/features/superadmin/DashboardPage"), "DashboardPage");
const SystemHealthPage = lazyPage(() => import("@/features/superadmin/SystemHealthPage"), "SystemHealthPage");
const TenantsPage = lazyPage(() => import("@/features/superadmin/TenantsPage"), "TenantsPage");
const SubscriptionsPage = lazyPage(() => import("@/features/superadmin/SubscriptionsPage"), "SubscriptionsPage");
const ModulesPage = lazyPage(() => import("@/features/superadmin/ModulesPage"), "ModulesPage");
const TenantLandingPage = lazyPage(() => import("@/features/tenant/TenantLandingPage"), "TenantLandingPage");
const SmsDashboardPage = lazyPage(() => import("@/features/tenant/sms/SmsDashboardPage"), "SmsDashboardPage");
const SmsCustomersPage = lazyPage(() => import("@/features/tenant/sms/SmsCustomersPage"), "SmsCustomersPage");
const SmsServiceRequestsPage = lazyPage(() => import("@/features/tenant/sms/SmsServiceRequestsPage"), "SmsServiceRequestsPage");
const SmsDispatchPage = lazyPage(() => import("@/features/tenant/sms/SmsDispatchPage"), "SmsDispatchPage");
const SmsReportsPage = lazyPage(() => import("@/features/tenant/sms/SmsReportsPage"), "SmsReportsPage");
const SmsUsersPage = lazyPage(() => import("@/features/tenant/sms/SmsUsersPage"), "SmsUsersPage");
const MlsDashboardPage = lazyPage(() => import("@/features/tenant/mls/MlsDashboardPage"), "MlsDashboardPage");
const ForbiddenPage = lazyPage(() => import("@/features/system/ForbiddenPage"), "ForbiddenPage");
const ErrorPage = lazyPage(() => import("@/features/system/ErrorPage"), "ErrorPage");
const NotFoundPage = lazyPage(() => import("@/features/system/NotFoundPage"), "NotFoundPage");

const routes = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootLandingPage /> },
      { path: "register", element: <RegisterPage /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "system-health", element: <SystemHealthPage /> },
      { path: "tenants", element: <TenantsPage /> },
      { path: "subscriptions", element: <SubscriptionsPage /> },
      { path: "modules", element: <ModulesPage /> },
      { path: "forbidden", element: <ForbiddenPage /> },
      { path: "error", element: <ErrorPage /> },
      { path: "not-found", element: <NotFoundPage /> },
      { path: "t/:tenantDomainSlug", element: <TenantRootRedirect /> },
      { path: "t/:tenantDomainSlug/sms", element: <TenantLandingPage system="sms" /> },
      { path: "t/:tenantDomainSlug/sms/dashboard", element: <SmsDashboardPage /> },
      { path: "t/:tenantDomainSlug/sms/customers", element: <SmsCustomersPage /> },
      { path: "t/:tenantDomainSlug/sms/service-requests", element: <SmsServiceRequestsPage /> },
      { path: "t/:tenantDomainSlug/sms/dispatch", element: <SmsDispatchPage /> },
      { path: "t/:tenantDomainSlug/sms/reports", element: <SmsReportsPage /> },
      { path: "t/:tenantDomainSlug/sms/users", element: <SmsUsersPage /> },
      { path: "t/:tenantDomainSlug/mls", element: <TenantLandingPage system="mls" /> },
      { path: "t/:tenantDomainSlug/mls/dashboard", element: <MlsDashboardPage /> },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
];

function TenantRootRedirect() {
  const { tenantDomainSlug = "" } = useParams();
  return <Navigate to={`/t/${tenantDomainSlug}/sms/`} replace />;
}

export const router = isDesktopShell()
  ? createHashRouter(routes)
  : createBrowserRouter(routes);
