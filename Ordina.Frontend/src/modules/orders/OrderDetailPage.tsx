import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useOrder, useUpdateOrder } from './hooks/useOrders'
import { ArrowLeft, Check, AlertTriangle, Loader2 } from 'lucide-react'

export const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const { data: order, isLoading, error } = useOrder(id || '')
  const updateOrderMutation = useUpdateOrder()

  const [observations, setObservations] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  if (isLoading) {
    return <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando pedido...</div>
  }

  if (error || !order) {
    return (
      <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)', padding: '24px' }}>
        No se encontró el pedido o hubo un problema al cargar los datos.
      </div>
    )
  }

  const currentObservations = observations !== null ? observations : (order.observations || '')
  const currentStatus = selectedStatus !== null ? selectedStatus : order.status

  const handleSaveChanges = async () => {
    setFeedbackMessage(null)
    try {
      await updateOrderMutation.mutateAsync({
        id: order.id,
        dto: {
          status: currentStatus,
          observations: currentObservations
        },
        expectedUpdatedAt: order.updatedAt
      })
      setFeedbackMessage('¡Pedido actualizado con éxito!')
      setTimeout(() => setFeedbackMessage(null), 4000)
    } catch (err: any) {
      alert(err.message || 'Error al actualizar el pedido.')
    }
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/orders" className="btn btn-secondary" style={{ padding: '8px' }}>
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Pedido #{order.orderNumber}</h1>
              <span className="badge badge-info">{order.status}</span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Registrado el {new Date(order.createdAt).toLocaleString('es-ES')} por {order.vendorName}
            </p>
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSaveChanges}
          disabled={updateOrderMutation.isPending}
        >
          {updateOrderMutation.isPending ? (
            <>
              <Loader2 size={16} className="spin" />
              <span>Guardando...</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>Guardar Cambios</span>
            </>
          )}
        </button>
      </div>

      {feedbackMessage && (
        <div
          style={{
            background: 'var(--primary-muted)',
            border: '1px solid rgba(28, 181, 105, 0.3)',
            color: 'var(--primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            marginBottom: '20px',
            fontSize: '14px',
            fontWeight: 600
          }}
        >
          {feedbackMessage}
        </div>
      )}

      {/* Grid: Client details & Order status */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Información del Cliente</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '14px' }}>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Nombre: </span>
              <strong>{order.clientName}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Identificación: </span>
              <strong className="mono">{order.clientId}</strong>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)' }}>Dirección de Entrega: </span>
              <span>{order.deliveryAddress || 'Retiro en tienda'}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '12px' }}>Estado y Observaciones</h2>
          <div className="form-group">
            <label className="form-label">Estado de la Orden</label>
            <select
              className="select"
              value={currentStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Aprobado">Aprobado</option>
              <option value="En Fabricacion">En Fabricación</option>
              <option value="En Despacho">En Despacho</option>
              <option value="Completado">Completado</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Observaciones</label>
            <textarea
              className="textarea"
              rows={2}
              value={currentObservations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder="Notas internas..."
            />
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Productos del Pedido</h2>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Precio Unit.</th>
                <th>Cant.</th>
                <th style={{ textAlign: 'right' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.products.map((p, idx) => (
                <tr key={p.id || idx}>
                  <td>
                    <strong>{p.name}</strong>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.category}</td>
                  <td className="mono">${p.price.toFixed(2)}</td>
                  <td className="mono">{p.quantity}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                    ${p.total.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Subtotal:</td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>${order.subtotal.toFixed(2)}</td>
              </tr>
              {order.deliveryCost > 0 && (
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right', color: 'var(--text-muted)' }}>Flete / Despacho:</td>
                  <td className="mono" style={{ textAlign: 'right' }}>${order.deliveryCost.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} style={{ textAlign: 'right', fontSize: '16px', fontWeight: 800 }}>Total:</td>
                <td className="mono" style={{ textAlign: 'right', fontSize: '18px', fontWeight: 800, color: 'var(--primary)' }}>
                  ${order.total.toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
