"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AccessPinPage } from "@/components/configuracion/access-pin-page";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { useAuth } from "@/contexts/auth-context";
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


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
      <div className="flex h-full bg-background">
        <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden p-4 lg:p-6">
            <AppBreadcrumb />

<PinAccesoGate>
              <AccessPinPage />
            </PinAccesoGate>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
