// Utilidades de prueba: servidor estático sin dependencias + Playwright (solo para verificar, no es parte de la app)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
// Playwright: se busca primero en las dependencias de desarrollo del equipo y, si no, en la instalación global.
const cargar = () => {
  for (const base of [import.meta.url, `file://${process.cwd()}/`, "file:///opt/npm-tools/node_modules/"]) {
    try { return createRequire(base)("playwright"); } catch { /* se prueba el siguiente lugar */ }
  }
  throw new Error("Playwright no está instalado. Ejecute: npm i -D playwright && npx playwright install chromium");
};
export const { chromium } = cargar();
export const tmp = (nombre) => path.join(os.tmpdir(), nombre);
// Carpeta del proyecto: argumento, o la carpeta hermana de «pruebas» (EcoRuta_v2.3.0, proyecto) o la superior.
export const raizPorDefecto = () => {
  const aqui = import.meta.dirname;
  const candidatas = ["../EcoRuta_v2.3.0", "../proyecto", ".."].map((r) => path.resolve(aqui, r));
  return candidatas.find((c) => fs.existsSync(path.join(c, "index.html"))) ?? candidatas[0];
};

const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };

export function servir(raiz, puerto) {
  raiz = path.resolve(raiz); // admite rutas relativas como «.»
  const srv = http.createServer((req, res) => {
    let ruta = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (ruta.endsWith("/")) ruta += "index.html";
    const archivo = path.join(raiz, ruta);
    if (!archivo.startsWith(raiz)) { res.writeHead(403); return res.end(); }
    fs.readFile(archivo, (err, datos) => {
      if (err) { res.writeHead(404); return res.end("no encontrado"); }
      res.writeHead(200, { "content-type": TIPOS[path.extname(archivo)] || "application/octet-stream" });
      res.end(datos);
    });
  });
  return new Promise((ok) => srv.listen(puerto, "127.0.0.1", () => ok(srv)));
}

// Abre la app, captura errores de consola/página y espera a que cargue el catálogo
export async function abrir(browser, url, { ancho = 1280, alto = 900, esquema = "light", estadoInicial } = {}) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, colorScheme: esquema });
  ctx.setDefaultTimeout(6000);
  const page = await ctx.newPage();
  const errores = [];
  page.on("pageerror", (e) => errores.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errores.push("console: " + m.text()); });
  if (estadoInicial) {
    await page.addInitScript((e) => { if (!localStorage.getItem("ecoruta_estado_v5")) localStorage.setItem("ecoruta_estado_v5", JSON.stringify(e)); }, estadoInicial);
  }
  await page.goto(url);
  await page.waitForSelector("#aplicacion:not([hidden])", { timeout: 8000 });
  return { ctx, page, errores };
}

export const resultados = [];
export function verificar(nombre, condicion, detalle = "") {
  resultados.push({ nombre, ok: !!condicion, detalle });
  console.log(`${condicion ? "  PASA " : "  FALLA"}  ${nombre}${detalle ? "  -> " + detalle : ""}`);
}
export function resumen() {
  const f = resultados.filter((r) => !r.ok);
  console.log(`\n${resultados.length - f.length}/${resultados.length} pruebas correctas`);
  return f.length;
}
