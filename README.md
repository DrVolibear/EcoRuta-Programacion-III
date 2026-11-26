# EcoRuta v2.3.0 · Logística sostenible

Aplicación web de una sola página para registrar envíos, calcular tarifas y emisiones, consolidar rutas, dar seguimiento por guía, controlar el inventario de bodega y respaldar la operación.

Proyecto final de **Programación III** (Universidad Internacional de las Américas). Tecnologías: **HTML5, CSS3 y JavaScript ES2022 con módulos nativos**. Sin frameworks, sin bibliotecas, sin CDN, sin `package.json`.

## Cómo ejecutarla

1. Abra la carpeta del proyecto en Visual Studio Code.
2. Inicie la extensión **Live Server** (o cualquier servidor HTTP local, por ejemplo `python3 -m http.server`).
3. No abra `index.html` con `file://`: el catálogo `datos/datos.json` se descarga con `fetch` y los módulos ES exigen HTTP.
4. En **Configuración → Cargar demo** se generan 15 clientes, 43 envíos en todos los estados y 5 rutas (3 abiertas, 2 en ruta).

## Estructura de carpetas

```text
index.html                 Estructura semántica: 8 vistas (M1–M9), diálogos y zona de impresión
css/
  estilos.css              Diseño mobile-first, tokens en :root, tema claro/oscuro, accesibilidad
  impresion.css            Ficha del envío y guía de despacho en A4 (media="print")
datos/
  datos.json               Catálogo institucional: sucursales, distancias, modalidades, tarifas,
                           recargos y reglas, más la furgoneta de referencia del RF-26.
                           Es la única fuente de capacidades, tarifas y factores.
js/
  app.js                   Punto de entrada: arranque, navegación, panel, búsqueda global, configuración
  catalogo.js              Carga del catálogo con fetch/async-await, copia local y distancias
  persistencia.js          localStorage versionado (clave ecoruta_estado_v5), migración y respaldos
  reglas.js                Funciones PURAS de negocio: estados, tarifa, emisiones, retención
  validaciones.js          Validación del catálogo, de los respaldos y de las solicitudes de envío
  formularios.js           Validación nativa + mensajes en español, rangos de fechas, teléfono
  modales.js               Diálogos <dialog>: confirmación y cancelación segura con motivo
  plantillas.js            HTML reutilizable: ficha del envío, desglose de tarifa, línea de tiempo
  impresion.js             Impresión de la ficha del envío y de la guía de despacho
  utilidades.js            Funciones auxiliares (escape de HTML, fechas, texto normalizado)
  demo.js                  Generador de datos de demostración coherentes
  modulos/
    clientes.js            M2 · Clientes: alta, edición, búsqueda, historial, inactivar y cancelar
    envios.js              M1/M4/M5 · Solicitud, comparación de modalidades, tabla de envíos
    rutas.js               M4 · Rutas de despacho, consolidación, cierre y guía de despacho
    seguimiento.js         M6 · Consulta por guía, línea de tiempo y cambios de estado
    inventario.js          M7 · Ocupación, retenidos, ingreso a bodega y distribución
docs/
  MATRIZ_CUMPLIMIENTO.md   Requisito por requisito: estado inicial, cambio, prueba y evidencia final
  MODELO_DATOS.md          Entidades, atributos y su correspondencia con el enunciado
  POLITICA_ECOLOGICA.md    Política de RF-26 (ahorro por consolidación) y RF-31 (descuento ecológico)
  MANUAL_DE_USUARIO.md     Manual de usuario paso a paso (también en .docx y .pdf; capturas en docs/manual/)
pruebas/                   Verificación automatizada (Playwright, solo para desarrollo): no se carga desde
                           index.html ni forma parte de la aplicación. Ver pruebas/LEEME.md
CHANGELOG.md               Historial de versiones
.prettierrc                Formato de código para el editor (opcional; no es una dependencia)
.gitignore                 Archivos que Git ignora
LICENSE                    MIT
```

Cada módulo de `js/modulos/` tiene una sola responsabilidad de negocio; `reglas.js` y `validaciones.js` no tocan el DOM ni `localStorage`, por eso se pueden probar solos.

## Reglas de negocio implementadas

