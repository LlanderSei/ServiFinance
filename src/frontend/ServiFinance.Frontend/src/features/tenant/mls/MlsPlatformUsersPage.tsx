import { PlatformUsersPage } from "@/features/tenant/platform/PlatformUsersPage";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function MlsPlatformUsersPage() {
  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requireAnyRole={["Administrator", "Owner"]}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/dashboard"
    >
      <PlatformUsersPage entrySurface="mls" />
    </ProtectedRoute>
  );
}
