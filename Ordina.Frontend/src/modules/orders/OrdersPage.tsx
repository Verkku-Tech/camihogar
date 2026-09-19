import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useOrders } from './hooks/useOrders'
import { PlusCircle, Search, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

export const OrdersPage: React.FC = () => {
  const [pageNumber, setPageNumber] = useState(1)
  const [status, setStatus] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data, isLoading, error } = useOrders({
    pageNumber,
    pageSize: 20,
    status: status || undefined,
    searchTerm: searchTerm || undefined
  })

  const getStatusBadge = (orderStatus: string) => {
    switch (orderStatus?.toLowerCase()) {
      case 'completado':
      case 'entregado':
        return <span className="badge badge-success">{orderStatus}</span>
      case 'pendiente':
        return <span className="badge badge-warning">{orderStatus}</span>
      case 'cancelado':
        return <span className="badge badge-danger">{orderStatus}</span>
      default:
        return <span className="badge badge-info">{orderStatus}</span>
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Gestión de Pedidos</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Listado y administración de ventas, presupuestos y órdenes de entrega.
          </p>
        </div>
        <Link to="/orders/new" className="btn btn-primary">
          <PlusCircle size={16} />
          <span>Crear Pedido</span>
        </Link>
      </div>

      {/* Filter Bar */}
      <div
        className="card"
        style={{
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          marginBottom: '24px',
          padding: '16px 20px'
        }}
      >
        <div style={{ flex: 1, position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-dim)'
            }}
          />
          <input
            className="input"
            style={{ width: '100%', paddingLeft: '38px' }}
            type="text"
            placeholder="Buscar por cliente, número de pedido o vendedor..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPageNumber(1)
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Filter size={16} color="var(--text-dim)" />
          <select
            className="select"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPageNumber(1)
            }}
          >
            <option value="">Todos los Estados</option>
            <option value="Pendiente">Pendiente</option>
            <option value="Aprobado">Aprobado</option>
            <option value="En Fabricacion">En Fabricación</option>
            <option value="En Despacho">En Despacho</option>
            <option value="Completado">Completado</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando pedidos...
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Error al cargar pedidos. Verifique su conexión o datos en caché.
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>N° Pedido</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Total (USD)</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.items && data.items.length > 0 ? (
                  data.items.map((order) => (
                    <tr key={order.id}>
                      <td>
                        <strong className="mono" style={{ color: 'var(--text-main)' }}>
                          {order.orderNumber}
                        </strong>
                      </td>
                      <td>{order.clientName}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{order.vendorName}</td>
                      <td>
                        <span className="mono" style={{ fontWeight: 700 }}>
                          ${order.total.toFixed(2)}
                        </span>
                      </td>
                      <td>{getStatusBadge(order.status)}</td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '13px' }}>
                        {new Date(order.createdAt).toLocaleDateString('es-ES')}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <Link
                          to={`/orders/${order.id}`}
                          className="btn btn-secondary"
                          style={{ padding: '6px 10px', fontSize: '12px' }}
                        >
                          <Eye size={14} />
                          <span>Ver</span>
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No se encontraron pedidos con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Mostrando página {data.page} de {data.totalPages} ({data.totalCount} pedidos en total)
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-secondary"
                  disabled={!data.hasPreviousPage}
                  onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                  <span>Anterior</span>
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={!data.hasNextPage}
                  onClick={() => setPageNumber((p) => p + 1)}
                >
                  <span>Siguiente</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
