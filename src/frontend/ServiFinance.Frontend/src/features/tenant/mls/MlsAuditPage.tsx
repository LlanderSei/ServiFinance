import { TenantMlsAuditsPage } from "@/features/administration/audits/AuditsPage";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";
import { MlsModuleCodes } from "@/shared/auth/permissions";

export function MlsAuditPage() {
  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.audits.view"
      requireModule={MlsModuleCodes.auditLogs}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/dashboard"
    >
      <TenantMlsAuditsPage />
    </ProtectedRoute>
  );
}
