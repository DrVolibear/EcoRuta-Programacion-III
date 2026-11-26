# Matriz de cumplimiento del enunciado · EcoRuta v2.3.0

Cada fila es un requisito del enunciado (RF, RN, 7.x, 8 y entregables). «**Estado actual**» es el estado **antes** de este trabajo, comprobado sobre los archivos de la v2.2.0. «**Evidencia final**» es el resultado de las pruebas ejecutadas sobre la v2.3.0 (que incorpora, además, la política de consolidación de RF-26 y RF-31 acordada con el profesor).

Los objetivos específicos **OE-1 a OE-8** se evalúan a través de los requisitos que los concretan (7.1 a 7.4, RF-48, RF-49 y RN-14); OE-9 y OE-10 son entregables y se listan aparte.

## Resumen

| | Cantidad |
| --- | --- |
| Requisitos evaluados | 113 |
| Estado actual (v2.2.0): Cumple | 77 |
| Estado actual (v2.2.0): Cumple parcialmente | 32 |
| Estado actual (v2.2.0): No cumple | 4 |
| **Con evidencia final de cumplimiento (v2.3.0)** | **109** |
| Con prueba automática y todas sus comprobaciones correctas | 107 de 107 |
| Pendientes o no verificables sin decisión del equipo / documentos | 4 |
| Pruebas automáticas por requisito (`pruebas_matriz.mjs`) | 234/234 correctas |
| Pruebas de aceptación del encargo (`pruebas_v221.mjs`) | 141/141 correctas |

> Un requisito **no** se declara cumplido sin evidencia. Los 4 que quedan abiertos (tabla al final) dependen de una decisión del equipo, de un documento o de un servicio externo; no se resolvieron inventando datos.

## Cómo reproducir

Las pruebas viven en la carpeta `pruebas/` (no son parte de la aplicación) y usan Playwright con Chromium, instalados aparte:

```bash
node pruebas/pruebas_v221.mjs   .   # aceptación del encargo
node pruebas/pruebas_matriz.mjs .   # una o más comprobaciones por requisito
node pruebas/humo.mjs           .   # prueba de humo
node pruebas/generar_matriz.mjs .   # regenera este documento
```

La etiqueta de la columna «Prueba» (`rf01`, `css`, `f1`…) es el prefijo `[etiqueta]` de las comprobaciones en `pruebas_matriz.mjs`; las etiquetas `f1`, `f3`, `p8`… remiten a los grupos P01–P14 y E01–E06 de `pruebas_v221.mjs`.

## Matriz

