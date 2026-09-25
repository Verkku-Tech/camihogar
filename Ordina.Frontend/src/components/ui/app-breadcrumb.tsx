import React from "react"
import { useLocation, Link } from "react-router-dom"
import { cn } from "@/lib/utils"

const SEGMENT_NAMES: Record<string, string> = {
  configuracion: "Configuración",
  "pin-acceso": "PIN de Acceso",
  tasas: "Tasas de Cambio",
  usuarios: "Usuarios",
  roles: "Roles",
  sistema: "Sistema",
  notificaciones: "Notificaciones",
  navegacion: "Navegación",
  comisiones: "Comisiones",
  inventario: "Inventario",
  categorias: "Categorías",
  productos: "Productos",
  fabricacion: "Fabricación",
  pedidos: "Pedidos",
  reservas: "Reservas",
  despachos: "Despachos",
  reportes: "Reportes",
  pagos: "Pagos",
  despacho: "Despacho",
  clientes: "Clientes",
  proveedores: "Proveedores",
  tiendas: "Tiendas",
  almacenes: "Almacenes",
  existencias: "Existencias Inmediatas",
  transferencias: "Traspasos entre Sedes",
  cuentas: "Cuentas",
  presupuestos: "Presupuestos",
  abbaco: "Pedidos Abbaco",
  dashboard: "Dashboard",
}

function formatSegment(segment: string): string {
  if (segment.match(/^(ORD-|PRE-)/i) || !isNaN(Number(segment))) {
    return `Detalle (${segment})`
  }
  return SEGMENT_NAMES[segment.toLowerCase()] || (segment.charAt(0).toUpperCase() + segment.slice(1))
}

export function AppBreadcrumb({ className }: { className?: string }) {
  const { pathname } = useLocation()

  if (!pathname || pathname === "/login") {
    return null
  }

  const segments = pathname.split("/").filter(Boolean)

  // Home: "/"
  if (segments.length === 0) {
    return (
      <nav aria-label="breadcrumb" className={cn("flex items-center space-x-2 text-sm text-muted-foreground mb-6", className)}>
        <span className="font-medium text-foreground">Home</span>
      </nav>
    )
  }

  // Nivel superior sin padre (ej: /dashboard, /clientes, /proveedores, /tiendas, /cuentas, /reportes, /pedidos, /presupuestos, /abbaco)
  if (segments.length === 1) {
    return (
      <nav aria-label="breadcrumb" className={cn("flex items-center space-x-2 text-sm text-muted-foreground mb-6", className)}>
        <span className="font-medium text-foreground">{formatSegment(segments[0])}</span>
      </nav>
    )
  }

  // Rutas anidadas (> 1 nivel): "Padre / Hijo"
  return (
    <nav aria-label="breadcrumb" className={cn("flex items-center space-x-2 text-sm text-muted-foreground mb-6", className)}>
      {segments.map((segment, index) => {
        const isLast = index === segments.length - 1
        const href = "/" + segments.slice(0, index + 1).join("/")
        const formatted = formatSegment(segment)

        return (
          <React.Fragment key={href}>
            {index > 0 && <span>/</span>}
            {isLast ? (
              <span className="font-medium text-foreground">{formatted}</span>
            ) : (
              <Link to={href} className="hover:text-foreground transition-colors">
                {formatted}
              </Link>
            )}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
