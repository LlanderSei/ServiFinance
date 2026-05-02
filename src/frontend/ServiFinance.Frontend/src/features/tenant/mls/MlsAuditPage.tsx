import { TenantMlsAuditsPage } from "@/features/administration/audits/AuditsPage";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function MlsAuditPage() {
  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/"
    >
      <TenantMlsAuditsPage />
    </ProtectedRoute>
  );
}
