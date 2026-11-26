// Reúne cifras reales para el documento escrito: indicadores del panel con la demo y simulación con las funciones puras.
import { chromium, servir, abrir, raizPorDefecto, tmp } from "./lib.mjs";
import fs from "node:fs";
const RAIZ = process.env.RAIZ || raizPorDefecto();
const srv = await servir(RAIZ, 8807);
const browser = await chromium.launch();
const URL = "http://127.0.0.1:8807/";
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
const { page, ctx, errores } = await abrir(browser, URL, { ancho: 1280, alto: 900, estadoInicial: demo });
const panel = await page.evaluate(() => {
  const p = document.querySelector("#panel");
  return [...p.querySelectorAll("dt, h2, h3, caption, th, td, li, dd, p")].map((n) => n.tagName + ": " + n.textContent.replace(/\s+/g, " ").trim()).slice(0, 140);
});
const resumen = {
  clientes: demo.clientes.length, envios: demo.envios.length, rutas: demo.rutas.length,
  porEstado: demo.envios.reduce((a, e) => ({ ...a, [e.estado]: (a[e.estado] || 0) + 1 }), {}),
  porModalidad: demo.envios.reduce((a, e) => ({ ...a, [e.modalidad]: (a[e.modalidad] || 0) + 1 }), {}),
  rutasPorEstado: demo.rutas.reduce((a, r) => ({ ...a, [r.estado]: (a[r.estado] || 0) + 1 }), {}),
  almacenamientoBytes: JSON.stringify(demo).length,
  ejemploEnvio: demo.envios[0], ejemploRuta: demo.rutas.find((r) => r.consolidacion) || demo.rutas[0],
  errores,
};
fs.writeFileSync(tmp("panel_demo.json"), JSON.stringify({ panel, resumen }, null, 1));
console.log(JSON.stringify(resumen, null, 1).slice(0, 3500));
console.log(panel.join("\n").slice(0, 5000));
await ctx.close(); await browser.close(); srv.close();
