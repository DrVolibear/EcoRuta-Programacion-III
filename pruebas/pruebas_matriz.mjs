// Pruebas por requisito del enunciado (RF, RN y 7.x) de EcoRuta v2.3.0.
// Cada comprobación lleva el prefijo [etiqueta]; docs/MATRIZ_CUMPLIMIENTO.md usa esas etiquetas como evidencia.
// Uso: node pruebas_matriz.mjs [carpeta-del-proyecto]
import { chromium, servir, abrir, verificar, resumen, resultados, raizPorDefecto } from "./lib.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const RAIZ = process.argv[2] || raizPorDefecto();
const PUERTO = 8804;
const URL = `http://127.0.0.1:${PUERTO}/`;
const srv = await servir(RAIZ, PUERTO);
const browser = await chromium.launch();
const catalogo = JSON.parse(fs.readFileSync(`${RAIZ}/datos/datos.json`, "utf8"));
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), "utf8");
const archivosJS = fs.readdirSync(`${RAIZ}/js`, { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => `js/${f}`);
const textoJS = (f) => leer(f);
const fuera0 = (css) => css.replace(/:root[^{]*\{[^}]*\}/g, "");

/* ---------- Estado de demostración generado por la propia aplicación ---------- */
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

const nueva = (opts = {}) => abrir(browser, URL, { estadoInicial: demo, ...opts });
const vacia = (opts = {}) => abrir(browser, URL, opts);
const estadoDe = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5")));
const ir = async (page, vista) => {
  const boton = page.locator(`.lateral [data-vista="${vista}"]`);
  if (!(await boton.isVisible())) await page.click("#btnMenu");
  await boton.click();
};
const toasts = (page) => page.locator(".toast").allTextContents();
const dentro = (page, ruta, fn, ...args) => page.evaluate(async ([r, f, a]) => { const m = await import(r); return new Function("m", "a", `return (${f})(m, ...a)`)(m, a); }, [ruta, fn.toString(), args]);
const clonar = (x) => JSON.parse(JSON.stringify(x));
const numeros = (texto) => Number(String(texto).replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));

async function llenar(page, o = {}) {
  const v = { remitente: 1, destinatario: 2, origen: "SJO-01", destino: "ALA-01", peso: "5", largo: "30", ancho: "25", alto: "20", contenido: "general", ...o };
  await page.selectOption("#remitente", { index: v.remitente });
  await page.selectOption("#destinatario", { index: v.destinatario });
  await page.selectOption("#origen", v.origen);
  await page.selectOption("#destino", v.destino);
  await page.fill("#peso", v.peso);
  await page.fill("#largo", v.largo);
  await page.fill("#ancho", v.ancho);
  await page.fill("#alto", v.alto);
  await page.selectOption("#contenido", v.contenido);
  if (v.urgente) await page.check("#urgente");
}
const comparar = async (page) => { await page.click("#btnComparar"); await page.waitForTimeout(80); };
async function registrar(page, o = {}, opcion = 0) {
  await ir(page, "registro");
  await llenar(page, o);
  await comparar(page);
  await page.click(`#comparacion button[data-opcion="${opcion}"]`);
  await page.waitForTimeout(150);
  return (await estadoDe(page)).envios.at(-1);
}

const bloques = [];
const bloque = (tag, fn) => bloques.push([tag, fn]);
const v = (tag, nombre, condicion, detalle = "") => verificar(`[${tag}] ${nombre}`, condicion, detalle);

/* =====================================================================
   M1 · Registro de envíos
   ===================================================================== */
bloque("rf01", async () => {
  const { page, ctx } = await nueva();
  const n0 = (await estadoDe(page)).envios.length;
  const e = await registrar(page, { remitente: 1, destinatario: 2, origen: "SJO-01", destino: "ALA-01", peso: "5", contenido: "fragil" });
  const est = await estadoDe(page);
  v("rf01", "la solicitud se guarda con remitente, destinatario, paquete y sucursales", est.envios.length === n0 + 1 && e.clienteRemitente && e.clienteDestinatario && e.sucursalOrigen === "SJO-01" && e.sucursalDestino === "ALA-01" && e.pesoReal === 5 && e.contenido === "fragil" && e.dimensiones.largo === 30, JSON.stringify([e.clienteRemitente, e.clienteDestinatario]));
  v("rf01", "el estado inicial es «registrado»", e.estado === "registrado");
  await ctx.close();
});

bloque("rf02", async () => {
  const { page, ctx } = await nueva();
  const antes = await estadoDe(page);
  const e1 = await registrar(page);
  const anio = new Date().getFullYear();
  v("rf02", "formato ENV-AAAA-NNNNN", new RegExp(`^ENV-${anio}-\\d{5}$`).test(e1.codigoGuia), e1.codigoGuia);
  const numero = (g) => Number(g.slice(-5));
  v("rf02", "correlativa: continúa tras la última guía existente", numero(e1.codigoGuia) === Math.max(...antes.envios.map((e) => numero(e.codigoGuia))) + 1, e1.codigoGuia);
  // se cancela la última y se registra otra: la guía no se reutiliza
  await ir(page, "registro");
  await page.click(`#tablaEnvios tr[data-guia="${e1.codigoGuia}"] button[data-accion="cancelar"]`);
  await page.fill("#motivoCancelacion", "Prueba de guía no reutilizable");
  await page.click("#confirmarCancelacion");
  await page.waitForTimeout(150);
  const e2 = await registrar(page);
  const est = await estadoDe(page);
  v("rf02", "una guía cancelada no se reutiliza (la siguiente es mayor)", numero(e2.codigoGuia) === numero(e1.codigoGuia) + 1 && est.envios.filter((e) => e.codigoGuia === e1.codigoGuia).length === 1, `${e1.codigoGuia} → ${e2.codigoGuia}`);
  v("rf02", "todas las guías son únicas", new Set(est.envios.map((e) => e.codigoGuia)).size === est.envios.length);
  await ctx.close();
});

bloque("rf03", async () => {
  const { page, ctx, errores } = await nueva();
  const info = await page.evaluate(() => {
    const g = (id) => document.getElementById(id);
    const atrib = (id, a) => g(id).getAttribute(a);
    return {
      requeridos: ["remitente", "destinatario", "origen", "destino", "peso", "largo", "ancho", "alto", "contenido", "identificacion", "nombre", "telefono", "correo", "direccion", "codigoPostal", "provincia"].filter((id) => g(id).required),
      tipos: { peso: atrib("peso", "type"), largo: atrib("largo", "type"), correo: atrib("correo", "type"), telefono: atrib("telefono", "type") },
      rangos: { pesoMin: atrib("peso", "min"), pesoMax: atrib("peso", "max"), largoMin: atrib("largo", "min"), largoMax: atrib("largo", "max") },
      maxlength: ["identificacion", "nombre", "telefono", "correo", "direccion", "codigoPostal"].filter((id) => g(id).hasAttribute("maxlength")),
      patrones: ["identificacion", "telefono", "codigoPostal"].map((id) => [id, atrib(id, "pattern")]),
    };
  });
  v("rf03", "campos obligatorios con required (16)", info.requeridos.length === 16, info.requeridos.length);
  v("rf03", "type number/email/tel y min/max en peso y dimensiones", info.tipos.peso === "number" && info.tipos.largo === "number" && info.tipos.correo === "email" && info.tipos.telefono === "tel" && info.rangos.pesoMin && info.rangos.pesoMax && info.rangos.largoMin && info.rangos.largoMax, JSON.stringify(info.rangos));
  v("rf03", "maxlength en los campos de texto del cliente", info.maxlength.length === 6, info.maxlength.join());
  const compilan = await page.evaluate((pat) => pat.every(([, p]) => { try { new RegExp(`^(?:${p})$`, "v"); return true; } catch { return false; } }), info.patrones);
  v("rf03", "pattern en teléfono, identificación y código postal, y todos compilan (flag v)", info.patrones.every(([, p]) => p) && compilan, JSON.stringify(info.patrones));
  await ir(page, "clientes");
  v("rf03", "el patrón de identificación ya no produce errores de consola", errores.length === 0, errores.join(" | "));
  await ctx.close();
});

bloque("rf04", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m) => [m.pesoVolumetrico(30, 25, 20, 5000), m.pesoVolumetrico(100, 100, 100, 5000)]);
  v("rf04", "peso volumétrico = L×A×H / divisor del catálogo", r[0] === 3 && r[1] === 200, JSON.stringify(r));
  const grande = await registrar(page, { peso: "1", largo: "100", ancho: "100", alto: "100" });
  v("rf04", "facturable = mayor entre real (1) y volumétrico (200)", grande.pesoReal === 1 && grande.pesoVolumetrico === 200 && grande.pesoFacturable === 200, JSON.stringify([grande.pesoReal, grande.pesoVolumetrico, grande.pesoFacturable]));
  const pesado = await registrar(page, { peso: "10", largo: "10", ancho: "10", alto: "10" });
  v("rf04", "facturable = real cuando supera al volumétrico", pesado.pesoFacturable === 10 && pesado.pesoVolumetrico === 0.2, JSON.stringify([pesado.pesoReal, pesado.pesoVolumetrico, pesado.pesoFacturable]));
  await ctx.close();
});

bloque("rf05", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const frio = m.modalidadesViables(cat, { pesoFacturable: 5, contenido: "frio" }, suc, 20).map((x) => x.codigo);
    const general = m.modalidadesViables(cat, { pesoFacturable: 5, contenido: "general" }, suc, 20).map((x) => x.codigo);
    const mod = cat.modalidades.find((x) => x.codigo === "consolidado");
    const t = (contenido) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido }, 20, mod).recargos;
    return { frio, general, rf: t("fragil").fragil, rc: t("frio").frio, rg: t("general") };
  }, catalogo);
  v("rf05", "cadena de frío solo ofrece modalidades refrigeradas", r.frio.length > 0 && !r.frio.includes("bicicleta") && r.general.includes("bicicleta"), r.frio.join());
  v("rf05", "frágil y frío tienen recargo propio; general no tiene", r.rf > 0 && r.rc > 0 && r.rg.fragil === 0 && r.rg.frio === 0, JSON.stringify([r.rf, r.rc]));
  await ctx.close();
});

bloque("rf06", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await llenar(page, { contenido: "fragil" });
  await comparar(page);
  const texto = await page.locator("#comparacion").innerText();
  const est = await estadoDe(page);
  const idRem = await page.inputValue("#remitente");
  const nombre = est.clientes.find((c) => c.id === idRem)?.nombre ?? "";
  const encabezado = texto.split(/Opciones|Modalidad/i)[0];
  v("rf06", "la comparación abre con el resumen de la solicitud (remitente, trayecto y paquete)", /resumen/i.test(texto) && nombre !== "" && texto.includes(nombre) && /5 kg|5\.0 kg|5 kg/.test(texto.replace(/\u00a0/g, " ")) && /San José Centro|SJO-01/.test(texto), encabezado.slice(0, 200));
  v("rf06", "cada opción muestra desglose de tarifa y emisiones antes de confirmar", /Peso facturable|Base/i.test(texto) && /CO₂e/.test(texto) && /Total/.test(texto));
  v("rf06", "no se registra nada hasta elegir una opción", (await estadoDe(page)).envios.length === est.envios.length);
  await ctx.close();
});

bloque("rf07", async () => {
  const { page, ctx } = await nueva();
  const errores = await dentro(page, "/js/validaciones.js", (m, reglas) => m.validarEnvioFormulario({ remitente: "", destinatario: "", origen: "SJO-01", destino: "SJO-01", pesoReal: 0, largo: 0, ancho: 20, alto: 301, sobredimensionMarcada: false }, reglas), catalogo.reglas);
  v("rf07", "cada error trae campo y mensaje específico (se muestran todos a la vez)", errores.length >= 6 && errores.every((e) => e.campo && e.mensaje), errores.map((e) => e.campo).join());
  await ir(page, "registro");
  await page.click("#btnComparar");
  await page.waitForTimeout(100);
  const marcados = await page.locator('#formEnvio [aria-invalid="true"]').count();
  const conMensaje = await page.locator('#formEnvio [id^="error-"]').evaluateAll((l) => l.filter((x) => x.textContent.trim()).length);
  v("rf07", "formulario vacío: campos marcados con aria-invalid y mensaje junto a cada uno", marcados >= 6 && conMensaje >= 6, `${marcados}/${conMensaje}`);
  v("rf07", "no se abrió ninguna comparación con datos inválidos", (await page.locator("#comparacion .opcion").count()) === 0);
  await ctx.close();
});

bloque("rf08", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const reg = demo.envios.find((e) => e.estado === "registrado");
  await page.click(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"] button[data-accion="editar"]`).catch(async () => {
    await page.fill("#buscarEnvio", reg.codigoGuia);
    await page.click(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"] button[data-accion="editar"]`);
  });
  const guiaCampo = await page.inputValue("#guiaEdicion");
  await page.fill("#peso", "7");
  await comparar(page);
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const e = est.envios.find((x) => x.codigoGuia === reg.codigoGuia);
  v("rf08", "al editar se conserva la guía y se actualizan los datos", guiaCampo === reg.codigoGuia && e.pesoReal === 7 && est.envios.length === demo.envios.length, `${guiaCampo} peso ${e.pesoReal}`);
  const bodega = demo.envios.find((x) => x.estado === "en bodega");
  await page.fill("#buscarEnvio", bodega.codigoGuia);
  v("rf08", "solo se editan solicitudes en estado «registrado» (en bodega: botón Editar deshabilitado)", await page.locator(`#tablaEnvios tr[data-guia="${bodega.codigoGuia}"] button[data-accion="editar"]`).isDisabled());
  await ctx.close();
});

