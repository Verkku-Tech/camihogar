import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createIdbPersister } from './lib/persister'
import { syncManager } from './lib/sync-manager'
import { AuthProvider, useAuth } from './contexts/AuthContext'

import { Layout } from './modules/common/Layout'
import { LoginPage } from './modules/auth/LoginPage'
import { DashboardPage } from './modules/dashboard/DashboardPage'
import { OrdersPage } from './modules/orders/OrdersPage'
import { CreateOrderPage } from './modules/orders/CreateOrderPage'
import { OrderDetailPage } from './modules/orders/OrderDetailPage'
import { ManufacturingKanbanPage } from './modules/manufacturing/ManufacturingKanbanPage'
import { DispatchPage } from './modules/dispatch/DispatchPage'
import { ClientsPage } from './modules/clients/ClientsPage'
import { ProductsPage } from './modules/catalog/ProductsPage'
import { FinancePage } from './modules/finance/FinancePage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours offline cache
      staleTime: 1000 * 60 * 5,     // 5 minutes freshness
      retry: (failureCount, error: any) => {
        // Don't retry client errors (4xx)
        if (error?.statusCode >= 400 && error?.statusCode < 500) return false
        return failureCount < 2
      }
    }
  }
})

syncManager.setQueryClient(queryClient)
const persister = createIdbPersister()

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-canvas)',
          color: 'var(--text-muted)'
        }}
      >
        Inicializando sesión en Ordina ERP...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

export function App() {
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/new" element={<CreateOrderPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="manufacturing" element={<ManufacturingKanbanPage />} />
              <Route path="dispatch" element={<DispatchPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="finance" element={<FinancePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </PersistQueryClientProvider>
  )
}

export default App
