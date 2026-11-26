# Modelo de datos de EcoRuta v2.3.0

Este documento cubre OE-6 y el apartado 8 del enunciado: entidades, atributos, relaciones, reglas de integridad y la correspondencia entre los nombres del enunciado y los que usa el código.

> Los nombres de los atributos se conservaron tal como los usaba la v2.2.0 para no romper los datos ya guardados en `localStorage` (clave `ecoruta_estado_v5`). La tabla «Correspondencia» muestra cómo se relacionan con el ejemplo del enunciado.

## 1. Estado guardado (`localStorage` → `ecoruta_estado_v5`)

```json
{
  "version": 5,
  "contadorGuia": 44,
  "contadorRuta": 6,
  "clientes": [],
  "envios": [],
  "enviosEliminados": [],
  "rutas": [],
  "configuracion": { "tema": "automatico", "umbralOcupacion": 80, "diasRetencion": 3, "diasRetencionFrio": 1 }
}
```

- `enviosEliminados` es un campo heredado de la v2.2.0. La v2.2.1 ya no lo usa: al leer un estado antiguo, sus elementos pasan a `envios` con `estado: "cancelado"`; se guarda siempre vacío.
- Toda lectura pasa por `normalizarEstado()` (en `persistencia.js`), que repara referencias rotas, completa campos ausentes y migra claves anteriores (`ecoruta_estado_v1` … `v4`).

## 2. Entidades

### Envío (`estado.envios[]`)

| Atributo | Tipo | Descripción |
| -------- | ---- | ----------- |
| `codigoGuia` | texto | `ENV-AAAA-NNNNN`, única, correlativa e inmutable. Nunca se reutiliza. |
| `clienteRemitente`, `clienteDestinatario` | texto | `id` interno del cliente (no cambia aunque se edite su identificación). |
| `sucursalOrigen`, `sucursalDestino` | texto | Códigos del catálogo (`SJO-01`, …). |
| `pesoReal`, `pesoVolumetrico`, `pesoFacturable` | número (kg) | Facturable = el mayor entre real y volumétrico. |
| `dimensiones` | `{ largo, ancho, alto }` | En centímetros, enteros. |
| `contenido` | `general` \| `fragil` \| `frio` | Tipo de contenido. |
| `urgente` | booleano | |
| `sobredimension` | booleano | Alguna dimensión supera `reglas.dimensionMaxCm` del catálogo. |
| `autorizacionSobredimension` | `{ responsable, fecha } \| null` | Quién autorizó; `responsable` va recortado y es obligatorio. |
| `distanciaKm` | número | Tomada de la matriz del catálogo. |
| `modalidad` | texto | Código de modalidad del catálogo. |
| `tarifa` | `{ base, peso, distancia, subtotal, recargos{urgente,fragil,frio,sobredimension}, descuento, total }` | Se guarda calculada para que las guías antiguas se expliquen igual si el catálogo cambia. |
| `emisionesKgCO2e` | número | Emisiones estimadas. |
| `emisionesEvitadasLimpiasKgCO2e`, `emisionesEvitadasConsolidacionKgCO2e` | número | Evitadas por modalidad limpia / por consolidar. |
| `modalidadMenorEmision`, `eligioMenorEmision` | texto, booleano | RF-23: cuál era la de menor emisión y si el agente la eligió. |
| `estado` | texto | Uno de los seis estados, o `cancelado`. |
| `rutaAsignada` | texto \| null | Código de la ruta. |
| `envioOrigen` | texto \| null | Si es un reenvío, la guía del envío original. |
| `fechaIngresoBodega` | ISO \| null | Desde cuándo se cuentan los días en bodega. |
| `historial` | `[{ estadoAnterior, estado, fecha, detalle }]` | Cada cambio de estado, con fecha y hora ISO. |
| `fechaRegistro` | ISO | |
| `estadoAnterior`, `fechaCancelacion`, `motivoCancelacion` | | Solo en envíos cancelados (baja lógica). |

### Cliente (`estado.clientes[]`)

`id` (UUID interno), `identificacion` (única), `nombre`, `telefono` (`8888-1234`), `correo` (único, sin distinguir mayúsculas), `direccion`, `codigoPostal` (5 dígitos), `provincia`, `estado` (`activo` \| `inactivo` \| `cancelado`), `activo` (booleano coherente con `estado`), `fechaRegistro`. Los cancelados añaden `estadoAnterior`, `fechaCancelacion` y `motivoCancelacion`.

### Ruta de despacho (`estado.rutas[]`)