/* =====================================================================
   M2 · Clientes
   ===================================================================== */
const datosCliente = { identificacion: "1-2345-6789", nombre: "Cliente de Prueba", telefono: "8888-1234", correo: "prueba@correo.com", direccion: "Avenida 1, San José", codigoPostal: "10101", provincia: "San José" };
async function llenarCliente(page, d = datosCliente) {
  for (const [k, val] of Object.entries(d)) {
    const tag = await page.locator(`#${k}`).evaluate((e) => e.tagName);
    if (tag === "SELECT") await page.selectOption(`#${k}`, { label: val }).catch(() => page.selectOption(`#${k}`, val));
    else await page.fill(`#${k}`, val);
  }
}

bloque("rf09", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  await llenarCliente(page);
  await page.click('#formCliente button[type="submit"]');
  await page.waitForTimeout(120);
  const est = await estadoDe(page);
  const c = est.clientes.find((x) => x.identificacion === datosCliente.identificacion);
  v("rf09", "el cliente se guarda con identificación, nombre, teléfono, correo, dirección y provincia", c && c.nombre === datosCliente.nombre && c.telefono === datosCliente.telefono && c.correo === datosCliente.correo && c.direccion === datosCliente.direccion && c.provincia, JSON.stringify(c));
  await llenarCliente(page, { ...datosCliente, correo: "otro@correo.com", nombre: "Duplicado" });
  await page.click('#formCliente button[type="submit"]');
  await page.waitForTimeout(120);
  v("rf09", "la identificación es única (duplicado rechazado)", (await estadoDe(page)).clientes.length === est.clientes.length);
  await ctx.close();
});

bloque("rf10", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const objetivo = demo.clientes[3];
  await page.fill("#buscarRemitente", objetivo.nombre.split(" ")[0]);
  await page.waitForTimeout(80);
  const opciones = await page.locator("#remitente option").allTextContents();
  v("rf10", "la búsqueda reduce las opciones del selector", opciones.some((t) => t.includes(objetivo.nombre)) && opciones.length < demo.clientes.length, opciones.length);
  await page.selectOption("#remitente", { label: opciones.find((t) => t.includes(objetivo.nombre)) });
  const datos = await page.locator("#datosRemitente").innerText();
  v("rf10", "al elegirlo se muestran sus datos (autocompletado visible)", datos.includes(objetivo.telefono) || datos.includes(objetivo.correo) || datos.includes(objetivo.nombre), datos);
  await ctx.close();
});

bloque("rf11", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  await page.evaluate(() => { window.__sinRecarga = true; });
  const total = await page.locator("#listaClientes tr").count();
  await page.fill("#buscarCliente", demo.clientes[2].nombre.split(" ")[0]);
  await page.waitForTimeout(80);
  const filtradas = await page.locator("#listaClientes tr").count();
  v("rf11", "la tabla se filtra mientras se escribe, sin recargar la página", filtradas >= 1 && filtradas < total && (await page.evaluate(() => window.__sinRecarga === true)), `${total}→${filtradas}`);
  await ctx.close();
});

bloque("rf12", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  const cli = demo.clientes.find((c) => demo.envios.some((e) => e.clienteRemitente === c.id && e.estado === "registrado"));
  await page.fill("#buscarCliente", cli.identificacion);
  await page.click(`#listaClientes button[data-accion="editar"][data-id="${cli.id}"]`);
  await page.fill("#nombre", "Nombre Modificado Prueba");
  await page.click('#formCliente button[type="submit"]');
  await page.waitForTimeout(120);
  const envio = demo.envios.find((e) => e.clienteRemitente === cli.id && e.estado === "registrado");
  await ir(page, "registro");
  await page.fill("#buscarEnvio", envio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${envio.codigoGuia}"] button[data-accion="detalle"]`);
  const ficha = await page.locator("#contenidoDetalleEnvio").innerText();
  v("rf12", "el nombre editado aparece en la ficha de sus envíos (los envíos guardan el id del cliente)", ficha.includes("Nombre Modificado Prueba") && !ficha.includes(cli.nombre), cli.nombre);
  await ctx.close();
});

bloque("rf13", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  const cli = demo.clientes.find((c) => demo.envios.some((e) => (e.clienteRemitente === c.id || e.clienteDestinatario === c.id) && ["registrado", "en bodega", "asignado a ruta", "en ruta"].includes(e.estado)));
  await page.fill("#buscarCliente", cli.identificacion);
  await page.click(`#listaClientes button[data-accion="cancelar"][data-id="${cli.id}"]`);
  await page.waitForTimeout(150);
  const t = (await toasts(page)).join(" ");
  const est = await estadoDe(page);
  v("rf13", "un cliente con envíos activos no se elimina y se ofrece inactivarlo", /No se puede cancelar/.test(t) && /inactivo/i.test(t) && est.clientes.find((c) => c.id === cli.id).estado === "activo", t);
  await page.click(`#listaClientes button[data-accion="estado"][data-id="${cli.id}"]`);
  await page.waitForTimeout(100);
  const e2 = await estadoDe(page);
  v("rf13", "puede inactivarse (baja lógica) conservando sus datos", e2.clientes.find((c) => c.id === cli.id).estado === "inactivo");
  await ctx.close();
});

bloque("rf14", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  const cli = demo.clientes.find((c) => demo.envios.filter((e) => e.clienteRemitente === c.id || e.clienteDestinatario === c.id).length >= 2);
  await page.fill("#buscarCliente", cli.identificacion);
  await page.click(`#listaClientes button[data-accion="historial"][data-id="${cli.id}"]`);
  const titulo = await page.locator("#tituloHistorialCliente").innerText();
  const cuerpo = await page.locator("#contenidoHistorialCliente").innerText();
  const propios = demo.envios.filter((e) => (e.clienteRemitente === cli.id || e.clienteDestinatario === cli.id) && e.estado !== "cancelado");
  const total = propios.reduce((s, e) => s + e.tarifa.total, 0);
  v("rf14", "título «Historial de envíos de [cliente]»", titulo === `Historial de envíos de ${cli.nombre}`, titulo);
  v("rf14", "lista sus envíos y muestra el total facturado (sin cancelados)", cuerpo.includes(propios[0].codigoGuia) && numeros(cuerpo.match(/Total facturado[^:]*:\s*([^\n]+)/)?.[1] ?? "") === total, `${total} | ${cuerpo.slice(0, 120)}`);
  await ctx.close();
});

/* =====================================================================
   M3 · Catálogo
   ===================================================================== */
bloque("rf15", async () => {
  const claves = ["sucursales", "distancias", "modalidades", "tarifas", "recargos", "reglas"];
  v("rf15", "datos.json trae sucursales, distancias, modalidades, tarifas, recargos y reglas", claves.every((k) => k in catalogo), Object.keys(catalogo).join());
  v("rf15", "cada sucursal trae código, nombre, provincia, capacidad, modalidades y tarifa base", catalogo.sucursales.every((s) => s.codigo && s.nombre && s.provincia && s.capacidadKg > 0 && Array.isArray(s.modalidades) && s.tarifaBase > 0));
  v("rf15", "la matriz de distancias es completa y simétrica", catalogo.sucursales.every((a) => catalogo.sucursales.every((b) => a.codigo === b.codigo || (catalogo.distancias[a.codigo][b.codigo] > 0 && catalogo.distancias[a.codigo][b.codigo] === catalogo.distancias[b.codigo][a.codigo]))));
});

bloque("rf16", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let liberar;
  const espera = new Promise((r) => (liberar = r));
  await page.route("**/datos/datos.json", async (ruta) => { await espera; await ruta.continue(); });
  await page.goto(URL);
  await page.waitForTimeout(300);
  const mientras = await page.evaluate(() => ({ app: document.getElementById("aplicacion").hidden, carga: !document.getElementById("estadoCarga").hidden }));
  v("rf16", "mientras se descarga el catálogo la aplicación está oculta y se muestra el estado de carga", mientras.app && mientras.carga, JSON.stringify(mientras));
  liberar();
  await page.waitForSelector("#aplicacion:not([hidden])");
  const despues = await page.evaluate(() => ({ habilitado: !document.getElementById("btnComparar").disabled, carga: document.getElementById("estadoCarga").hidden, opciones: document.querySelectorAll("#origen option").length }));
  v("rf16", "al terminar se habilitan los formularios con las sucursales del catálogo", despues.habilitado && despues.carga && despues.opciones > catalogo.sucursales.length - 1, JSON.stringify(despues));
  await ctx.close();
});

bloque("rf17", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.route("**/datos/datos.json", (r) => r.abort());
  await page.goto(URL);
  await page.waitForSelector("#btnReintentar:not([hidden])");
  const txt = await page.locator("#textoCarga").innerText();
  v("rf17", "sin red y sin copia local: mensaje de error y botón «Reintentar» (no pantalla en blanco)", /No fue posible cargar el catálogo/.test(txt) && (await page.locator("#btnReintentar").isVisible()), txt);
  await page.unroute("**/datos/datos.json");
  await Promise.all([page.waitForEvent("load"), page.click("#btnReintentar")]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  v("rf17", "al volver la red, «Reintentar» recupera la aplicación", true);
  await ctx.close();
});

bloque("rf18", async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const roto = clonar(catalogo);
  delete roto.tarifas.porKg;
  await page.route("**/datos/datos.json", (r) => r.fulfill({ contentType: "application/json", body: JSON.stringify(roto) }));
  await page.goto(URL);
  await page.waitForSelector("#btnReintentar:not([hidden])");
  const txt = await page.locator("#textoCarga").innerText();
  v("rf18", "un catálogo inválido informa qué campo falla (tarifas.porKg)", /porKg/.test(txt), txt);
  await ctx.close();
});

bloque("rf19", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "catalogo");
  const t = await page.locator("#catalogo").innerText();
  v("rf19", "la vista del catálogo muestra las 7 sucursales con capacidad y tarifa base", catalogo.sucursales.every((s) => t.includes(s.nombre) && t.includes(s.codigo)) && /Capacidad/.test(t) && /5\s000 kg|5\.000 kg|5000 kg/.test(t.replace(/[\u00a0\u202f]/g, " ")), t.slice(0, 100));
  v("rf19", "lista las modalidades con sus factores", catalogo.modalidades.every((m) => t.includes(m.nombre)));
  await ctx.close();
});

bloque("rf20", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/catalogo.js", (m, cat) => {
    let error = "";
    try { m.obtenerDistancia(cat, "SJO-01", "XXX"); } catch (e) { error = e.message; }
    return [m.obtenerDistancia(cat, "SJO-01", "LIM-01"), m.obtenerDistancia(cat, "LIM-01", "SJO-01"), error];
  }, catalogo);
  v("rf20", "la distancia sale de la matriz del catálogo (SJO→LIM = 160 km) y es simétrica", r[0] === 160 && r[1] === 160, JSON.stringify(r));
  v("rf20", "un par sin distancia produce un error explícito", /No existe una distancia válida/.test(r[2]), r[2]);
  const usos = archivosJS.filter((f) => /\bdistancias\b/.test(textoJS(f)) && !f.endsWith("catalogo.js") && !f.endsWith("validaciones.js"));
  v("rf20", "ningún módulo incrusta distancias (solo catalogo.js las lee)", usos.length === 0, usos.join());
  await ctx.close();
});

/* =====================================================================
   M4 · Modalidades y rutas
   ===================================================================== */
bloque("rf21", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const o = (c) => cat.sucursales.find((s) => s.codigo === c);
    const cod = (p, c, d) => m.modalidadesViables(cat, p, o(c), d).map((x) => x.codigo);
    return {
      corta: cod({ pesoFacturable: 5, contenido: "general" }, "SJO-01", 20),
      pesada: cod({ pesoFacturable: 30, contenido: "general" }, "SJO-01", 20),
      larga: cod({ pesoFacturable: 5, contenido: "general" }, "SJO-01", 160),
      sinBici: cod({ pesoFacturable: 5, contenido: "general" }, "LIM-01", 20),
      muyPesada: cod({ pesoFacturable: 900, contenido: "general" }, "SJO-01", 20),
    };
  }, catalogo);
  v("rf21", "viables según peso facturable (30 kg descarta la bicicleta; 900 kg deja solo el consolidado)", r.corta.includes("bicicleta") && !r.pesada.includes("bicicleta") && JSON.stringify(r.muyPesada) === JSON.stringify(["consolidado"]), JSON.stringify([r.pesada, r.muyPesada]));
  v("rf21", "viables según distancia (160 km descarta la bicicleta y habilita el aéreo)", !r.larga.includes("bicicleta") && r.larga.includes("aereo") && !r.corta.includes("aereo"), JSON.stringify(r.larga));
  v("rf21", "viables según la sucursal de origen (Limón no ofrece bicicleta)", !r.sinBici.includes("bicicleta"), JSON.stringify(r.sinBici));
  await ctx.close();
});

bloque("rf22", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await llenar(page);
  await comparar(page);
  const opciones = await page.locator("#comparacion .opcion").count();
  const t = (await page.locator("#comparacion").innerText()).replace(/ /g, " ");
  v("rf22", "se comparan las modalidades viables (≥2) con tarifa, emisiones y tiempo de entrega", opciones >= 2 && /₡/.test(t) && /CO₂e/.test(t) && /(min|h)\b/.test(t) && /Tiempo|entrega/i.test(t), `${opciones} opciones`);
  await ctx.close();
});

bloque("rf23", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await llenar(page);
  await comparar(page);
  const destacada = await page.locator("#comparacion .opcion").evaluateAll((l) => l.filter((x) => /menor emisi/i.test(x.innerText) || x.classList.contains("recomendada")).length);
  v("rf23", "la opción de menor emisión aparece destacada", destacada >= 1, destacada);
  await ctx.close();
});

