import { ProtectedRoute } from "@/components/auth/protected-route"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"

export default function DashboardAnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsDashboard />
    </ProtectedRoute>
  )
}
