# Migración Abacco → CamiHogar

Extracción de datos desde **sys.abacco.com** (Dolibarr) a CSV estructurado, con vistas HTML para revisión antes de importar a MongoDB.

## Requisitos previos

1. **Python 3.10+**
2. **Google Chrome** instalado (Selenium lo usa automáticamente)
3. Acceso a `https://sys.abacco.com`
4. Credenciales configuradas en `scrapers/LoginSysAbacco.py`

### Instalación

Desde la carpeta `Migración/`:

```powershell
pip install -r requirements.txt
```

---

## Dónde ejecutar los scripts

Todos los scrapers se ejecutan desde la carpeta `scrapers/`:

```powershell
cd scrapers
```

---

## Scrapers disponibles

### 1. Clientes — `scrape_clientes.py`

Extrae el listado completo de clientes con **todas las columnas** del export de Abacco (~7.900 registros, con paginación automática).

```powershell
python scrape_clientes.py
```

| Salida | Ruta |
|--------|------|
| CSV | `data/clientes/clientes.csv` |
| Vista HTML | `data/clientes/vista.html` |
| Índice actualizado | `data/index.html` |

**Duración aproximada:** 2–3 minutos.

---

### 2. Pedidos — `scrape_pedidos.py`

Extrae cabeceras de pedidos y, por defecto, el detalle completo de líneas de producto.
**Solo incluye pedidos cuyo `Estado de fabricacion` NO sea `ENTREGADOS`.**

```powershell
# Extracción completa (~pedidos no ENTREGADOS + líneas)
python scrape_pedidos.py

# Prueba rápida: solo 5 pedidos (ya filtrados)
python scrape_pedidos.py --max 5

# Solo listado (sin abrir cada ficha; mucho más rápido, sin líneas)
python scrape_pedidos.py --solo-listado

# Carpeta de salida personalizada
python scrape_pedidos.py --salida "C:\ruta\pedidos"
```

| Opción | Descripción |
|--------|-------------|
| `--max N` | Limita a N pedidos válidos (útiles para pruebas) |
| `--solo-listado` | No entra en la ficha de cada pedido; no genera líneas de detalle |
| `--salida DIR` | Carpeta destino (por defecto: `data/pedidos/`) |

| Salida | Ruta |
|--------|------|
| CSV pedidos | `data/pedidos/pedidos.csv` |
| CSV líneas | `data/pedidos/pedidos_lineas.csv` |
| Vista pedidos | `data/pedidos/vista.html` |
| Vista líneas | `data/pedidos/vista_lineas.html` |
| Índice | `data/index.html` |

**Cabecera del pedido** incluye: Código, Tercero, fechas, Descuento, Condiciones de pago, Tipo entrega, Origen, Incoterm, Cuota de transporte, Base imponible, IVA, Importe total, Fabricante, Estado de fabricación, Estado, Facturado, etc.

**Líneas** incluyen: Descripción, IVA, P.U., Cantidad, Descuento, Total bruto.

**Duración aproximada:**
- Completo con líneas: varias horas (abre cada pedido uno a uno)
- `--solo-listado`: ~5–10 minutos
- `--max 5`: ~1–2 minutos (no recarga 5000 filas; usa el listado por defecto)

---

### 3. Usuarios — `scrape_users.py`

Extrae el listado de usuarios internos de Abacco.

```powershell
python scrape_users.py
```

| Salida | Ruta |
|--------|------|
| CSV | `data/usuarios/usuarios.csv` |
| Vista HTML | `data/usuarios/vista.html` |
| Índice | `data/index.html` |

**Duración aproximada:** 1–2 minutos.

---

### 4. Orquestador — `scrape_migracion.py`

Ejecuta clientes y/o pedidos en una sola corrida.

```powershell
# Clientes + pedidos (completo)
python scrape_migracion.py

# Solo clientes
python scrape_migracion.py --solo-clientes

# Solo pedidos
python scrape_migracion.py --solo-pedidos

# Pedidos de prueba (20) sin detalle de líneas
python scrape_migracion.py --solo-pedidos --max-pedidos 20 --solo-listado-pedidos
```

| Opción | Descripción |
|--------|-------------|
| `--solo-clientes` | Ejecuta solo el scraper de clientes |
| `--solo-pedidos` | Ejecuta solo el scraper de pedidos |
| `--max-pedidos N` | Limita la cantidad de pedidos |
| `--solo-listado-pedidos` | Pedidos sin abrir ficha individual |

---

## Vistas HTML (revisión de datos)

Al guardar cada CSV, se genera automáticamente su vista HTML (buscador, paginación y estadísticas).

**Punto de entrada principal:** abre en el navegador:

```
data/index.html
```

Desde ahí puedes navegar a las vistas de clientes, pedidos, líneas y usuarios.

### Regenerar vistas sin volver a scrapear

Si ya tienes los CSV y solo quieres actualizar el HTML:

```powershell
python generar_vista.py

# Solo una vista
python generar_vista.py --solo clientes
python generar_vista.py --solo pedidos
python generar_vista.py --solo pedidos_lineas
python generar_vista.py --solo usuarios
```

---

## Estructura del proyecto

```
Migración/
├── README.md
├── requirements.txt
├── data/
│   ├── index.html              # Índice de todas las vistas
│   ├── clientes/
│   │   ├── clientes.csv
│   │   └── vista.html
│   ├── pedidos/
│   │   ├── pedidos.csv
│   │   ├── pedidos_lineas.csv
│   │   ├── vista.html
│   │   └── vista_lineas.html
│   └── usuarios/
│       ├── usuarios.csv
│       └── vista.html
└── scrapers/
    ├── LoginSysAbacco.py       # Login Selenium
    ├── scrape_utils.py         # Utilidades compartidas
    ├── scrape_clientes.py
    ├── scrape_pedidos.py
    ├── scrape_users.py
    ├── scrape_migracion.py     # Orquestador
    └── generar_vista.py        # Regenerar HTML desde CSV
```

---

## Notas importantes

- **Paginación:** Los listados con más de 5.000 registros (clientes, pedidos) se recorren automáticamente página por página con límite 5.000.
- **Chrome visible:** Selenium abre una ventana de Chrome durante la extracción; no la cierres manualmente.
- **Credenciales:** Si el login falla, revisa usuario y contraseña en `scrapers/LoginSysAbacco.py`.
- **Campos vacíos en clientes:** Es normal; indica que el dato no estaba registrado en Abacco.
- **Pedidos completos:** La extracción con líneas de detalle es lenta porque visita la ficha de cada pedido. Usa `--solo-listado` o `--max N` para pruebas.

---

## Orden recomendado para la migración

1. `python scrape_clientes.py` — validar en `data/index.html`
2. `python scrape_users.py` — validar usuarios
3. `python scrape_pedidos.py --max 20` — prueba de pedidos
4. `python scrape_pedidos.py` — extracción completa (cuando la prueba esté OK)