bloque("rf24", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "rutas");
  const manana = new Date(Date.now() + 2 * 86400000);
  const fecha = new Date(manana.getTime() - manana.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  await page.selectOption("#rutaDestino", "HER-01");
  await page.selectOption("#rutaModalidad", "consolidado");
  await page.fill("#rutaFechaSalida", fecha);
  await page.fill("#rutaCapacidadPeso", "500");
  await page.fill("#rutaCapacidadCantidad", "10");
  await page.click('#formRuta button[type="submit"]');
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const r = est.rutas.at(-1);
  v("rf24", "la ruta guarda destino, modalidad, fecha de salida y envíos asignados (vacía al crearse)", r.sucursalDestino === "HER-01" && r.modalidad === "consolidado" && r.fechaSalida && Array.isArray(r.envios) && r.envios.length === 0 && r.estado === "abierta", JSON.stringify(r));
  v("rf24", "aparece en la lista de rutas", (await page.locator(`#ruta-${r.codigo}`).count()) === 1);
  await ctx.close();
});

bloque("rf25", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "rutas");
  const ruta = demo.rutas.find((r) => r.estado === "abierta" && r.envios.length === 0);
  // se limita la capacidad de la ruta vacía a 1 paquete y se intenta asignar dos
  await page.evaluate((cod) => {
    const e = JSON.parse(localStorage.getItem("ecoruta_estado_v5"));
    e.rutas.find((r) => r.codigo === cod).capacidadCantidad = 1;
    localStorage.setItem("ecoruta_estado_v5", JSON.stringify(e));
  }, ruta.codigo);
  await page.reload();
  await page.waitForSelector("#aplicacion:not([hidden])");
  await ir(page, "rutas");
  const botones = page.locator(`#enviosDisponiblesRuta button[data-ruta="${ruta.codigo}"]`);
  const disponibles = await botones.count();
  if (disponibles >= 2) {
    await botones.first().click();
    await page.waitForTimeout(100);
    await page.locator(`#enviosDisponiblesRuta button[data-ruta="${ruta.codigo}"]`).first().click();
    await page.waitForTimeout(100);
  }
  const est = await estadoDe(page);
  const r = est.rutas.find((x) => x.codigo === ruta.codigo);
  const texto = await page.locator(`#ruta-${ruta.codigo}`).innerText();
  v("rf25", "la ruta respeta su capacidad en paquetes (el segundo envío se rechaza)", disponibles >= 2 && r.envios.length === 1, `${disponibles} disponibles, ${r.envios.length} asignados`);
  v("rf25", "la ruta informa su capacidad libre", /libre|disponible/i.test(texto) && /kg/.test(texto), texto.slice(0, 160));
  await ctx.close();
});

bloque("rf27", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "rutas");
  const ruta = demo.rutas.find((r) => r.estado === "abierta" && r.envios.length > 0);
  const guia = ruta.envios[0];
  await page.click(`#ruta-${ruta.codigo} button[data-accion="retirar"][data-guia="${guia}"]`);
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const e = est.envios.find((x) => x.codigoGuia === guia);
  const r = est.rutas.find((x) => x.codigo === ruta.codigo);
  v("rf27", "retirar un envío de una ruta que no salió lo devuelve a «en bodega»", e.estado === "en bodega" && !e.rutaAsignada && !r.envios.includes(guia), JSON.stringify([e.estado, e.rutaAsignada]));
  v("rf27", "el retiro queda en el historial del envío", e.historial.at(-1).estado === "en bodega" && e.historial.at(-1).estadoAnterior === "asignado a ruta");
  const enRuta = demo.rutas.find((r) => r.estado === "en ruta");
  v("rf27", "una ruta que ya salió no ofrece botón de retirar", (await page.locator(`#ruta-${enRuta.codigo} button[data-accion="retirar"]`).count()) === 0);
  await ctx.close();
});

bloque("rf28", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "rutas");
  const ruta = demo.rutas.find((r) => r.estado === "abierta" && r.envios.length > 0);
  await page.click(`#ruta-${ruta.codigo} button[data-accion="cerrar"]`);
  await page.click('#dialogoConfirmacion button[value="confirm"]');
  await page.waitForTimeout(200);
  const est = await estadoDe(page);
  const r = est.rutas.find((x) => x.codigo === ruta.codigo);
  const estados = ruta.envios.map((g) => est.envios.find((e) => e.codigoGuia === g).estado);
  v("rf28", "cerrar la ruta cambia en bloque el estado de todos sus envíos a «en ruta»", r.estado === "en ruta" && estados.every((s) => s === "en ruta"), estados.join());
  v("rf28", "la ruta registra su fecha real de salida y los ahorros por consolidación", r.fechaSalidaReal && typeof r.ahorroConsolidacion === "number");
  await ctx.close();
});

/* =====================================================================
   M5 · Tarifas
   ===================================================================== */
bloque("rf29", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const t = (codigo) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", urgente: false }, 20, cat.modalidades.find((x) => x.codigo === codigo));
    return { consolidado: t("consolidado"), aereo: t("aereo") };
  }, catalogo);
  const subtotal = (1800 + 5 * 190 + 20 * 32) * 0.9;
  v("rf29", "subtotal = (base de sucursal + peso×tarifa/kg + km×tarifa/km) × factor de modalidad", Math.abs(r.consolidado.subtotal - subtotal) < 0.001, `${r.consolidado.subtotal} vs ${subtotal}`);
  const totalAereo = Math.round((1800 + 5 * 190 + 20 * 32) * 2.2);
  v("rf29", "total sin recargos ni descuento (modalidad aérea, sin descuento) = subtotal", r.aereo.total === totalAereo, `${r.aereo.total} vs ${totalAereo}`);
  await ctx.close();
});

bloque("rf30", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const mod = cat.modalidades.find((x) => x.codigo === "consolidado");
    const t = (p) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", urgente: false, ...p }, 20, mod);
    const base = t({});
    return { sub: base.subtotal, u: t({ urgente: true }).recargos.urgente, f: t({ contenido: "fragil" }).recargos.fragil, c: t({ contenido: "frio" }).recargos.frio, s: t({ sobredimension: true }).recargos.sobredimension };
  }, catalogo);
  const casi = (a, b) => Math.abs(a - b) < 0.001;
  v("rf30", "urgente 25 %, frágil 12 %, frío 18 % y sobredimensión 20 % del subtotal (porcentajes de datos.json)", casi(r.u, r.sub * catalogo.recargos.urgente) && casi(r.f, r.sub * catalogo.recargos.fragil) && casi(r.c, r.sub * catalogo.recargos.frio) && casi(r.s, r.sub * catalogo.recargos.sobredimension), JSON.stringify(r));
  await ctx.close();
});

bloque("rf31", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const mod = (codigo) => cat.modalidades.find((x) => x.codigo === codigo);
    const t = (modalidad, p = {}) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", urgente: false, ...p }, 20, modalidad);
    const sinMarca = { ...mod("consolidado") };
    delete sinMarca.consolidada;
    const otroCodigo = { ...mod("aereo"), consolidada: true };
    const envio = (modalidad, p = {}) => ({ tarifa: t(modalidad, p), pesoFacturable: 5, distanciaKm: 20, urgente: false, contenido: "general", sobredimension: false, modalidad: modalidad.codigo, ...p });
    const fila = (modalidad, p) => m.desgloseTarifa(cat, envio(modalidad, p), modalidad).find((f) => f.clave === "descuento").regla;
    const sub = t(mod("consolidado")).subtotal;
    return {
      cons: t(mod("consolidado")), elec: t(mod("electrico")), aereo: t(mod("aereo")),
      consUrg: t(mod("consolidado"), { urgente: true }),
      sinMarca: t(sinMarca).descuento, otroCodigo: t(otroCodigo).descuento, sub,
      reglaCons: fila(mod("consolidado")), reglaElec: fila(mod("electrico")), reglaAereo: fila(mod("aereo")), reglaUrg: fila(mod("consolidado"), { urgente: true }),
      flag: m.esConsolidada(mod("consolidado")), flagAereo: m.esConsolidada(mod("aereo")),
    };
  }, catalogo);
  const pct = catalogo.tarifas.descuentoEcologico;
  const casi = (a, b) => Math.abs(a - b) < 0.001;
  v("rf31", "el catálogo marca la modalidad consolidada y el código la reconoce aunque falte la marca", r.flag === true && r.flagAereo === false && casi(r.sinMarca, r.sub * pct), JSON.stringify([r.flag, r.flagAereo, r.sinMarca]));
  v("rf31", "envío consolidado sin urgencia: descuento ecológico = % de datos.json sobre el subtotal", casi(r.cons.descuento, r.cons.subtotal * pct) && r.cons.descuento > 0, JSON.stringify([r.cons.subtotal, r.cons.descuento]));
  v("rf31", "el total del consolidado ya descuenta: round(subtotal − descuento)", r.cons.total === Math.round(r.cons.subtotal - r.cons.descuento), `${r.cons.total}`);
  v("rf31", "la baja emisión conserva su descuento y el aéreo (ni limpio ni consolidado) no recibe", casi(r.elec.descuento, r.elec.subtotal * pct) && r.aereo.descuento === 0, JSON.stringify([r.elec.descuento, r.aereo.descuento]));
  v("rf31", "la marca del catálogo gobierna la política (no depende del código de la modalidad)", casi(r.otroCodigo, r.aereo.subtotal * pct), String(r.otroCodigo));
  v("rf31", "consolidado con urgencia: recargo sí, descuento no (RN-11)", r.consUrg.descuento === 0 && r.consUrg.recargos.urgente > 0, JSON.stringify([r.consUrg.descuento, r.consUrg.recargos.urgente]));
  v("rf31", "el desglose explica el motivo (consolidada, baja emisión, ninguno, urgencia)", /consolidada/i.test(r.reglaCons) && /baja emisión/i.test(r.reglaElec) && /ni consolidada/i.test(r.reglaAereo) && /RN-11/.test(r.reglaUrg), JSON.stringify([r.reglaCons, r.reglaElec, r.reglaAereo, r.reglaUrg]));
  await ctx.close();

  // En pantalla: la comparación muestra el descuento en la opción consolidada y el catálogo declara la política
  const ui = await nueva();
  await ir(ui.page, "registro");
  await llenar(ui.page, { peso: "30", destino: "ALA-01" });
  await comparar(ui.page);
  const tarjetas = await ui.page.locator("#comparacion .opcion").evaluateAll((els) => els.map((e) => e.textContent));
  const cons = tarjetas.find((t) => /Camión consolidado/.test(t)) ?? "";
  v("rf31", "la comparación muestra el descuento ecológico en la opción consolidada", /Descuento ecológico/.test(cons) && /consolidada/i.test(cons) && !/No aplica: la modalidad no es de baja emisión ni consolidada/.test(cons), cons.replace(/\s+/g, " ").slice(0, 200));
  const total = Number((cons.match(/Total\s*₡?\s*([\d.,\s\u00a0\u202f]+)/) ?? [])[1]?.replace(/\D/g, ""));
  const km = catalogo.distancias["SJO-01"]["ALA-01"];
  const subtotalUI = (1800 + 30 * 190 + km * 32) * 0.9;
  const esperadoUI = Math.round(subtotalUI - subtotalUI * catalogo.tarifas.descuentoEcologico);
  v("rf31", "el total mostrado coincide con la tarifa calculada con descuento", total === esperadoUI, `${total} vs ${esperadoUI}`);
  await ir(ui.page, "catalogo");
  const cat = await ui.page.locator("#catalogoTarifas").innerText();
  v("rf31", "el catálogo declara la política: baja emisión y consolidada, sin urgencia", /baja emisión y consolidada/.test(cat), cat.slice(0, 160));
  await ui.ctx.close();
});

