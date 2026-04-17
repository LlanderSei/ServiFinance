import { lazy } from "react";
import type { ComponentType } from "react";
import { Navigate } from "react-router-dom";
import { createBrowserRouter, createHashRouter, useParams } from "react-router-dom";
import { AppShell } from "./shell";
import { CustomerLayout } from "@/features/customer/CustomerLayout";
import { CustomerProtectedRoute } from "@/features/customer/CustomerProtectedRoute";
import { isDesktopShell } from "@/platform/runtime";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

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
const CustomerLoginPage = lazyPage(() => import("@/features/customer/CustomerLoginPage"), "CustomerLoginPage");
const CustomerRegisterPage = lazyPage(() => import("@/features/customer/CustomerRegisterPage"), "CustomerRegisterPage");
const CustomerDashboardPage = lazyPage(() => import("@/features/customer/CustomerDashboardPage"), "CustomerDashboardPage");
const CustomerRequestsPage = lazyPage(() => import("@/features/customer/CustomerRequestsPage"), "CustomerRequestsPage");
const CustomerInvoicesPage = lazyPage(() => import("@/features/customer/CustomerInvoicesPage"), "CustomerInvoicesPage");
const CustomerFeedbackPage = lazyPage(() => import("@/features/customer/CustomerFeedbackPage"), "CustomerFeedbackPage");
const MlsDesktopLoginPage = lazyPage(() => import("@/features/tenant/mls/MlsDesktopLoginPage"), "MlsDesktopLoginPage");
const SmsDashboardPage = lazyPage(() => import("@/features/tenant/sms/SmsDashboardPage"), "SmsDashboardPage");
const SmsCustomersPage = lazyPage(() => import("@/features/tenant/sms/SmsCustomersPage"), "SmsCustomersPage");
const SmsServiceRequestsPage = lazyPage(() => import("@/features/tenant/sms/SmsServiceRequestsPage"), "SmsServiceRequestsPage");
const SmsDispatchPage = lazyPage(() => import("@/features/tenant/sms/SmsDispatchPage"), "SmsDispatchPage");
const SmsReportsPage = lazyPage(() => import("@/features/tenant/sms/SmsReportsPage"), "SmsReportsPage");
const SmsUsersPage = lazyPage(() => import("@/features/tenant/sms/SmsUsersPage"), "SmsUsersPage");
const MlsDashboardPage = lazyPage(() => import("@/features/tenant/mls/MlsDashboardPage"), "MlsDashboardPage");
const MlsCustomerFinancePage = lazyPage(() => import("@/features/tenant/mls/MlsCustomerFinancePage"), "MlsCustomerFinancePage");
const MlsLoanConversionPage = lazyPage(() => import("@/features/tenant/mls/MlsLoanConversionPage"), "MlsLoanConversionPage");
const MlsStandaloneLoanPage = lazyPage(() => import("@/features/tenant/mls/MlsStandaloneLoanPage"), "MlsStandaloneLoanPage");
const MlsLoanAccountsPage = lazyPage(() => import("@/features/tenant/mls/MlsLoanAccountsPage"), "MlsLoanAccountsPage");
const MlsCollectionsPage = lazyPage(() => import("@/features/tenant/mls/MlsCollectionsPage"), "MlsCollectionsPage");
const MlsAuditPage = lazyPage(() => import("@/features/tenant/mls/MlsAuditPage"), "MlsAuditPage");
const MlsReportsPage = lazyPage(() => import("@/features/tenant/mls/MlsReportsPage"), "MlsReportsPage");
const MlsLedgerPage = lazyPage(() => import("@/features/tenant/mls/MlsLedgerPage"), "MlsLedgerPage");
const DesktopRequiredPage = lazyPage(() => import("@/features/system/DesktopRequiredPage"), "DesktopRequiredPage");
const ForbiddenPage = lazyPage(() => import("@/features/system/ForbiddenPage"), "ForbiddenPage");
const ErrorPage = lazyPage(() => import("@/features/system/ErrorPage"), "ErrorPage");
const NotFoundPage = lazyPage(() => import("@/features/system/NotFoundPage"), "NotFoundPage");

