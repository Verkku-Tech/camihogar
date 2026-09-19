import React, { useState } from 'react'
import { useProducts, useCategories } from './hooks/useCatalog'
import { Search, Package, AlertCircle } from 'lucide-react'

export const ProductsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [pageNumber, setPageNumber] = useState(1)

  const { data, isLoading } = useProducts({
    pageNumber,
    pageSize: 25,
    searchTerm: searchTerm || undefined
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Catálogo de Productos</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Inventario, precios de venta y control de existencias.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px', padding: '14px 20px' }}>
        <div style={{ position: 'relative' }}>
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
            placeholder="Buscar por SKU, modelo o descripción..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPageNumber(1)
            }}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando catálogo...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nombre del Producto</th>
                <th>Categoría</th>
                <th style={{ textAlign: 'right' }}>Precio (USD)</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {data?.items && data.items.length > 0 ? (
                data.items.map((prod) => (
                  <tr key={prod.id}>
                    <td className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                      {prod.sku}
                    </td>
                    <td>
                      <strong>{prod.name}</strong>
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{prod.category}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      ${prod.priceUsd.toFixed(2)}
                    </td>
                    <td className="mono" style={{ textAlign: 'center' }}>
                      <span
                        className="badge"
                        style={{
                          background: prod.stock > 0 ? 'var(--bg-elevated)' : 'var(--danger-muted)',
                          color: prod.stock > 0 ? 'var(--text-main)' : 'var(--danger)'
                        }}
                      >
                        {prod.stock} un.
                      </span>
                    </td>
                    <td>
                      {prod.isActive ? (
                        <span className="badge badge-success">Activo</span>
                      ) : (
                        <span className="badge badge-danger">Inactivo</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron productos registrados en el catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