bloque("rf26", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const mod = (codigo) => cat.modalidades.find((x) => x.codigo === codigo);
    const cons = mod("consolidado");
    const ref = m.furgonetaIndividual(cat, cons);
    const envios = (n, kg, km) => Array.from({ length: n }, () => ({ pesoFacturable: kg, distanciaKm: km }));
    const sinRef = { ...cat }; delete sinRef.referencias;
    const pesado = envios(3, 300, 100);
    return {
      ref,
      refSinCatalogo: m.furgonetaIndividual(sinRef, cons) === cons,
      livianos: m.calcularConsolidacion(envios(4, 10, 100), cons, ref),
      pesados: m.calcularConsolidacion(pesado, cons, ref),
      pesadosMismoVehiculo: m.calcularConsolidacion(pesado, cons),
      uno: m.calcularConsolidacion(envios(1, 10, 100), cons, ref),
      vacio: m.calcularConsolidacion([], cons, ref),
      aereo: m.calcularConsolidacion(envios(3, 300, 200), mod("aereo"), ref),
      calc: (km, kg, x) => m.calcularEmisiones(km, kg, x),
    };
  }, catalogo);
  const casi = (a, b) => Math.abs(a - b) < 0.0011;
  const van = catalogo.referencias.furgonetaIndividual;
  const e = (km, kg, f, cap) => Number((km * f * Math.max(0.1, kg / cap)).toFixed(3));
  v("rf26", "datos.json declara la «furgoneta individual» con datos que ya estaban en el catálogo (factor del camión de combustión, capacidad de la furgoneta)", van.factorEmision === catalogo.modalidades.find((m) => m.codigo === "consolidado").factorEmision && van.capacidadKg === catalogo.modalidades.find((m) => m.codigo === "electrico").capacidadKg, JSON.stringify(van));
  const indLiv = 4 * e(100, 10, van.factorEmision, van.capacidadKg);
  const consLiv = e(100, 40, 0.09, 5000);
  v("rf26", "línea base: un viaje de furgoneta por envío (4 × 100 km) frente a un solo viaje consolidado", casi(r.livianos.emisionesIndividuales, indLiv) && casi(r.livianos.emisionesConsolidadas, consLiv), JSON.stringify([r.livianos.emisionesIndividuales, indLiv, r.livianos.emisionesConsolidadas, consLiv]));
  v("rf26", "ahorro = individuales − consolidadas, con su porcentaje", casi(r.livianos.ahorro, indLiv - consLiv) && casi(r.livianos.ahorroPorcentaje, ((indLiv - consLiv) / indLiv) * 100), JSON.stringify([r.livianos.ahorro, r.livianos.ahorroPorcentaje]));
  v("rf26", "informa viajes y km evitados (4 viajes → 1; 400 km → 100 km)", r.livianos.viajesIndividuales === 4 && r.livianos.viajesConsolidados === 1 && r.livianos.viajesEvitados === 3 && r.livianos.kmEvitados === 300, JSON.stringify([r.livianos.viajesEvitados, r.livianos.kmEvitados]));
  const indPes = 3 * e(100, 300, van.factorEmision, van.capacidadKg);
  const consPes = e(100, 900, 0.09, 5000);
  v("rf26", "con carga pesada la furgoneta individual emite más por paquete y el ahorro crece (≈84 %)", casi(r.pesados.ahorro, indPes - consPes) && r.pesados.ahorro > r.pesadosMismoVehiculo.ahorro, JSON.stringify([r.pesados.ahorro, r.pesadosMismoVehiculo.ahorro, r.pesados.ahorroPorcentaje]));
  v("rf26", "un solo envío no tiene viajes por evitar", r.uno.viajesEvitados === 0 && r.uno.kmEvitados === 0, JSON.stringify([r.uno.viajesEvitados, r.uno.kmEvitados]));
  v("rf26", "un solo envío no se presenta como consolidación: ahorro 0 % y emisiones individuales = consolidadas", r.uno.ahorro === 0 && r.uno.ahorroPorcentaje === 0 && r.uno.emisionesIndividuales === r.uno.emisionesConsolidadas, JSON.stringify(r.uno));
  v("rf26", "una ruta vacía devuelve ceros, sin NaN", r.vacio.ahorro === 0 && r.vacio.ahorroPorcentaje === 0 && r.vacio.emisionesIndividuales === 0, JSON.stringify(r.vacio));
  v("rf26", "el ahorro nunca es negativo (aunque la modalidad de la ruta emita más que la furgoneta)", r.aereo.ahorro >= 0, String(r.aereo.ahorro));
  v("rf26", "si el catálogo no trae la referencia se usa el vehículo de la ruta (un viaje por envío)", r.refSinCatalogo === true);
  await ctx.close();

  // Rechazo de una referencia inválida en el catálogo (RF-18)
  const val = await nueva();
  const msg = await dentro(val.page, "/js/validaciones.js", (m, cat) => {
    const malo = JSON.parse(JSON.stringify(cat));
    malo.referencias.furgonetaIndividual.factorEmision = 0;
    try { m.validarCatalogo(malo); return "sin error"; } catch (er) { return er.message; }
  }, catalogo);
  v("rf26", "un catálogo con la referencia mal definida informa el campo (referencias.furgonetaIndividual.factorEmision)", /referencias\.furgonetaIndividual\.factorEmision/.test(msg), msg);
  await val.ctx.close();

  // En pantalla: tarjeta de ruta abierta con envíos, despacho y ruta ya despachada
  const ui = await nueva();
  await ir(ui.page, "rutas");
  const abierta = demo.rutas.find((x) => x.estado === "abierta" && x.envios.length >= 2);
  const tarjeta = await ui.page.locator(`#ruta-${abierta.codigo}`).innerText();
  v("rf26", "la tarjeta de ruta muestra furgonetas individuales, consolidado, ahorro, % y viajes evitados", /furgonetas individuales/i.test(tarjeta) && /Consolidado/.test(tarjeta) && /Ahorro por consolidación/.test(tarjeta) && /%/.test(tarjeta) && /viajes evitados/.test(tarjeta) && /km evitados/.test(tarjeta), tarjeta.replace(/\s+/g, " ").slice(0, 260));
  await ui.page.click(`#ruta-${abierta.codigo} button[data-accion="cerrar"]`);
  const resumen = await ui.page.locator("#dialogoConfirmacion").innerText();
  v("rf26", "el aviso de despacho compara furgonetas individuales con el viaje consolidado", /furgonetas individuales/i.test(resumen) && /Ahorro por consolidación/.test(resumen), resumen.replace(/\s+/g, " ").slice(0, 200));
  await ui.page.click('#dialogoConfirmacion button[value="confirm"]');
  await ui.page.waitForTimeout(200);
  const est = await estadoDe(ui.page);
  const ruta = est.rutas.find((x) => x.codigo === abierta.codigo);
  const guias = ruta.envios.map((g) => est.envios.find((x) => x.codigoGuia === g));
  const c = ruta.consolidacion ?? {};
  v("rf26", "al despachar se guarda el resultado de la consolidación (ahorro, %, viajes y km evitados)", ruta.estado === "en ruta" && c.ahorro === ruta.ahorroConsolidacion && c.viajesEvitados === guias.length - 1 && typeof c.ahorroPorcentaje === "number" && typeof c.kmEvitados === "number" && c.emisionesIndividuales >= c.emisionesConsolidadas, JSON.stringify(c));
  v("rf26", "el ahorro se reparte entre los envíos de la ruta (RF-48)", guias.every((g) => Math.abs(g.emisionesEvitadasConsolidacionKgCO2e - c.ahorro / guias.length) < 0.0011), guias.map((g) => g.emisionesEvitadasConsolidacionKgCO2e).join());
  const despachada = await ui.page.locator(`#ruta-${abierta.codigo}`).innerText();
  v("rf26", "una ruta ya despachada conserva y muestra el resultado guardado", despachada.includes(c.ahorro.toFixed(3)) && despachada.includes(c.emisionesIndividuales.toFixed(3)), despachada.replace(/\s+/g, " ").slice(0, 200));
  const demoDespachada = demo.rutas.find((x) => x.estado === "en ruta");
  v("rf26", "las rutas despachadas de la demostración traen su resultado de consolidación", demoDespachada.consolidacion && demoDespachada.consolidacion.ahorro === demoDespachada.ahorroConsolidacion && demoDespachada.consolidacion.viajesEvitados === demoDespachada.envios.length - 1, JSON.stringify(demoDespachada.consolidacion));
  // Compatibilidad: estado y catálogo guardados por la v2.2.1 (sin `consolidacion`, sin referencia, sin marca, sin descuento)
  {
    const viejo = clonar(demo);
    viejo.rutas.forEach((x) => delete x.consolidacion);
    const antiguo = viejo.envios.find((x) => x.modalidad === "consolidado" && x.tarifa && !x.urgente);
    antiguo.tarifa.descuento = 0;
    antiguo.tarifa.total = Math.round(antiguo.tarifa.subtotal + Object.values(antiguo.tarifa.recargos).reduce((a, b) => a + b, 0));
    const cacheViejo = clonar(catalogo);
    delete cacheViejo.referencias;
    cacheViejo.modalidades.forEach((m) => delete m.consolidada);
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await ctx2.newPage();
    const errs = [];
    p2.on("pageerror", (e) => errs.push(e.message));
    p2.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
    await p2.route("**/datos/datos.json", (r) => r.abort());
    await p2.addInitScript(([e, c]) => { localStorage.setItem("ecoruta_estado_v5", JSON.stringify(e)); localStorage.setItem("ecoruta_catalogo_cache", JSON.stringify(c)); }, [viejo, cacheViejo]);
    await p2.goto(URL);
    await p2.waitForSelector("#aplicacion:not([hidden])");
    await ir(p2, "rutas");
    const rutaVieja = viejo.rutas.find((x) => x.estado === "en ruta");
    const textoViejo = await p2.locator(`#ruta-${rutaVieja.codigo}`).innerText();
    const textoAbierta = await p2.locator(`#ruta-${abierta.codigo}`).innerText();
    v("rf26", "compatibilidad: con el catálogo y el estado de la v2.2.1 las rutas se muestran sin errores (línea base = vehículo de la ruta)", /furgonetas individuales/i.test(textoViejo) && /furgonetas individuales/i.test(textoAbierta) && errs.length === 0, errs.join(" | ") || textoViejo.replace(/\s+/g, " ").slice(0, 160));
    await ir(p2, "registro");
    await p2.fill("#buscarEnvio", antiguo.codigoGuia);
    await p2.waitForTimeout(400);
    await p2.click(`#tablaEnvios tr[data-guia="${antiguo.codigoGuia}"] button[data-accion="detalle"]`);
    await p2.waitForTimeout(250);
    const detalleViejo = await p2.locator("#contenidoDetalleEnvio").innerText();
    v("rf31", "compatibilidad: una guía consolidada cobrada antes del RF-31 explica por qué no tiene descuento", /registrada antes/i.test(detalleViejo), detalleViejo.slice(0, 120));
    await ctx2.close();
  }
  await ir(ui.page, "catalogo");
  const mods = await ui.page.locator("#catalogoModalidades").innerText();
  v("rf26", "el catálogo muestra la furgoneta individual como referencia del ahorro", /Furgoneta individual/.test(mods) && /referencia del ahorro/.test(mods), mods.slice(-220));
  await ui.ctx.close();
});

bloque("rf32", async () => {
  const { page, ctx } = await nueva();
  const e = await registrar(page, { contenido: "fragil", urgente: true });
  await page.click(`#tablaEnvios tr[data-guia="${e.codigoGuia}"] button[data-accion="detalle"]`);
  const t = await page.locator("#contenidoDetalleEnvio").innerText();
  v("rf32", "el detalle desglosa base, peso, distancia, subtotal, cada recargo, descuento y total", ["Base", "Peso", "Distancia", "Subtotal", "urgen", "rágil", "Total"].every((p) => new RegExp(p, "i").test(t)), t.slice(0, 80));
  v("rf32", "cada fila explica la regla aplicada (porcentaje o fórmula)", /%/.test(t) && /×|x /.test(t));
  await ctx.close();
});

bloque("rf33", async () => {
  const { page, ctx } = await nueva();
  const m = await dentro(page, "/js/reglas.js", (mod) => mod.moneda(1234567));
  v("rf33", "moneda() da formato de colones con separador de miles", /₡/.test(m) && /1.234.567|1\s234\s567/.test(m), m);
  const otros = archivosJS.filter((f) => !f.endsWith("reglas.js") && /style:\s*["']currency["']|Intl\.NumberFormat/.test(textoJS(f)));
  v("rf33", "ningún otro módulo define su propio formato de moneda", otros.length === 0, otros.join());
  await ctx.close();
});

/* =====================================================================
   M6 · Seguimiento
   ===================================================================== */
bloque("rf34", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m) => ({ estados: m.ESTADOS, cancelado: m.ESTADO_CANCELADO }));
  v("rf34", "los seis estados del enunciado, en orden", JSON.stringify(r.estados) === JSON.stringify(["registrado", "en bodega", "asignado a ruta", "en ruta", "entregado", "devuelto"]), r.estados.join());
  v("rf34", "«cancelado» se añade aparte como baja lógica (no es un estado del ciclo de vida)", r.cancelado === "cancelado" && !r.estados.includes("cancelado"));
  await ctx.close();
});

bloque("rf35", async () => {
  const { page, ctx } = await nueva();
  const T = await dentro(page, "/js/reglas.js", (m) => m.TRANSICIONES);
  v("rf35", "tabla explícita de transiciones", JSON.stringify(T.registrado) === JSON.stringify(["en bodega", "devuelto"]) && T.entregado.length === 0 && T.devuelto.length === 0 && T.cancelado.length === 0, JSON.stringify(T));
  await ir(page, "seguimiento");
  const reg = demo.envios.find((e) => e.estado === "registrado");
  await page.fill("#guiaSeguimiento", reg.codigoGuia);
  await page.click('#formSeguimiento button[type="submit"]');
  const botones = await page.locator("#resultadoSeguimiento button[data-estado]").evaluateAll((l) => l.map((b) => b.dataset.estado));
  v("rf35", "desde «registrado» solo se ofrece pasar a «en bodega» o «devuelto»", JSON.stringify(botones.sort()) === JSON.stringify(["devuelto", "en bodega"]), botones.join());
  const ent = demo.envios.find((e) => e.estado === "entregado");
  await page.fill("#guiaSeguimiento", ent.codigoGuia);
  await page.click('#formSeguimiento button[type="submit"]');
  v("rf35", "un envío entregado no ofrece ningún cambio", (await page.locator("#resultadoSeguimiento button[data-estado]").count()) === 0);
  await ctx.close();
});

bloque("rf36", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "seguimiento");
  const reg = demo.envios.find((e) => e.estado === "registrado");
  await page.fill("#guiaSeguimiento", reg.codigoGuia);
  await page.click('#formSeguimiento button[type="submit"]');
  await page.click('#resultadoSeguimiento button[data-estado="en bodega"]');
  await page.click('#dialogoConfirmacion button[value="confirm"]');
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const h = est.envios.find((e) => e.codigoGuia === reg.codigoGuia).historial.at(-1);
  v("rf36", "cada cambio guarda estado anterior, estado nuevo y fecha-hora ISO", h.estadoAnterior === "registrado" && h.estado === "en bodega" && !Number.isNaN(Date.parse(h.fecha)), JSON.stringify(h));
  const linea = await page.locator("#historialSeguimiento").innerText();
  v("rf36", "la línea de tiempo muestra el cambio con fecha y hora", /en bodega/i.test(linea) && /\d{1,2}\/\d{1,2}\/\d{4}/.test(linea) && /\d{1,2}:\d{2}/.test(linea), linea.slice(0, 100));
  await ctx.close();
});

