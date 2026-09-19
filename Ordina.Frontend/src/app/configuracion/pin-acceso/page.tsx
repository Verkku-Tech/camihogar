"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute>
      <div className="flex h-screen bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            <PinAccesoGate>
              <AccessPinPage />
            </PinAccesoGate>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