| N.º | Requisito textual | Archivo / módulo | Estado actual (v2.2.0) | Cambio requerido | Prueba de aceptación | Evidencia final |
| --- | --- | --- | --- | --- | --- | --- |
| RF-01 | Registrar solicitud: remitente, destinatario, paquete, sucursal de origen y destino | envios.js | Cumple | Ninguno | `rf01` · la solicitud se guarda con remitente, destinatario, paquete y sucursales (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-02 | Código de guía único ENV-AAAA-NNNNN, correlativo y no reutilizable | envios.js / persistencia.js | Cumple | Ninguno | `rf02` · formato ENV-AAAA-NNNNN (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-03 | Validación nativa: required, type, min, max, maxlength y pattern (teléfono, identificación, código postal) | index.html | Cumple parcialmente | Patrón de identificación inválido (error de consola): escapar el guion | `rf03` · campos obligatorios con required (16) (+4) | ✅ Cumple · 5/5 comprobaciones |
| RF-04 | Tres dimensiones, peso volumétrico; facturable = mayor entre real y volumétrico | reglas.js | Cumple | Ninguno | `rf04` · peso volumétrico = L×A×H / divisor del catálogo (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-05 | Clasificar por contenido: frágil y cadena de frío con manejo diferenciado | reglas.js | Cumple | Ninguno | `rf05` · cadena de frío solo ofrece modalidades refrigeradas (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-06 | Resumen de la solicitud antes de confirmar, con desglose de tarifa y emisiones | envios.js | Cumple parcialmente | Añadir resumen de la solicitud (personas, trayecto, paquete) sobre las opciones | `rf06` · la comparación abre con el resumen de la solicitud (remitente, trayecto y paquete) (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-07 | Impedir el registro que incumpla una regla, con mensaje específico de regla y campo | validaciones.js | Cumple parcialmente | Regla de sobredimensión nunca se evaluaba; mostrar todos los errores | `rf07` `f1` · cada error trae campo y mensaje específico (se muestran todos a la vez) (+28) | ✅ Cumple · 29/29 comprobaciones |
| RF-08 | Corregir solicitud registrada conservando la guía | envios.js | Cumple | Ninguno | `rf08` · al editar se conserva la guía y se actualizan los datos (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-09 | Clientes: identificación única, nombre, teléfono, correo, dirección y provincia | clientes.js | Cumple | Mensajes exactos del enunciado de tu lista | `rf09` · el cliente se guarda con identificación, nombre, teléfono, correo, dirección y provincia (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-10 | Buscar cliente existente y autocompletar al registrar un envío | envios.js | Cumple parcialmente | Mostrar los datos del cliente elegido (autocompletado visible) | `rf10` · la búsqueda reduce las opciones del selector (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-11 | Búsqueda incremental de clientes sin recargar | clientes.js | Cumple | Ninguno | `rf11` · la tabla se filtra mientras se escribe, sin recargar la página | ✅ Cumple · 1/1 comprobaciones |
| RF-12 | Editar cliente y propagar el cambio a la presentación de sus envíos | clientes.js | Cumple | Ninguno | `rf12` · el nombre editado aparece en la ficha de sus envíos (los envíos guardan el id del cliente) | ✅ Cumple · 1/1 comprobaciones |
| RF-13 | No eliminar cliente con envíos activos; ofrecer inactivarlo | clientes.js | Cumple | Ninguno | `rf13` · un cliente con envíos activos no se elimina y se ofrece inactivarlo (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-14 | Historial de envíos de un cliente con su total facturado | clientes.js | Cumple | Título 'Historial de envíos de [cliente]' | `rf14` · título «Historial de envíos de [cliente]» (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-15 | datos.json propio: sucursales, distancias, tarifas, modalidades, recargos | datos.json | Cumple | Ninguno | `rf15` · datos.json trae sucursales, distancias, modalidades, tarifas, recargos y reglas (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-16 | Cargar catálogo con fetch/async-await antes de habilitar formularios | catalogo.js | Cumple | Ninguno | `rf16` · mientras se descarga el catálogo la aplicación está oculta y se muestra el estado de carga (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-17 | Estado de carga y de error con reintento, sin pantalla en blanco | app.js | Cumple | Ninguno | `rf17` · sin red y sin copia local: mensaje de error y botón «Reintentar» (no pantalla en blanco) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-18 | Validar estructura del catálogo e informar qué campo falla | validaciones.js | Cumple | Ninguno | `rf18` · un catálogo inválido informa qué campo falla (tarifas.porKg) | ✅ Cumple · 1/1 comprobaciones |
| RF-19 | Vista consultable de sucursales con capacidad y modalidades | app.js | Cumple | Ninguno | `rf19` · la vista del catálogo muestra las 7 sucursales con capacidad y tarifa base (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-20 | Distancia desde la matriz del catálogo, sin valores incrustados | catalogo.js | Cumple | Ninguno | `rf20` · la distancia sale de la matriz del catálogo (SJO→LIM = 160 km) y es simétrica (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-21 | Modalidades viables según peso facturable, dimensiones, distancia y origen | reglas.js | Cumple | Ninguno | `rf21` · viables según peso facturable (30 kg descarta la bicicleta; 900 kg deja solo el consolidado) (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-22 | Comparación de viables: tarifa, emisiones y tiempo de entrega | envios.js | Cumple | Ninguno | `rf22` · se comparan las modalidades viables (≥2) con tarifa, emisiones y tiempo de entrega | ✅ Cumple · 1/1 comprobaciones |
| RF-23 | Destacar la de menor emisión y registrar cuál eligió el agente | envios.js | Cumple parcialmente | Guardar modalidad de menor emisión y si el agente la eligió | `rf23` · la opción de menor emisión aparece destacada | ✅ Cumple · 1/1 comprobaciones |
| RF-24 | Rutas con fecha de salida, modalidad, destino y envíos asignados | rutas.js | Cumple | Demo generaba rutas abiertas vacías (ver RF-58) | `rf24` · la ruta guarda destino, modalidad, fecha de salida y envíos asignados (vacía al crearse) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-25 | Capacidad de ruta en peso y en paquetes; informar capacidad libre | rutas.js | Cumple | Capacidad máxima desde datos.json (punto 31) | `rf25` `p31` · la ruta respeta su capacidad en paquetes (el segundo envío se rechaza) (+9) | ✅ Cumple · 10/10 comprobaciones |
| RF-26 | Ahorro por consolidación vs. furgoneta individual | rutas.js | Cumple parcialmente | Línea base «furgoneta individual» (un viaje por envío) declarada en datos.json; ahorro en kg CO₂e, % y viajes/km evitados | `rf26` · datos.json declara la «furgoneta individual» con datos que ya estaban en el catálogo (factor d… (+18) | ✅ Cumple · 19/19 comprobaciones |
| RF-27 | Retirar envío de una ruta que no salió, devolviéndolo al estado anterior | rutas.js | Cumple | Ninguno | `rf27` · retirar un envío de una ruta que no salió lo devuelve a «en bodega» (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-28 | Cerrar ruta: cambia en bloque el estado de sus envíos | rutas.js | Cumple | Ninguno | `rf28` · cerrar la ruta cambia en bloque el estado de todos sus envíos a «en ruta» (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-29 | Tarifa desde base de sucursal, peso facturable, distancia y modalidad | reglas.js | Cumple | Ninguno | `rf29` · subtotal = (base de sucursal + peso×tarifa/kg + km×tarifa/km) × factor de modalidad (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-30 | Recargos: urgente, frágil, frío y sobredimensión | reglas.js | Cumple | Ninguno | `rf30` · urgente 25 %, frágil 12 %, frío 18 % y sobredimensión 20 % del subtotal (porcentajes de datos.… | ✅ Cumple · 1/1 comprobaciones |
| RF-31 | Descuento ecológico a baja emisión y a consolidados, según política justificada | reglas.js | Cumple parcialmente | El descuento también aplica a la modalidad consolidada (marca `consolidada` en datos.json), sin acumularse con urgencia; política documentada | `rf31` · el catálogo marca la modalidad consolidada y el código la reconoce aunque falte la marca (+10) | ✅ Cumple · 11/11 comprobaciones |
| RF-32 | Desglose completo del cálculo con cada componente y monto | envios.js | Cumple parcialmente | Filas separadas en comparación, detalle y seguimiento con la regla aplicada | `rf32` · el detalle desglosa base, peso, distancia, subtotal, cada recargo, descuento y total (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-33 | Montos con formato de moneda mediante una única función | reglas.js | Cumple parcialmente | Seguimiento usaba su propio toLocaleString | `rf33` · moneda() da formato de colones con separador de miles (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-34 | Estados: registrado, en bodega, asignado a ruta, en ruta, entregado, devuelto | seguimiento.js | Cumple | Se añade 'cancelado' como baja lógica terminal (decisión documentada) | `rf34` · los seis estados del enunciado, en orden (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-35 | Solo transiciones válidas, definidas en el código | seguimiento.js | Cumple | Incluir cancelado en la tabla explícita | `rf35` · tabla explícita de transiciones (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-36 | Historial de cambios de estado con fecha, hora y estado anterior | seguimiento.js | Cumple | Ninguno | `rf36` · cada cambio guarda estado anterior, estado nuevo y fecha-hora ISO (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-37 | Consultar por guía y mostrar ficha completa con línea de tiempo | seguimiento.js | Cumple parcialmente | Completar ficha (urgencia, sobredimensión, responsable, desglose) | `rf37` `p15` · E01 seguimiento: el código se normaliza a mayúsculas y sin espacios (+7) | ✅ Cumple · 16/16 comprobaciones |
| RF-38 | Filtros combinados: estado, sucursal, modalidad, fechas y texto | envios.js | Cumple | Cancelado en filtros históricos | `rf38` · estado + sucursal combinados dan la intersección esperada (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-39 | Ordenar por cualquier columna, asc/desc, con indicación visual | envios.js | Cumple | Añadir aria-sort | `rf39` · ordenar por total: ascendente y luego descendente (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-40 | Paginar con control del tamaño de página | envios.js | Cumple | Ninguno | `rf40` · 5 por página: 5 filas y «Página 1 de N» (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-41 | Eliminar con confirmación previa registrando el motivo | envios.js | Cumple parcialmente | Modal sin resumen; cancelación lógica con estado anterior, fecha y motivo | `rf41` `p9` `p10` · P08 los conteos son consistentes: activos + cancelados + históricos = total (+27) | ✅ Cumple · 50/50 comprobaciones |
| RF-42 | Ocupación por sucursal: paquetes, peso y % de capacidad | inventario.js | Cumple | Excluir cancelados | `rf42` · cada sucursal muestra paquetes, kg y % de su capacidad (sin cancelados) | ✅ Cumple · 1/1 comprobaciones |
| RF-43 | Alerta visible al superar el umbral, no solo por color | inventario.js | Cumple | Ninguno | `rf43` · al superar el umbral aparece una alerta de texto con la sucursal (no solo color) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-44 | Paquetes en bodega por antigüedad con días desde el ingreso | inventario.js | Cumple | '1 día'/'2 días' | `rf44` · P04 «1 día» y «2 días» aparecen y nunca «día(s)» | ✅ Cumple · 1/1 comprobaciones |
| RF-45 | Identificar retenidos (exceden el plazo máximo en bodega) | inventario.js | Cumple parcialmente | Filtro Retenido no filtraba (punto 3) | `rf45` `f3` · esRetenido(): excede el plazo → true; dentro del plazo → false; frío usa su plazo propio (+11) | ✅ Cumple · 12/12 comprobaciones |
| RF-46 | Distribución por tipo de contenido y por sucursal de destino | inventario.js | Cumple | Ninguno | `rf46` · distribución por tipo de contenido (general, frágil, cadena de frío) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-47 | Indicadores operativos: total, por estado, peso, facturado, promedio | app.js | Cumple | Ninguno | `rf47` · total de envíos (sin cancelados) (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-48 | Indicadores ambientales y % en modalidad de baja emisión | app.js | Cumple | Ninguno | `rf48` · emisiones totales estimadas (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-49 | Todas las métricas con map/filter/reduce; sin acumular en variable externa dentro de un ciclo | app.js | Cumple parcialmente | Eliminar acumulador externo (dona) y pasar a reduce | `rf49` · el panel calcula con map / filter / reduce / sort / slice (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-50 | Al menos dos visualizaciones con HTML y CSS puros | app.js / estilos.css | Cumple | Ninguno | `rf50` · gráfico de barras con HTML y CSS puros (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-51 | Panel filtrable por rango de fechas y sucursal | app.js | Cumple parcialmente | Validar rango Desde/Hasta también en el panel | `rf51` `p8` · filtrar por sucursal recalcula los indicadores (+9) | ✅ Cumple · 10/10 comprobaciones |
| RF-52 | Indicadores se actualizan al registrar/modificar/eliminar sin recargar | app.js | Cumple | Ninguno | `rf52` · al registrar un envío el panel sube +1 sin recargar la página (+1) | ✅ Cumple · 2/2 comprobaciones |
| RF-53 | Ranking de las tres sucursales con mejor desempeño ambiental (criterio justificado) | app.js | Cumple | Documentar el criterio en el informe | `rf53` · ranking de las tres sucursales con menor emisión media por envío | ✅ Cumple · 1/1 comprobaciones |
| RF-54 | Tema claro/oscuro/automático persistente | app.js | Cumple | Ninguno | `rf54` · E03 con el sistema en modo oscuro el tema automático se oscurece (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-55 | Exportar toda la operación a JSON descargable | persistencia.js | Cumple | Ninguno | `rf55` · la exportación descarga un .json con clientes, envíos, rutas y configuración | ✅ Cumple · 1/1 comprobaciones |
| RF-56 | Importar JSON validando estructura y advirtiendo el reemplazo | app.js | Cumple | Ninguno | `rf56` · un archivo inválido se rechaza con mensaje y sin tocar los datos (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-57 | Reiniciar con doble confirmación | app.js | Cumple | Ninguno | `rf57` · reiniciar pide dos confirmaciones distintas (+2) | ✅ Cumple · 3/3 comprobaciones |
| RF-58 | Demo con ≥40 envíos, 15 clientes y 5 rutas utilizables | app.js | Cumple parcialmente | 7 envíos 'en ruta' sin ruta y rutas abiertas vacías: generar demo coherente | `rf58` · la demo trae ≥40 envíos, 15 clientes y 5 rutas (+3) | ✅ Cumple · 4/4 comprobaciones |
| RF-59 | Mostrar espacio en localStorage y advertir cerca del límite | app.js | Cumple | Ninguno | `rf59` · muestra el espacio usado en localStorage (KB y % de 5 MB) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RN-01 | Peso facturable = mayor entre real y volumétrico | reglas.js | Cumple | Ninguno | `rf04` · peso volumétrico = L×A×H / divisor del catálogo (+2) | ✅ Cumple · 3/3 comprobaciones |
| RN-02 | Peso mínimo y máximo | validaciones.js | Cumple | Mensaje 'mínimo 0.1 kg' | `rn02` · peso por debajo del mínimo: «El peso mínimo es 0.1 kg.» (+2) | ✅ Cumple · 3/3 comprobaciones |
| RN-03 | Dimensión sobre el límite: requiere autorización y recargo | envios.js | Cumple parcialmente | Responsable obligatorio si la casilla está marcada (punto 1) | `rn03` `f1` · 200 cm es el límite (no excede); 201 cm excede (+27) | ✅ Cumple · 28/28 comprobaciones |
| RN-04 | Bicicleta solo bajo un peso y distancia máximos | reglas.js | Cumple | Ninguno | `rn04` · bicicleta viable hasta 25 kg y 30 km; no con 25.1 kg ni con 31 km | ✅ Cumple · 1/1 comprobaciones |
| RN-05 | Aéreo solo sobre una distancia mínima | reglas.js | Cumple | Ninguno | `rn05` · aéreo solo desde 120 km | ✅ Cumple · 1/1 comprobaciones |
| RN-06 | Frío: solo modalidades refrigeradas y permanencia limitada en bodega | reglas.js / inventario.js | Cumple parcialmente | Exponer en Configuración el límite de días para frío | `rn06` · Configuración expone los días máximos en bodega y los de cadena de frío (+1) | ✅ Cumple · 2/2 comprobaciones |
| RN-07 | Guía única, correlativa, inmutable y no reutilizable | persistencia.js | Cumple | La cancelación conserva la guía | `rf02` `p9` · formato ENV-AAAA-NNNNN (+25) | ✅ Cumple · 26/26 comprobaciones |
| RN-08 | Solo transiciones declaradas | seguimiento.js | Cumple | Ninguno | `rf35` · tabla explícita de transiciones (+2) | ✅ Cumple · 3/3 comprobaciones |
| RN-09 | Envío en ruta o entregado no se edita ni elimina | envios.js | Cumple | Ninguno | `rn09` · un envío en ruta no puede editarse ni cancelarse (botones deshabilitados) (+2) | ✅ Cumple · 3/3 comprobaciones |
| RN-10 | Ruta no acepta envíos que excedan su capacidad | rutas.js | Cumple | Ninguno | `rf25` · la ruta respeta su capacidad en paquetes (el segundo envío se rechaza) (+1) | ✅ Cumple · 2/2 comprobaciones |
| RN-11 | Descuento ecológico no se acumula con recargo por urgencia | reglas.js | Cumple | Ninguno | `rn11` · baja emisión sin urgencia: descuento ecológico del 10 % (+2) | ✅ Cumple · 3/3 comprobaciones |
| RN-12 | Cliente con envíos activos no se elimina; se inactiva | clientes.js | Cumple | Ninguno | `rf13` · un cliente con envíos activos no se elimina y se ofrece inactivarlo (+1) | ✅ Cumple · 2/2 comprobaciones |
| RN-13 | Envío que supera el plazo se marca retenido y aparece como excepción | inventario.js | Cumple parcialmente | esRetenido() reutilizable (punto 3) | `rf45` `f3` · esRetenido(): excede el plazo → true; dentro del plazo → false; frío usa su plazo propio (+11) | ✅ Cumple · 12/12 comprobaciones |
| RN-14 | Factores de emisión con fuente citada y fecha de consulta | informe | Cumple parcialmente | Documentar fuente y fecha en el informe (no verificable en el código) | Revisión manual / documental | ⚠️ Parcial (informe). El documento escrito (sección 8.2) cita las fuentes (GLEC 3.1 y los factores del IMN) con su fecha de consulta, pero los cuatro factores de `datos.json` son parámetros indicativos que no se derivan de ellas con un cálculo trazable; la diferencia de escala se declara en la sección 8.4. Para cerrarlo, recalibrar los factores en `datos.json` con un consumo medido por vehículo. |
| 7.1-a | Cero divitis; estructura semántica header/nav/main/section/article/aside/footer | index.html | Cumple parcialmente | Revisión de uso de div; conservar solo contenedores de maquetación | `sem` · usa header, nav, main, section, article, aside y footer (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.1-b | Formularios con fieldset/legend, autocomplete, type y rangos | index.html | Cumple parcialmente | Formulario de clientes sin fieldset/legend | `form` · todos los controles tienen etiqueta (label/for o aria-label) (+3) | ✅ Cumple · 4/4 comprobaciones |
| 7.1-c | Tablas con thead, tbody, th scope y caption; sin tablas simuladas | index.html | Cumple parcialmente | Listado de clientes como tabla real | `tabla` · toda tabla estática tiene caption, thead, tbody y th con scope (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.1-d | A11y: aria-*, label/for, contraste 4.5:1 y 3:1 | index.html / estilos.css | Cumple parcialmente | Medir contraste de tokens en ambos temas | `contraste` · todos los pares texto/fondo de los dos temas cumplen WCAG AA (4.5:1 texto, 3:1 componentes) | ✅ Cumple · 1/1 comprobaciones |
| 7.1-e | Regiones dinámicas con aria-live | index.html | Cumple parcialmente | aria-live en comparación, ficha de seguimiento y listas | `live` · las regiones dinámicas declaran aria-live (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.1-f | Registro completable solo con teclado, con foco visible | envios.js | Cumple | Verificar con prueba de teclado | `teclado` · todos los campos de la solicitud se alcanzan con Tab y se llenan con el teclado (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.1-g | Un h1 por vista y sin saltos de nivel | index.html | Cumple | Verificar por script | `h1` · cada una de las 8 vistas tiene exactamente un h1 (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.1-h | <noscript> que informa y explica qué hacer | index.html | Cumple | Ninguno | `noscript` · existe <noscript> que explica que se requiere JavaScript y qué hacer | ✅ Cumple · 1/1 comprobaciones |
| 7.1-i | HTML válido en el validador del W3C | index.html | Cumple parcialmente | No hay validador oficial disponible sin red: lint estructural propio | Revisión manual / documental | ⚠️ No verificable aquí. No hay acceso al validador del W3C sin red. Se hizo una revisión estructural propia (etiquetas cerradas y anidadas, ids únicos, `for`/`id`, sin atributos obsoletos). Validar `index.html` en validator.w3.org antes de entregar. |
| 7.2-a | CSS Grid para la estructura global y Flexbox para componentes | estilos.css | Cumple | Ninguno | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-b | Mobile-First: base angosta y media queries hacia arriba, ≥3 puntos de quiebre | estilos.css | Cumple parcialmente | Consolidar con min-width únicamente | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-c | Propiedades personalizadas en :root; nomenclatura limpia y documentada | estilos.css | Cumple parcialmente | Documentar el sistema de tokens | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-d | Tema claro/oscuro con prefers-color-scheme + control manual persistente | estilos.css | Cumple | Ninguno | `rf54` · E03 con el sistema en modo oscuro el tema automático se oscurece (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.2-e | Escala tipográfica, de espaciado y paleta como variables; sin valores sueltos | estilos.css | No cumple | Tokenizar todos los colores y espaciados | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-f | Estados :hover, :focus-visible, :disabled e :invalid | estilos.css | Cumple | Ninguno | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-g | Animaciones anuladas con prefers-reduced-motion | estilos.css | Cumple | Una sola regla, sin !important | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.2-h | Hoja de estilos de impresión para ficha del envío y guía de despacho | impresion.css | No cumple | Imprimía 4 páginas y no existía guía de despacho | `print` · P13 la ficha se imprime en A4 (+5) | ✅ Cumple · 6/6 comprobaciones |
| 7.2-i | Sin código muerto, sin reglas duplicadas, sin !important | estilos.css | No cumple | Reescribir el CSS sin duplicados ni !important | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.3-a | Todo se actualiza por DOM sin recargar la página | app.js | Cumple | Importar/demo/reiniciar recargan por diseño de respaldo | `rf52` · al registrar un envío el panel sube +1 sin recargar la página (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.3-b | Actualización dirigida: insertar la fila nueva sin reconstruir la tabla | envios.js | No cumple | Insertar/actualizar la fila; redibujo total solo en filtrar/ordenar | `dirigida` · E02 7.3: registrar inserta solo la fila nueva (las filas existentes no se redibujan) (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.3-c | Delegación de eventos: un solo escuchador en el contenedor de la tabla | envios.js | Cumple | Ninguno | `deleg` · la tabla de envíos tiene un único escuchador delegado (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.3-d | Persistencia: JSON.stringify/parse en try/catch, datos ausentes o corruptos, versión de esquema | persistencia.js | Cumple | Ninguno | `persist` · JSON.parse y JSON.stringify están dentro de try/catch (+5) | ✅ Cumple · 6/6 comprobaciones |
| 7.3-e | Uso de map/filter/reduce/find/some/sort | app.js | Cumple | Ninguno | `rf49` · el panel calcula con map / filter / reduce / sort / slice (+3) | ✅ Cumple · 4/4 comprobaciones |
| 7.3-f | Inmutabilidad: funciones de cálculo no modifican sus argumentos | reglas.js | Cumple | Prueba que lo demuestra | `inmut` · las funciones de cálculo aceptan argumentos congelados (Object.freeze profundo) sin lanzar err… (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.3-g | Asincronía con fetch/async-await, try/catch, carga, error y reintento | catalogo.js | Cumple | Ninguno | `rf17` · sin red y sin copia local: mensaje de error y botón «Reintentar» (no pantalla en blanco) (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.3-h | Módulos ES6 con responsabilidad única | js/ | Cumple | Ninguno | `modulos` · un único script type=module como punto de entrada y sin scripts en línea (+3) | ✅ Cumple · 4/4 comprobaciones |
| 7.3-i | Funciones puras para tarifa y emisiones (sin DOM ni localStorage) | reglas.js | Cumple | Prueba que lo demuestra | `puras` · reglas.js no usa document, window, localStorage, fetch ni Date.now() implícito sin parámetro d… (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.3-j | Validación en dos niveles: HTML5 + reglas de negocio | validaciones.js | Cumple | Ninguno | `rf07` · cada error trae campo y mensaje específico (se muestran todos a la vez) (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.3-k | Ninguna acción del usuario produce error no atendido en consola | js/ | Cumple parcialmente | Error de patrón en consola | `consola` · ninguna acción (válida o inválida) produce errores en la consola ni excepciones sin atender | ✅ Cumple · 1/1 comprobaciones |
| 7.3-l | Sin frameworks, librerías ni CDN | index.html | Cumple | Verificar por script | `cdn` · index.html no carga nada externo (scripts, estilos ni fuentes) (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.4-a | Estructura de carpetas documentada en README | README.md | Cumple | Actualizar README | `readme` · el README documenta la estructura de carpetas y cada archivo del proyecto (+1) | ✅ Cumple · 2/2 comprobaciones |
| 7.4-b | Peso total < 500 KB sin datos de demostración | proyecto | Cumple | Medir | `peso` · E05 la aplicación pesa menos de 500 KB | ✅ Cumple · 1/1 comprobaciones |
| 7.4-c | Imágenes optimizadas; íconos SVG o caracteres | index.html | Cumple | No hay imágenes | `peso` · E05 la aplicación pesa menos de 500 KB | ✅ Cumple · 1/1 comprobaciones |
| 7.4-d | Tipografía del sistema | estilos.css | Cumple | Ninguno | `css` · sin !important (+13) | ✅ Cumple · 14/14 comprobaciones |
| 7.4-e | Funcionamiento sin conexión para la operación ya cargada | app.js | Cumple | Ninguno (opcional: Service Worker) | `offline` · sin conexión se puede registrar y consultar la operación ya cargada (+2) | ✅ Cumple · 3/3 comprobaciones |
| 7.4-f | Código comentado en español donde la intención no sea evidente | js/ | Cumple parcialmente | Reformatear código minificado y comentar reglas | `legible` · todo módulo abre con un comentario que explica su responsabilidad (+4) | ✅ Cumple · 5/5 comprobaciones |
| 7.4-g | Nombres en español y consistentes | js/ | Cumple | Ninguno | Revisión manual / documental | ✅ Cumple (revisión manual). Funciones, variables y archivos están en español y siguen el mismo criterio (`calcularTarifa`, `esRetenido`, `sucursalOrigen`, …). |
| 8-a | Modelo de datos con las cuatro entidades y atributos mínimos | persistencia.js | Cumple parcialmente | Los nombres difieren del ejemplo; se conservan por compatibilidad. Documentar el mapeo | Revisión manual / documental | ✅ Cumple con diferencias documentadas. Las cuatro entidades existen con todos sus atributos; algunos nombres difieren del ejemplo (p. ej. `pesoReal` y no `pesoRealKg`) y se conservaron para no romper los datos guardados. Correspondencia completa en `docs/MODELO_DATOS.md`. |
| OE-9 | Git: ramas, PR revisados, commits distribuidos, bitácora | repositorio | Cumple parcialmente | NO VERIFICABLE desde el ZIP; plantilla de bitácora en README | Revisión manual / documental | ⚠️ No verificable desde el código. Ramas, pull requests revisados, commits repartidos y bitácora dependen del repositorio Git del equipo. El README trae la plantilla de bitácora. |
| OE-10 | Informe técnico, manual de usuario, PPT, bitácoras firmadas | documentos | Cumple parcialmente | NO VERIFICABLE desde el código; ver reporte | Revisión manual / documental | ⚠️ Parcial (documentos). El manual de usuario ya está hecho (`docs/MANUAL_DE_USUARIO.docx`, `.pdf` y `.md`, con capturas en `docs/manual/`). El informe técnico en Word (APA 7) está en `docs/`. Siguen fuera del código: la presentación, las bitácoras firmadas y la defensa oral. |

## Pruebas de aceptación del encargo (puntos 1–31)

| Grupo | Comprobaciones | Resultado | Primera comprobación |
| --- | --- | --- | --- |
| P01 | 15 | ✅ 15/15 | cambiar «remitente» invalida la comparación |
| P02 | 11 | ✅ 11/11 | largo 210 cm sin marcar autorización no compara |
| P03 | 7 | ✅ 7/7 | (escritorio 1280px) tres grupos iguales en una fila |
| P04 | 11 | ✅ 11/11 | el filtro de estado solo ofrece Todos / En bodega / Asignado a ruta / En ruta / Retenido |
| P05 | 5 | ✅ 5/5 | al abrir el formulario de clientes no hay campos en rojo ni mensajes |
| P06 | 3 | ✅ 3/3 | campos obligatorios solo con espacios no se guardan |
| P07 | 8 | ✅ 8/8 | editar con «correo» inválido no guarda |
| P08 | 22 | ✅ 22/22 | los conteos son consistentes: activos + cancelados + históricos = total |
| P09 | 6 | ✅ 6/6 | segundo reenvío activo bloqueado con el mensaje «Ya existe un reenvío activo: ENV-…» |
| P10 | 8 | ✅ 8/8 | Bicicleta de carga: capacidad máxima 40 kg tomada de datos.json |
| P11 | 7 | ✅ 7/7 | la búsqueda por guía ofrece resultado de tipo Guía |
| P12 | 8 | ✅ 8/8 | Hasta.min = Desde |
| P13 | 6 | ✅ 6/6 | la ficha se imprime en A4 |
| P14 | 1 | ✅ 1/1 | node --check pasa en los 16 archivos JS |
| E01 | 8 | ✅ 8/8 | seguimiento: el código se normaliza a mayúsculas y sin espacios |
| E02 | 4 | ✅ 4/4 | la comparación muestra resumen de la solicitud, menor emisión y desglose por componente |
| E03 | 3 | ✅ 3/3 | con el sistema en modo oscuro el tema automático se oscurece |
| E04 | 2 | ✅ 2/2 | configuración fuera de rango se rechaza y conserva el valor |
| E05 | 3 | ✅ 3/3 | sin scripts ni estilos externos (CDN) |
| E06 | 3 | ✅ 3/3 | 390px: ninguna vista desborda horizontalmente |

## Requisitos abiertos o no verificables

| N.º | Situación | Qué falta |
| --- | --- | --- |
| RN-14 | Parcial (informe) | El documento escrito (sección 8.2) cita las fuentes (GLEC 3.1 y los factores del IMN) con su fecha de consulta, pero los cuatro factores de `datos.json` son parámetros indicativos que no se derivan de ellas con un cálculo trazable; la diferencia de escala se declara en la sección 8.4. Para cerrarlo, recalibrar los factores en `datos.json` con un consumo medido por vehículo. |
| 7.1-i | No verificable aquí | No hay acceso al validador del W3C sin red. Se hizo una revisión estructural propia (etiquetas cerradas y anidadas, ids únicos, `for`/`id`, sin atributos obsoletos). Validar `index.html` en validator.w3.org antes de entregar. |
| OE-9 | No verificable desde el código | Ramas, pull requests revisados, commits repartidos y bitácora dependen del repositorio Git del equipo. El README trae la plantilla de bitácora. |
| OE-10 | Parcial (documentos) | El manual de usuario ya está hecho (`docs/MANUAL_DE_USUARIO.docx`, `.pdf` y `.md`, con capturas en `docs/manual/`). El informe técnico en Word (APA 7) está en `docs/`. Siguen fuera del código: la presentación, las bitácoras firmadas y la defensa oral. |

## Decisiones que el equipo debe conocer

1. **`cancelado` es un séptimo estado terminal.** RF-34 enumera seis estados; RF-41 exige eliminar con motivo y RN-07 que la guía no se reutilice. La baja lógica (`estado: "cancelado"` + motivo, fecha y estado anterior) cumple ambas; no forma parte del ciclo de vida y las transiciones lo tratan como estado final.
2. **`DIMENSION_MAX_ABSOLUTA_CM = 300`** (tope físico por dimensión) está en `reglas.js` porque ya existía como `max="300"` en el formulario. El límite institucional (200 cm) sigue saliendo de `datos.json`. Si el profesor lo prefiere, puede moverse al catálogo.
3. **Nombres de atributos**: se conservaron los de la v2.2.0 para no romper los datos guardados; la correspondencia con el ejemplo del enunciado está en `docs/MODELO_DATOS.md`.
4. **RF-26 (ahorro por consolidación).** La línea base es una «furgoneta individual» por envío (un viaje por paquete) frente a un solo viaje consolidado. El catálogo no traía esa referencia, así que se declaró en `datos.json` (`referencias.furgonetaIndividual`) **reutilizando datos que ya estaban allí**: el factor de emisión del vehículo de combustión terrestre (`consolidado`, 0,09) y la capacidad de la furgoneta del catálogo (`electrico`, 800 kg). La app informa kg CO₂e, porcentaje, viajes y km evitados. Si el equipo consigue un factor propio con fuente (RN-14), basta con editar esos dos números.
5. **RF-31 (descuento ecológico).** Reciben el descuento (10 % del subtotal, `descuentoEcologico`) las modalidades de **baja emisión** y la **consolidada** (marca `consolidada: true` en `datos.json`), porque consolidar reduce viajes y emisiones por paquete aun con vehículos de combustión. Sigue sin acumularse con el recargo por urgencia (RN-11). Efecto: el camión consolidado cuesta 10 % menos que antes.
6. **Cambios en `datos/datos.json`**: solo se agregaron dos campos opcionales (`consolidada` y `referencias.furgonetaIndividual`). Las tarifas, capacidades, sucursales, distancias, recargos y reglas institucionales no cambiaron. Un catálogo anterior sin esos campos sigue funcionando (el camión consolidado se reconoce por su código y el ahorro usa el vehículo de la ruta como línea base).
7. **Sin cambios en**: la clave de `localStorage` (`ecoruta_estado_v5`) ni en el formato de las guías ya guardadas; los envíos registrados antes de este cambio conservan la tarifa con la que se cobraron.