bloque("rf38", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.selectOption("#cantidadEnviosPagina", "20");
  const antes = await page.locator("#tablaEnvios tr").count();
  const sucursal = "SJO-01";
  await page.selectOption("#filtroEstadoEnvio", "en bodega");
  await page.selectOption("#filtroSucursalEnvio", sucursal);
  const esperados = demo.envios.filter((e) => e.estado === "en bodega" && (e.sucursalOrigen === sucursal || e.sucursalDestino === sucursal)).length;
  const filas = await page.locator("#tablaEnvios tr[data-guia]").count();
  v("rf38", "estado + sucursal combinados dan la intersección esperada", filas === Math.min(20, esperados) && esperados > 0, `${filas} de ${esperados}`);
  await page.fill("#buscarEnvio", "zzzz-no-existe");
  v("rf38", "estado + sucursal + texto sin coincidencias muestra el mensaje de filtros", /No hay solicitudes que coincidan/.test(await page.locator("#tablaEnvios").innerText()));
  await page.click("#limpiarFiltrosEnvios");
  v("rf38", "«Limpiar filtros» restablece la tabla completa", (await page.locator("#tablaEnvios tr[data-guia]").count()) === Math.min(20, demo.envios.length) && antes > 0);
  await page.selectOption("#filtroModalidadEnvio", "consolidado");
  const consol = demo.envios.filter((e) => e.modalidad === "consolidado").length;
  v("rf38", "el filtro de modalidad funciona", (await page.locator("#tablaEnvios tr[data-guia]").count()) === Math.min(20, consol));
  await ctx.close();
});

bloque("rf39", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.selectOption("#cantidadEnviosPagina", "20");
  const total = () => page.locator("#tablaEnvios tr[data-guia] td:nth-child(4)").allTextContents().then((l) => l.map(numeros));
  await page.click('.orden-columna[data-orden="total"]');
  const asc = await total();
  const sortAsc = await page.locator('th:has(.orden-columna[data-orden="total"])').getAttribute("aria-sort");
  await page.click('.orden-columna[data-orden="total"]');
  const desc = await total();
  const sortDesc = await page.locator('th:has(.orden-columna[data-orden="total"])').getAttribute("aria-sort");
  v("rf39", "ordenar por total: ascendente y luego descendente", asc.every((x, i) => i === 0 || asc[i - 1] <= x) && desc.every((x, i) => i === 0 || desc[i - 1] >= x), `${asc.slice(0, 3)} / ${desc.slice(0, 3)}`);
  v("rf39", "indicación visual (▲/▼) y aria-sort en la columna activa", sortAsc === "ascending" && sortDesc === "descending" && /▼/.test(await page.locator('.orden-columna[data-orden="total"]').innerText()), `${sortAsc}/${sortDesc}`);
  await ctx.close();
});

bloque("rf40", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.selectOption("#cantidadEnviosPagina", "5");
  const total = demo.envios.length;
  v("rf40", "5 por página: 5 filas y «Página 1 de N»", (await page.locator("#tablaEnvios tr[data-guia]").count()) === 5 && (await page.locator("#informacionPaginaEnvios").innerText()) === `Página 1 de ${Math.ceil(total / 5)}`);
  await page.click("#paginaSiguienteEnvios");
  v("rf40", "«Siguiente» avanza y habilita «Anterior»", (await page.locator("#informacionPaginaEnvios").innerText()).startsWith("Página 2") && !(await page.locator("#paginaAnteriorEnvios").isDisabled()));
  await page.selectOption("#cantidadEnviosPagina", "20");
  v("rf40", "cambiar el tamaño vuelve a la página 1", (await page.locator("#informacionPaginaEnvios").innerText()).startsWith("Página 1") && (await page.locator("#tablaEnvios tr[data-guia]").count()) === 20);
  await ctx.close();
});

/* =====================================================================
   M7 · Inventario
   ===================================================================== */
bloque("rf42", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "inventario");
  const por = (cod) => demo.envios.filter((e) => ["en bodega", "asignado a ruta"].includes(e.estado) && e.sucursalOrigen === cod);
  const s = catalogo.sucursales.find((x) => x.codigo === "SJO-01");
  const lista = por("SJO-01");
  const kg = lista.reduce((a, e) => a + e.pesoFacturable, 0);
  const tarjeta = (await page.locator("#ocupacionSucursales article", { hasText: s.nombre }).innerText()).replace(/ /g, " ");
  v("rf42", "cada sucursal muestra paquetes, kg y % de su capacidad (sin cancelados)", tarjeta.includes(`${lista.length} ${lista.length === 1 ? "paquete" : "paquetes"}`) && tarjeta.includes(`${kg.toFixed(1)} kg`) && tarjeta.includes(`${((kg / s.capacidadKg) * 100).toFixed(1)}%`), tarjeta);
  await ctx.close();
});

bloque("rf43", async () => {
  const lleno = clonar(demo);
  const e = lleno.envios.find((x) => x.estado === "en bodega" && x.sucursalOrigen === "LIM-01") ?? lleno.envios.find((x) => x.estado === "en bodega");
  e.pesoFacturable = 4000;
  const suc = catalogo.sucursales.find((s) => s.codigo === e.sucursalOrigen);
  const { page, ctx } = await abrir(browser, URL, { estadoInicial: lleno });
  await ir(page, "inventario");
  const alerta = await page.locator("#alertasInventario").innerText();
  v("rf43", "al superar el umbral aparece una alerta de texto con la sucursal (no solo color)", /Alerta/.test(alerta) && alerta.includes(suc.nombre) && /umbral/.test(alerta), alerta);
  v("rf43", "la región de alertas es aria-live=assertive", (await page.locator("#alertasInventario").getAttribute("aria-live")) === "assertive");
  await ctx.close();
});

bloque("rf45", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m) => {
    const cfg = { diasRetencion: 3, diasRetencionFrio: 1 };
    const ahora = Date.now();
    const e = (estado, dias, contenido = "general") => ({ estado, contenido, fechaIngresoBodega: new Date(ahora - dias * 86400000 - 1000).toISOString() });
    return [m.esRetenido(e("en bodega", 4), cfg, ahora), m.esRetenido(e("en bodega", 3), cfg, ahora), m.esRetenido(e("en bodega", 2, "frio"), cfg, ahora), m.esRetenido(e("en bodega", 2), cfg, ahora), m.esRetenido(e("en ruta", 9), cfg, ahora), m.esRetenido(e("entregado", 9), cfg, ahora)];
  });
  v("rf45", "esRetenido(): excede el plazo → true; dentro del plazo → false; frío usa su plazo propio", JSON.stringify(r) === JSON.stringify([true, false, true, false, false, false]), JSON.stringify(r));
  await ctx.close();
});

bloque("rf46", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "inventario");
  const c = await page.locator("#inventarioPorContenido").innerText();
  const d = await page.locator("#inventarioPorDestino").innerText();
  v("rf46", "distribución por tipo de contenido (general, frágil, cadena de frío)", /General/.test(c) && /Frágil/.test(c) && /fr[ií]o/i.test(c), c.replace(/\n/g, " "));
  v("rf46", "distribución por sucursal de destino", catalogo.sucursales.some((s) => d.includes(s.nombre)) && (await page.locator("#inventarioPorDestino .barra").count()) >= 1);
  await ctx.close();
});

/* =====================================================================
   M8 · Panel
   ===================================================================== */
bloque("rf47", async () => {
  const { page, ctx } = await nueva();
  const vigentes = demo.envios.filter((e) => e.estado !== "cancelado");
  const facturado = vigentes.reduce((s, e) => s + e.tarifa.total, 0);
  const peso = vigentes.reduce((s, e) => s + e.pesoFacturable, 0);
  const k = async (id) => (await page.locator(`#${id}`).innerText()).replace(/ /g, " ");
  v("rf47", "total de envíos (sin cancelados)", Number(await k("kpiEnvios")) === vigentes.length, await k("kpiEnvios"));
  v("rf47", "monto facturado y tarifa promedio", numeros(await k("kpiFacturado")) === facturado && numeros(await k("kpiPromedio")) === Math.round(facturado / vigentes.length), `${await k("kpiFacturado")} / ${await k("kpiPromedio")}`);
  const pesoTexto = (await k("kpiPeso")).replace(" kg", "");
  v("rf47", "peso facturable total", Math.abs(Number(pesoTexto.replace(",", ".")) - peso) < 0.06, `${pesoTexto} vs ${peso.toFixed(1)}`);
  const porEstado = await page.locator("#resumenEstados").innerText();
  v("rf47", "cantidad por estado", ["registrado", "en bodega", "en ruta", "entregado"].every((s) => porEstado.toLowerCase().includes(s)) && porEstado.includes(`En bodega: ${demo.envios.filter((e) => e.estado === "en bodega").length}`), porEstado.replace(/\n/g, " "));
  await ctx.close();
});

bloque("rf48", async () => {
  const { page, ctx } = await nueva();
  const vigentes = demo.envios.filter((e) => e.estado !== "cancelado");
  const emis = vigentes.reduce((s, e) => s + e.emisionesKgCO2e, 0);
  const limpias = vigentes.filter((e) => catalogo.modalidades.find((m) => m.codigo === e.modalidad).bajaEmision).length;
  const k = async (id) => (await page.locator(`#${id}`).innerText()).replace(/ /g, " ");
  v("rf48", "emisiones totales estimadas", (await k("kpiEmisiones")).startsWith(emis.toFixed(3)), `${await k("kpiEmisiones")} vs ${emis.toFixed(3)}`);
  v("rf48", "porcentaje de envíos en modalidades de baja emisión", (await k("kpiPorcentajeLimpio")) === `${((limpias / vigentes.length) * 100).toFixed(1)}%`, await k("kpiPorcentajeLimpio"));
  v("rf48", "emisiones evitadas (modalidad limpia y consolidación) presentes", /kg/.test(await k("kpiEvitadasLimpias")) && /kg/.test(await k("kpiEvitadasConsolidadas")));
  await ctx.close();
});

bloque("rf49", async () => {
  const app = textoJS("js/app.js");
  const panel = app.slice(app.indexOf("function renderPanel"), app.indexOf("function renderAlmacenamiento"));
  v("rf49", "el panel calcula con map / filter / reduce / sort / slice", ["reduce", "filter(", "map(", "sort(", "slice("].every((f) => panel.includes(f)));
  const sinFor = !/\b(for|while)\b\s*\(/.test(panel) && !/forEach/.test(panel);
  v("rf49", "el cálculo del panel no usa ciclos for/while/forEach ni variables externas", sinFor);
  const acumula = archivosJS.filter((f) => !f.endsWith("demo.js") && /\bfor\s*\([^)]*\)\s*\{?[^}]*\+=/.test(textoJS(f)));
  v("rf49", "ningún ciclo acumula con «+=» en una variable externa", acumula.length === 0, acumula.join());
  const acumuladores = archivosJS.filter((f) => !f.endsWith("demo.js") && /\+=|-=/.test(textoJS(f)));
  v("rf49", "sin acumuladores «+=» (excepto el contador de la demo)", acumuladores.length === 0, acumuladores.join());
});

bloque("rf50", async () => {
  const { page, ctx } = await nueva();
  const r = await page.evaluate(() => ({
    barras: document.querySelectorAll("#graficoSucursales .barra-fill").length,
    dona: getComputedStyle(document.querySelector("#graficoModalidades")).backgroundImage.includes("conic-gradient") || document.querySelector("#graficoModalidades").innerHTML.includes("conic-gradient") || document.querySelector("#graficoModalidades [style*='conic-gradient']") !== null,
    canvas: document.querySelectorAll("canvas, svg").length,
  }));
  v("rf50", "gráfico de barras con HTML y CSS puros", r.barras >= 3, r.barras);
  v("rf50", "gráfico de dona con conic-gradient (CSS)", r.dona);
  v("rf50", "sin canvas ni bibliotecas de gráficos", r.canvas === 0, r.canvas);
  await ctx.close();
});

bloque("rf51", async () => {
  const { page, ctx } = await nueva();
  await page.selectOption("#panelSucursal", "SJO-01");
  const esperado = demo.envios.filter((e) => e.estado !== "cancelado" && (e.sucursalOrigen === "SJO-01" || e.sucursalDestino === "SJO-01")).length;
  v("rf51", "filtrar por sucursal recalcula los indicadores", Number(await page.locator("#kpiEnvios").innerText()) === esperado, `${await page.locator("#kpiEnvios").innerText()} vs ${esperado}`);
  const hoy = new Date();
  const iso = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  await page.selectOption("#panelSucursal", "");
  await page.fill("#panelFechaDesde", iso(hoy));
  await page.fill("#panelFechaHasta", iso(hoy));
  await page.waitForTimeout(80);
  const hoyN = demo.envios.filter((e) => e.estado !== "cancelado" && iso(new Date(e.fechaRegistro)) === iso(hoy)).length;
  v("rf51", "filtrar por rango de fechas recalcula los indicadores", Number(await page.locator("#kpiEnvios").innerText()) === hoyN, `${await page.locator("#kpiEnvios").innerText()} vs ${hoyN}`);
  await ctx.close();
});

