import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCreateOrder } from './hooks/useOrders'
import { useAuth } from '../../contexts/AuthContext'
import { ArrowLeft, Plus, Trash2, CheckCircle, Loader2 } from 'lucide-react'

interface ProductRow {
  id: string
  name: string
  category: string
  price: number
  quantity: number
  total: number
}

export const CreateOrderPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const createOrderMutation = useCreateOrder()

  const [clientName, setClientName] = useState('')
  const [clientId, setClientId] = useState('CLI-' + Math.floor(Math.random() * 10000))
  const [deliveryCost, setDeliveryCost] = useState<number>(0)
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [paymentType, setPaymentType] = useState('directo')
  const [paymentMethod, setPaymentMethod] = useState('Efectivo')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [hasDelivery, setHasDelivery] = useState(false)
  const [observations, setObservations] = useState('')

  const [products, setProducts] = useState<ProductRow[]>([
    {
      id: 'P-' + Date.now(),
      name: 'Cama Matrimonial King',
      category: 'Camas',
      price: 350,
      quantity: 1,
      total: 350
    }
  ])

  const addProductRow = () => {
    setProducts([
      ...products,
      {
        id: 'P-' + Date.now(),
        name: '',
        category: 'General',
        price: 0,
        quantity: 1,
        total: 0
      }
    ])
  }

  const removeProductRow = (index: number) => {
    setProducts(products.filter((_, i) => i !== index))
  }

  const updateProductRow = (index: number, field: keyof ProductRow, value: any) => {
    const updated = [...products]
    const current = { ...updated[index], [field]: value }

    if (field === 'price' || field === 'quantity') {
      current.total = (Number(current.price) || 0) * (Number(current.quantity) || 0)
    }

    updated[index] = current
    setProducts(updated)
  }

  const subtotal = products.reduce((acc, p) => acc + (p.total || 0), 0)
  const discountAmount = discountPercent > 0 ? (subtotal * discountPercent) / 100 : 0
  const grandTotal = Math.max(0, subtotal + (Number(deliveryCost) || 0) - discountAmount)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (products.length === 0) {
      alert('Debe agregar al menos un producto al pedido.')
      return
    }

    const payload = {
      clientId,
      clientName: clientName.trim(),
      vendorId: user?.id || 'default-vendor',
      vendorName: user?.name || user?.username || 'Vendedor',
      products: products.map((p) => ({
        name: p.name,
        category: p.category,
        price: Number(p.price) || 0,
        quantity: Number(p.quantity) || 1,
        total: p.total,
        stock: 10
      })),
      deliveryCost: Number(deliveryCost) || 0,
      generalDiscountPercent: discountPercent > 0 ? Number(discountPercent) : null,
      paymentType,
      paymentMethod,
      deliveryAddress: hasDelivery ? deliveryAddress : null,
      hasDelivery,
      observations
    }

    try {
      await createOrderMutation.mutateAsync(payload)
      navigate('/orders')
    } catch (err: any) {
      alert(err.message || 'Error al crear el pedido.')
    }
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <Link to="/orders" className="btn btn-secondary" style={{ padding: '8px' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Nuevo Pedido</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Registre una nueva venta o presupuesto con cálculo dinámico y soporte offline.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client & Vendor details */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Datos del Cliente</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Nombre del Cliente *</label>
              <input
                className="input"
                type="text"
                placeholder="ej. María González"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Cédula / RIF / RUT *</label>
              <input
                className="input"
                type="text"
                placeholder="ej. V-18456789"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                required
              />
            </div>
          </div>
        </div>

        {/* Products Table */}
        <div className="card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700 }}>Líneas de Productos</h2>
            <button type="button" className="btn btn-secondary" onClick={addProductRow} style={{ padding: '6px 12px', fontSize: '12px' }}>
              <Plus size={14} />
              <span>Agregar Producto</span>
            </button>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th style={{ width: '140px' }}>Categoría</th>
                  <th style={{ width: '110px' }}>Precio ($)</th>
                  <th style={{ width: '80px' }}>Cant.</th>
                  <th style={{ width: '110px' }}>Total ($)</th>
                  <th style={{ width: '50px' }}></th>
                </tr>
              </thead>
              <tbody>
                {products.map((row, index) => (
                  <tr key={row.id}>
                    <td>
                      <input
                        className="input"
                        style={{ width: '100%' }}
                        type="text"
                        placeholder="Nombre o modelo..."
                        value={row.name}
                        onChange={(e) => updateProductRow(index, 'name', e.target.value)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="input"
                        style={{ width: '100%' }}
                        type="text"
                        value={row.category}
                        onChange={(e) => updateProductRow(index, 'category', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        className="input mono"
                        style={{ width: '100%' }}
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateProductRow(index, 'price', parseFloat(e.target.value) || 0)}
                        required
                      />
                    </td>
                    <td>
                      <input
                        className="input mono"
                        style={{ width: '100%' }}
                        type="number"
                        min="1"
                        value={row.quantity}
                        onChange={(e) => updateProductRow(index, 'quantity', parseInt(e.target.value) || 1)}
                        required
                      />
                    </td>
                    <td>
                      <strong className="mono">${row.total.toFixed(2)}</strong>
                    </td>
                    <td>
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProductRow(index)}
                          style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals, Discounts & Delivery */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
          <div className="card">
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Pago y Entrega</h2>
            <div className="form-group">
              <label className="form-label">Tipo de Pago</label>
              <select className="select" value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <option value="directo">Pago Completo (Directo)</option>
                <option value="abono">Abono Inicial</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Método de Pago</label>
              <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="Efectivo">Efectivo (USD)</option>
                <option value="Zelle">Zelle</option>
                <option value="Pagomovil">Pago Móvil (Bs)</option>
                <option value="Transferencia">Transferencia Bancaria</option>
              </select>
            </div>
            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={hasDelivery}
                  onChange={(e) => setHasDelivery(e.target.checked)}
                />
                <span>Requiere servicio de despacho / entrega a domicilio</span>
              </label>
            </div>
            {hasDelivery && (
              <div className="form-group" style={{ marginTop: '12px' }}>
                <label className="form-label">Dirección de Entrega</label>
                <textarea
                  className="textarea"
                  rows={2}
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="Calle, urbanización, punto de referencia..."
                />
              </div>
            )}
          </div>

          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Resumen del Total</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal:</span>
                <span className="mono" style={{ fontWeight: 600 }}>${subtotal.toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Descuento (%):</span>
                <input
                  className="input mono"
                  style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                  type="number"
                  min="0"
                  max="100"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(parseFloat(e.target.value) || 0)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>Costo de Entrega ($):</span>
                <input
                  className="input mono"
                  style={{ width: '80px', padding: '4px 8px', textAlign: 'right' }}
                  type="number"
                  min="0"
                  value={deliveryCost}
                  onChange={(e) => setDeliveryCost(parseFloat(e.target.value) || 0)}
                />
              </div>

              <hr style={{ borderColor: 'var(--border)', margin: '8px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '18px', fontWeight: 800 }}>Total Final:</span>
                <span className="mono" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--primary)' }}>
                  ${grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '24px' }}
              disabled={createOrderMutation.isPending}
            >
              {createOrderMutation.isPending ? (
                <>
                  <Loader2 size={18} className="spin" />
                  <span>Guardando Pedido...</span>
                </>
              ) : (
                <>
                  <CheckCircle size={18} />
                  <span>Guardar y Emitir Pedido</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
