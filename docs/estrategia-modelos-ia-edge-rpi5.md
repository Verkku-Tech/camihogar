# Estrategia y Arquitectura de Modelos de Inteligencia Artificial & Machine Learning en el Edge (Raspberry Pi 5)

Este documento define la estrategia, viabilidad técnica, arquitectura de ejecución y el impacto operativo de los modelos de Inteligencia Artificial (IA) y Machine Learning (ML) diseñados para ejecutarse en el servidor local de producción de **Camihogar / Ordina** (Raspberry Pi 5 con procesador ARM64).

---

## 1. Contexto de Infraestructura y Filosofía de Diseño

El servidor de producción de Camihogar cuenta con las siguientes especificaciones:
* **Hardware:** Raspberry Pi 5 (SoC Broadcom BCM2712, 4 núcleos ARM Cortex-A76 @ 2.4 GHz).
* **Memoria RAM:** 16 GB LPDDR4X-4267 (margen de memoria sumamente holgado para cargas de inferencia clásica).
* **Almacenamiento:** 64 GB (requiere modelos de huella reducida, típicamente < 100 MB).
* **Sistema Operativo:** Debian 12 (Bookworm) ARM64.
* **Runtime de Aplicación:** .NET 10 Web API compilado para `linux-arm64` (ReadyToRun).

### Principios Rectores:
1. **Cero Modelos de Lenguaje Masivos (No-LLM):** No se desplegarán modelos generativos pesados (LLMs) en el Raspberry Pi 5. Los LLMs saturarían el ancho de banda térmico del procesador, generarían latencias de segundos y consumirían gigabytes de RAM.
2. **Inferencia In-Process (.NET 10 Nativo):** Todos los modelos se ejecutan directamente dentro del proceso del backend utilizando `Microsoft.ML.OnnxRuntime` (aprovechando las extensiones vectoriales ARM NEON) o `Microsoft.ML` (ML.NET). Esto elimina la necesidad de microservicios de Python, sockets IPC o llamadas HTTP internas.
3. **Privacidad Absoluta y Cero Costo por Token:** Todo el procesamiento ocurre localmente dentro del contenedor de la aplicación. No se envían datos bancarios, nombres de clientes o montos a APIs de terceros (OpenAI, Google Cloud, AWS).
4. **Desacoplamiento entre Entrenamiento e Inferencia:** El Raspberry Pi 5 **únicamente realiza inferencia**. El reentrenamiento de modelos se realiza fuera de línea (en estaciones de trabajo de desarrollo o pipelines de CI/CD en GitHub Actions) y los artefactos finales compilados (`.onnx` o `.zip`) se versionan y despliegan en el servidor.

---

## 2. Los 7 Vectores de Inteligencia Aplicada

```
                                  [ Ordina.Api (.NET 10 / ARM64) ]
                                                │
         ┌───────────────────┬──────────────────┼──────────────────┬──────────────────┐
         ▼                   ▼                  ▼                  ▼                  ▼
   [ ONNX Runtime ]    [ ONNX Runtime ]    [ ONNX Runtime ]    [ ML.NET Core ]    [ ML.NET Core ]
    PP-OCRv4 Mobile     bge-small-es        bge-small-es        LightGBM Regr.     FastTree / EBM
   (OCR Comprobantes)  (Catálogo Semántico) (Reclamos/Obs.)    (Lead Time Taller) (Scoring Cobranza)
```

---

### Vector 1: Priorización Dinámica de Órdenes de Fabricación y Despacho

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Los supervisores de taller y despachadores revisan manualmente listas de decenas de pedidos. Deciden el orden de fabricación y rutas de entrega de manera subjetiva, provocando retrasos en pedidos urgentes y rutas de transporte desordenadas (ej. ir a un mismo municipio en días consecutivos).
* **Impacto Operativo:**
  * **Cola de Fabricación Optimizada:** Calcula un índice de urgencia y complejidad que ordena la lista de corte y confección en cada taller asociado.
  * **Agrupación Geográfica de Despacho (Clustering):** Agrupa automáticamente los pedidos listos por zona de entrega y volumen cúbico estimado para llenar los viajes de transporte de manera eficiente.

