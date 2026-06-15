"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { AssignableUserPermission } from "@/lib/user-extra-permissions";

interface AssignablePermissionsPickerProps {
  permissions: AssignableUserPermission[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

export function AssignablePermissionsPicker({
  permissions,
  selected,
  onChange,
  disabled = false,
}: AssignablePermissionsPickerProps) {
  const toggle = (permissionId: string, checked: boolean) => {
    if (checked) {
      onChange([...selected, permissionId]);
      return;
    }
    onChange(selected.filter((id) => id !== permissionId));
  };

  if (permissions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay permisos exclusivos disponibles.
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-md border p-3">
      {permissions.map((permission) => {
        const checked = selected.includes(permission.id);
        return (
          <div key={permission.id} className="flex items-start gap-3">
            <Checkbox
              id={`extra-perm-${permission.id}`}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) =>
                toggle(permission.id, value === true)
              }
            />
            <div className="space-y-1">
              <Label
                htmlFor={`extra-perm-${permission.id}`}
                className="font-medium leading-none"
              >
                {permission.label}
              </Label>
              <p className="text-xs text-muted-foreground">{permission.id}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
