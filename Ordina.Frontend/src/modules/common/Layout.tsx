import React, { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Truck,
  Users,
  Package,
  CircleDollarSign,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { syncManager } from '../../lib/sync-manager'
import { useLatestExchangeRate } from '../finance/hooks/useFinance'

export const Layout: React.FC = () => {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingCount, setPendingCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [conflictAlert, setConflictAlert] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  const { data: exchangeRate } = useLatestExchangeRate('Bs', 'USD')

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    const updateCounts = async () => {
      const p = await syncManager.getPendingCount()
      const c = await syncManager.getConflictedCount()
      setPendingCount(p)
      setConflictCount(c)
    }

    updateCounts()
    const unsubscribe = syncManager.subscribe(updateCounts)

    const handleConflict = (e: any) => {
      setConflictAlert(e.detail?.error || 'Conflicto de concurrencia detectado al sincronizar.')
    }
    window.addEventListener('sync:conflict', handleConflict)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('sync:conflict', handleConflict)
      unsubscribe()
    }
  }, [])

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await syncManager.drainOutbox()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="app-container">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="offline-banner" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100 }}>
          <WifiOff size={16} />
          <span>Modo Sin Conexión activo. Las mutaciones se guardarán localmente y se sincronizarán al reconectar.</span>
        </div>
      )}

      {/* Conflict Alert Banner */}
      {conflictAlert && (
        <div
          style={{
            position: 'fixed',
            top: !isOnline ? 38 : 0,
            left: 0,
            right: 0,
            zIndex: 99,
            background: 'var(--danger)',
            color: '#FFF',
            padding: '10px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} />
            <span>{conflictAlert}</span>
          </div>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={() => setConflictAlert(null)}
          >
            Entendido
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className="sidebar" style={{ marginTop: !isOnline || conflictAlert ? 40 : 0 }}>
        <div style={{ padding: '24px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #1CB569 0%, #10663B 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '18px',
              color: '#0A0D10'
            }}
          >
            C
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '16px', letterSpacing: '0.05em' }}>ORDINA</div>
            <div style={{ fontSize: '11px', color: 'var(--primary)', fontWeight: 600, letterSpacing: '0.1em' }}>CAMIHOGAR</div>
          </div>
        </div>

        <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
          <NavLink
            to="/"
            end
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <LayoutDashboard size={18} />
            <span>Panel General</span>
          </NavLink>

          <NavLink
            to="/orders"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <ShoppingCart size={18} />
            <span>Pedidos y Ventas</span>
          </NavLink>

          <NavLink
            to="/manufacturing"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <Factory size={18} />
            <span>Manufactura (Kanban)</span>
          </NavLink>

          <NavLink
            to="/dispatch"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <Truck size={18} />
            <span>Despacho y Rutas</span>
          </NavLink>

          <NavLink
            to="/clients"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <Users size={18} />
            <span>Clientes</span>
          </NavLink>

          <NavLink
            to="/products"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <Package size={18} />
            <span>Catálogo y Stock</span>
          </NavLink>

          <NavLink
            to="/finance"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontWeight: 600,
              color: isActive ? 'var(--text-main)' : 'var(--text-muted)',
              background: isActive ? 'var(--primary-muted)' : 'transparent',
              borderLeft: isActive ? '3px solid var(--primary)' : '3px solid transparent',
              textDecoration: 'none',
              transition: 'all 0.15s'
            })}
          >
            <CircleDollarSign size={18} />
            <span>Finanzas y Tasas</span>
          </NavLink>
        </nav>

        {/* User profile & Logout */}
        <div style={{ padding: '16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{user?.name || user?.username}</div>
            <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{user?.role}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Cerrar Sesión"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px'
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-content" style={{ marginTop: !isOnline || conflictAlert ? 40 : 0 }}>
        <header className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {exchangeRate && (
              <div
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '6px 12px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>Tasa BCV:</span>
                <strong className="mono" style={{ color: 'var(--primary)' }}>
                  1 USD = {exchangeRate.rate.toFixed(2)} Bs
                </strong>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Sync Manager Status Indicator */}
            {pendingCount > 0 && (
              <button
                className="btn btn-secondary"
                style={{ fontSize: '12px', padding: '6px 12px' }}
                onClick={handleManualSync}
                disabled={isSyncing || !isOnline}
              >
                <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
                <span>{pendingCount} pendientes</span>
              </button>
            )}

            {conflictCount > 0 && (
              <span className="badge badge-danger">
                <AlertTriangle size={12} />
                {conflictCount} conflictos
              </span>
            )}

            {/* Online Indicator */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 600,
                color: isOnline ? 'var(--primary)' : 'var(--warning)'
              }}
            >
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
            </div>
          </div>
        </header>

        <main className="page-body">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