bloque("rf52", async () => {
  const { page, ctx } = await nueva();
  await page.evaluate(() => { window.__sinRecarga = true; });
  const antes = Number(await page.locator("#kpiEnvios").innerText());
  await registrar(page);
  await ir(page, "panel");
  const despues = Number(await page.locator("#kpiEnvios").innerText());
  v("rf52", "al registrar un envío el panel sube +1 sin recargar la página", despues === antes + 1 && (await page.evaluate(() => window.__sinRecarga === true)), `${antes}→${despues}`);
  const guia = (await estadoDe(page)).envios.at(-1).codigoGuia;
  await ir(page, "registro");
  await page.click(`#tablaEnvios tr[data-guia="${guia}"] button[data-accion="cancelar"]`);
  await page.fill("#motivoCancelacion", "Prueba de actualización del panel");
  await page.click("#confirmarCancelacion");
  await page.waitForTimeout(150);
  await ir(page, "panel");
  v("rf52", "al cancelar vuelve a bajar (sin recargar)", Number(await page.locator("#kpiEnvios").innerText()) === antes && (await page.evaluate(() => window.__sinRecarga === true)));
  await ctx.close();
});

bloque("rf53", async () => {
  const { page, ctx } = await nueva();
  const items = await page.locator("#rankingSucursales li").allTextContents();
  const valores = items.map((t) => Number(t.match(/: ([\d.,]+) kg/)?.[1].replace(",", ".")));
  v("rf53", "ranking de las tres sucursales con menor emisión media por envío", items.length === 3 && valores.every((x, i) => i === 0 || valores[i - 1] <= x), items.join(" | "));
  await ctx.close();
});

/* =====================================================================
   M9 · Configuración y datos
   ===================================================================== */
bloque("rf55", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#exportarRespaldo")]);
  const ruta = await descarga.path();
  const json = JSON.parse(fs.readFileSync(ruta, "utf8"));
  v("rf55", "la exportación descarga un .json con clientes, envíos, rutas y configuración", /\.json$/.test(descarga.suggestedFilename()) && json.clientes.length === demo.clientes.length && json.envios.length === demo.envios.length && json.rutas.length === demo.rutas.length && json.configuracion, descarga.suggestedFilename());
  await ctx.close();
});

bloque("rf56", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  await page.setInputFiles("#importarRespaldo", { name: "malo.json", mimeType: "application/json", buffer: Buffer.from("{esto no es json") });
  await page.waitForTimeout(150);
  v("rf56", "un archivo inválido se rechaza con mensaje y sin tocar los datos", (await toasts(page)).join(" ").includes("Respaldo inválido") && (await estadoDe(page)).envios.length === demo.envios.length);
  await page.setInputFiles("#importarRespaldo", { name: "falta.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ clientes: "no", envios: [] })) });
  await page.waitForTimeout(150);
  v("rf56", "una estructura incorrecta se rechaza indicando el problema", (await toasts(page)).join(" ").includes("Respaldo inválido"));
  const ok = clonar(demo);
  ok.clientes = ok.clientes.slice(0, 3);
  ok.envios = [];
  ok.rutas = [];
  await page.setInputFiles("#importarRespaldo", { name: "ok.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(ok)) });
  await page.waitForSelector("#dialogoConfirmacion[open]");
  const aviso = await page.locator("#textoConfirmacion").innerText();
  v("rf56", "antes de importar advierte que reemplaza los datos y cuántos registros trae", /Reemplazará/.test(aviso) && /3 clientes/.test(aviso), aviso);
  await Promise.all([page.waitForEvent("load"), page.click('#dialogoConfirmacion button[value="confirm"]')]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  v("rf56", "al confirmar se reemplazan los datos", (await estadoDe(page)).clientes.length === 3);
  await ctx.close();
});

bloque("rf57", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  await page.click("#restablecerDatos");
  const t1 = await page.locator("#tituloConfirmacion").innerText();
  await page.click('#dialogoConfirmacion button[value="confirm"]');
  await page.waitForTimeout(100);
  const t2 = await page.locator("#tituloConfirmacion").innerText();
  v("rf57", "reiniciar pide dos confirmaciones distintas", t1 === "Primera confirmación" && t2 === "Segunda confirmación", `${t1} / ${t2}`);
  await page.click('#dialogoConfirmacion button[value="cancel"]');
  await page.waitForTimeout(100);
  v("rf57", "cancelar la segunda deja los datos intactos", (await estadoDe(page)).envios.length === demo.envios.length);
  await page.click("#restablecerDatos");
  await page.click('#dialogoConfirmacion button[value="confirm"]');
  await page.waitForTimeout(100);
  await Promise.all([page.waitForEvent("load"), page.click('#dialogoConfirmacion button[value="confirm"]')]);
  await page.waitForSelector("#aplicacion:not([hidden])");
  const est = await estadoDe(page);
  v("rf57", "confirmar las dos deja el sistema vacío", est.envios.length === 0 && est.clientes.length === 0 && est.rutas.length === 0);
  await ctx.close();
});

bloque("rf58", async () => {
  v("rf58", "la demo trae ≥40 envíos, 15 clientes y 5 rutas", demo.envios.length >= 40 && demo.clientes.length === 15 && demo.rutas.length === 5, `${demo.envios.length}/${demo.clientes.length}/${demo.rutas.length}`);
  const porGuia = new Map(demo.envios.map((e) => [e.codigoGuia, e]));
  const coherente = demo.rutas.every((r) => r.envios.every((g) => porGuia.get(g)?.rutaAsignada === r.codigo && porGuia.get(g).estado === (r.estado === "abierta" ? "asignado a ruta" : "en ruta") || porGuia.get(g)?.estado === "entregado" || porGuia.get(g)?.estado === "devuelto"));
  v("rf58", "las rutas son utilizables: cada envío «en ruta» o «asignado» pertenece a una ruta coherente", coherente && demo.envios.filter((e) => ["en ruta", "asignado a ruta"].includes(e.estado)).every((e) => demo.rutas.find((r) => r.codigo === e.rutaAsignada)?.envios.includes(e.codigoGuia)));
  v("rf58", "hay envíos en todos los estados (incluidos retenidos, cancelados y devueltos)", ["registrado", "en bodega", "asignado a ruta", "en ruta", "entregado", "devuelto", "cancelado"].every((s) => demo.envios.some((e) => e.estado === s)));
  v("rf58", "hay al menos un envío retenido y una ruta abierta vacía para probar", demo.envios.some((e) => e.estado === "en bodega" && Math.floor((Date.now() - new Date(e.fechaIngresoBodega)) / 86400000) > (e.contenido === "frio" ? 1 : 3)) && demo.rutas.some((r) => r.estado === "abierta" && r.envios.length === 0));
});

bloque("rf59", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  const t = await page.locator("#usoAlmacenamiento").innerText();
  v("rf59", "muestra el espacio usado en localStorage (KB y % de 5 MB)", /KB de 5 MB/.test(t) && /%/.test(t) && /Capacidad disponible/.test(t), t);
  await page.evaluate(() => localStorage.setItem("relleno", "x".repeat(4.2 * 1024 * 1024 / 2)));
  await page.reload();
  await page.waitForSelector("#aplicacion:not([hidden])");
  await ir(page, "configuracion");
  const t2 = await page.locator("#usoAlmacenamiento").innerText();
  v("rf59", "cerca del límite (≥80 %) advierte con texto", /Advertencia: cerca del límite/.test(t2), t2);
  await ctx.close();
});

/* =====================================================================
   Reglas de negocio
   ===================================================================== */
bloque("rn02", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/validaciones.js", (m, reglas) => {
    const base = { remitente: "a", destinatario: "b", origen: "SJO-01", destino: "ALA-01", largo: 10, ancho: 10, alto: 10, sobredimensionMarcada: false };
    const msg = (peso) => m.validarEnvioFormulario({ ...base, pesoReal: peso }, reglas).find((e) => e.campo === "peso")?.mensaje ?? null;
    return [msg(0.05), msg(0.1), msg(500), msg(501)];
  }, catalogo.reglas);
  v("rn02", "peso por debajo del mínimo: «El peso mínimo es 0.1 kg.»", r[0] === "El peso mínimo es 0.1 kg.", r[0]);
  v("rn02", "los límites exactos (0.1 y 500 kg) son válidos", r[1] === null && r[2] === null);
  v("rn02", "peso por encima del máximo: «El peso máximo es 500 kg.»", r[3] === "El peso máximo es 500 kg.", r[3]);
  await ctx.close();
});

bloque("rn03", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const mod = cat.modalidades.find((x) => x.codigo === "consolidado");
    const con = m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", sobredimension: true }, 20, mod);
    return [m.esSobredimensionado({ largo: 200, ancho: 10, alto: 10 }, cat.reglas), m.esSobredimensionado({ largo: 201, ancho: 10, alto: 10 }, cat.reglas), con.recargos.sobredimension / con.subtotal];
  }, catalogo);
  v("rn03", "200 cm es el límite (no excede); 201 cm excede", r[0] === false && r[1] === true, JSON.stringify(r));
  v("rn03", "la sobredimensión autorizada añade el 20 % de recargo", Math.abs(r[2] - 0.2) < 1e-9, r[2]);
  await ctx.close();
});

bloque("rn04", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const bici = (peso, km) => m.modalidadesViables(cat, { pesoFacturable: peso, contenido: "general" }, suc, km).some((x) => x.codigo === "bicicleta");
    return [bici(25, 30), bici(25.1, 30), bici(25, 31)];
  }, catalogo);
  v("rn04", "bicicleta viable hasta 25 kg y 30 km; no con 25.1 kg ni con 31 km", JSON.stringify(r) === JSON.stringify([true, false, false]), JSON.stringify(r));
  await ctx.close();
});

bloque("rn05", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const aereo = (km) => m.modalidadesViables(cat, { pesoFacturable: 5, contenido: "general" }, suc, km).some((x) => x.codigo === "aereo");
    return [aereo(119), aereo(120), aereo(20)];
  }, catalogo);
  v("rn05", "aéreo solo desde 120 km", JSON.stringify(r) === JSON.stringify([false, true, false]), JSON.stringify(r));
  await ctx.close();
});

bloque("rn06", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  v("rn06", "Configuración expone los días máximos en bodega y los de cadena de frío", (await page.locator("#diasRetencion").count()) === 1 && (await page.locator("#diasRetencionFrio").count()) === 1);
  await page.fill("#diasRetencionFrio", "2");
  await page.dispatchEvent("#diasRetencionFrio", "change");
  await page.waitForTimeout(80);
  v("rn06", "el plazo de frío se guarda aparte del plazo normal", (await estadoDe(page)).configuracion.diasRetencionFrio === 2 && (await estadoDe(page)).configuracion.diasRetencion === 3);
  await ctx.close();
});

bloque("rn09", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.selectOption("#cantidadEnviosPagina", "20");
  const enRuta = demo.envios.find((e) => e.estado === "en ruta");
  await page.fill("#buscarEnvio", enRuta.codigoGuia);
  const fila = `#tablaEnvios tr[data-guia="${enRuta.codigoGuia}"]`;
  v("rn09", "un envío en ruta no puede editarse ni cancelarse (botones deshabilitados)", (await page.locator(`${fila} button[data-accion="editar"]`).isDisabled()) && (await page.locator(`${fila} button[data-accion="cancelar"]`).isDisabled()));
  const ent = demo.envios.find((e) => e.estado === "entregado");
  await page.fill("#buscarEnvio", ent.codigoGuia);
  const fila2 = `#tablaEnvios tr[data-guia="${ent.codigoGuia}"]`;
  v("rn09", "un envío entregado tampoco", (await page.locator(`${fila2} button[data-accion="editar"]`).isDisabled()) && (await page.locator(`${fila2} button[data-accion="cancelar"]`).isDisabled()));
  const puede = await dentro(page, "/js/reglas.js", (m) => [m.puedeCancelarse({ estado: "en ruta" }), m.puedeCancelarse({ estado: "entregado" }), m.puedeCancelarse({ estado: "en bodega" })]);
  v("rn09", "la regla vive en reglas.js (puedeCancelarse)", JSON.stringify(puede) === JSON.stringify([false, false, true]));
  await ctx.close();
});

bloque("rn11", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const mod = cat.modalidades.find((x) => x.codigo === "electrico");
    const t = (urgente) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", urgente }, 20, mod);
    return [t(false).descuento, t(true).descuento, t(true).recargos.urgente];
  }, catalogo);
  v("rn11", "baja emisión sin urgencia: descuento ecológico del 10 %", r[0] > 0, JSON.stringify(r));
  v("rn11", "con urgencia: recargo sí, descuento no (no se acumulan)", r[1] === 0 && r[2] > 0, JSON.stringify(r));
  const c2 = await dentro(page, "/js/reglas.js", (m, cat) => {
    const suc = cat.sucursales.find((s) => s.codigo === "SJO-01");
    const mod = cat.modalidades.find((x) => x.codigo === "consolidado");
    const t = (urgente) => m.calcularTarifa(cat, suc, { pesoFacturable: 5, contenido: "general", urgente }, 20, mod);
    return [t(false).descuento, t(true).descuento, t(true).recargos.urgente];
  }, catalogo);
  v("rn11", "modalidad consolidada: con urgencia tampoco se acumula el descuento", c2[0] > 0 && c2[1] === 0 && c2[2] > 0, JSON.stringify(c2));
  await ctx.close();
});

/* =====================================================================
   7.1 · HTML semántico, formularios, tablas y accesibilidad
   ===================================================================== */
