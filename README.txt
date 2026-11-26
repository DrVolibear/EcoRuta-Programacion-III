ECORUTA v2.3.0  ·  Logística sostenible
=====================================

CÓMO EJECUTARLA
1. Abra la carpeta con Visual Studio Code.
2. Inicie Live Server y abra index.html desde ahí (también sirve cualquier servidor HTTP local).
   No use file://: datos/datos.json se carga con fetch y los módulos ES necesitan HTTP.
3. En Configuración use «Cargar demo» para crear 15 clientes, 43 envíos y 5 rutas de ejemplo.

DATOS
- La operación se guarda en localStorage con la clave ecoruta_estado_v5 (no cambia respecto a v2.2.0).
- Las versiones anteriores se migran solas; los envíos «eliminados» pasan a Cancelados con su motivo.
- Configuración permite exportar/importar respaldos, ver el espacio usado y reiniciar con doble confirmación.

IMPRESIÓN
- La ficha del envío se imprime desde «Ver detalles → Imprimir ficha» (A4).
- La guía de despacho se imprime desde la tarjeta de cada ruta («Imprimir guía»).

DOCUMENTACIÓN
- README.md                    Estructura de carpetas, reglas y pendientes.
- CHANGELOG.md                 Historial de versiones.
- docs/MATRIZ_CUMPLIMIENTO.md  Cumplimiento del enunciado requisito por requisito, con su prueba.
- docs/MODELO_DATOS.md         Entidades y atributos, y su relación con el enunciado.
- docs/POLITICA_ECOLOGICA.md   Política de RF-26 (ahorro por consolidación) y RF-31 (descuento ecológico).
- docs/MANUAL_DE_USUARIO.*     Manual de usuario paso a paso, con capturas (.docx, .pdf y .md).

SIN DEPENDENCIAS
HTML5 + CSS3 + JavaScript (módulos ES). No hay frameworks, bibliotecas, CDN ni package.json.
