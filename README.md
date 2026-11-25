# EcoRuta v2.1.0 - Green Logistics

Aplicación frontend sin dependencias externas para registrar envíos, calcular tarifas y emisiones, consolidar rutas, mantener trazabilidad, controlar inventario y respaldar la operación.

## Ejecución
1. Abra la carpeta en Visual Studio Code.
2. Use la extensión **Live Server** o cualquier servidor HTTP local.
3. No abra `index.html` con `file://`, porque `datos/datos.json` se consume con `fetch`.
4. En **Configuración**, use **Cargar demo** para crear 40 envíos, 15 clientes y 5 rutas.

## Estructura
- `index.html`: vistas semánticas M1-M9.
- `css/estilos.css`: diseño responsive, temas y accesibilidad.
- `css/impresion.css`: ficha A4 imprimible.
- `datos/datos.json`: catálogo institucional validado.
- `js/app.js`: arranque, navegación, panel y configuración.
- `js/persistencia.js`: localStorage versionado v5, migración y respaldos.
- `js/reglas.js`: funciones puras de tarifa, peso y emisiones.
- `js/validaciones.js`: validación estricta de catálogo, respaldos y negocio.
- `js/utilidades.js`: utilidades reutilizables.
- `js/modulos/`: clientes, envíos, rutas, seguimiento e inventario.

## Reglas implementadas
- Guía única, correlativa, inmutable y no reutilizable.
- Peso facturable como el mayor entre peso real y volumétrico.
- Modalidades viables por capacidad, distancia, refrigeración y sucursal.
- Cadena de frío solo con modalidad refrigerada y retención máxima diferenciada.
- Sobredimensión con autorización y recargo.
- Seis estados y transiciones controladas con historial.
- Rutas con capacidad por peso/cantidad, integridad de referencias y ahorro ambiental.
- Antigüedad desde el ingreso físico a bodega.
- Respaldo, importación validada, resumen previo y doble confirmación de reinicio.

## Datos y ejecución sin conexión
El catálogo se guarda en caché local después de una carga correcta. La aplicación puede recuperar esa copia cuando la red no está disponible. Los datos de operación se almacenan bajo `ecoruta_estado_v5`, con migración automática desde versiones anteriores.

## Licencia
MIT License, 2026 Equipo EcoRuta.

## Bitácora técnica
Complete aquí únicamente los aportes reales de cada integrante y los enlaces a pull requests revisados.
