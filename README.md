# EcoRuta - Green Logistics

Aplicacion frontend sin dependencias externas para registrar envios, calcular tarifas y emisiones, consolidar rutas, mantener trazabilidad, controlar inventario y respaldar la operacion.

## Ejecucion
1. Abra esta carpeta en Visual Studio Code.
2. Ejecute `index.html` con la extension **Live Server** o cualquier servidor HTTP local.
3. No utilice `file://`, porque `datos/datos.json` se consume con `fetch`.
4. En **Configuracion**, use `Cargar demo 40/15/5` para probar volumen realista.

## Estructura
- `index.html`: vistas semanticas M1-M9.
- `css/estilos.css`: sistema visual responsive, temas y accesibilidad.
- `css/impresion.css`: ficha imprimible.
- `datos/datos.json`: catalogo institucional.
- `js/app.js`: arranque, navegacion, panel y configuracion.
- `js/persistencia.js`: localStorage versionado y respaldos.
- `js/reglas.js`: funciones puras de tarifa, peso y emisiones.
- `js/validaciones.js`: validaciones de catalogo, respaldo y negocio.
- `js/utilidades.js`: utilidades reutilizables.
- `js/modulos/`: clientes, envios, rutas, seguimiento e inventario.

## Reglas implementadas
- Guia unica correlativa e inmutable.
- Peso facturable mayor entre real y volumetrico.
- Modalidades viables por capacidad, distancia, refrigeracion y sucursal.
- Sobredimension con autorizacion y recargo.
- Seis estados y transiciones controladas.
- Consolidacion con capacidad por peso/cantidad y ahorro ambiental.
- Retencion por permanencia en bodega.
- Respaldo, importacion validada, doble confirmacion y medicion de almacenamiento.

## Bitacora tecnica
Complete aqui los aportes reales de cada integrante y enlace los pull requests. No atribuya trabajo que no haya sido realizado por esa persona.
