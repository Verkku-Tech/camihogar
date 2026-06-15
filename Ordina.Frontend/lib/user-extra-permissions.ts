export const DISPATCH_SEND_TO_ROUTE = "dispatch.send_to_route";

export interface AssignableUserPermission {
  id: string;
  label: string;
}

export const ASSIGNABLE_USER_PERMISSIONS: AssignableUserPermission[] = [
  { id: DISPATCH_SEND_TO_ROUTE, label: "Pasar pedido a ruta" },
];

export function getAssignablePermissionLabel(permissionId: string): string {
  return (
    ASSIGNABLE_USER_PERMISSIONS.find((p) => p.id === permissionId)?.label ??
    permissionId
  );
}
