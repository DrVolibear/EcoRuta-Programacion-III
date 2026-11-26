# Historial de cambios

## v2.3.0

Cierra los dos requisitos que habían quedado abiertos (RF-26 y RF-31) con la política que el profesor pidió definir y justificar. Detalle y justificación en `docs/POLITICA_ECOLOGICA.md`; evidencia en `docs/MATRIZ_CUMPLIMIENTO.md`.

### RF-26 · Ahorro por consolidación frente a «furgoneta individual»

- El ahorro compara **un viaje de furgoneta por envío** con **un solo viaje consolidado** de la modalidad de la ruta (antes se comparaba con la suma de las emisiones por separado del mismo vehículo, lo que no reflejaba la eficiencia de consolidar).
- Cada ruta informa emisiones en furgonetas individuales, emisiones consolidadas, **ahorro en kg CO₂e y en %**, **viajes evitados** y **km evitados**, en la tarjeta de la ruta, en el aviso de despacho y en la guía de despacho impresa.
- Al despachar se guarda el resultado (`ruta.consolidacion`) y el ahorro se reparte entre los envíos (`emisionesEvitadasConsolidacionKgCO2e`, RF-48). Las rutas ya despachadas muestran lo que quedó guardado.
- La furgoneta de referencia se declara en `datos.json` (`referencias.furgonetaIndividual`) y **reutiliza datos del catálogo**: el factor de emisión del vehículo de combustión terrestre (`consolidado`, 0,09) y la capacidad de la furgoneta (`electrico`, 800 kg). Si el catálogo no la trae, se usa el vehículo de la ruta.

### RF-31 · Descuento ecológico también para consolidados

- El descuento ecológico (10 %, `tarifas.descuentoEcologico`) aplica a las modalidades de **baja emisión** y a la **consolidada** (marca `consolidada: true` en el catálogo; un catálogo anterior se reconoce por el código `consolidado`). Sigue sin acumularse con el recargo por urgencia (RN-11).
- El desglose de la tarifa explica el motivo («modalidad consolidada: varios envíos comparten un viaje»), y la vista Catálogo declara la política.
- Efecto: el camión consolidado cuesta un 10 % menos que en la v2.2.1. Los envíos ya registrados conservan la tarifa con la que se cobraron.

### Otros cambios

- `datos/datos.json`: solo se añadieron dos campos opcionales (`consolidada` y `referencias.furgonetaIndividual`); tarifas, capacidades, sucursales, distancias, recargos y reglas no cambiaron. `validarCatalogo` valida ambos campos si existen.
- `reglas.js`: nuevas funciones `esConsolidada`, `aplicaDescuentoEcologico`, `motivoDescuento` y `furgonetaIndividual`; `calcularConsolidacion` devuelve ahora `emisionesIndividuales` (antes `emisionesSeparadas`), `ahorroPorcentaje`, `viajesEvitados` y `kmEvitados`.
- Nuevos documentos: `docs/POLITICA_ECOLOGICA.md` y `docs/MANUAL_DE_USUARIO.md` (con capturas).
- Con un solo envío no hay consolidación: la ruta informa ahorro 0 % y emisiones individuales iguales a las consolidadas (antes comparaba la furgoneta de referencia con el vehículo de la ruta y mostraba un ahorro que no provenía de consolidar).
- `datos/datos.json`: se pusieron tildes a textos mostrados al usuario (p. ej. «Camión consolidado», «Furgón eléctrico», «Carga aérea», «San José Centro», «Limón Centro»). Solo cambian cadenas de texto; los códigos, números y reglas son los mismos.
- `pruebas/lib.mjs`: el servidor de pruebas acepta rutas relativas como `.`.
- Pruebas: 234 comprobaciones por requisito (antes 202; incluye compatibilidad con datos de la v2.2.1), con bloques nuevos `rf26` y `rf31`.

## v2.2.1

Basada en la v2.2.0 (se conservó la arquitectura, la clave `ecoruta_estado_v5` y todo lo que ya funcionaba). Detalle de cada requisito en `docs/MATRIZ_CUMPLIMIENTO.md`.

### Correcciones prioritarias

1. **Sobredimensión autorizada**: el responsable es obligatorio y se recorta (`trim`) al comparar y al registrar; si falta, las opciones se limpian con el mensaje «Los datos cambiaron. Vuelva a comparar las modalidades.» y el campo muestra «Indique el responsable que autorizó la sobredimensión.». El campo se deshabilita y se vacía al desmarcar la casilla. El responsable se guarda en el envío, el detalle, el seguimiento y el historial (auditoría). Cualquiera de los 12 campos del formulario invalida la comparación (firma de datos) y al registrar se vuelve a validar todo.
2. **Dimensiones**: Largo, Ancho y Alto son tres grupos iguales con etiqueta «(cm)» y la unidad dentro de la caja; una sola columna en pantallas angostas.
3. **Inventario**: el filtro de estado ofrece solo *Todos / En bodega / Asignado a ruta / En ruta / Retenido*. `esRetenido(envio)` es reutilizable, las filas retenidas van en naranja suave con el rótulo «Retenido», «1 día / 2 días» nunca «día(s)» y la columna se llama «Peso facturable».

