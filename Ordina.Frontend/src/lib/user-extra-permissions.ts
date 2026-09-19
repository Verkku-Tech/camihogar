export const DISPATCH_SEND_TO_ROUTE = "dispatch.send_to_route";
export const DISPATCH_CONFIRM_DELIVERY = "dispatch.confirm_delivery";
export const MANUFACTURING_MANAGE = "manufacturing.manage";
export const INVENTORY_MOVEMENTS_VIEW = "inventory.movements.view";

export const DISPLAY_ROLE_SUPERVISOR = "Supervisor";
export const DISPLAY_ROLE_STORE_SELLER = "Vendedor de tienda";

export interface AssignableUserPermission {
  id: string;
  label: string;
}

export const ASSIGNABLE_USER_PERMISSIONS: AssignableUserPermission[] = [
  { id: DISPATCH_SEND_TO_ROUTE, label: "Pasar pedido a ruta" },
  { id: DISPATCH_CONFIRM_DELIVERY, label: "Confirmar entrega (Entregar)" },
  { id: MANUFACTURING_MANAGE, label: "Gestionar fabricación" },
];

/** Roles del formulario de usuarios que pueden recibir cada permiso exclusivo. */
const ASSIGNABLE_PERMISSION_DISPLAY_ROLES: Record<string, string[]> = {
  [DISPATCH_SEND_TO_ROUTE]: [DISPLAY_ROLE_STORE_SELLER],
  [DISPATCH_CONFIRM_DELIVERY]: [DISPLAY_ROLE_SUPERVISOR],
  [MANUFACTURING_MANAGE]: [DISPLAY_ROLE_STORE_SELLER],
};

export function canAccessManufacturing(
  hasPermission: (permission: string) => boolean,
): boolean {
  return (
    hasPermission(INVENTORY_MOVEMENTS_VIEW) ||
    hasPermission(MANUFACTURING_MANAGE)
  );
}

export function getAssignablePermissionsForDisplayRole(
  permissions: AssignableUserPermission[],
  displayRole: string,
): AssignableUserPermission[] {
  if (!displayRole.trim()) return [];
  return permissions.filter((p) =>
    (ASSIGNABLE_PERMISSION_DISPLAY_ROLES[p.id] ?? []).includes(displayRole),
  );
}

export function filterExtraPermissionsForDisplayRole(
  permissionIds: string[],
  displayRole: string,
): string[] {
  const allowedIds = new Set(
    Object.entries(ASSIGNABLE_PERMISSION_DISPLAY_ROLES)
      .filter(([, roles]) => roles.includes(displayRole))
      .map(([id]) => id),
  );
  return permissionIds.filter((id) => allowedIds.has(id));
}

export function getAssignablePermissionLabel(permissionId: string): string {
  return (
    ASSIGNABLE_USER_PERMISSIONS.find((p) => p.id === permissionId)?.label ??
    permissionId
  );
}
