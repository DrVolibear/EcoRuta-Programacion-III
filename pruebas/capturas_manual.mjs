// Genera las capturas del manual de usuario (docs/manual/*.png) con datos de demostración.
// Uso: RAIZ=<proyecto> SALIDA=<carpeta> node capturas_manual.mjs
import { chromium, servir, abrir, raizPorDefecto } from "./lib.mjs";
import fs from "node:fs";
const RAIZ = process.env.RAIZ || raizPorDefecto();
const SALIDA = process.env.SALIDA || `${RAIZ}/docs/manual`;
const PUERTO = Number(process.env.PUERTO || 8806);
const URL = `http://127.0.0.1:${PUERTO}/`;
fs.mkdirSync(SALIDA, { recursive: true });
const srv = await servir(RAIZ, PUERTO);
const browser = await chromium.launch();

// Estado de demostración generado por la propia aplicación
let demo;
{
  const { page, ctx } = await abrir(browser, URL);
  await page.click('[data-vista="configuracion"]');
  await Promise.all([
    page.waitForEvent("load"),
    (async () => { await page.click("#cargarDemo"); await page.click('#dialogoConfirmacion button[value="confirm"]'); })(),
  ]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  demo = await page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5")));
  await ctx.close();
}

const ir = async (page, v) => {
  const b = page.locator(`.lateral [data-vista="${v}"]`);
  if (!(await b.isVisible())) await page.click("#btnMenu");
  await b.click();
  await page.waitForTimeout(200);
};
const foto = async (page, nombre, opciones = {}) => {
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
  console.log("captura", nombre);
};
const elemento = async (page, selector, nombre, relleno = 8) => {
  const loc = page.locator(selector).first();
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const caja = await loc.boundingBox();
  await page.screenshot({
    path: `${SALIDA}/${nombre}.png`,
    fullPage: true,
    clip: { x: Math.max(0, caja.x - relleno), y: Math.max(0, caja.y + (await page.evaluate(() => scrollY)) - relleno), width: caja.width + relleno * 2, height: caja.height + relleno * 2 },
  });
  console.log("captura", nombre);
};

const { page, ctx, errores } = await abrir(browser, URL, { ancho: 1280, alto: 800, estadoInicial: demo });

// 01 Panel
await foto(page, "01_panel", { fullPage: true });

// 02 Búsqueda global
await page.fill("#busquedaGlobal", demo.envios[3].codigoGuia.slice(0, 11));
await page.waitForTimeout(300);
await foto(page, "02_busqueda_global", { clip: { x: 0, y: 0, width: 1280, height: 330 } });
await page.fill("#busquedaGlobal", "");
await page.keyboard.press("Escape");

// 03 Clientes
await ir(page, "clientes");
await foto(page, "03_clientes", { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1250 } });

// 04 Registro: formulario lleno
await ir(page, "registro");
await page.selectOption("#remitente", { index: 1 });
await page.selectOption("#destinatario", { index: 2 });
await page.selectOption("#origen", "SJO-01");
await page.selectOption("#destino", "ALA-01");
await page.fill("#peso", "30");
await page.fill("#largo", "40");
await page.fill("#ancho", "30");
await page.fill("#alto", "25");

// 05 Comparación de modalidades (se abre el desglose de la opción consolidada)
await page.click("#btnComparar");
await page.waitForTimeout(300);
for (const d of await page.locator("#comparacion details[open] > summary").all()) await d.click();
await page.evaluate(() => window.scrollTo(0, 0));
await foto(page, "04_registro_formulario", { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1000 } });
{
  const cajas = await page.locator("#comparacion .opcion").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, w: r.width, h: r.height }; }));
  const x = cajas[0].x - 8, y = cajas[0].y - 8;
  const fin = cajas.at(-1);
  await foto(page, "05_comparacion_modalidades", { fullPage: true, clip: { x, y, width: cajas[0].w + 16, height: fin.y + fin.h - cajas[0].y + 16 } });
}
const consolidada = page.locator("#comparacion .opcion", { hasText: "Camión consolidado" }).first();
await consolidada.locator("summary").click();
await elemento(page, "#comparacion .opcion:has-text('Camión consolidado') details", "05b_desglose_consolidado");

