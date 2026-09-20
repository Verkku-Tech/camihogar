"use client";

import { useState } from "react";
import { Sidebar } from "@/components/dashboard/sidebar";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { CommissionsPage } from "@/components/configuracion/commissions-page";
import { AppBreadcrumb } from "@/components/ui/app-breadcrumb"


export default function ComisionesPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AppBreadcrumb />

<CommissionsPage />
        </main>
      </div>
    </div>
  );
}

