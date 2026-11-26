# Pruebas de EcoRuta v2.3.0

Estas pruebas **no forman parte de la aplicación**: no se cargan desde `index.html` y la aplicación no tiene dependencias. Sirven para demostrar que cada requisito se cumple y se pueden repetir en cualquier momento.

## Qué necesita

- Node.js 20 o superior.
- Playwright con Chromium: `npm i -D playwright` y `npx playwright install chromium` (en una carpeta de desarrollo, **no** dentro del proyecto).
- Solo para las pruebas de impresión: `pdfinfo` y `pdftotext` (paquete *poppler-utils*; en Windows, `choco install poppler`).
- Python 3 (solo para la verificación de contraste).

## Cómo ejecutarlas

Desde la raíz del repositorio (la carpeta que contiene `index.html` y esta carpeta `pruebas/`):

```text
index.html, css/, js/, datos/ …   ← la aplicación
pruebas/                          ← estas pruebas
```

```bash
node pruebas/humo.mjs            .   # carga, 8 vistas y demo (11 comprobaciones)
node pruebas/pruebas_v221.mjs    .   # aceptación del encargo: puntos 1–31 (141)
node pruebas/pruebas_matriz.mjs  .   # una o más comprobaciones por requisito (234)
python3 pruebas/contraste.py     .   # contraste WCAG AA de los dos temas
node pruebas/generar_matriz.mjs  .   # regenera docs/MATRIZ_CUMPLIMIENTO.md
RAIZ=. node pruebas/capturas_manual.mjs   # capturas del manual de usuario
bash pruebas/construir_manual.sh .         # manual en .docx y .pdf
node pruebas/medicion.mjs                   # cifras de rendimiento (escribe en la carpeta temporal del sistema)
node pruebas/simulacion.mjs                 # simulación de consolidación (idem)
```

Cada script levanta su propio servidor estático (sin dependencias) y abre la aplicación en un Chromium real. Si no se indica la carpeta, se usa la carpeta superior a `pruebas/`.

## Archivos

| Archivo | Para qué sirve |
| --- | --- |
| `lib.mjs` | Servidor estático, apertura de la app y registro de resultados |
| `humo.mjs` | Prueba de humo |
| `pruebas_v221.mjs` | Grupos P01–P14 (puntos prioritarios y correcciones) y E01–E06 (extras) |
| `pruebas_matriz.mjs` | Comprobaciones etiquetadas `[rf01]`, `[rn03]`, `[css]`… una por requisito |
| `matriz.mjs` | Los 113 requisitos con su estado inicial, cambio requerido y prueba |
| `generar_matriz.mjs` | Cruza `matriz.mjs` con los resultados y escribe la matriz de cumplimiento |
| `contraste.py` | Lee los colores de `css/estilos.css` y mide el contraste |
| `capturas.mjs` | Capturas de pantalla de las vistas (claro/oscuro, 390/820/1280 px) |
| `capturas_manual.mjs` | Genera las capturas de `docs/manual/` con los datos de demostración |
| `construir_manual.sh`, `construir_manual.py` | Convierten `docs/MANUAL_DE_USUARIO.md` en `.docx` (Times New Roman 12, A4) y `.pdf`; requieren pandoc, python-docx y LibreOffice |
| `medicion.mjs` | Mide peticiones, bytes, tiempos de carga y nodos del DOM (sección 9.3 del documento escrito) |
| `simulacion.mjs` | Simula la consolidación con las funciones reales de `js/reglas.js` (sección 10) |
| `kpi.mjs`, `datos_informe.mjs` | Leen los indicadores y las emisiones por sucursal de la demostración (sección 11.4) |
| `resultados_pruebas.json`, `resultados_matriz.json` | Último resultado de cada comprobación |
