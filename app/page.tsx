import { ProtectedRoute } from "@/components/auth/protected-route"
import { Dashboard } from "@/components/dashboard/dashboard"

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
