import { ProtectedRoute } from "@/components/auth/protected-route";
import { Home } from "@/components/home/home";

export default function HomePage() {
  return (
    <ProtectedRoute>
      <Home />
    </ProtectedRoute>
  );
}
