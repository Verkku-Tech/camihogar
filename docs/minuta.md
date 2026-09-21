# Resumen de Reunión: Requerimientos y Siguientes Pasos

**Participantes principales:** Lisbeth, Saydenier
**Fecha:** Septiembre 2026  

---

## 1. Estatus Actual del Proyecto

* **Operatividad básica en producción:** El sistema ya se utiliza para montar ventas y generar reportes de fabricación/despacho, pero coexiste con una alta dependencia de herramientas externas (WhatsApp y Google Drive).
* **Gestión manual por WhatsApp:**
  * Notificación y seguimiento de pedidos críticos: *Retiro por tienda*, *Retiro por almacén* y despachos *Express*.
  * Control de disponibilidad inmediata de camas mediante listas de texto que los vendedores copian, descuentan y reenvían en chats.
* **Control en Google Drive:**
  * Consulta de stock de productos terminados (colchones, closets, comedores y centros de TV).
  * Repositorio desestructurado de fotos reales de productos entregados («carpeta de recursos»).
* **Soporte inicial:** El periodo de soporte gratuito incluido en la primera entrega está próximo a vencer.

---

## 2. Puntos a Trabajar

### A. Módulo de Notificaciones y Alertas Web
* Implementación de notificaciones push de navegador y centro de notificaciones in-app (icono de campana con contador).
* Inclusión de alertas sonoras para que el personal de almacén/coordinación escuche los avisos al instante.
* Disparo automático de alertas al cambiar pedidos a los estatus:
  * **Retiro por tienda:** Cuando el cliente compra y se lleva la pieza del local.
  * **Retiro por almacén:** Cuando el cliente retirará directamente en depósito (frecuente en Guatire).
  * **Express:** Pedidos con entrega pactada para el mismo día que requieren coordinación inmediata de transporte.

### B. Gestión de Inventario para Disponibilidad Inmediata
* Centralización del inventario terminado en la plataforma web para eliminar el uso de listas en WhatsApp y hojas de Drive.
* Funcionalidad de carga y actualización masiva mediante archivos Excel.
* Segmentación del inventario por ubicación física:
  * *Almacén Terrinca* (distribuidor principal).
  * *Tienda Guatire*.
  * *Tienda Caracas*.
* **Mecanismo de reserva temporal:** Pantalla de consulta interactiva donde el vendedor pueda apartar un ítem disponible en tiempo real mientras toma los datos del cliente, evitando ventas duplicadas simultáneas.

### C. Registro de Órdenes de Fabricación / Reposición Interna (Fase 2)
* Flujo especializado para que administración (Aarón) monte requerimientos de fabricación orientados a surtir stock (disponibilidad inmediata o exhibición en tiendas).
* Separación completa entre una orden de reposición y una venta comercial, garantizando que no se dupliquen ventas ni se alteren las métricas de ingresos.

### D. Catálogo Visual y Repositorio de Recursos
* **Buscador de fotos de referencia:** Galería interna con etiquetado por producto, modelo, tipo de tela y color (ej. *Oslo / Lino tramado / Gris*) para apoyar la venta de clósets en caja y muebles bajo pedido.
* **Visualizador de producto y telas (Exploratorio):** Desarrollo de un prototipo/demo para previsualizar acabados y variantes de color sobre la imagen del modelo, asistiendo la toma de decisión del cliente.

### E. Esquema de Mantenimiento Post-Garantía
* Redacción y entrega de propuesta formal con dos opciones:
  1. *Plan de mantenimiento mensual* (bolsa de horas para optimización de servidor, depuración de caché, respaldos de base de datos, ajustes menores y soporte correctivo).
  2. *Facturación por hora bajo demanda*.

---

## 3. Reglas de Negocio a Considerar

1. **Criterio de descuento de inventario:**
   * **Descuento inmediato:** Aplica únicamente para ventas marcadas como *Entrega inmediata*, *Express*, *Retiro por tienda* o *Retiro por almacén*.
   * **Sin descuento de stock terminado:** Encargos a fábrica, sistemas de apartado y ventas para rutas programadas que aún no cuentan con producto asignado.
2. **Exclusión del almacén de socios en Caracas:**
   * El depósito de Caracas pertenece a socios externos sin control sistemático interno. No se gestionará stock de este almacén en la plataforma.
   * Si no hay existencia en almacenes propios (Terrinca/Guatire) para un despacho urgente, el sistema debe arrojar una notificación: *«Sin inventario local, consultar con administración (Daphne)»*.
3. **Integridad financiera en reposiciones:**
   * La producción para stock no debe computarse como una venta pagada en los paneles de facturación, evitando inflación artificial de ingresos y discrepancias en el costo de producción vs. precio de venta.
4. **Restricción de accesos a transportistas:**
   * Los transportistas externos no tendrán usuario ni acceso a la plataforma por motivos de confidencialidad de la operación y cartera de clientes. La logística continuará operando vía reportes impresos o notas de despacho enviadas por administración.
5. **Descarte de integración bancaria:**
   * Queda cancelada la integración automática vía API con el Banco de Venezuela para conciliación de pagos; el proceso seguirá manual a cargo de Sandra.

---

## 4. Notas Importantes

* **Concurrencia en ventas de última unidad:** Se confirmó que ocurren situaciones donde dos vendedores en distintas ubicaciones intentan vender la misma pieza única en el mismo minuto.
* **Capacidades físicas de tiendas:** Las tiendas cuentan con límites físicos de exhibición (espacio máximo para camas y colchones). Este parámetro servirá como restricción para futuros cálculos de reposición inteligente.
* **Crecimiento de almacenamiento en servidor:** La base de datos actual (~300 MB) tenderá a crecer con rapidez una vez se alojen comprobantes, imágenes de productos y fotos de clientes, exigiendo políticas de compresión y mantenimiento preventivo.

---

## 5. Notas al Autor (Aspectos no discutidos a evaluar)

1. **Tiempo de expiración (Timeout) en la reserva de stock:**
   * Al reservar un producto durante la atención en tienda, es crucial establecer un tiempo límite (ej. 5 a 10 minutos). Sin una liberación automática tras inactividad, un vendedor podría olvidar un pedido a medio llenar y bloquear inventario crítico para las demás sucursales.
2. **Circuito de traslados entre almacén y tiendas:**
   * Al transferir mercancía desde Terrinca a una tienda para reposición de exhibición, se requiere definir si existirá un estatus de *«En tránsito»* o confirmación de recepción física, evitando que el stock se descuente del depósito central antes de llegar a tienda.
3. **Estrategia de almacenamiento de imágenes:**
   * Guardar fotos de alta resolución tomadas con celulares directamente en el disco del servidor puede comprometer el rendimiento y encarecer los backups. Conviene definir si se empleará compresión automática al subir o almacenamiento externo en la nube (ej. S3 / R2).
4. **Flujo de confirmación con Sandra:**
   * Aunque Lisbeth sugirió mantener la conciliación manual sin API bancaria, se recomienda consultar formalmente con Sandra si requiere al menos un botón o vista dedicada dentro del sistema para marcar pagos verificados y evitar cotejos manuales en papel.