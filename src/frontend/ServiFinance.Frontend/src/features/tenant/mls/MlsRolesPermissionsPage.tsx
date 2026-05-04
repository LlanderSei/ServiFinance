import { TenantMlsRolesPermissionsPage } from "@/features/administration/roles-permissions/RolesPermissionsPage";
import { ProtectedRoute } from "@/shared/auth/ProtectedRoute";

export function MlsRolesPermissionsPage() {
  return (
    <ProtectedRoute
      requireSurface="TenantDesktop"
      requireAnyRole={["Administrator", "Owner"]}
      unauthenticatedRedirectTo="/t/mls/"
      unauthorizedRedirectTo="/t/mls/dashboard"
    >
      <TenantMlsRolesPermissionsPage />
    </ProtectedRoute>
  );
}
