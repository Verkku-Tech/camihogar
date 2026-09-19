import React from 'react'
import { Link } from 'react-router-dom'
import {
  ShoppingCart,
  Clock,
  CheckCircle2,
  DollarSign,
  Users,
  Package,
  Factory,
  Truck,
  PlusCircle
} from 'lucide-react'
import { useDashboardMetrics } from './hooks/useDashboard'

export const DashboardPage: React.FC = () => {
  const { data: metrics, isLoading, error } = useDashboardMetrics()

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Panel Principal</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Resumen operativo y métricas clave de Camihogar en tiempo real.
          </p>
        </div>
        <Link to="/orders/new" className="btn btn-primary">
          <PlusCircle size={16} />
          <span>Nuevo Pedido</span>
        </Link>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando indicadores operativos...
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '20px' }}>
          No fue posible cargar las métricas en tiempo real. Mostrando datos locales o caché.
        </div>
      ) : (
        <>
          {/* Top Metrics Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '20px',
              marginBottom: '32px'
            }}
          >
            <div className="card card-stat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Ventas Totales</span>
                <DollarSign size={20} color="var(--primary)" />
              </div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                ${(metrics?.totalSalesUsd ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Ingresos facturados</span>
            </div>

            <div className="card card-stat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Pedidos Activos</span>
                <Clock size={20} color="var(--warning)" />
              </div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>
                {metrics?.pendingOrders ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>En gestión / pendientes</span>
            </div>

            <div className="card card-stat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Pedidos Completados</span>
                <CheckCircle2 size={20} color="var(--info)" />
              </div>
              <div className="stat-value">
                {metrics?.completedOrders ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>De {metrics?.totalOrders ?? 0} totales</span>
            </div>

            <div className="card card-stat">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Stock de Productos</span>
                <Package size={20} color="var(--text-muted)" />
              </div>
              <div className="stat-value">
                {metrics?.totalProductsInStock ?? 0}
              </div>
              <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Unidades disponibles</span>
            </div>
          </div>

          {/* Operational Status Queues */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Factory size={20} color="#8B5CF6" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Manufactura en Curso</h3>
                </div>
                <Link to="/manufacturing" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
                  Ver Kanban &rarr;
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span className="stat-value" style={{ fontSize: '36px', color: '#8B5CF6' }}>
                  {metrics?.manufacturingPendingCount ?? 0}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  piezas en líneas de corte, costura o tapicería
                </span>
              </div>
            </div>

            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Truck size={20} color="var(--info)" />
                  <h3 style={{ fontSize: '16px', fontWeight: 700 }}>Pendientes por Despacho</h3>
                </div>
                <Link to="/dispatch" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none' }}>
                  Ver Rutas &rarr;
                </Link>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px' }}>
                <span className="stat-value" style={{ fontSize: '36px', color: 'var(--info)' }}>
                  {metrics?.dispatchPendingCount ?? 0}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
                  órdenes listas para programar entrega
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
