"use client";

import { AccessPinPage } from "@/components/configuracion/access-pin-page";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";

function PinAccesoGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin =
    user?.role === "Super Administrator" || user?.role === "Administrator";
  if (!isAdmin) {
    return (
      <div className="p-6 text-muted-foreground">
        No tienes permiso para acceder a esta sección.
      </div>
    );
  }
  return <>{children}</>;
}

export default function PinAccesoConfigPage() {
  return (
    <ProtectedRoute>
      <PinAccesoGate>
        <AccessPinPage />
      </PinAccesoGate>
    </ProtectedRoute>
  );
}