#### Modelos y Algoritmos Recomendados
* **Ranking / Scoring:** **LightGBM Ranker (LambdaMART)** o motor multi-criterio calibrado mediante **Regresión Logística**.
* **Clustering de Rutas:** Algoritmo **DBSCAN** o **K-Means** ponderado por proximidad geográfica y capacidad de carga.
* **Formato:** Compilado en `.onnx` o ejecutado mediante `Microsoft.ML`.

#### Entradas (Features) y Salidas
* **Entradas:** Fecha de compromiso, días desde creación, criticidad del cliente, complejidad de producto, disponibilidad de material, estado de carga del taller y zona/municipio de entrega.
* **Salidas:** Puntuación de prioridad (0-100) y asignación de `DispatchWaveGroup` (Ola de despacho).

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~12 MB de RAM.
* **Tiempo de Inferencia:** < 1 ms para ordenar un lote de 200 órdenes.
* **Tamaño del Artefacto:** ~2 MB.

---

### Vector 2: Búsqueda Semántica de Observaciones y Reclamos

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Las órdenes y productos acumulan texto libre en `observations`, detalles de reclamos y garantías. Cuando administración desea auditar problemas recurrentes (ej. fallas en costuras o retrasos en transporte), una búsqueda por texto exacto (`string.Contains` o regex) descarta sinónimos, modismos y palabras con errores ortográficos.
* **Impacto Operativo:**
  * Permite que gerencia consulte *"problemas con tapizado"* y el sistema recupere incidencias con textos como *"costura deshilachada en el espaldar"*, *"tela vino rota de fábrica"* o *"forro mal engrapado"*.
  * Permite detectar automáticamente proveedores o transportistas con anomalías repetitivas.

#### Modelos y Algoritmos Recomendados
* **Modelo de Embeddings:** **`bge-small-es-v1.5`** o **`multilingual-e5-small`** (cuantizados en INT8).
* **Vector Dimensionality:** 384 dimensiones densas.
* **Motor:** `Microsoft.ML.OnnxRuntime` con indexación por similitud de cosenos en memoria (`HNSWLib.Net`) o índice vectorial directo de MongoDB.

#### Entradas y Salidas
* **Entrada:** Texto de búsqueda o reclamo introducido por el usuario.
* **Salida:** Vector densificado (array de 384 floats) y lista de pedidos con mayor similitud de cosenos (> 0.78).

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~50 MB de RAM.
* **Tiempo de Inferencia:** ~25 a 35 ms por embedding generado.
* **Tamaño del Artefacto:** ~45 MB para el archivo `.onnx`.

---

### Vector 3: Búsqueda Inteligente de Muebles y Catálogo

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Los vendedores deben conocer de memoria el catálogo exacto y códigos de producto. Si un cliente solicita por mostrador o WhatsApp *"un mueble esquinero gris que no se ensucie fácil con niños"* o escribe con faltas de ortografía, el buscador tradicional no retorna nada, retrasando la cotización.
* **Impacto Operativo:**
  * Búsqueda por lenguaje natural y atributos semánticos desde el formulario de pedido o cotización.
  * Sugerencia automática de muebles sustitutos en caso de que el modelo buscado esté agotado.

#### Modelos y Algoritmos Recomendados
* **Modelo de Embeddings:** Reutilización de la misma instancia en memoria de **`bge-small-es-v1.5` (INT8)** descrita en el Vector 2 (**0 MB de RAM adicional**).
* **Estrategia Híbrida (Hybrid Search):** Fusión de rango recíproco (**RRF - Reciprocal Rank Fusion**) que combina coincidencias léxicas (código, nombre) con proximidad vectorial de descripción y atributos.