`codigo` (`RUTA-AAAA-NNNN`), `sucursalDestino`, `modalidad`, `fechaSalida`, `capacidadPeso` (kg), `capacidadCantidad` (paquetes), `envios` (lista de guías), `estado` (`abierta` \| `en ruta` \| `cancelada`), `emisionesTotales`, `ahorroConsolidacion`, `consolidacion` (al despachar: `{ emisionesIndividuales, emisionesConsolidadas, ahorro, ahorroPorcentaje, viajesIndividuales, viajesConsolidados, viajesEvitados, kmEvitados }`, RF-26), `fechaCreacion`, `fechaSalidaReal`. Las canceladas añaden `fechaCancelacion` y `motivoCancelacion`.

### Catálogo (`datos/datos.json`, solo lectura)

`sucursales[]` (código, nombre, provincia, `capacidadKg`, `modalidades`, `tarifaBase`), `distancias` (matriz simétrica), `modalidades[]` (código, nombre, `factorEmision`, `capacidadKg`, `maxDistanciaKm`, `minDistanciaKm`, `velocidadKmH`, `bajaEmision`, `consolidada` (opcional, RF-31), `refrigerada`, `factorTarifa`), `tarifas` (`porKg`, `porKm`, `descuentoEcologico`), `recargos` (`urgente`, `fragil`, `frio`, `sobredimension`) y `reglas` (`pesoMinKg`, `pesoMaxKg`, `dimensionMaxCm`, `divisorVolumetrico`, `bicicletaPesoMaxKg`, `bicicletaDistanciaMaxKm`, `aereoDistanciaMinKm`) y, opcionalmente, `referencias.furgonetaIndividual` (`nombre`, `factorEmision`, `capacidadKg`, `supuesto`: línea base del ahorro por consolidación, RF-26). Se valida con `validarCatalogo()` y se guarda una copia local para trabajar sin red.

## 3. Relaciones y reglas de integridad

- Envío → Cliente: dos referencias por `id` (remitente y destinatario, distintos entre sí).
- Envío → Ruta: `rutaAsignada` ↔ `ruta.envios`. Si el envío está *asignado a ruta* debe figurar en la lista de su ruta abierta; `normalizarEstado()` elimina referencias que ya no se cumplen.
- Envío → Envío: `envioOrigen` (reenvío). Un envío devuelto admite un solo reenvío activo.
- Envío → Catálogo: sucursales, modalidad y distancia salen de `datos.json`; nada se incrusta en el código.
- Un cliente con envíos activos no se cancela (se inactiva). Un envío en ruta o entregado no se edita ni se cancela (RN-09).
- La guía nunca se reutiliza: el contador solo crece, y la cancelación es lógica (RN-07).
- Una ruta no acepta envíos que excedan su capacidad (RN-10), que no estén en bodega o cuyo destino/modalidad no coincidan.

## 4. Correspondencia con el ejemplo del enunciado

| Enunciado | Código | Observación |
| --------- | ------ | ----------- |
| `clienteRemitente: "1-1111-1111"` | `clienteRemitente: <id interno>` | Se guarda el `id` y no la identificación porque esta es editable; la ficha muestra ambos. |
| `pesoRealKg` | `pesoReal` | Mismo significado; la unidad es kg. |
| `dimensionesCm` | `dimensiones` | Centímetros. |
| `pesoVolumetricoKg` | `pesoVolumetrico` | |
| `pesoFacturableKg` | `pesoFacturable` | |
| `tipoContenido` | `contenido` | |
| `modalidad: "camion-consolidado"` | `modalidad: "consolidado"` | El código lo define el catálogo `datos.json`. |
| `tarifa.porPeso`, `tarifa.porDistancia`, `tarifa.recargos` | `tarifa.peso`, `tarifa.distancia`, `tarifa.recargos{…}` | Los recargos se guardan desglosados. |
| `emisionesEvitadasKgCO2e` | `emisionesEvitadasLimpiasKgCO2e` + `emisionesEvitadasConsolidacionKgCO2e` | Se separan las dos causas. |
| Estados (6) | Los mismos 6 + `cancelado` | `cancelado` es la baja lógica de RF-41; no es parte del ciclo de vida. |
| Cliente: `activo`, `fecha de registro` | `activo`, `estado`, `fechaRegistro` | |
| Ruta: `lista de códigos de guía asignados` | `envios` | |
| Ruta: `capacidad en peso` / `en cantidad` | `capacidadPeso` / `capacidadCantidad` | |
| Ruta: `emisiones totales`, `ahorro por consolidación` | `emisionesTotales`, `ahorroConsolidacion` | |
| Catálogo: «estructura tarifaria por sucursal» | `sucursales[].tarifaBase` + `tarifas` + `recargos` | |