const browserRoutes = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <RootLandingPage /> },
      { path: "register", element: <RegisterPage /> },
      {
        element: <SuperadminProtectedLayout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "system-health", element: <SystemHealthPage /> },
          { path: "tenants", element: <TenantsPage /> },
          { path: "subscriptions", element: <SubscriptionsPage /> },
          { path: "modules", element: <ModulesPage /> }
        ]
      },
      { path: "desktop-required", element: <DesktopRequiredPage /> },
      { path: "forbidden", element: <ForbiddenPage /> },
      { path: "error", element: <ErrorPage /> },
      { path: "not-found", element: <NotFoundPage /> },
      { path: "t/mls", element: <Navigate to="/desktop-required" replace /> },
      { path: "t/mls/*", element: <Navigate to="/desktop-required" replace /> },
      {
        path: "t/:tenantDomainSlug",
        children: [
          { index: true, element: <TenantRootRedirect /> },
          { path: "sms", element: <TenantLandingPage system="sms" /> },
          {
            path: "c",
            element: <CustomerLayout />,
            children: [
              { index: true, element: <CustomerRootRedirect /> },
              { path: "login", element: <CustomerLoginPage /> },
              { path: "register", element: <CustomerRegisterPage /> },
              {
                element: <CustomerProtectedRoute />,
                children: [
                  { path: "dashboard", element: <CustomerDashboardPage /> },
                  { path: "requests", element: <CustomerRequestsPage /> },
                  { path: "invoices", element: <CustomerInvoicesPage /> },
                  { path: "feedback", element: <CustomerFeedbackPage /> }
                ]
              }
            ]
          },
          {
            element: <TenantSmsProtectedLayout />,
            children: [
              { path: "sms/dashboard", element: <SmsDashboardPage /> },
              { path: "sms/customers", element: <SmsCustomersPage /> },
              { path: "sms/service-requests", element: <SmsServiceRequestsPage /> },
              { path: "sms/dispatch", element: <SmsDispatchPage /> },
              { path: "sms/reports", element: <SmsReportsPage /> }
            ]
          },
          {
            element: <TenantSmsAdminProtectedLayout />,
            children: [
              { path: "sms/users", element: <SmsUsersPage /> }
            ]
          },
          { path: "mls", element: <Navigate to="/desktop-required" replace /> },
          { path: "mls/*", element: <Navigate to="/desktop-required" replace /> }
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
];

const desktopRoutes = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/t/mls/" replace /> },
      { path: "register", element: <RegisterPage /> },
      {
        element: <SuperadminProtectedLayout />,
        children: [
          { path: "dashboard", element: <DashboardPage /> },
          { path: "system-health", element: <SystemHealthPage /> },
          { path: "tenants", element: <TenantsPage /> },
          { path: "subscriptions", element: <SubscriptionsPage /> },
          { path: "modules", element: <ModulesPage /> }
        ]
      },
      { path: "desktop-required", element: <DesktopRequiredPage /> },
      { path: "forbidden", element: <ForbiddenPage /> },
      { path: "error", element: <ErrorPage /> },
      { path: "not-found", element: <NotFoundPage /> },
      { path: "t/mls", element: <MlsDesktopLoginPage /> },
      { path: "t/mls/dashboard", element: <MlsDashboardPage /> },
      { path: "t/mls/customers", element: <MlsCustomerFinancePage /> },
      { path: "t/mls/loan-conversion", element: <MlsLoanConversionPage /> },
      { path: "t/mls/standalone-loans", element: <MlsStandaloneLoanPage /> },
      { path: "t/mls/loans", element: <MlsLoanAccountsPage /> },
      { path: "t/mls/collections", element: <MlsCollectionsPage /> },
      { path: "t/mls/audit", element: <MlsAuditPage /> },
      { path: "t/mls/reports", element: <MlsReportsPage /> },
      { path: "t/mls/ledger", element: <MlsLedgerPage /> },
      {
        path: "t/:tenantDomainSlug",
        children: [
          { index: true, element: <TenantRootRedirect /> },
          { path: "sms", element: <TenantLandingPage system="sms" /> },
          {
            path: "c",
            element: <CustomerLayout />,
            children: [
              { index: true, element: <CustomerRootRedirect /> },
              { path: "login", element: <CustomerLoginPage /> },
              { path: "register", element: <CustomerRegisterPage /> },
              {
                element: <CustomerProtectedRoute />,
                children: [
                  { path: "dashboard", element: <CustomerDashboardPage /> },
                  { path: "requests", element: <CustomerRequestsPage /> },
                  { path: "invoices", element: <CustomerInvoicesPage /> },
                  { path: "feedback", element: <CustomerFeedbackPage /> }
                ]
              }
            ]
          },
          {
            element: <TenantSmsProtectedLayout />,
            children: [
              { path: "sms/dashboard", element: <SmsDashboardPage /> },
              { path: "sms/customers", element: <SmsCustomersPage /> },
              { path: "sms/service-requests", element: <SmsServiceRequestsPage /> },
              { path: "sms/dispatch", element: <SmsDispatchPage /> },
              { path: "sms/reports", element: <SmsReportsPage /> }
            ]
          },
          {
            element: <TenantSmsAdminProtectedLayout />,
            children: [
              { path: "sms/users", element: <SmsUsersPage /> }
            ]
          },
          { path: "mls", element: <Navigate to="/t/mls/" replace /> },
          { path: "mls/*", element: <LegacyMlsRouteRedirect /> }
        ]
      },
      { path: "*", element: <NotFoundPage /> }
    ]
  }
];

function SuperadminProtectedLayout() {
  return <ProtectedRoute requireRole="SuperAdmin" />;
}

function TenantSmsProtectedLayout() {
  const { tenantDomainSlug = "" } = useParams();
  return <ProtectedRoute tenantSlug={tenantDomainSlug} />;
}

function TenantSmsAdminProtectedLayout() {
  const { tenantDomainSlug = "" } = useParams();
  return <ProtectedRoute tenantSlug={tenantDomainSlug} requireRole="Administrator" />;
}

function TenantRootRedirect() {
  const { tenantDomainSlug = "" } = useParams();
  return <Navigate to={`/t/${tenantDomainSlug}/sms/`} replace />;
}

function CustomerRootRedirect() {
  const { tenantDomainSlug = "" } = useParams();
  return <Navigate to={`/t/${tenantDomainSlug}/c/login`} replace />;
}

function LegacyMlsRouteRedirect() {
  const { "*": legacyPath = "" } = useParams();
  const normalizedTarget = legacyPath ? `/t/mls/${legacyPath}` : "/t/mls/";
  return <Navigate to={normalizedTarget} replace />;
}

export const router = isDesktopShell()
  ? createHashRouter(desktopRoutes)
  : createBrowserRouter(browserRoutes);
