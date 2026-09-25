# Dashboard Analitico + Pagina Home — Spec de Diseno
Fecha: 2026-09-19
Rama: feat/modular-monolith-refactor (worktree)
Alcance: Solo roles Administrador y Super Administrador para la vista analitica.

## Resumen
- / -> Home (KPI cards + tablas operativas, lo de hoy)
- /dashboard -> Analitica (graficos, proyecciones, rankings)

## Nuevos Endpoints Backend
1. GET /api/reports/dashboard/trend?days=30
2. GET /api/reports/dashboard/by-sale-type?period=X
3. GET /api/reports/dashboard/top-sellers?period=X&limit=10
4. GET /api/reports/dashboard/top-products?period=X&limit=10
5. GET /api/reports/dashboard/pipeline
6. GET /api/reports/dashboard/expired-layaways-by-age

## Graficos (Recharts 2.15.4 - ya instalado)
- AreaChart: tendencia 30 dias + proyeccion fin de mes
- BarChart: facturado vs cobrado por semana
- PieChart: distribucion tipo de venta
- BarChart horizontal: pipeline fabricacion->despacho
- BarChart horizontal: top vendedores
- BarChart: SA vencidos por antiguedad
- Tabla: top productos

## Sidebar
- Home (icono Home, /, todos los roles)
- Dashboard (icono BarChart2, /dashboard, solo Admin/SuperAdmin)
