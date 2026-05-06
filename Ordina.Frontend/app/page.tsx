import { ProtectedRoute } from "@/components/auth/protected-route";
import { Dashboard } from "@/components/dashboard/dashboard";
import { useEffect } from "react";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  );
}
