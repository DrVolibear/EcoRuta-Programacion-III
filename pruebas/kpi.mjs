import { chromium, servir, abrir, raizPorDefecto, tmp } from "./lib.mjs";
import fs from "node:fs";
const srv = await servir(process.env.RAIZ || raizPorDefecto(), 8810);
const b = await chromium.launch();
const URL = "http://127.0.0.1:8810/";
let demo;
{ const { page, ctx } = await abrir(b, URL);
  await page.click('[data-vista="configuracion"]');
  await Promise.all([page.waitForEvent("load"), (async () => { await page.click("#cargarDemo"); await page.click('#dialogoConfirmacion button[value="confirm"]'); })()]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  demo = await page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5"))); await ctx.close(); }
const { page } = await abrir(b, URL, { estadoInicial: demo });
const k = await page.evaluate(() => Object.fromEntries(["kpiEnvios", "kpiFacturado", "kpiPromedio", "kpiPeso", "kpiEmisiones", "kpiEvitadasLimpias", "kpiEvitadasConsolidadas", "kpiPorcentajeLimpio"].map((i) => [i, document.getElementById(i).textContent.trim()])));
const rutas = demo.rutas.map((r) => ({ codigo: r.codigo, estado: r.estado, modalidad: r.modalidad, envios: r.envios.length, ahorro: r.consolidacion?.ahorro ?? null }));
fs.writeFileSync(tmp("kpi_demo.json"), JSON.stringify({ k, rutas, resumen: { clientes: demo.clientes.length, envios: demo.envios.length, rutas: demo.rutas.length } }, null, 1));
console.log(JSON.stringify({ k, rutas }));
await b.close(); srv.close();