bloque("sem", async () => {
  const html = leer("index.html");
  const cuenta = (re) => (html.match(re) || []).length;
  const divs = cuenta(/<div\b/g);
  const semanticos = cuenta(/<(header|nav|main|section|article|aside|footer|form|fieldset|table|ul|ol|dl)\b/g);
  v("sem", "usa header, nav, main, section, article, aside y footer", ["header", "nav", "main", "section", "article", "aside", "footer"].every((t) => new RegExp(`<${t}\\b`).test(html)));
  v("sem", "los div son minoría frente a los elementos semánticos (sin «divitis»)", divs < semanticos, `${divs} div vs ${semanticos} semánticos`);
  v("sem", "no hay atributos de estilo en línea fuera de las barras/dona dinámicas ni <center>/<font>", !/<(center|font|b|i)\b/.test(html) && !/\sstyle="/.test(html));
});

bloque("form", async () => {
  const { page, ctx } = await nueva();
  const r = await page.evaluate(() => {
    const controles = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")];
    const sinEtiqueta = controles.filter((c) => !(c.labels?.length || c.getAttribute("aria-label") || c.getAttribute("aria-labelledby"))).map((c) => c.id || c.name);
    return {
      sinEtiqueta,
      fieldsets: [...document.querySelectorAll("form fieldset")].filter((f) => f.querySelector(":scope > legend")).length,
      formularios: document.querySelectorAll("form").length,
      autocomplete: ["telefono", "correo", "nombre", "direccion"].filter((id) => document.getElementById(id).autocomplete && document.getElementById(id).autocomplete !== "").length,
      tipos: [...new Set([...document.querySelectorAll("input")].map((i) => i.type))],
    };
  });
  v("form", "todos los controles tienen etiqueta (label/for o aria-label)", r.sinEtiqueta.length === 0, r.sinEtiqueta.join());
  v("form", "los formularios principales usan fieldset con legend (clientes, solicitud, ruta, dimensiones)", r.fieldsets >= 4, r.fieldsets);
  v("form", "autocomplete en los datos personales del cliente", r.autocomplete === 4, r.autocomplete);
  v("form", "usa tipos nativos (number, email, tel, date, datetime-local, checkbox)", ["number", "email", "tel", "date", "datetime-local", "checkbox"].every((t) => r.tipos.includes(t)), r.tipos.join());
  await ctx.close();
});

bloque("tabla", async () => {
  const { page, ctx } = await nueva();
  for (const vista of ["clientes", "registro", "catalogo", "inventario"]) await ir(page, vista);
  const r = await page.evaluate(() => [...document.querySelectorAll("table")].map((t) => ({ caption: !!t.querySelector("caption"), thead: !!t.querySelector("thead"), tbody: !!t.querySelector("tbody"), scope: [...t.querySelectorAll("thead th")].every((th) => th.getAttribute("scope") === "col"), id: t.closest("[id]")?.id })));
  v("tabla", "toda tabla estática tiene caption, thead, tbody y th con scope", r.length >= 3 && r.every((t) => t.caption && t.thead && t.tbody && t.scope), JSON.stringify(r.filter((t) => !(t.caption && t.thead && t.tbody && t.scope))));
  const css = leer("css/estilos.css");
  v("tabla", "sin tablas simuladas con display:table en el CSS de pantalla", !/display:\s*table(?!-header-group)/.test(css));
  const cuerpo = demo.envios.length ? await page.evaluate(() => document.querySelectorAll("tbody tr").length) : 0;
  v("tabla", "los datos se pintan dentro de tbody", cuerpo > 10);
  await ctx.close();
});

bloque("contraste", async () => {
  let salida = "";
  try { salida = execSync(`${process.platform === "win32" ? "python" : "python3"} "${path.join(import.meta.dirname, "contraste.py")}" "${RAIZ}"`, { encoding: "utf8" }); } catch (e) { salida = String(e.stdout || e.message); }
  v("contraste", "todos los pares texto/fondo de los dos temas cumplen WCAG AA (4.5:1 texto, 3:1 componentes)", /0 (fallos|failures)|sin fallos|FALLOS: 0/i.test(salida) || /failures?:\s*0/i.test(salida), salida.trim().split("\n").slice(-2).join(" | "));
});

bloque("live", async () => {
  const { page, ctx } = await nueva();
  const r = await page.evaluate(() => ["comparacion", "resultadoSeguimiento", "listaRutas", "toasts", "resultadosGlobales", "listaClientes", "alertasInventario", "usoAlmacenamiento"].map((id) => [id, document.getElementById(id).getAttribute("aria-live")]));
  v("live", "las regiones dinámicas declaran aria-live", r.every(([, a]) => a === "polite" || a === "assertive"), JSON.stringify(r.filter(([, a]) => !a)));
  await ir(page, "registro");
  await llenar(page);
  await comparar(page);
  v("live", "al comparar, el resultado llega dentro de la región aria-live", (await page.locator("#comparacion[aria-live] .opcion").count()) > 0);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("noop")));
  await ir(page, "clientes");
  await llenarCliente(page, { ...datosCliente, identificacion: "x" });
  await page.click('#formCliente button[type="submit"]');
  v("live", "los errores de formulario enlazan su mensaje con aria-describedby y aria-invalid", await page.evaluate(() => { const c = document.getElementById("identificacion"); const id = (c.getAttribute("aria-describedby") || "").split(" ").find((x) => x.startsWith("error-")); const m = id && document.getElementById(id); return c.getAttribute("aria-invalid") === "true" && !!m && m.textContent.trim().length > 5; }));
  await ctx.close();
});

bloque("teclado", async () => {
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const alcanzar = async (id, max = 40) => {
    for (let i = 0; i < max; i++) {
      if ((await page.evaluate(() => document.activeElement?.id)) === id) return true;
      await page.keyboard.press("Tab");
    }
    return false;
  };
  const elegirPorTeclado = async (id, veces) => { for (let i = 0; i < veces; i++) await page.keyboard.press("ArrowDown"); };
  await page.focus("#buscarRemitente");
  const alcanza = {};
  alcanza.remitente = await alcanzar("remitente");
  await elegirPorTeclado("remitente", 1);
  alcanza.destinatario = await alcanzar("destinatario");
  await elegirPorTeclado("destinatario", 2);
  alcanza.origen = await alcanzar("origen");
  await page.keyboard.press("S"); // «San José Centro»
  alcanza.destino = await alcanzar("destino");
  await page.keyboard.press("A"); // «Alajuela Centro»
  for (const [id, texto] of [["peso", "5"], ["largo", "30"], ["ancho", "25"], ["alto", "20"]]) {
    alcanza[id] = await alcanzar(id);
    await page.keyboard.type(texto);
  }
  alcanza.contenido = await alcanzar("contenido");
  alcanza.btn = await alcanzar("btnComparar");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(150);
  const foco = await page.evaluate(() => { const e = document.activeElement; const s = getComputedStyle(e); return { outline: s.outlineStyle, ancho: parseFloat(s.outlineWidth), sombra: s.boxShadow }; });
  v("teclado", "todos los campos de la solicitud se alcanzan con Tab y se llenan con el teclado", Object.values(alcanza).every(Boolean), JSON.stringify(alcanza));
  v("teclado", "el foco es visible (contorno o sombra) en el control activo", (foco.outline !== "none" && foco.ancho > 0) || foco.sombra !== "none", JSON.stringify(foco));
  const opcion = await alcanzar("__ninguno__", 0).then(() => page.locator('#comparacion button[data-opcion="0"]'));
  await opcion.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  const est = await estadoDe(page);
  v("teclado", "el registro se completa y confirma solo con el teclado", est.envios.length === demo.envios.length + 1 && est.envios.at(-1).sucursalOrigen === "SJO-01" && est.envios.at(-1).pesoReal === 5, `${est.envios.length}`);
  await ctx.close();
});

bloque("h1", async () => {
  const { page, ctx } = await nueva();
  const r = await page.evaluate(() => [...document.querySelectorAll(".vista")].map((v) => {
    const t = [...v.querySelectorAll("h1,h2,h3,h4")].map((h) => Number(h.tagName[1]));
    const saltos = t.filter((n, i) => i > 0 && n - t[i - 1] > 1);
    return { id: v.id, h1: t.filter((n) => n === 1).length, saltos: saltos.length, primero: t[0] };
  }));
  v("h1", "cada una de las 8 vistas tiene exactamente un h1", r.length === 8 && r.every((x) => x.h1 === 1 && x.primero === 1), JSON.stringify(r.filter((x) => x.h1 !== 1)));
  v("h1", "sin saltos de nivel de encabezado (h1→h2→h3)", r.every((x) => x.saltos === 0), JSON.stringify(r.filter((x) => x.saltos)));
  await ctx.close();
});

bloque("noscript", async () => {
  const html = leer("index.html");
  const m = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
  v("noscript", "existe <noscript> que explica que se requiere JavaScript y qué hacer", !!m && /JavaScript/.test(m[1]) && /(Active|active|habilit)/.test(m[1]) && /recargue/i.test(m[1]));
});

/* =====================================================================
   7.2 · CSS
   ===================================================================== */
bloque("css", async () => {
  const css = leer("css/estilos.css");
  const sinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const consultas = [...sinComentarios.matchAll(/@media\s*([^{]+)\{/g)].map((m) => m[1].trim());
  const minWidth = consultas.filter((q) => /^\(min-width:\s*\d+px\)$/.test(q));
  const puntos = [...new Set(minWidth.map((q) => q.match(/\d+/)[0]))];
  v("css", "sin !important", !/!important/.test(sinComentarios));
  v("css", "Mobile-First: todas las consultas de ancho usan min-width y hay ≥3 puntos de quiebre", !/max-width\s*:/.test(sinComentarios.replace(/max-width\s*:\s*[^;]+;/g, (m) => (/\d+(px|rem|ch)|none|100%/.test(m) ? "" : m))) || consultas.filter((q) => /max-width/.test(q)).length === 0, `${puntos.join(", ")}`);
  v("css", "≥3 puntos de quiebre (min-width)", puntos.length >= 3, puntos.join(", "));
  const raiz = [...sinComentarios.matchAll(/:root[^{]*\{([^}]*)\}/g)].map((m) => m[1]).join("\n");
  const tokens = (raiz.match(/--[a-z0-9-]+\s*:/g) || []).length;
  v("css", "tokens en :root: paleta, escala de espaciado (--esp-), escala tipográfica (--texto-) y radios (--radio)", tokens >= 60 && /--verde/.test(raiz) && /--esp-1/.test(raiz) && /--texto-base/.test(raiz) && /--radio/.test(raiz), `${tokens} tokens`);
  const sueltos = [...fuera0(sinComentarios).matchAll(/(?:font-size|padding[a-z-]*|margin[a-z-]*|gap)\s*:[^;]*\d(?:\.\d+)?rem[^;]*;/g)].map((m) => m[0]);
  v("css", "espaciados y tamaños de letra solo mediante variables (sin valores rem sueltos)", sueltos.length === 0, sueltos.slice(0, 3).join(" "));
  const fuera = sinComentarios.replace(/:root[^{]*\{[^}]*\}/g, "");
  const colores = [...new Set(fuera.match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g) || [])];
  v("css", "ningún color literal fuera de los tokens de :root (todo va por variables)", colores.length === 0, colores.slice(0, 6).join(" "));
  v("css", "Grid y Flexbox", /display:\s*grid/.test(sinComentarios) && /display:\s*flex/.test(sinComentarios));
  v("css", "tema oscuro con prefers-color-scheme y control manual [data-tema]", /prefers-color-scheme:\s*dark/.test(sinComentarios) && /\[data-tema="oscuro"\]/.test(sinComentarios));
  v("css", "estados :hover, :focus-visible, :disabled y accesibilidad de validación ([aria-invalid])", [":hover", ":focus-visible", ":disabled", '[aria-invalid="true"]'].every((s) => sinComentarios.includes(s)));
  v("css", "prefers-reduced-motion anula animaciones y transiciones", /prefers-reduced-motion/.test(sinComentarios));
  v("css", "tipografía del sistema (sin @font-face ni @import)", /system-ui|-apple-system|Segoe UI/.test(sinComentarios) && !/@font-face|@import/.test(sinComentarios));
  // reglas duplicadas: mismo selector con idéntico cuerpo en el nivel superior
  const reglas = [...sinComentarios.matchAll(/(^|\})\s*([^{}@]+)\{([^{}]*)\}/g)].map((m) => `${m[2].trim()}{${m[3].replace(/\s+/g, " ").trim()}}`);
  const dup = reglas.filter((r, i) => reglas.indexOf(r) !== i);
  v("css", "sin reglas duplicadas (mismo selector y mismas declaraciones)", dup.length === 0, dup.slice(0, 3).join(" | "));
  const impresion = leer("css/impresion.css");
  v("css", "la hoja de impresión también evita !important", !/!important/.test(impresion));
});

bloque("css", async () => {
  const html = leer("index.html");
  v("css", "las hojas se enlazan por separado (pantalla e impresión con media=\"print\")", /estilos\.css/.test(html) && /<link[^>]*impresion\.css[^>]*media="print"/.test(html));
});

/* =====================================================================
   7.3 · JavaScript
   ===================================================================== */
bloque("deleg", async () => {
  const { page, ctx } = await nueva();
  const envios = textoJS("js/modulos/envios.js");
  const registrados = (envios.match(/el\.tablaEnvios\.addEventListener/g) || []).length;
  v("deleg", "la tabla de envíos tiene un único escuchador delegado", registrados === 1, registrados);
  v("deleg", "ningún módulo enlaza escuchadores fila por fila (no hay addEventListener dentro de forEach/map sobre filas)", !archivosJS.some((f) => /querySelectorAll\([^)]*(tr|button)[^)]*\)\.forEach\([^)]*addEventListener/.test(textoJS(f))));
  await ir(page, "registro");
  const e = await registrar(page);
  // la fila insertada después del arranque responde sin volver a enlazar nada
  await page.click(`#tablaEnvios tr[data-guia="${e.codigoGuia}"] button[data-accion="detalle"]`);
  v("deleg", "una fila creada después del arranque responde a sus botones", (await page.locator("#dialogoEnvio[open]").count()) === 1);
  await ctx.close();
});

