import { chromium, servir, abrir, verificar, resumen, raizPorDefecto, tmp } from "./lib.mjs";
const RAIZ = process.argv[2] || raizPorDefecto();
const srv = await servir(RAIZ, 8802);
const browser = await chromium.launch();
const { page, errores } = await abrir(browser, "http://127.0.0.1:8802/");
verificar("la app carga sin errores", errores.length === 0, errores.join(" | "));
for (const v of ["panel","registro","clientes","catalogo","rutas","seguimiento","inventario","configuracion"]) {
  await page.click(`[data-vista="${v}"]`);
  verificar(`vista ${v} visible`, await page.locator(`#${v}.activa`).count() === 1);
}
// cargar demo
await page.click('[data-vista="configuracion"]');
await Promise.all([page.waitForEvent("load"), (async()=>{ await page.click("#cargarDemo"); await page.click('#dialogoConfirmacion button[value="confirm"]'); })()]);
await page.waitForSelector("#aplicacion:not([hidden])");
const cuenta = await page.evaluate(() => { const e = JSON.parse(localStorage.getItem("ecoruta_estado_v5")); return { c:e.clientes.length, e:e.envios.length, r:e.rutas.length }; });
verificar("demo cargada 15/42/5", cuenta.c===15 && cuenta.e>=40 && cuenta.r===5, JSON.stringify(cuenta));
for (const v of ["panel","registro","clientes","rutas","seguimiento","inventario"]) await page.click(`[data-vista="${v}"]`);
await page.screenshot({ path: tmp("humo_inv.png") });
verificar("sin errores tras demo", errores.length === 0, errores.join(" | "));
await browser.close(); srv.close();
process.exit(resumen() ? 1 : 0);
