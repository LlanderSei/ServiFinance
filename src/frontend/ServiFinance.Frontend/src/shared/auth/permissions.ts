import type { CurrentSessionUser } from "@/shared/api/contracts";

export function hasPermission(user: CurrentSessionUser | null | undefined, permissionKey: string) {
  if (!user) {
    return false;
  }

  if (user.permissionKeys?.includes(permissionKey)) {
    return true;
  }

  // Legacy fallback for sessions minted before permission keys were added.
  if (permissionKey.startsWith("root.")) {
    return user.roles.includes("SuperAdmin");
  }

  if (permissionKey.startsWith("sms.") || permissionKey.startsWith("mls.")) {
    return user.roles.includes("Owner") || user.roles.includes("Administrator");
  }

  return false;
}

export function hasAnyPermission(user: CurrentSessionUser | null | undefined, permissionKeys: string[]) {
  return permissionKeys.some(permissionKey => hasPermission(user, permissionKey));
}
