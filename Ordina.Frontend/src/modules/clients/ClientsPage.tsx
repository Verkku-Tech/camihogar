import React, { useState, useRef } from 'react'
import { useClients, useCreateClient, useImportClientsCsv, Client } from './hooks/useClients'
import { Search, Plus, Upload, Download, Users, CheckCircle, Loader2 } from 'lucide-react'
import Papa from 'papaparse'

export const ClientsPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('')
  const [pageNumber, setPageNumber] = useState(1)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useClients({
    pageNumber,
    pageSize: 20,
    searchTerm: searchTerm || undefined
  })

  const importCsvMutation = useImportClientsCsv()

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const result = await importCsvMutation.mutateAsync(file)
      alert(`Importación completada: ${result.totalInserted} insertados, ${result.totalUpdated} actualizados.`)
    } catch (err: any) {
      alert(err.message || 'Error al importar archivo CSV.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) {
      alert('No hay clientes para exportar.')
      return
    }

    const csvData = data.items.map((c) => ({
      ID: c.id,
      Nombre: c.name,
      RUT_Cedula: c.rutId,
      Telefono: c.phone || '',
      Email: c.email || '',
      Direccion: c.address || '',
      TotalPedidos: c.totalOrdersCount,
      TotalGastadoUSD: c.totalSpentUsd
    }))

    const csv = Papa.unparse(csvData)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `clientes_camihogar_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '4px' }}>Directorio de Clientes</h1>
          <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
            Base de datos de clientes, historial comercial e importación masiva de CSV.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            disabled={importCsvMutation.isPending}
          >
            {importCsvMutation.isPending ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <Upload size={16} />
            )}
            <span>Importar CSV</span>
          </button>

          <button className="btn btn-secondary" onClick={handleExportCsv}>
            <Download size={16} />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
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
            placeholder="Buscar por nombre, cédula o RIF..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setPageNumber(1)
            }}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: '60px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando clientes...</div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>RUT / Cédula</th>
                <th>Teléfono</th>
                <th>Correo</th>
                <th>Ubicación</th>
                <th style={{ textAlign: 'right' }}>Pedidos</th>
                <th style={{ textAlign: 'right' }}>Total Consumido</th>
              </tr>
            </thead>
            <tbody>
              {data?.items && data.items.length > 0 ? (
                data.items.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <strong>{client.name}</strong>
                    </td>
                    <td className="mono" style={{ color: 'var(--primary)' }}>
                      {client.rutId}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{client.phone || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{client.email || '—'}</td>
                    <td>{client.city || client.address || '—'}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{client.totalOrdersCount}</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>
                      ${client.totalSpentUsd.toFixed(2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No se encontraron clientes registrados.
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