#### Entradas y Salidas
* **Entrada:** Texto libre de búsqueda o requerimiento del cliente.
* **Salida:** Lista de productos sugeridos con score de coincidencia y badges de sustitutos recomendados.

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria Adicional:** 0 MB (comparte el modelo con el Vector 2).
* **Tiempo de Inferencia:** ~15 a 20 ms.
* **Almacenamiento Adicional:** < 1 MB para los vectores del catálogo actual de productos.

---

### Vector 4: Estimación Inteligente de Tiempos de Fabricación (Lead Time Prediction)

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Los vendedores prometen fechas de entrega genéricas (ej. *"15 días hábiles"*), ignorando si el taller asignado tiene 50 pedidos en cola o si el acabado solicitado requiere mayor tiempo de preparación. Esto resulta en incumplimientos de entrega y quejas constantes de clientes.
* **Impacto Operativo:**
  * Al momento de cotizar o registrar una orden, el sistema calcula automáticamente una **fecha estimada realista con intervalo de confianza** (ej. *"Entrega estimada: 14 al 18 de octubre - 94% de probabilidad"*).
  * Alerta preventiva al vendedor si el taller elegido se encuentra saturado.

#### Modelos y Algoritmos Recomendados
* **Modelo:** **LightGBM Regressor** o **FastTree (ML.NET)**.
* **Features:** Proveedor fabricante, categorías de productos en la orden, número de ítems, carga actual de órdenes activas del taller, día de la semana y mes.
* **Métrica de Salida:** Tiempo real de ciclo en días corridos desde `Fabricación` hasta `En Almacén`.

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~8 MB de RAM.
* **Tiempo de Inferencia:** < 0.5 ms (ejecución imperceptible en la UI).
* **Tamaño del Artefacto:** ~1.5 MB.

---

### Vector 5: Pronóstico de Demanda de Inventario (Demand Forecasting)

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Las compras de telas más populares, madera, herrajes o espumas se realizan de forma reactiva cuando ya se agotaron en el taller, deteniendo la línea de producción hasta que se adquiere nuevo material.
* **Impacto Operativo:**
  * Generación de alertas semanales automáticas: *"Para las próximas 3 semanas se proyecta una demanda de 30 comedores modelo Roma y 60 metros de lino gris; stock disponible en riesgo"*.
  * Sugiere órdenes de compra a proveedores de materia prima con días de anticipación.

#### Modelos y Algoritmos Recomendados
* **Modelo:** **LightGBM con Lags temporales** o modelos autorregresivos ligeros (SSA - Singular Spectrum Analysis) en ML.NET.
* **Ventaja:** Excepcional rendimiento computacional sin necesidad de redes neuronales recurrentes complejas.

#### Entradas y Salidas
* **Entrada:** Serie de tiempo de ventas históricas por semana, categoría de producto y material.
* **Salida:** Demanda proyectada a 1, 2 y 4 semanas con límites superior e inferior de incertidumbre.

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~20 MB de RAM durante la corrida por lotes.
* **Tiempo de Inferencia:** ~150 ms para evaluar todo el catálogo en una tarea programada semanal.
* **Tamaño del Artefacto:** ~3 MB.

---

### Vector 6: Scoring de Riesgo de Cobranza (Financiamientos Internos / Cashea)

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** La aprobación de planes de pago fraccionados o créditos internos recae en el criterio subjetivo del vendedor o cajero, sin un historial unificado que mida la confiabilidad de pago del cliente.
* **Impacto Operativo:**
  * Clasificación automática del perfil de pago del cliente: **Bajo Riesgo**, **Riesgo Medio**, **Alto Riesgo**.
  * Recomendación dinámica de condiciones: exigencia de porcentaje de inicial adaptada (ej. 30% inicial para clientes de bajo riesgo vs 50% inicial para clientes con historial de mora).

