import { chromium, servir, abrir, raizPorDefecto, tmp } from "./lib.mjs";
import fs from "node:fs";
const RAIZ = process.env.RAIZ || raizPorDefecto(); const SALIDA = process.env.SALIDA || tmp("caps"); const PUERTO = Number(process.env.PUERTO || 8805);
const srv = await servir(RAIZ, PUERTO);
const browser = await chromium.launch();
let demo;
{ const { page, ctx } = await abrir(browser, `http://127.0.0.1:${PUERTO}/`);
  await page.click('[data-vista="configuracion"]');
  await Promise.all([page.waitForEvent("load"), (async()=>{ await page.click("#cargarDemo"); await page.click('#dialogoConfirmacion button[value="confirm"]'); })()]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  demo = await page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5"))); await ctx.close(); }
fs.mkdirSync(SALIDA, { recursive: true });
const ir = async (page, v) => { const b = page.locator(`.lateral [data-vista="${v}"]`); if (!(await b.isVisible())) await page.click("#btnMenu"); await b.click(); };
for (const [w, h, esquema] of [[1280, 900, "light"], [1280, 900, "dark"], [390, 844, "light"], [390, 844, "dark"], [820, 1000, "light"]]) {
  const { page, ctx, errores } = await abrir(browser, `http://127.0.0.1:${PUERTO}/`, { ancho: w, alto: h, esquema, estadoInicial: demo });
  const tag = `${w}_${esquema}`;
  for (const v of ["panel", "registro", "clientes", "rutas", "seguimiento", "inventario"]) {
    await ir(page, v);
    if (v === "registro") {
      await page.selectOption("#remitente", { index: 1 }); await page.selectOption("#destinatario", { index: 2 });
      await page.selectOption("#origen", "SJO-01"); await page.selectOption("#destino", "ALA-01");
      await page.fill("#peso", "5"); await page.fill("#largo", "30"); await page.fill("#ancho", "25"); await page.fill("#alto", "20");
      await page.click("#btnComparar");
    }
    if (v === "seguimiento") { await page.fill("#guiaSeguimiento", demo.envios[3].codigoGuia); await page.click("#formSeguimiento button[type=submit]"); }
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${SALIDA}/${tag}_${v}.png`, fullPage: true });
  }
  if (errores.length) console.log(tag, errores);
  await ctx.close();
}
await browser.close(); srv.close();