### Correcciones y mejoras 4–31 del encargo

- **Clientes**: el formulario no muestra errores al abrirse; mensajes específicos por campo solo tras interactuar; los campos se recortan; el teléfono se formatea `8888-1234`; correo e identificación únicos (sin distinguir mayúsculas); la edición valida igual que el alta; mensajes distintos para «sin resultados» y «lista vacía».
- **Cancelación segura** (envíos, clientes y rutas): modal con resumen e impacto, motivo de al menos 10 caracteres con contador, foco y Escape correctos, bloqueo del scroll de fondo y baja lógica (`cancelado`) que conserva guía, historial, motivo, fecha y estado anterior. Conteos separados de activos, cancelados e históricos.
- **Reenvíos**: no se permite un segundo reenvío activo del mismo envío («Ya existe un reenvío activo: ENV-…»); la ficha enlaza el original con su reenvío y viceversa.
- **Rutas**: la capacidad máxima de cada modalidad sale de `datos.json` (40 / 800 / 5 000 / 1 500 kg); la capacidad operativa no puede superarla; la fecha de salida no puede estar en el pasado; «Cerrar y despachar» se deshabilita sin envíos.
- **Búsqueda global** por guía, cliente o ruta, con teclado y navegación a la vista correspondiente.
- **Fechas**: Desde/Hasta sincronizados (`min`/`max`) y mensaje claro en el rango inválido, en la tabla de envíos y en el panel.
- **Impresión A4**: ficha del envío y guía de despacho con fecha de impresión, sin la interfaz y sin páginas en blanco.
- **Seguimiento**: el código se normaliza (mayúsculas, sin espacios, `ENV-AAAA-NNNNN`); ficha completa con pesos real/volumétrico/facturable, dimensiones, desglose de tarifa y progreso del envío.
- **Interfaz**: CSS reescrito con tokens en `:root`, mobile-first, tema claro/oscuro/automático sin `!important` ni duplicados; contraste WCAG AA verificado; sin desbordamiento horizontal.
- **Rendimiento**: al registrar o cancelar se inserta o reemplaza solo la fila afectada; el redibujo total queda para filtrar, ordenar y paginar.
- **Datos de demostración**: 15 clientes, 43 envíos en todos los estados y 5 rutas coherentes.

### Cambios de arquitectura (sin cambiar de tecnología)

- Nuevos módulos: `demo.js`, `modales.js`, `formularios.js`, `plantillas.js`, `impresion.js`.
- `reglas.js` incorpora `esRetenido`, `limiteRetencionDias`, `textoDias`, `emisionesEvitadasLimpias` y la tabla de transiciones con `cancelado`.
- Código reformateado y comentado en español (se eliminó el código minificado).

### Decisiones que el equipo debe conocer

- `cancelado` es un estado terminal adicional a los seis del enunciado (RF-34): es la baja lógica exigida por RF-41 y RN-07 (la guía no se reutiliza).
- `DIMENSION_MAX_ABSOLUTA_CM = 300` (tope físico por dimensión) está en `reglas.js` porque ya existía como `max="300"` en el formulario; conviene moverlo a `datos.json` si el profesor lo pide.
- No se inventaron tarifas, capacidades, sucursales, distancias ni reglas: todo sale de `datos/datos.json`.
- Pendientes de decisión: RF-26, RF-31 y RN-14 (ver `README.md`). RF-26 y RF-31 se resolvieron en la v2.3.0.

## v2.2.0

- Invalida comparaciones cuando cambia cualquier dato y valida de nuevo antes de registrar.
- Cancelación lógica de envíos y clientes con auditoría.
- Validación y normalización completa de clientes, incluido correo único.
- Ficha completa de seguimiento, relaciones de reenvío y bloqueo de reenvíos activos duplicados.
- Inventario con filtro Retenido, pluralización correcta y resaltado visual.
- Capacidad de despacho sugerida automáticamente desde el catálogo.
- Rangos de fechas sincronizados, modales mejorados y motivo de cancelación con contador.
- Pesos real, volumétrico y facturable diferenciados; dimensiones uniformes Largo × Ancho × Alto.
- Impresión A4 compacta sin controles ni páginas vacías.
