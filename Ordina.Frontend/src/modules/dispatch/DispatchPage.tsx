import React, { useState } from 'react'
import { useDispatchQueue, useDispatchRoutes, useConfirmDelivery } from './hooks/useDispatch'
import { Truck, MapPin, CheckCircle, Package, Clock, Loader2 } from 'lucide-react'

export const DispatchPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'queue' | 'routes'>('queue')
  const { data: queue, isLoading: isQueueLoading } = useDispatchQueue()
  const { data: routes, isLoading: isRoutesLoading } = useDispatchRoutes()
  const confirmDeliveryMutation = useConfirmDelivery()

  const handleConfirm = async (routeId: string, orderId: string) => {
    if (window.confirm('¿Desea confirmar la entrega de este pedido?')) {
      await confirmDeliveryMutation.mutateAsync({
        routeId,
        orderId
      })
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Despacho y Entregas</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Cola de pedidos listos para entrega y monitoreo de rutas de despacho activas.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-card)', padding: '4px', borderRadius: 'var(--radius-sm)' }}>
          <button
            className={`btn ${activeTab === 'queue' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setActiveTab('queue')}
          >
            Cola de Despacho ({queue?.length ?? 0})
          </button>
          <button
            className={`btn ${activeTab === 'routes' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '13px' }}
            onClick={() => setActiveTab('routes')}
          >
            Rutas Activas ({routes?.length ?? 0})
          </button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        isQueueLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cola de despacho...</div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>N° Pedido</th>
                  <th>Cliente</th>
                  <th>Zona / Destino</th>
                  <th>Dirección</th>
                  <th>Tipo Entrega</th>
                  <th style={{ textAlign: 'right' }}>Monto ($)</th>
                  <th>Estado Pago</th>
                </tr>
              </thead>
              <tbody>
                {queue && queue.length > 0 ? (
                  queue.map((item) => (
                    <tr key={item.orderId}>
                      <td>
                        <strong className="mono" style={{ color: 'var(--primary)' }}>
                          #{item.orderNumber}
                        </strong>
                      </td>
                      <td>{item.clientName}</td>
                      <td>
                        <span className="badge badge-info">{item.deliveryZone || 'Sin Zona'}</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                        {item.deliveryAddress || 'Retiro en tienda'}
                      </td>
                      <td>{item.deliveryType}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                        ${item.totalAmount.toFixed(2)}
                      </td>
                      <td>
                        <span className="badge badge-success">{item.paymentStatus}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No hay pedidos pendientes en la cola de despacho.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      ) : isRoutesLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando rutas de despacho...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {routes && routes.length > 0 ? (
            routes.map((route) => (
              <div key={route.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: '8px',
                        background: 'var(--info-muted)',
                        color: 'var(--info)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Truck size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                        Ruta {route.code} &bull; Chofer: {route.driverName}
                      </h3>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        Zona: {route.zone} | Placa: {route.vehiclePlate || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <span className="badge badge-info">{route.status}</span>
                </div>

                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Pedido</th>
                        <th>Cliente</th>
                        <th>Dirección</th>
                        <th>Estado de Entrega</th>
                        <th style={{ textAlign: 'right' }}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {route.items.map((it) => (
                        <tr key={it.orderId}>
                          <td className="mono">#{it.orderNumber}</td>
                          <td>{it.clientName}</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{it.address}</td>
                          <td>
                            {it.isDelivered ? (
                              <span className="badge badge-success">Entregado</span>
                            ) : (
                              <span className="badge badge-warning">En Ruta</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            {!it.isDelivered && (
                              <button
                                className="btn btn-primary"
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                                onClick={() => handleConfirm(route.id, it.orderId)}
                                disabled={confirmDeliveryMutation.isPending}
                              >
                                <CheckCircle size={14} />
                                <span>Confirmar Entrega</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No hay rutas programadas o activas actualmente.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
