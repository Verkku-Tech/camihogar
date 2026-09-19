# Reglas de Negocio: Clientes y Validación RUT / Cédula

**Módulo:** Clientes y Directorio Comercial  
**Entidades Principales:** `Client`, `ClientType`, `ClientStatus`  
**Servicios de Aplicación:** `IClientService`, `ClientService`, `RutValidator`  

---

## 1. Clasificación de Clientes (`ClientType`)

Todo cliente registrado en el sistema debe categorizarse formalmente para determinar el tratamiento fiscal y los requisitos de facturación:

| Tipo | Código Enum | Documento Requerido | Descripción |
| :--- | :--- | :--- | :--- |
| **Persona Natural** | `ClientType.Individual` | Cédula de Identidad (`V`, `E`) o Pasaporte (`P`) | Consumidor final para uso residencial particular. |
| **Persona Jurídica** | `ClientType.Company` | Registro de Información Fiscal (`J`, `G`) | Empresas, comercios, instituciones públicas u oficinas corporativas. |

---

## 2. Validación y Normalización Estricta de Identificación (`RutValidator`)

En el ecosistema legal y tributario venezolano, el documento de identidad o RIF es el identificador fiscal primario. El sistema implementa un motor de validación determinista (`RutValidator`) para garantizar la integridad de los datos:

### 1. Expresión Regular Oficial:
```regex
^[VEJPGvejpg]-?[0-9]{5,10}$
```

### 2. Prefijos Legales Admitidos:
- **`V` (Venezolano):** Ciudadanos venezolanos naturales (cédulas de 5 a 8 dígitos típicamente).
- **`E` (Extranjero):** Residentes extranjeros en territorio nacional.
- **`J` (Jurídico):** Sociedades mercantiles, compañías anónimas y firmas personales.
- **`G` (Gubernamental):** Ministerios, alcaldías, gobernaciones y entes del Estado.
- **`P` (Pasaporte):** Compradores internacionales sin residencia fija.

### 3. Algoritmo de Normalización Automática:
Antes de almacenar en base de datos o ejecutar búsquedas, el sistema limpia la entrada del usuario:
1. Elimina espacios en blanco internos y externos.
2. Convierte todas las letras a mayúsculas estrictas.
3. Inserta obligatoriamente el guion separador después del prefijo si fue omitido por el usuario.

```
Entrada del Usuario ──► [ RutValidator.Normalize ] ──► Formato Canónico
"v 18456789"         ─────────────────────────────► "V-18456789"
"j309876543"         ─────────────────────────────► "J-309876543"
"e-84123456"         ─────────────────────────────► "E-84123456"
```

---

## 3. Regla de Unicidad y Duplicidad

1. **Unicidad por Documento Normalizado:**
   - No pueden coexistir dos registros de cliente con el mismo valor en `documentNumber` (normalizado).
   - Un intento de crear un cliente con una cédula/RIF ya registrada en base de datos arroja una excepción de regla de negocio (`DuplicateKeyException`), sugiriendo al vendedor cargar el perfil existente.
2. **Reasignación de Órdenes:**
   - Si un cliente actualiza su número de teléfono o dirección de despacho, los pedidos futuros toman los nuevos datos sin alterar la foto histórica de órdenes ya despachadas o cerradas.

---

## 4. Estados del Cliente (`ClientStatus`)

- **`Activo` (`ClientStatus.Active`):** Cliente habilitado para emitir presupuestos, reservas y pedidos.
- **`Inactivo` (`ClientStatus.Inactive`):** Cliente sin actividad en más de 24 meses o marcado temporalmente.
- **`Bloqueado` (`ClientStatus.Blocked`):** Cliente restringido por mora recurrente, cheques devueltos o disputas comerciales no resueltas. No permite generar nuevos pedidos ni apartados.

---

## 5. Búsquedas Indexadas en Servidor

Para garantizar búsquedas instantáneas en bases de datos con más de 100.000 clientes:
1. Las consultas operan sobre índices compuestos en MongoDB (`documentNumber`, `name`, `phone`).
2. El frontend consume endpoints paginados con búsqueda en servidor (`PagedRequest` con término de búsqueda tokenizado), evitando la descarga masiva de la libreta de clientes a la memoria del navegador.