- **Guía** `ENV-AAAA-NNNNN`: única, correlativa, inmutable y nunca reutilizada (ni siquiera tras cancelar).
- **Peso facturable** = el mayor entre el peso real y el volumétrico (L×A×H ÷ divisor del catálogo).
- **Modalidades viables** según peso, distancia, sucursal de origen, bicicleta (≤ 25 kg y ≤ 30 km), aéreo (≥ 120 km) y cadena de frío (solo modalidades refrigeradas).
- **Sobredimensión**: más de 200 cm en una dimensión exige marcar *Sobredimensión autorizada* e indicar el responsable; añade el recargo del catálogo. Se guarda en el envío, en el detalle, en el seguimiento y en el historial.
- **Tarifa** = (base de la sucursal + peso × tarifa/kg + distancia × tarifa/km) × factor de la modalidad, más recargos (urgente, frágil, frío, sobredimensión), menos el descuento ecológico.
- **Descuento ecológico (RF-31)**: 10 % del subtotal para las modalidades de **baja emisión** (bicicleta, furgón eléctrico) y para la **consolidada** (camión consolidado), porque consolidar reduce viajes y emisiones por paquete aun con vehículos de combustión. No se acumula con el recargo por urgencia (RN-11).
- **Emisiones** = km × factor de emisión × proporción de la capacidad usada (mínimo 10 %).
- **Ahorro por consolidación (RF-26)** = emisiones de despachar cada envío en su propia furgoneta (un viaje por envío) − emisiones de un solo viaje consolidado. La ruta muestra kg CO₂e, porcentaje, viajes y km evitados. La «furgoneta individual» se declara en `datos.json` (`referencias.furgonetaIndividual`). Justificación completa en `docs/POLITICA_ECOLOGICA.md`.
- **Estados** `registrado → en bodega → asignado a ruta → en ruta → entregado` y `devuelto`, con una tabla explícita de transiciones y un historial con fecha, hora y estado anterior.
- **Cancelación lógica** (`cancelado`): conserva la guía, el historial, el motivo (≥ 10 caracteres), la fecha y el estado anterior. Un envío en ruta o entregado no puede cancelarse (RN-09).
- **Retenidos**: un paquete en bodega que excede el plazo (3 días; 1 día para cadena de frío, configurable) se marca con `esRetenido()` y se resalta en el inventario.
- **Rutas**: capacidad máxima tomada de `datos.json` (bicicleta 40 kg, furgón 800 kg, camión 5 000 kg, aéreo 1 500 kg), asignación solo de envíos compatibles, retiro antes de la salida y cierre en bloque. Al cerrar se guarda el resultado de la consolidación (ahorro, porcentaje, viajes y km evitados) y se reparte entre los envíos (RF-48).

## Datos, persistencia y funcionamiento sin conexión

- Los datos de operación viven en `localStorage` bajo la clave **`ecoruta_estado_v5`** (versión de esquema 5). Las claves de versiones anteriores se migran solas; los envíos que la v2.2.0 «eliminaba» pasan a **Cancelados** con su motivo.
- El catálogo validado se guarda en una copia local; si la red falla, la aplicación sigue con esa copia. Si no hay copia, muestra el error y un botón **Reintentar**.
- Con la operación ya cargada, la aplicación funciona sin conexión (registrar, consultar, despachar).
- **Configuración** permite exportar/importar respaldos JSON (con validación y advertencia de reemplazo), cargar la demo, ver el espacio usado y reiniciar con doble confirmación.

## Accesibilidad y diseño

HTML semántico, un `h1` por vista, `fieldset/legend`, `aria-live`, `aria-sort`, foco visible, navegación completa con teclado, contraste WCAG AA verificado en los dos temas (claro/oscuro/automático), `prefers-reduced-motion` y diseño que no desborda horizontalmente a 390, 820 y 1280 px. El CSS no usa `!important`.

## Cómo se verificó

Las pruebas **no forman parte de la aplicación** (la aplicación no tiene dependencias, ni `package.json`). Están en la carpeta `pruebas/` y se ejecutan con Playwright y Chromium instalados aparte (instrucciones en `pruebas/LEEME.md`):

```bash
node pruebas/pruebas_v221.mjs   # 141 comprobaciones de aceptación (puntos 1–31 del encargo)
node pruebas/pruebas_matriz.mjs # 234 comprobaciones por requisito RF/RN/7.x
node pruebas/humo.mjs           # prueba de humo
```

El resultado de cada requisito está en `docs/MATRIZ_CUMPLIMIENTO.md`.

## Pendientes que requieren decisión del equipo

- **RN-14** (cubierto en parte): el documento escrito cita las fuentes y la fecha de consulta de los factores de emisión y declara que son indicativos (menores que los valores de referencia GLEC). Falta decidir si el equipo los recalibra; hacerlo cambiaría todas las cifras de emisiones.
- **7.1**: validar `index.html` en el validador del W3C (requiere conexión; se hizo una revisión estructural propia).
- **RF-26**: la furgoneta individual reutiliza datos del catálogo (factor del camión de combustión y capacidad de la furgoneta). Si el equipo consigue un factor propio con fuente citada, basta con editar `referencias.furgonetaIndividual` en `datos.json`.
- **Entregables fuera del código**: el documento escrito y la presentación se entregan en el campus virtual; el manual de usuario está en `docs/`.

## Bitácora técnica (completar con aportes reales)

| Integrante | Rama | Pull requests revisados | Aporte |
| ---------- | ---- | ----------------------- | ------ |
|            |      |                         |        |

## Licencia

MIT License, 2026 Equipo EcoRuta.