// 06 Tabla de envíos con filtros
await elemento(page, "#registro .filtros-envios", "06_filtros_envios");
await page.locator("#tablaEnvios").scrollIntoViewIfNeeded();
await foto(page, "07_tabla_envios");

// 08 Detalle de un envío (consolidado con descuento)
const conDescuento = demo.envios.find((e) => e.modalidad === "consolidado" && e.tarifa?.descuento > 0 && e.estado === "en bodega") ?? demo.envios.find((e) => e.modalidad === "consolidado");
await page.fill("#buscarEnvio", conDescuento.codigoGuia);
await page.waitForTimeout(500);
await page.click(`#tablaEnvios tr[data-guia="${conDescuento.codigoGuia}"] button[data-accion="detalle"]`);
await page.waitForTimeout(300);
await foto(page, "08_detalle_envio");
await page.click("#cerrarDetalleEnvio");
await page.fill("#buscarEnvio", "");

// 09 Cancelar un envío (modal con motivo)
const registrado = demo.envios.find((e) => e.estado === "registrado");
await page.fill("#buscarEnvio", registrado.codigoGuia);
await page.waitForTimeout(500);
await page.click(`#tablaEnvios tr[data-guia="${registrado.codigoGuia}"] button[data-accion="cancelar"]`);
await page.waitForTimeout(300);
await page.fill("#motivoCancelacion", "El cliente pidió anular la solicitud antes de entregar el paquete");
await foto(page, "09_cancelar_envio");
await page.keyboard.press("Escape");
await page.fill("#buscarEnvio", "");

// 10 Catálogo
await ir(page, "catalogo");
await foto(page, "10_catalogo", { fullPage: true });

// 11 Despacho: crear ruta y envíos disponibles
await ir(page, "rutas");
await foto(page, "11_despacho_crear", { clip: { x: 0, y: 0, width: 1280, height: 800 } });

// 12 Tarjeta de una ruta abierta con ahorro por consolidación
const abierta = demo.rutas.find((r) => r.estado === "abierta" && r.envios.length >= 3);
await elemento(page, `#ruta-${abierta.codigo}`, "12_ruta_ahorro");

// 13 Confirmación del despacho
await page.click(`#ruta-${abierta.codigo} button[data-accion="cerrar"]`);
await page.waitForTimeout(300);
await foto(page, "13_despacho_confirmacion");
await page.click('#dialogoConfirmacion button[value="cancel"]');

// 14 Ruta ya despachada
const enRuta = demo.rutas.find((r) => r.estado === "en ruta");
await elemento(page, `#ruta-${enRuta.codigo}`, "14_ruta_despachada");

// 15 Seguimiento
await ir(page, "seguimiento");
const seguido = demo.envios.find((e) => e.estado === "en ruta") ?? demo.envios[3];
await page.fill("#guiaSeguimiento", seguido.codigoGuia);
await page.click("#formSeguimiento button[type=submit]");
await page.waitForTimeout(300);
await foto(page, "15_seguimiento", { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1250 } });

// 16 Inventario
await ir(page, "inventario");
await foto(page, "16_inventario", { fullPage: true, clip: { x: 0, y: 0, width: 1280, height: 1250 } });

// 17 Configuración
await ir(page, "configuracion");
await foto(page, "17_configuracion", { fullPage: true });
if (errores.length) console.log("ERRORES", errores);
await ctx.close();

// 18 Tema oscuro y 19 móvil (19a + 19b se unen lado a lado, 390 px + 30 px de separación + 390 px, en docs/manual/19_movil.png con cualquier editor de imágenes)
{
  const o = await abrir(browser, URL, { ancho: 1280, alto: 800, esquema: "dark", estadoInicial: demo });
  await foto(o.page, "18_tema_oscuro");
  await ctx.close?.();
  await o.ctx.close();
}
{
  const m = await abrir(browser, URL, { ancho: 390, alto: 844, estadoInicial: demo });
  await ir(m.page, "registro");
  await foto(m.page, "19a_movil");
  await m.page.click("#btnMenu");
  await m.page.waitForTimeout(300);
  await foto(m.page, "19b_movil");
  await m.ctx.close();
}
await browser.close();
srv.close();
