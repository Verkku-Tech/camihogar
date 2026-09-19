import React, { useState } from 'react'
import {
  useKanbanBoard,
  useUpdateManufacturingStage,
  useRefabricateProduct,
  WorkOrderItem
} from './hooks/useManufacturing'
import { ArrowRight, RotateCcw, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react'

const STAGES = [
  { key: 'corte', label: '1. Corte' },
  { key: 'costura', label: '2. Costura' },
  { key: 'tapiceria', label: '3. Tapicería' },
  { key: 'carpinteria', label: '4. Carpintería' },
  { key: 'pintura', label: '5. Pintura' },
  { key: 'controlCalidad', label: '6. Calidad' },
  { key: 'terminado', label: '7. Terminado' }
]

const NEXT_STAGE_MAP: Record<string, string> = {
  corte: 'costura',
  costura: 'tapiceria',
  tapiceria: 'carpinteria',
  carpinteria: 'pintura',
  pintura: 'controlCalidad',
  controlCalidad: 'terminado'
}

export const ManufacturingKanbanPage: React.FC = () => {
  const { data: board, isLoading, error } = useKanbanBoard()
  const updateStageMutation = useUpdateManufacturingStage()
  const refabricateMutation = useRefabricateProduct()

  const [refabricateModalItem, setRefabricateModalItem] = useState<WorkOrderItem | null>(null)
  const [refabricateReason, setRefabricateReason] = useState('')

  const handleAdvanceStage = async (item: WorkOrderItem, currentStageKey: string) => {
    const nextStage = NEXT_STAGE_MAP[currentStageKey]
    if (!nextStage) return

    await updateStageMutation.mutateAsync({
      orderId: item.orderId,
      productId: item.productId,
      stage: nextStage
    })
  }

  const handleRefabricateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!refabricateModalItem || !refabricateReason.trim()) return

    await refabricateMutation.mutateAsync({
      orderId: refabricateModalItem.orderId,
      productId: refabricateModalItem.productId,
      reason: refabricateReason.trim()
    })

    setRefabricateModalItem(null)
    setRefabricateReason('')
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Tablero Kanban de Manufactura</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Control de etapas de producción de muebles y gestión de refabricaciones.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando tablero kanban...
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          Error al cargar datos del tablero kanban.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, minmax(220px, 1fr))',
            gap: '14px',
            overflowX: 'auto',
            paddingBottom: '20px'
          }}
        >
          {STAGES.map((st) => {
            const items: WorkOrderItem[] = (board as any)?.[st.key] || []

            return (
              <div
                key={st.key}
                style={{
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: '600px'
                }}
              >
                {/* Stage Header */}
                <div
                  style={{
                    padding: '14px',
                    borderBottom: '1px solid var(--border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'var(--bg-card)',
                    borderTopLeftRadius: 'var(--radius-md)',
                    borderTopRightRadius: 'var(--radius-md)'
                  }}
                >
                  <span style={{ fontSize: '13px', fontWeight: 700 }}>{st.label}</span>
                  <span
                    className="badge"
                    style={{
                      background: items.length > 0 ? 'var(--primary-muted)' : 'var(--bg-elevated)',
                      color: items.length > 0 ? 'var(--primary)' : 'var(--text-dim)',
                      fontSize: '11px'
                    }}
                  >
                    {items.length}
                  </span>
                </div>

                {/* Cards list */}
                <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                  {items.map((item) => (
                    <div
                      key={`${item.orderId}-${item.productId}`}
                      className="card"
                      style={{
                        padding: '12px',
                        background: 'var(--bg-card)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <strong className="mono" style={{ fontSize: '12px', color: 'var(--primary)' }}>
                          #{item.orderNumber}
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                          Cant: {item.quantity}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                        {item.productName}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                        Cliente: {item.clientName}
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                          title="Reportar Refabricación"
                          onClick={() => setRefabricateModalItem(item)}
                        >
                          <RotateCcw size={12} />
                        </button>

                        {NEXT_STAGE_MAP[st.key] && (
                          <button
                            className="btn btn-primary"
                            style={{ padding: '4px 10px', fontSize: '11px', flex: 1 }}
                            onClick={() => handleAdvanceStage(item, st.key)}
                          >
                            <span>Avanzar</span>
                            <ArrowRight size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {items.length === 0 && (
                    <div
                      style={{
                        padding: '40px 10px',
                        textAlign: 'center',
                        color: 'var(--text-dim)',
                        fontSize: '12px'
                      }}
                    >
                      Sin piezas
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Refabrication Modal */}
      {refabricateModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '20px'
          }}
        >
          <div className="card" style={{ maxWidth: '480px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', color: 'var(--danger)' }}>
              <AlertTriangle size={22} />
              <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Registrar Refabricación</h2>
            </div>

            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              La pieza <strong>{refabricateModalItem.productName}</strong> del pedido{' '}
              <strong className="mono">#{refabricateModalItem.orderNumber}</strong> será reiniciada a la etapa de Corte.
            </p>

            <form onSubmit={handleRefabricateSubmit}>
              <div className="form-group">
                <label className="form-label">Motivo o Causa del Defecto *</label>
                <textarea
                  className="textarea"
                  rows={3}
                  placeholder="ej. Medidas de corte incorrectas, tela rota durante costura..."
                  value={refabricateReason}
                  onChange={(e) => setRefabricateReason(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRefabricateModalItem(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={refabricateMutation.isPending}
                >
                  {refabricateMutation.isPending ? 'Procesando...' : 'Confirmar Refabricación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