#### Modelos y Algoritmos Recomendados
* **Modelo:** **Explainable Boosting Machine (EBM / InterpretML)** o **Regresión Logística Regularizada en ML.NET**.
* **Ventaja Crítica:** Al ser un modelo explicable (Glassbox), detalla qué factores causan el nivel de riesgo (ej. *"retraso en 2 pagos previos"*, *"monto de la orden duplica su media histórica"*), dando fundamento claro al personal de cobranza.

#### Entradas y Salidas
* **Entradas:** Historial de compras, porcentaje de pagos puntuales previos, método de pago habitual, ratio monto de cuota vs valor total.
* **Salidas:** Score de riesgo (0-100), categoría (Verde, Amarillo, Rojo) y desglose de factores de influencia.

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~10 MB de RAM.
* **Tiempo de Inferencia:** < 1 ms.
* **Tamaño del Artefacto:** ~1 MB.

---

### Vector 7: OCR de Comprobantes de Pago Móvil / Transferencias

#### Problema y Simplificación de Trabajo Manual
* **Situación Actual:** Los clientes envían capturas de pantalla de Pago Móvil o transferencias bancarias por WhatsApp. El cajero o vendedor debe transcribir manualmente códigos de referencia largos (6 a 12 dígitos), banco emisor, fecha y monto. Un error de un solo dígito bloquea la conciliación bancaria y exige arqueos manuales de cuenta.
* **Impacto Operativo:**
  * El vendedor arrastra o pega la imagen del comprobante bancario (`Ctrl+V`) en la pantalla de cobro.
  * El sistema auto-rellena en menos de 200 ms:
    * `Referencia`: Número exacto extraído.
    * `Banco Emisor`: Detección automática (BDV, Banesco, Mercantil, Provincial, Bancamiga, Zelle).
    * `Monto`: Cantidad reconocida en Bs o divisas.
    * `Fecha`: Fecha estampada en el comprobante.
  * Verificación inmediata contra la base de datos de MongoDB para alertar si esa misma referencia ya fue registrada en otra orden (anti-fraude).

#### Modelos y Algoritmos Recomendados
* **Pipeline OCR:**
  1. **Detector de Cajas de Texto:** **PP-OCRv4 Detector Mobile (ONNX INT8)**.
  2. **Reconocedor de Caracteres:** **PP-OCRv4 Recognizer Mobile (ONNX INT8)** calibrado para caracteres latinos.
  3. **Parser Heurístico / Regex Semántico:** Reglas deterministas para extraer montos, códigos y nombres de bancos según las plantillas conocidas de la banca venezolana e internacional (Zelle).

#### Entradas y Salidas
* **Entrada:** Imagen en formato PNG, JPEG o WebP del comprobante de pago.
* **Salida:** Objeto estructurado `{ bank: string, reference: string, amount: number, currency: string, date: string, confidence: number }`.

#### Requisitos y Métricas de Rendimiento en RPi 5
* **Huella en Memoria:** ~45 MB de RAM.
* **Tiempo de Inferencia:** ~120 a 180 ms en CPU ARM64 (imagen optimizada a 960x960 px).
* **Tamaño del Artefacto:** ~14 MB total para ambos modelos ONNX.

---

## 3. Matriz Comparativa y Consumo Total de Recursos en Raspberry Pi 5

La siguiente tabla resume el impacto computacional de desplegar **la totalidad de los 7 vectores en simultáneo** en el Raspberry Pi 5:

| Vector | RAM en Memoria | CPU por Inferencia | Espacio en Disco (64GB) | Latencia Media | Runtime en .NET 10 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Priorización Taller / Despacho** | 12 MB | < 0.1% | 2 MB | < 1 ms | `Microsoft.ML` |
| **2. Búsqueda Reclamos / Observaciones** | 50 MB | ~5% (30ms) | 45 MB | ~30 ms | `Microsoft.ML.OnnxRuntime` |
| **3. Búsqueda Catálogo Semántico** | 0 MB *(comparte mod. 2)* | ~3% (20ms) | < 1 MB | ~18 ms | `Microsoft.ML.OnnxRuntime` |
| **4. Estimación Tiempos Fabricación** | 8 MB | < 0.1% | 1.5 MB | < 0.5 ms | `Microsoft.ML` |
| **5. Pronóstico Demanda Inventario** | 20 MB | ~8% (lote semanal) | 3 MB | ~150 ms (batch) | `Microsoft.ML` |
| **6. Scoring Riesgo Cobranza** | 10 MB | < 0.1% | 1 MB | < 1 ms | `Microsoft.ML` |
| **7. OCR Comprobantes de Pago** | 45 MB | ~15% (150ms) | 14 MB | ~150 ms | `Microsoft.ML.OnnxRuntime` |
| **IMPACTO TOTAL CONJUNTO** | **~145 MB** | **Despreciable en reposo** | **~66.5 MB** | **Tiempo real** | **100% In-Process C#** |

> [!NOTE]
> **Capacidad Disponible:**
> El consumo combinado de **145 MB de RAM** representa menos del **1%** de los **16 GB** disponibles en el Raspberry Pi 5.
> El almacenamiento requerido de **66.5 MB** representa menos del **0.1%** de los **64 GB** del disco.
> El servidor mantiene holgura total para MongoDB, el backend .NET 10 y el Dashboard de Aspire.

---

## 4. Plan de Implementación por Fases de Negocio

Para maximizar el retorno de inversión y mitigar riesgos, se define la siguiente hoja de ruta secuencial:

### Fase 1: Automatización de Ventas y Caja (Alto Impacto Inmediato)
1. **OCR de Comprobantes de Pago Móvil / Transferencias:**
   - Evita transcripción errónea de montos y referencias bancarias.
   - Detección inmediata de duplicados en caja.
2. **Búsqueda Inteligente de Muebles y Catálogo:**
   - Permite a los vendedores cotizar y responder consultas de clientes a máxima velocidad.

### Fase 2: Control Operativo y Eficiencia de Talleres
3. **Estimación Inteligente de Tiempos de Fabricación:**
   - Fechas de entrega precisas y realistas calculadas al momento de generar la orden.
4. **Priorización Dinámica de Órdenes de Fabricación y Despacho:**
   - Optimización de la carga de trabajo en talleres y consolidación de fletes por zonas de entrega.

### Fase 3: Analítica Predictiva, Finanzas y Calidad
5. **Scoring de Riesgo de Cobranza (Cashea / Crédito Interno):**
   - Reglas y scores para aprobación de financiamientos y reducción de morosidad.
6. **Pronóstico de Demanda de Insumos e Inventario:**
   - Planificación preventiva de compra de materiales (telas, herrajes, madera).
7. **Búsqueda Semántica de Observaciones y Reclamos:**
   - Auditoría automatizada de garantías y control de calidad de proveedores.

---

## 5. Ciclo de Vida de los Modelos (MLOps Ligero)

```
[ Datos Anonimizados de MongoDB ]
                │
                ▼
[ Script de Entrenamiento (Python / Scikit / LightGBM) en Dev/CI ]
                │
                ▼
[ Exportación y Cuantización a .onnx / .zip ]
                │
                ▼
[ Despliegue de Artefacto Versionado en Ordina.Backend/models/ ]
                │
                ▼
[ Carga Singleton en In-Process Memory (.NET 10) al Iniciar API ]
```

1. **Entrenamiento Desacoplado:** Ningún modelo se entrena en el Raspberry Pi 5 para no consumir CPU ni generar estrés térmico en el servidor de producción.
2. **Versionado de Modelos:** Los archivos `.onnx` y `.zip` se versionan en el repositorio o en almacenamiento de artefactos (ej. `models/ocr-v1.onnx`, `models/leadtime-v1.zip`).
3. **Carga Segura en Backend:** El contenedor de `Ordina.Api` inicializa los `InferenceSession` o `PredictionEnginePool` como servicios `Singleton` al arrancar la aplicación (`Program.cs`), asegurando latencias de respuesta inmediatas en cada petición web.
