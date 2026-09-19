import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Lock, User, AlertCircle, Loader2 } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const navigate = useNavigate()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(username, password)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Credenciales inválidas. Por favor verifique sus datos.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 30%, #1A212B 0%, #111418 100%)',
        padding: '20px'
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '420px',
          padding: '40px 32px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          borderColor: 'var(--border)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div
            style={{
              width: 54,
              height: 54,
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #1CB569 0%, #10663B 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              fontSize: '26px',
              color: '#0A0D10',
              marginBottom: '16px',
              boxShadow: '0 0 20px rgba(28, 181, 105, 0.4)'
            }}
          >
            C
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, letterSpacing: '0.02em', marginBottom: '6px' }}>
            ORDINA ERP
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Camihogar — Iniciar Sesión en la Plataforma
          </p>
        </div>

        {error && (
          <div
            style={{
              background: 'var(--danger-muted)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              color: 'var(--danger)',
              fontSize: '13px'
            }}
          >
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Usuario o Correo Electrónico
            </label>
            <div style={{ position: 'relative' }}>
              <User
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
                id="username"
                className="input"
                style={{ width: '100%', paddingLeft: '38px' }}
                type="text"
                placeholder="ej. admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '28px' }}>
            <label className="form-label" htmlFor="password">
              Contraseña
            </label>
            <div style={{ position: 'relative' }}>
              <Lock
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
                id="password"
                className="input"
                style={{ width: '100%', paddingLeft: '38px' }}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <span>Entrar al Sistema</span>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'var(--text-dim)' }}>
          Verkku Precision Atelier &bull; Camihogar Monolito Modular
        </div>
      </div>
    </div>
  )
}
