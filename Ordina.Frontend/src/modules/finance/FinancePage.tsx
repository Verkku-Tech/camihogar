import React, { useState } from 'react'
import { useLatestExchangeRate, useSetExchangeRate } from './hooks/useFinance'
import { CircleDollarSign, Check, RefreshCw, Calculator, ArrowRightLeft } from 'lucide-react'

export const FinancePage: React.FC = () => {
  const { data: currentRate, isLoading } = useLatestExchangeRate('Bs', 'USD')
  const setRateMutation = useSetExchangeRate()

  const [newRate, setNewRate] = useState('')
  const [successMsg, setSuccessMsg] = useState(false)

  // Calculator helper
  const [calcUsd, setCalcUsd] = useState('100')

  const handleUpdateRate = async (e: React.FormEvent) => {
    e.preventDefault()
    const rateVal = parseFloat(newRate)
    if (!rateVal || rateVal <= 0) return

    await setRateMutation.mutateAsync({
      fromCurrency: 'Bs',
      toCurrency: 'USD',
      rate: rateVal
    })

    setSuccessMsg(true)
    setNewRate('')
    setTimeout(() => setSuccessMsg(false), 3000)
  }

  const rate = currentRate?.rate || 1
  const usdVal = parseFloat(calcUsd) || 0
  const bsVal = (usdVal * rate).toFixed(2)

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Finanzas y Tesorería</h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
          Configuración de tasa cambiaria oficial y herramientas de conversión comercial.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Exchange Rate Management */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <CircleDollarSign size={22} color="var(--primary)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Tasa Oficial (BCV)</h2>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              border: '1px solid var(--border)',
              marginBottom: '20px'
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Tasa activa en el sistema:
            </div>
            <div className="mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--primary)' }}>
              1 USD = {isLoading ? '...' : (currentRate?.rate?.toFixed(2) ?? '—')} Bs
            </div>
            {currentRate?.effectiveDate && (
              <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                Última actualización: {new Date(currentRate.effectiveDate).toLocaleString('es-ES')}
              </div>
            )}
          </div>

          <form onSubmit={handleUpdateRate}>
            <div className="form-group">
              <label className="form-label">Establecer Nueva Tasa (Bs por USD)</label>
              <input
                className="input mono"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="ej. 78.50"
                value={newRate}
                onChange={(e) => setNewRate(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%' }}
              disabled={setRateMutation.isPending}
            >
              {setRateMutation.isPending ? 'Actualizando...' : 'Guardar Nueva Tasa'}
            </button>
          </form>

          {successMsg && (
            <div
              style={{
                marginTop: '12px',
                color: 'var(--primary)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Check size={16} />
              <span>Tasa actualizada correctamente en toda la plataforma.</span>
            </div>
          )}
        </div>

        {/* Quick Converter Calculator */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <Calculator size={22} color="var(--info)" />
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>Calculadora de Conversión</h2>
          </div>

          <div className="form-group">
            <label className="form-label">Monto en Dólares (USD)</label>
            <input
              className="input mono"
              type="number"
              value={calcUsd}
              onChange={(e) => setCalcUsd(e.target.value)}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '12px 0',
              color: 'var(--text-dim)'
            }}
          >
            <ArrowRightLeft size={20} />
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-sm)',
              padding: '16px',
              border: '1px solid var(--border)'
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
              Equivalente en Bolívares (Bs):
            </div>
            <div className="mono" style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-main)' }}>
              Bs. {bsVal}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