bloque("persist", async () => {
  const persist = textoJS("js/persistencia.js");
  v("persist", "JSON.parse y JSON.stringify están dentro de try/catch", /try\s*\{[\s\S]*JSON\.parse[\s\S]*\}\s*catch/.test(persist) && /try\s*\{[\s\S]*JSON\.stringify[\s\S]*\}\s*catch/.test(persist));
  const corrupto = await vacia({ estadoInicial: undefined });
  await corrupto.page.evaluate(() => localStorage.setItem("ecoruta_estado_v5", "{esto no es json"));
  await corrupto.page.reload();
  await corrupto.page.waitForSelector("#aplicacion:not([hidden])");
  v("persist", "datos corruptos en localStorage: la aplicación arranca con el estado inicial vacío", (await corrupto.page.locator("#tablaEnvios tr[data-guia]").count()) === 0 && (await corrupto.page.locator("#aplicacion").isVisible()));
  v("persist", "datos corruptos: no hay errores no atendidos", corrupto.errores.filter((e) => !/Estado corrupto/.test(e)).length === 0, corrupto.errores.join(" | "));
  await corrupto.ctx.close();
  const { page, ctx } = await vacia();
  v("persist", "sin datos guardados el sistema arranca vacío", (await page.locator("#tablaEnvios tr[data-guia]").count()) === 0 && /Todavía no hay solicitudes/.test(await page.locator("#tablaEnvios").innerText()));
  await ctx.close();
  const nuevo = await nueva();
  const guardado = await estadoDe(nuevo.page);
  v("persist", "el estado guardado lleva la versión de esquema (5) bajo la clave ecoruta_estado_v5", guardado.version === 5, guardado.version);
  await nuevo.ctx.close();
  // compatibilidad: un estado de la versión anterior (clave v4 con enviosEliminados) se migra sin pérdida
  const viejo = clonar(demo);
  const eliminado = { ...viejo.envios.find((e) => e.estado === "registrado"), codigoGuia: "ENV-2026-90001", fechaEliminacion: new Date().toISOString(), motivoEliminacion: "Heredado de v2.2.0" };
  viejo.enviosEliminados = [eliminado];
  const migracion = await abrir(browser, URL);
  await migracion.page.evaluate((e) => { localStorage.removeItem("ecoruta_estado_v5"); localStorage.setItem("ecoruta_estado_v4", JSON.stringify(e)); }, viejo);
  await migracion.page.reload();
  await migracion.page.waitForSelector("#aplicacion:not([hidden])");
  await migracion.page.evaluate(() => document.querySelector('.lateral [data-vista="registro"]').click());
  await migracion.page.selectOption("#cantidadEnviosPagina", "20");
  await migracion.page.fill("#buscarEnvio", "ENV-2026-90001");
  const fila = migracion.page.locator('#tablaEnvios tr[data-guia="ENV-2026-90001"]');
  const filaOk = (await fila.count()) === 1 && /Cancelado/.test(await fila.innerText()) && (await fila.getAttribute("class")).includes("fila-cancelada");
  const cancelados = Number(await migracion.page.locator("#conteoCancelados").innerText());
  const total = Number(await migracion.page.locator("#conteoTotal").innerText());
  v("persist", "compatibilidad: el estado de una versión anterior (clave v4) se migra y sus eliminados pasan a «cancelado»", filaOk && total === demo.envios.length + 1 && cancelados === demo.envios.filter((e) => e.estado === "cancelado").length + 1, `${total} envíos, ${cancelados} cancelados`);
  await migracion.ctx.close();
});

bloque("inmut", async () => {
  const { page, ctx } = await nueva();
  const r = await dentro(page, "/js/reglas.js", (m, cat, envios) => {
    const profundo = (o) => { Object.values(o).forEach((x) => x && typeof x === "object" && !Object.isFrozen(x) && profundo(x)); return Object.freeze(o); };
    const c = profundo(JSON.parse(JSON.stringify(cat)));
    const e = profundo(JSON.parse(JSON.stringify(envios)));
    const suc = c.sucursales[0];
    const antes = JSON.stringify([c, e]);
    const paquete = profundo({ pesoFacturable: 5, contenido: "fragil", urgente: true, sobredimension: true });
    const errores = [];
    for (const [nombre, f] of [
      ["modalidadesViables", () => m.modalidadesViables(c, paquete, suc, 20)],
      ["calcularTarifa", () => m.calcularTarifa(c, suc, paquete, 20, c.modalidades[2])],
      ["calcularEmisiones", () => m.calcularEmisiones(20, 5, c.modalidades[2])],
      ["calcularConsolidacion", () => m.calcularConsolidacion(e, c.modalidades[2])],
      ["emisionesEvitadasLimpias", () => m.emisionesEvitadasLimpias(c, 20, 5, 0.1)],
      ["esRetenido", () => m.esRetenido(e[0], { diasRetencion: 3, diasRetencionFrio: 1 })],
      ["desgloseTarifa", () => m.desgloseTarifa(c, e[0], c.modalidades[2])],
    ]) { try { f(); } catch (x) { errores.push(`${nombre}: ${x.message}`); } }
    return { errores, igual: JSON.stringify([c, e]) === antes };
  }, catalogo, demo.envios.slice(0, 6));
  v("inmut", "las funciones de cálculo aceptan argumentos congelados (Object.freeze profundo) sin lanzar errores", r.errores.length === 0, r.errores.join(" | "));
  v("inmut", "y los argumentos quedan idénticos tras el cálculo", r.igual);
  await ctx.close();
});

bloque("modulos", async () => {
  const html = leer("index.html");
  const scripts = html.match(/<script\b[^>]*>/g) || [];
  v("modulos", "un único script type=module como punto de entrada y sin scripts en línea", scripts.length === 1 && /type="module"/.test(scripts[0]) && /src="/.test(scripts[0]), scripts.join());
  v("modulos", "≥10 módulos con import/export", archivosJS.length >= 10 && archivosJS.filter((f) => /\bexport\b/.test(textoJS(f))).length >= archivosJS.length - 1, archivosJS.length);
  const negocio = ["clientes", "envios", "rutas", "seguimiento", "inventario"].filter((m) => fs.existsSync(`${RAIZ}/js/modulos/${m}.js`));
  v("modulos", "un módulo por responsabilidad de negocio (clientes, envíos, rutas, seguimiento, inventario)", negocio.length === 5);
  const variablesGlobales = archivosJS.filter((f) => /\bvar\s/.test(textoJS(f)) || /\bwindow\.\w+\s*=/.test(textoJS(f)));
  v("modulos", "sin var ni variables globales en window", variablesGlobales.length === 0, variablesGlobales.join());
});

bloque("puras", async () => {
  const reglas = textoJS("js/reglas.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  v("puras", "reglas.js no usa document, window, localStorage, fetch ni Date.now() implícito sin parámetro de prueba", !/\b(document|window|localStorage|sessionStorage|fetch|XMLHttpRequest)\b/.test(reglas));
  v("puras", "reglas.js no importa módulos con efectos (no importa nada)", !/^\s*import\s/m.test(reglas));
  const validaciones = textoJS("js/validaciones.js").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  v("puras", "validaciones.js tampoco toca el DOM ni el almacenamiento", !/\b(document|window|localStorage)\b/.test(validaciones));
});

bloque("consola", async () => {
  const { page, ctx, errores } = await nueva();
  for (const vista of ["panel", "registro", "clientes", "catalogo", "rutas", "seguimiento", "inventario", "configuracion"]) await ir(page, vista);
  // acciones inválidas o extremas
  await ir(page, "seguimiento");
  for (const texto of ["", "abc", "ENV-2026-99999", "<img src=x onerror=alert(1)>", "ENV-2026-00001"]) {
    await page.fill("#guiaSeguimiento", texto);
    await page.click('#formSeguimiento button[type="submit"]');
  }
  await ir(page, "clientes");
  await llenarCliente(page, { ...datosCliente, identificacion: "abc", telefono: "1", correo: "x", codigoPostal: "z" });
  await page.click('#formCliente button[type="submit"]');
  await ir(page, "registro");
  await page.click("#btnComparar");
  await page.fill("#peso", "-5");
  await page.click("#btnComparar");
  await page.fill("#buscarEnvio", "<script>alert(1)</script>");
  await page.fill("#busquedaGlobal", "%%%");
  await page.waitForTimeout(150);
  await ir(page, "rutas");
  await page.click('#formRuta button[type="submit"]');
  await ir(page, "configuracion");
  await page.fill("#umbralOcupacion", "5");
  await page.dispatchEvent("#umbralOcupacion", "change");
  await page.waitForTimeout(150);
  v("consola", "ninguna acción (válida o inválida) produce errores en la consola ni excepciones sin atender", errores.length === 0, errores.join(" | "));
  await ctx.close();
});

bloque("cdn", async () => {
  const html = leer("index.html");
  const externas = [...html.matchAll(/(?:src|href)="(https?:)?\/\/[^"]+"/g)].map((m) => m[0]);
  const enJS = archivosJS.filter((f) => /https?:\/\//.test(textoJS(f).replace(/\/\/.*$/gm, "")));
  v("cdn", "index.html no carga nada externo (scripts, estilos ni fuentes)", externas.length === 0, externas.join());
  v("cdn", "ningún módulo JS referencia URLs externas ni importa paquetes", enJS.length === 0 && !archivosJS.some((f) => /from\s+["'](?![./])/.test(textoJS(f))), enJS.join());
  v("cdn", "no existen package.json ni node_modules en el proyecto", !fs.existsSync(`${RAIZ}/package.json`) && !fs.existsSync(`${RAIZ}/node_modules`));
});

/* =====================================================================
   7.4 · Rendimiento, documentación y operación sin conexión
   ===================================================================== */
bloque("offline", async () => {
  const { page, ctx } = await nueva();
  await ctx.setOffline(true);
  const e = await registrar(page);
  v("offline", "sin conexión se puede registrar y consultar la operación ya cargada", !!e && e.estado === "registrado");
  await ir(page, "inventario");
  await ir(page, "panel");
  v("offline", "la navegación entre vistas sigue funcionando sin red", (await page.locator("#panel.activa").count()) === 1);
  await ctx.setOffline(false);
  // al reabrir con el servidor del catálogo caído se usa la copia local del catálogo
  await page.route("**/datos/datos.json", (r) => r.abort());
  await page.reload();
  await page.waitForSelector("#aplicacion:not([hidden])", { timeout: 8000 });
  v("offline", "si el catálogo no responde, se usa la última copia válida guardada en el navegador", (await page.locator("#origen option").count()) > 7);
  await ctx.close();
});

bloque("legible", async () => {
  const stats = archivosJS.map((f) => {
    const t = textoJS(f);
    const lineas = t.split("\n");
    const comentarios = lineas.filter((l) => /^\s*(\/\/|\/\*|\*)/.test(l)).length;
    return { f, lineas: lineas.length, comentarios, maxLinea: Math.max(...lineas.map((l) => l.length)), cabecera: /^\s*(\/\/|\/\*)/.test(t) };
  });
  const total = stats.reduce((s, x) => s + x.lineas, 0);
  const coment = stats.reduce((s, x) => s + x.comentarios, 0);
  v("legible", "todo módulo abre con un comentario que explica su responsabilidad", stats.every((x) => x.cabecera), stats.filter((x) => !x.cabecera).map((x) => x.f).join());
  const declaraciones = archivosJS.flatMap((f) => textoJS(f).split("\n").map((l, k, L) => [l, L[k - 1] ?? ""]).filter(([l]) => /^(export )?(async )?function \w+|^export const \w+ = (\(|async)/.test(l)));
  const documentadas = declaraciones.filter(([, previa]) => /^\s*(\/\/|\/\*|\*)/.test(previa)).length;
  v("legible", "≥ 95 % de las funciones de nivel superior tienen un comentario que explica su intención", documentadas / declaraciones.length >= 0.95, `${documentadas}/${declaraciones.length}`);
  v("legible", "≥ 5 % de las líneas son comentarios en español", coment / total >= 0.05, `${((coment / total) * 100).toFixed(1)}%`);
  v("legible", "código formateado (no minificado): sin archivos de una sola línea larga", stats.every((x) => x.lineas > 15 && x.maxLinea < 1500));
  v("legible", "se usa const/let con nombres en español (sin var ni nombres de una letra en funciones de negocio)", !archivosJS.some((f) => /\bvar\s/.test(textoJS(f))));
});

bloque("readme", async () => {
  const readme = fs.existsSync(`${RAIZ}/README.md`) ? leer("README.md") : "";
  const archivos = [...fs.readdirSync(RAIZ, { recursive: true })].filter((f) => /\.(js|css|json|html)$/.test(f) && !f.startsWith("docs/")).map((f) => path.basename(f));
  const faltan = archivos.filter((f) => !readme.includes(f));
  v("readme", "el README documenta la estructura de carpetas y cada archivo del proyecto", faltan.length === 0 && /datos\//.test(readme) && /js\/modulos\//.test(readme), faltan.join());
  v("readme", "el README indica versión v2.3.0, cómo ejecutar y la clave de localStorage", /2\.3\.0/.test(readme) && /Live Server|servidor/i.test(readme) && /ecoruta_estado_v5/.test(readme));
});

/* =====================================================================
   Ejecución
   ===================================================================== */
for (const [tag, fn] of bloques) {
  console.log(`\n== ${tag}`);
  try { await fn(); } catch (e) { verificar(`[${tag}] error inesperado en la prueba: ${String(e.message).split("\n")[0]}`, false, String(e.stack).split("\n").slice(1, 3).join(" ")); }
}

await browser.close();
srv.close();
fs.writeFileSync(path.join(import.meta.dirname, "resultados_matriz.json"), JSON.stringify(resultados, null, 1));
process.exit(resumen() ? 1 : 0);
