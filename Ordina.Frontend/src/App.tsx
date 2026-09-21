import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIdbPersister } from './lib/persister'
import { syncManager } from './lib/sync-manager'
import { AuthProvider, useAuth } from './contexts/auth-context'
import { CurrencyProvider } from './contexts/currency-context'
import { NavigationProvider } from './contexts/navigation-context'
import { ThemeProvider } from './components/theme-provider'
import { Toaster } from './components/ui/sonner'
import { ImpersonationBanner } from './components/auth/impersonation-banner'
import { InstallPrompt } from './components/pwa/install-prompt'

// Extracted Real Business Pages
import HomePage from './app/page'
import DashboardAnalyticsPage from './app/dashboard/page'
import LoginPage from './app/login/page'
import PedidosPage from './app/pedidos/page'
import PedidoDetailPage from './app/pedidos/[orderNumber]/page'
import ReservasPage from './app/pedidos/reservas/page'
import DespachosPage from './app/pedidos/despachos/page'
import PresupuestosPage from './app/presupuestos/page'
import PresupuestoDetailPage from './app/presupuestos/[budgetNumber]/page'
import ProductosPage from './app/inventario/productos/page'
import CategoriasPage from './app/inventario/categorias/page'
import FabricacionPage from './app/pedidos/fabricacion/page'
import FabricacionDetailPage from './app/pedidos/fabricacion/[orderNumber]/page'
import ClientesPage from './app/clientes/page'
import ProveedoresPage from './app/proveedores/page'
import TiendasPage from './app/tiendas/page'
import CuentasPage from './app/cuentas/page'
import ReportesPage from './app/reportes/page'
import ReporteComisionesPage from './app/reportes/comisiones/page'
import ReporteDespachoPage from './app/reportes/despacho/page'
import ReporteFabricacionPage from './app/reportes/fabricacion/page'
import ReportePagosPage from './app/reportes/pagos/page'
import UsuariosConfigPage from './app/configuracion/usuarios/page'
import RolesConfigPage from './app/configuracion/roles/page'
import TasasConfigPage from './app/configuracion/tasas/page'
import ComisionesConfigPage from './app/configuracion/comisiones/page'
import PinAccesoConfigPage from './app/configuracion/pin-acceso/page'
import NavegacionConfigPage from './app/configuracion/navegacion/page'
import SistemaConfigPage from './app/configuracion/sistema/page'
import AbbacoPage from './app/abbaco/page'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours offline cache
      staleTime: 1000 * 60 * 5, // 5 minutes freshness
      retry: (failureCount, error: any) => {
        if (error?.statusCode >= 400 && error?.statusCode < 500) return false
        return failureCount < 2
      }
    }
  }
})

syncManager.setQueryClient(queryClient)
const persister = createIdbPersister()

function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}

export function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
        storageKey="camihogar-theme"
      >
        <CurrencyProvider>
          <NavigationProvider>
            <AuthProvider>
              <BrowserRouter>
                <div className="flex flex-col h-full w-full overflow-hidden">
                  <ImpersonationBanner />
                  <div className="flex-1 min-h-0 min-w-0 overflow-hidden">
                    <Routes>
                      {/* Public routes */}
                      <Route path="/login" element={<LoginPage />} />

                      {/* Protected routes */}
                      <Route element={<RequireAuth />}>
                        {/* Home & Analytics Dashboard */}
                        <Route path="/" element={<HomePage />} />
                        <Route path="/dashboard" element={<DashboardAnalyticsPage />} />

                        {/* Orders / Pedidos */}
                        <Route path="/pedidos" element={<PedidosPage />} />
                        <Route path="/pedidos/reservas" element={<ReservasPage />} />
                        <Route path="/pedidos/fabricacion" element={<FabricacionPage />} />
                        <Route path="/pedidos/fabricacion/:orderNumber" element={<FabricacionDetailPage />} />
                        <Route path="/pedidos/despachos" element={<DespachosPage />} />
                        <Route path="/pedidos/:orderNumber" element={<PedidoDetailPage />} />
                        <Route path="/presupuestos" element={<PresupuestosPage />} />
                        <Route path="/presupuestos/:budgetNumber" element={<PresupuestoDetailPage />} />

                        {/* Inventory / Inventario */}
                        <Route path="/inventario/productos" element={<ProductosPage />} />
                        <Route path="/inventario/categorias" element={<CategoriasPage />} />

                        {/* Management */}
                        <Route path="/clientes" element={<ClientesPage />} />
                        <Route path="/proveedores" element={<ProveedoresPage />} />
                        <Route path="/tiendas" element={<TiendasPage />} />
                        <Route path="/cuentas" element={<CuentasPage />} />
                        <Route path="/abbaco" element={<AbbacoPage />} />

                        {/* Reports */}
                        <Route path="/reportes" element={<ReportesPage />} />
                        <Route path="/reportes/comisiones" element={<ReporteComisionesPage />} />
                        <Route path="/reportes/despacho" element={<ReporteDespachoPage />} />
                        <Route path="/reportes/fabricacion" element={<ReporteFabricacionPage />} />
                        <Route path="/reportes/pagos" element={<ReportePagosPage />} />

                        {/* Configuration */}
                        <Route path="/configuracion/usuarios" element={<UsuariosConfigPage />} />
                        <Route path="/configuracion/roles" element={<RolesConfigPage />} />
                        <Route path="/configuracion/tasas" element={<TasasConfigPage />} />
                        <Route path="/configuracion/comisiones" element={<ComisionesConfigPage />} />
                        <Route path="/configuracion/pin-acceso" element={<PinAccesoConfigPage />} />
                        <Route path="/configuracion/navegacion" element={<NavegacionConfigPage />} />
                        <Route path="/configuracion/sistema" element={<SistemaConfigPage />} />
                      </Route>

                      {/* Aliases for legacy or refactored paths */}
                      <Route path="/orders" element={<Navigate to="/pedidos" replace />} />
                      <Route path="/despachos" element={<Navigate to="/pedidos/despachos" replace />} />
                      <Route path="/reservas" element={<Navigate to="/pedidos/reservas" replace />} />
                      <Route path="/inventario/fabricacion" element={<Navigate to="/pedidos/fabricacion" replace />} />
                      <Route path="/inventario/fabricacion/:orderNumber" element={<Navigate to="/pedidos/fabricacion" replace />} />
                      <Route path="/fabricacion" element={<Navigate to="/pedidos/fabricacion" replace />} />
                      <Route path="/manufacturing" element={<Navigate to="/pedidos/fabricacion" replace />} />
                      <Route path="/productos" element={<Navigate to="/inventario/productos" replace />} />
                      <Route path="/products" element={<Navigate to="/inventario/productos" replace />} />
                      <Route path="/categorias" element={<Navigate to="/inventario/categorias" replace />} />
                      <Route path="/clients" element={<Navigate to="/clientes" replace />} />
                      <Route path="/providers" element={<Navigate to="/proveedores" replace />} />
                      <Route path="/stores" element={<Navigate to="/tiendas" replace />} />
                      <Route path="/accounts" element={<Navigate to="/cuentas" replace />} />
                      <Route path="/reports" element={<Navigate to="/reportes" replace />} />

                      {/* Fallback */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </div>
                </div>
              </BrowserRouter>
              <Toaster />
              <InstallPrompt />
            </AuthProvider>
          </NavigationProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}

export default App
