// Mediciones de rendimiento para el informe (Chromium sin interfaz, servidor local; cifras orientativas).
import { chromium, servir, abrir, raizPorDefecto, tmp } from "./lib.mjs";
import fs from "node:fs";
const RAIZ = process.env.RAIZ || raizPorDefecto();
const srv = await servir(RAIZ, 8808);
const browser = await chromium.launch();
const URL = "http://127.0.0.1:8808/";
const mediana = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const salida = {};

// 1) Carga en frío: peticiones y bytes (sin datos de demostración)
const tiempos = [];
let peticiones = [];
for (let i = 0; i < 7; i++) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const lista = [];
  page.on("response", async (r) => { try { const b = await r.body(); lista.push({ url: r.url().replace(URL, "/"), bytes: b.length, tipo: r.request().resourceType() }); } catch {} });
  const t0 = Date.now();
  await page.goto(URL);
  await page.waitForSelector("#aplicacion:not([hidden])");
  tiempos.push(Date.now() - t0);
  const nav = await page.evaluate(() => { const n = performance.getEntriesByType("navigation")[0]; return { dcl: n.domContentLoadedEventEnd, load: n.loadEventEnd }; });
  if (i === 6) peticiones = lista;
  tiempos[tiempos.length - 1] = { total: tiempos[tiempos.length - 1], ...nav };
  await ctx.close();
}
salida.cargaFria = {
  peticiones: peticiones.length,
  bytesTotales: peticiones.reduce((a, p) => a + p.bytes, 0),
  porTipo: peticiones.reduce((a, p) => ({ ...a, [p.tipo]: (a[p.tipo] || 0) + p.bytes }), {}),
  medianaListoMs: mediana(tiempos.map((t) => t.total)),
  medianaDCLms: Math.round(mediana(tiempos.map((t) => t.dcl))),
  medianaLoadMs: Math.round(mediana(tiempos.map((t) => t.load))),
  detalle: peticiones.sort((a, b) => b.bytes - a.bytes),
};

// 2) Con demostración: nodos del DOM y memoria
let demo;
{
  const { page, ctx } = await abrir(browser, URL);
  await page.click('[data-vista="configuracion"]');
  await Promise.all([page.waitForEvent("load"), (async () => { await page.click("#cargarDemo"); await page.click('#dialogoConfirmacion button[value="confirm"]'); })()]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  demo = await page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5")));
  await ctx.close();
}
{
  const { page, ctx, errores } = await abrir(browser, URL, { estadoInicial: demo });
  salida.demo = await page.evaluate(() => ({
    nodos: document.querySelectorAll("*").length,
    filasTabla: document.querySelectorAll("#tablaEnvios tbody tr, #registro tbody tr").length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(2) : null,
    bytesLocalStorage: new Blob([localStorage.getItem("ecoruta_estado_v5")]).size,
  }));
  salida.demo.erroresConsola = errores.length;
  await ctx.close();
}

// 3) Volumen: 500 envíos para comprobar que la paginación limita el DOM
{
  const grande = structuredClone(demo);
  const base = grande.envios.filter((e) => e.estado === "registrado" || e.estado === "en bodega");
  let n = grande.contadorGuia;
  while (grande.envios.length < 500) {
    const o = structuredClone(base[grande.envios.length % base.length]);
    o.codigoGuia = `ENV-2026-${String(n++).padStart(5, "0")}`; o.rutaAsignada = null; o.estado = "registrado";
    o.historial = [{ estadoAnterior: null, estado: "registrado", fecha: o.fechaRegistro, detalle: "Volumen de prueba" }];
    grande.envios.push(o);
  }
  grande.contadorGuia = n;
  const { page, ctx, errores } = await abrir(browser, URL, { estadoInicial: grande });
  const t0 = Date.now();
  await page.click('.lateral [data-vista="registro"]').catch(async () => { await page.click("#btnMenu"); await page.click('.lateral [data-vista="registro"]'); });
  await page.waitForTimeout(300);
  salida.volumen = await page.evaluate(() => ({
    envios: JSON.parse(localStorage.getItem("ecoruta_estado_v5")).envios.length,
    filasEnDOM: document.querySelectorAll("#registro table tbody tr").length,
    nodosTotales: document.querySelectorAll("*").length,
    bytesLocalStorage: new Blob([localStorage.getItem("ecoruta_estado_v5")]).size,
    textoPagina: document.querySelector("#paginaEnvios, #infoPaginaEnvios, [id*=aginaEnvios]")?.textContent?.trim() ?? null,
  }));
  salida.volumen.erroresConsola = errores.length;
  await ctx.close();
}

// 4) Sin conexión: tras una carga con red, se recarga sin red
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(URL);
  await page.waitForSelector("#aplicacion:not([hidden])");
  await ctx.setOffline(true);
  // se simula la caída de la red: el catálogo ya fue copiado a localStorage
  const copia = await page.evaluate(() => Object.keys(localStorage));
  salida.sinConexion = { clavesLocalStorage: copia };
  await ctx.close();
}
fs.writeFileSync(tmp("medicion.json"), JSON.stringify(salida, null, 1));
console.log(JSON.stringify({ ...salida, cargaFria: { ...salida.cargaFria, detalle: salida.cargaFria.detalle.slice(0, 6) } }, null, 1));
await browser.close(); srv.close();
