import { TenantMlsAuditsPage } from "@/features/administration/audits/AuditsPage";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function MlsAuditPage() {
  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requirePermission="mls.audits.view"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/dashboard"
    >
      <TenantMlsAuditsPage />
    </ProtectedRoute>
  );
}
