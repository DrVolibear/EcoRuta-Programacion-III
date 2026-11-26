// Pruebas de aceptación (puntos 1–31 del encargo de la v2.2.1, vigentes en la v2.3.0) de EcoRuta (navegador real con Playwright + servidor estático sin dependencias).
// Uso: node pruebas_v221.mjs [carpeta-del-proyecto]
import { chromium, servir, abrir, verificar, resumen, resultados, raizPorDefecto, tmp } from "./lib.mjs";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
const FICHA_PDF = tmp("ficha.pdf");
const GUIA_PDF = tmp("guia.pdf");

const RAIZ = process.argv[2] || raizPorDefecto();
const PUERTO = 8803;
const URL = `http://127.0.0.1:${PUERTO}/`;
const srv = await servir(RAIZ, PUERTO);
const browser = await chromium.launch();
const catalogo = JSON.parse(fs.readFileSync(`${RAIZ}/datos/datos.json`, "utf8"));

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
const estadoDe = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("ecoruta_estado_v5")));
const ir = async (page, vista) => {
  const boton = page.locator(`.lateral [data-vista="${vista}"]`);
  if (!(await boton.isVisible())) await page.click("#btnMenu"); // en pantallas angostas el menú está plegado
  await boton.click();
};
const textoToast = (page) => page.locator(".toast").allTextContents();

async function llenarEnvio(page, o = {}) {
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
}
const comparar = async (page) => { await page.click("#btnComparar"); await page.waitForTimeout(80); };
const hayOpciones = (page) => page.locator("#comparacion .opcion").count();
const MENSAJE_CAMBIO = "Los datos cambiaron. Vuelva a comparar las modalidades.";

/* =========== P01 · Cualquier cambio de los 12 campos invalida la comparación =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const cambios = {
    remitente: () => page.selectOption("#remitente", { index: 4 }),
    destinatario: () => page.selectOption("#destinatario", { index: 5 }),
    origen: () => page.selectOption("#origen", "HER-01"),
    destino: () => page.selectOption("#destino", "CAR-01"),
    peso: () => page.fill("#peso", "6"),
    largo: () => page.fill("#largo", "31"),
    ancho: () => page.fill("#ancho", "26"),
    alto: () => page.fill("#alto", "21"),
    contenido: () => page.selectOption("#contenido", "fragil"),
    urgente: () => page.check("#urgente"),
    autorizacionSobredimension: () => page.check("#autorizacionSobredimension"),
    responsableAutorizacion: () => page.fill("#responsableAutorizacion", "Otra persona"),
  };
  for (const [campo, cambiar] of Object.entries(cambios)) {
    await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "registro");
    await llenarEnvio(page);
    if (campo === "responsableAutorizacion") { await page.check("#autorizacionSobredimension"); await page.fill("#responsableAutorizacion", "Marta Rojas"); }
    await comparar(page);
    const antes = await hayOpciones(page);
    await cambiar();
    const texto = await page.locator("#comparacion").innerText();
    const despues = await hayOpciones(page);
    verificar(`P01 cambiar «${campo}» invalida la comparación`, antes > 0 && despues === 0 && texto.includes(MENSAJE_CAMBIO), `opciones ${antes}→${despues}`);
  }
  // buscar en la caja de búsqueda NO invalida si la selección sigue siendo válida
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "registro");
  await llenarEnvio(page);
  const nombreRem = await page.locator("#remitente option:checked").innerText();
  await comparar(page);
  await page.fill("#buscarRemitente", nombreRem.split(" (")[0].slice(0, 5));
  verificar("P01 escribir en la búsqueda de remitente conserva la comparación si la selección sigue siendo la misma", await hayOpciones(page) > 0);
  // re-validación al registrar: un valor cambiado sin eventos (p. ej. por script) no se registra
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "registro");
  await llenarEnvio(page); await comparar(page);
  const antesEnvios = (await estadoDe(page)).envios.length;
  await page.evaluate(() => { document.getElementById("peso").value = "9999"; });
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(100);
  verificar("P01 al registrar se vuelve a validar el formulario (peso 9999 rechazado)", (await estadoDe(page)).envios.length === antesEnvios);
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "registro");
  await llenarEnvio(page); await comparar(page);
  await page.evaluate(() => { document.getElementById("contenido").value = "fragil"; });
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(100);
  verificar("P01 al registrar se compara la firma de datos (contenido cambiado sin evento)", (await estadoDe(page)).envios.length === antesEnvios && (await textoToast(page)).join(" ").includes("Los datos cambiaron"));
  await ctx.close();
}

/* =========== P02 · Sobredimensión autorizada exige responsable =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await llenarEnvio(page, { largo: "210", ancho: "40", alto: "30", destino: "CD-CEN" });
  await comparar(page);
  verificar("P02 largo 210 cm sin marcar autorización no compara", await hayOpciones(page) === 0);
  await page.check("#autorizacionSobredimension");
  verificar("P02 al marcar se habilita el campo responsable y es obligatorio",
    !(await page.locator("#responsableAutorizacion").isDisabled()) && await page.locator("#responsableAutorizacion").evaluate((e) => e.required));
  await comparar(page);
  const errVacio = await page.locator("#error-responsableAutorizacion").innerText();
  verificar("P02 responsable vacío: mensaje exacto y sin opciones", errVacio === "Indique el responsable que autorizó la sobredimensión." && await hayOpciones(page) === 0, errVacio);
  await page.fill("#responsableAutorizacion", "     ");
  await comparar(page);
  verificar("P02 responsable solo con espacios: se rechaza", (await page.locator("#error-responsableAutorizacion").innerText()) === "Indique el responsable que autorizó la sobredimensión." && await hayOpciones(page) === 0);
  await page.fill("#responsableAutorizacion", "   Marta Rojas   ");
  await comparar(page);
  verificar("P02 responsable válido: aparecen modalidades", await hayOpciones(page) > 0);
  // si se borra el responsable sin eventos, al registrar se vuelve a validar
  const n0 = (await estadoDe(page)).envios.length;
  await page.evaluate(() => { document.getElementById("responsableAutorizacion").value = ""; });
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(100);
  verificar("P02 al registrar con responsable vacío no se guarda", (await estadoDe(page)).envios.length === n0);
  await page.fill("#responsableAutorizacion", "   Marta Rojas   ");
  await comparar(page);
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const nuevo = est.envios.at(-1);
  verificar("P02 responsable guardado recortado en el envío", nuevo.autorizacionSobredimension?.responsable === "Marta Rojas", JSON.stringify(nuevo.autorizacionSobredimension));
  verificar("P02 auditoría: el historial nombra al responsable", nuevo.historial.at(-1).detalle.includes("sobredimensión autorizada por Marta Rojas"), nuevo.historial.at(-1).detalle);
  await page.click(`#tablaEnvios tr[data-guia="${nuevo.codigoGuia}"] button[data-accion="detalle"]`);
  const ficha = await page.locator("#contenidoDetalleEnvio").innerText();
  verificar("P02 el detalle muestra el responsable", ficha.includes("Marta Rojas"));
  await page.keyboard.press("Escape");
  await ir(page, "seguimiento");
  await page.fill("#guiaSeguimiento", nuevo.codigoGuia); await page.click("#formSeguimiento button[type=submit]");
  verificar("P02 el seguimiento muestra el responsable", (await page.locator("#resultadoSeguimiento").innerText()).includes("Marta Rojas"));
  // desmarcar limpia y deshabilita
  await ir(page, "registro");
  await page.check("#autorizacionSobredimension"); await page.fill("#responsableAutorizacion", "Alguien");
  await page.uncheck("#autorizacionSobredimension");
  verificar("P02 al desmarcar se limpia y deshabilita el responsable", (await page.inputValue("#responsableAutorizacion")) === "" && await page.locator("#responsableAutorizacion").isDisabled());
  await ctx.close();
}

/* =========== P03 · Largo / Ancho / Alto alineados =========== */
for (const [ancho, alto, nombre] of [[1280, 900, "escritorio"], [768, 900, "tableta"], [390, 800, "teléfono"]]) {
  const { page, ctx } = await nueva({ ancho, alto });
  await ir(page, "registro");
  const cajas = await page.locator(".grupo-dimension").evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width }; }));
  const mismoAncho = cajas.every((c) => Math.abs(c.w - cajas[0].w) < 1.5);
  const misma = cajas.every((c) => Math.abs(c.y - cajas[0].y) < 1.5);
  const columna = cajas.every((c) => Math.abs(c.x - cajas[0].x) < 1.5) && cajas[1].y > cajas[0].y && cajas[2].y > cajas[1].y;
  if (ancho >= 560) verificar(`P03 (${nombre} ${ancho}px) tres grupos iguales en una fila`, cajas.length === 3 && mismoAncho && misma, JSON.stringify(cajas.map((c) => Math.round(c.w))));
  else verificar(`P03 (${nombre} ${ancho}px) una sola columna`, cajas.length === 3 && mismoAncho && columna);
  if (ancho === 1280) {
    const etiquetas = await page.locator(".grupo-dimension label").allInnerTexts();
    verificar("P03 etiquetas «Largo (cm) *», «Ancho (cm) *», «Alto (cm) *» en ese orden", JSON.stringify(etiquetas) === JSON.stringify(["Largo (cm) *", "Ancho (cm) *", "Alto (cm) *"]), etiquetas.join("|"));
    const dentro = await page.locator(".grupo-dimension .campo-unidad").evaluateAll((els) => els.every((e) => { const i = e.querySelector("input").getBoundingClientRect(), u = e.querySelector(".unidad").getBoundingClientRect(); return u.left >= i.left && u.right <= i.right && u.top >= i.top && u.bottom <= i.bottom && e.querySelector(".unidad").textContent === "cm"; }));
    verificar("P03 la unidad «cm» está dentro de la caja de cada campo", dentro);
    const sinDesborde = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    verificar("P03 sin desbordamiento horizontal (escritorio)", sinDesborde);
  }
  if (ancho === 390) verificar("P03 sin desbordamiento horizontal (teléfono)", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ctx.close();
}

/* =========== P04 · Inventario: filtros y retenidos =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "inventario");
  const opciones = await page.locator("#filtroInventarioEstado option").allInnerTexts();
  verificar("P04 el filtro de estado solo ofrece Todos / En bodega / Asignado a ruta / En ruta / Retenido", JSON.stringify(opciones) === JSON.stringify(["Todos", "En bodega", "Asignado a ruta", "En ruta", "Retenido"]), opciones.join("|"));
  const esperado = await page.evaluate(async () => {
    const { esRetenido, ESTADOS_INVENTARIO } = await import("/js/reglas.js");
    const e = JSON.parse(localStorage.getItem("ecoruta_estado_v5"));
    const inv = e.envios.filter((x) => ESTADOS_INVENTARIO.includes(x.estado));
    return { todos: inv.length, ret: inv.filter((x) => esRetenido(x, e.configuracion)).length, bodega: inv.filter((x) => x.estado === "en bodega").length, asig: inv.filter((x) => x.estado === "asignado a ruta").length, ruta: inv.filter((x) => x.estado === "en ruta").length };
  });
  const filas = () => page.locator("#tablaInventario tr").count();
  verificar("P04 Todos", await filas() === esperado.todos, `${await filas()} / ${esperado.todos}`);
  for (const [valor, clave] of [["en bodega", "bodega"], ["asignado a ruta", "asig"], ["en ruta", "ruta"], ["retenido", "ret"]]) {
    await page.selectOption("#filtroInventarioEstado", valor);
    verificar(`P04 filtro «${valor}»`, await filas() === esperado[clave] && esperado[clave] > 0, `${await filas()} / ${esperado[clave]}`);
  }
  verificar("P04 el contador refleja el filtro", (await page.locator("#totalInventario").innerText()).startsWith(String(esperado.ret)));
  const ret = await page.locator("#tablaInventario tr").evaluateAll((trs) => trs.map((t) => ({ clase: t.className, fondo: getComputedStyle(t).backgroundColor, texto: t.innerText })));
  verificar("P04 todas las filas retenidas llevan la clase, fondo naranja suave y rótulo «Retenido»", ret.every((r) => r.clase.includes("fila-retenida") && r.fondo !== "rgba(0, 0, 0, 0)" && r.fondo !== "rgb(255, 255, 255)" && r.texto.includes("Retenido")), ret[0]?.fondo);
  await page.selectOption("#filtroInventarioEstado", "");
  const cabecera = await page.locator("#inventario thead th").allInnerTexts();
  verificar("P04 columna «Peso facturable» y «Tiempo en bodega»", cabecera.includes("Peso facturable") && cabecera.includes("Tiempo en bodega"), cabecera.join("|"));
  const cuerpo = await page.locator("#tablaInventario").innerText();
  verificar("P04 «1 día» y «2 días» aparecen y nunca «día(s)»", /\b1 día\b/.test(cuerpo) && /\b2 días\b/.test(cuerpo) && !cuerpo.includes("día(s)"));
  // Cancelado no se ofrece en inventario pero sí en el histórico de envíos
  await ir(page, "registro");
  const estadosHist = await page.locator("#filtroEstadoEnvio option").allInnerTexts();
  verificar("P04 «Cancelado» está en el filtro histórico y no en el inventario", estadosHist.includes("Cancelado") && !opciones.includes("Cancelado"));
  await ctx.close();
}

/* =========== P05–P07 · Clientes =========== */
async function llenarCliente(page, o = {}) {
  const v = { identificacion: "9-0001-0001", nombre: "Cliente Prueba", telefono: "61681217", correo: "prueba@correo.cr", direccion: "Dirección de prueba", codigoPostal: "10101", provincia: "San José", ...o };
  for (const k of ["identificacion", "nombre", "telefono", "correo", "direccion", "codigoPostal"]) await page.fill(`#${k}`, v[k]);
  await page.selectOption("#provincia", v.provincia);
}
{
  const { page, ctx } = await nueva();
  await ir(page, "clientes");
  const rojos0 = await page.locator('#formCliente [aria-invalid="true"]').count();
  const bordes = await page.locator("#formCliente input, #formCliente select").evaluateAll((els) => els.map((e) => getComputedStyle(e).borderColor));
  verificar("P05 al abrir el formulario de clientes no hay campos en rojo ni mensajes", rojos0 === 0 && (await page.locator("#formCliente .campo-error:not([hidden])").count()) === 0 && new Set(bordes).size === 1, bordes[0]);
  await llenarCliente(page);
  verificar("P05 el teléfono 61681217 se formatea como 6168-1217", (await page.inputValue("#telefono")) === "6168-1217");
  const n0 = (await estadoDe(page)).clientes.length;
  await page.click("#formCliente button[type=submit]");
  await page.waitForTimeout(100);
  verificar("P05 cliente válido guardado", (await estadoDe(page)).clientes.length === n0 + 1);
  await llenarCliente(page, { identificacion: "9-0002-0002", correo: "  PRUEBA@Correo.CR  ", nombre: "Otro Cliente" });
  await page.click("#formCliente button[type=submit]");
  await page.waitForTimeout(100);
  const e1 = await estadoDe(page);
  verificar("P05 correo duplicado (mayúsculas y espacios) se rechaza", e1.clientes.length === n0 + 1);
  verificar("P05 mensaje «El correo ya está registrado.» visible bajo el campo", (await page.locator("#error-correo").innerText()) === "El correo ya está registrado.");
  await page.click("#cancelarCliente").catch(() => {});

  // P06 solo espacios
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "clientes");
  const n1 = (await estadoDe(page)).clientes.length;
  await llenarCliente(page, { identificacion: "   ", nombre: "   ", direccion: "   ", correo: "   " });
  await page.click("#formCliente button[type=submit]");
  await page.waitForTimeout(100);
  const msgs = { identificacion: await page.locator("#error-identificacion").innerText(), nombre: await page.locator("#error-nombre").innerText(), direccion: await page.locator("#error-direccion").innerText(), correo: await page.locator("#error-correo").innerText() };
  verificar("P06 campos obligatorios solo con espacios no se guardan", (await estadoDe(page)).clientes.length === n1);
  verificar("P06 mensajes específicos por campo", msgs.identificacion.includes("identificación") && msgs.nombre.includes("nombre") && msgs.direccion.includes("dirección") && msgs.correo.includes("correo"), JSON.stringify(msgs));
  // recorte al crear
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "clientes");
  await llenarCliente(page, { identificacion: "  9-0003-0003  ", nombre: "  Nombre Con Espacios  ", direccion: "  Calle 5  ", correo: "  recorte@correo.cr  " });
  await page.click("#formCliente button[type=submit]");
  await page.waitForTimeout(100);
  const c = (await estadoDe(page)).clientes.at(-1);
  verificar("P06 se recortan identificación, nombre, correo y dirección al crear", c.identificacion === "9-0003-0003" && c.nombre === "Nombre Con Espacios" && c.correo === "recorte@correo.cr" && c.direccion === "Calle 5", JSON.stringify([c.identificacion, c.nombre, c.correo, c.direccion]));

  // P07 edición inválida
  const original = (await estadoDe(page)).clientes[0];
  await page.fill("#buscarCliente", original.identificacion);
  await page.click(`#listaClientes button[data-accion="editar"][data-id="${original.id}"]`);
  const casos = [["correo", "malo"], ["telefono", "123"], ["nombre", "   "], ["codigoPostal", "12"], ["identificacion", "ab"]];
  for (const [campo, valor] of casos) {
    await page.fill(`#${campo}`, valor);
    await page.click("#formCliente button[type=submit]");
    await page.waitForTimeout(80);
    const g = (await estadoDe(page)).clientes.find((x) => x.id === original.id);
    verificar(`P07 editar con «${campo}» inválido no guarda`, g[campo] === original[campo], `${campo}=${g[campo]}`);
    await page.click(`#listaClientes button[data-accion="editar"][data-id="${original.id}"]`).catch(() => {});
  }
  // edición válida con recorte
  await page.click(`#listaClientes button[data-accion="editar"][data-id="${original.id}"]`);
  await page.fill("#nombre", "  Nombre Editado  ");
  await page.click("#formCliente button[type=submit]");
  await page.waitForTimeout(100);
  verificar("P07 edición válida se guarda recortada", (await estadoDe(page)).clientes.find((x) => x.id === original.id).nombre === "Nombre Editado");
  // vacíos distintos
  await page.fill("#buscarCliente", "zzzzzzzz");
  verificar("P07 mensaje de búsqueda sin resultados", (await page.locator("#listaClientes").innerText()).includes("No se encontraron clientes que coincidan con la búsqueda."));
  await ctx.close();
}
{
  const { page, ctx } = await abrir(browser, URL);
  await ir(page, "clientes");
  verificar("P07 mensaje de lista vacía distinto: «No hay clientes registrados.»", (await page.locator("#listaClientes").innerText()).includes("No hay clientes registrados."));
  await ctx.close();
}

/* =========== P08 · Cancelación segura, modal y persistencia =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const reg = demo.envios.find((e) => e.estado === "registrado" && !e.envioOrigen);
  await page.fill("#buscarEnvio", reg.codigoGuia);
  const antes = await page.evaluate(() => ({ a: conteoActivos.textContent, c: conteoCancelados.textContent, h: conteoHistoricos.textContent, t: conteoTotal.textContent }));
  verificar("P08 los conteos son consistentes: activos + cancelados + históricos = total", Number(antes.a) + Number(antes.c) + Number(antes.h) === Number(antes.t), JSON.stringify(antes));
  const botonCancelar = page.locator(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"] button[data-accion="cancelar"]`);
  await botonCancelar.click();
  verificar("P08 se abre el modal de cancelación segura", await page.locator("#dialogoCancelacion[open]").count() === 1);
  const resumenModal = await page.locator("#resumenCancelacion").innerText();
  verificar("P08 el modal muestra guía, clientes, estado y trayecto", resumenModal.includes(reg.codigoGuia) && resumenModal.includes("Registrado") && resumenModal.includes("→"), resumenModal.replace(/\n/g, " | ").slice(0, 160));
  verificar("P08 el modal muestra impacto", (await page.locator("#impactoCancelacion").innerText()).includes("Impacto"));
  verificar("P08 contador inicial 0/10 y botón de confirmar deshabilitado", (await page.locator("#contadorMotivo").innerText()) === "0/10" && await page.locator("#confirmarCancelacion").isDisabled());
  verificar("P08 el scroll del fondo queda bloqueado", await page.evaluate(() => document.documentElement.classList.contains("modal-abierto")));
  await page.fill("#motivoCancelacion", "123456789");
  verificar("P08 con 9 caracteres sigue deshabilitado (9/10)", (await page.locator("#contadorMotivo").innerText()) === "9/10" && await page.locator("#confirmarCancelacion").isDisabled());
  await page.fill("#motivoCancelacion", "          corto     ");
  verificar("P08 los espacios no cuentan como motivo", await page.locator("#confirmarCancelacion").isDisabled());
  // cerrar con Escape: no cambia nada y devuelve el foco
  await page.keyboard.press("Escape");
  verificar("P08 Escape cierra sin cancelar", await page.locator("#dialogoCancelacion[open]").count() === 0 && (await estadoDe(page)).envios.find((e) => e.codigoGuia === reg.codigoGuia).estado === "registrado");
  verificar("P08 el foco vuelve al botón que abrió el modal", await page.evaluate((g) => document.activeElement?.dataset?.guia === g && document.activeElement?.dataset?.accion === "cancelar", reg.codigoGuia));
  verificar("P08 se libera el bloqueo de scroll al cerrar", await page.evaluate(() => !document.documentElement.classList.contains("modal-abierto")));
  // cerrar con clic en el fondo
  await botonCancelar.click();
  await page.mouse.click(4, 4);
  verificar("P08 clic en el fondo cierra el modal", await page.locator("#dialogoCancelacion[open]").count() === 0);
  // botón Cancelar no valida
  await botonCancelar.click();
  await page.click("#cerrarCancelacion");
  verificar("P08 el botón «Cancelar» cierra sin exigir motivo", await page.locator("#dialogoCancelacion[open]").count() === 0);
  // un clic dentro del modal no lo cierra
  await botonCancelar.click();
  await page.click("#tituloCancelacion");
  verificar("P08 clic dentro del modal no lo cierra", await page.locator("#dialogoCancelacion[open]").count() === 1);
  await page.fill("#motivoCancelacion", "El cliente pidió anular el envío");
  await page.click("#confirmarCancelacion");
  await page.waitForTimeout(150);
  let est = await estadoDe(page);
  let cancelado = est.envios.find((e) => e.codigoGuia === reg.codigoGuia);
  verificar("P08 cancelación lógica: estado «cancelado» con motivo, fecha y estado anterior", cancelado.estado === "cancelado" && cancelado.motivoCancelacion === "El cliente pidió anular el envío" && cancelado.estadoAnterior === "registrado" && !!cancelado.fechaCancelacion);
  verificar("P08 la guía y el historial se conservan (no se elimina)", cancelado.historial.at(-1).estado === "cancelado" && est.envios.length === demo.envios.length);
  const despues = await page.evaluate(() => ({ a: conteoActivos.textContent, c: conteoCancelados.textContent, t: conteoTotal.textContent }));
  verificar("P08 conteos: activos −1, cancelados +1, total igual", Number(despues.a) === Number(antes.a) - 1 && Number(despues.c) === Number(antes.c) + 1 && despues.t === antes.t, JSON.stringify(despues));
  verificar("P08 la fila cancelada se atenúa y sus botones se bloquean", await page.locator(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"].fila-cancelada`).count() === 1 && await page.locator(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"] button[data-accion="cancelar"]`).isDisabled());
  // persistencia tras recargar
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])"); await ir(page, "registro");
  await page.fill("#buscarEnvio", reg.codigoGuia);
  verificar("P08 tras recargar la página el envío sigue cancelado", (await page.locator(`#tablaEnvios tr[data-guia="${reg.codigoGuia}"]`).innerText()).includes("Cancelado"));
  // no aparece en inventario ni pendientes
  await ir(page, "inventario");
  verificar("P08 un envío cancelado no aparece en pendientes de ingreso", !(await page.locator("#pendientesIngreso").innerText()).includes(reg.codigoGuia));
  // ficha con cancelación en seguimiento
  await ir(page, "seguimiento");
  await page.fill("#guiaSeguimiento", reg.codigoGuia); await page.click("#formSeguimiento button[type=submit]");
  const fichaC = await page.locator("#resultadoSeguimiento").innerText();
  verificar("P08 el seguimiento muestra motivo de cancelación y no ofrece cambios de estado", fichaC.includes("El cliente pidió anular el envío") && await page.locator("#resultadoSeguimiento button[data-estado]").count() === 0);
  // en ruta no se cancela
  await ir(page, "registro");
  const enRuta = demo.envios.find((e) => e.estado === "en ruta");
  await page.fill("#buscarEnvio", enRuta.codigoGuia);
  verificar("P08 un envío en ruta no se puede cancelar (RN-09)", await page.locator(`#tablaEnvios tr[data-guia="${enRuta.codigoGuia}"] button[data-accion="cancelar"]`).isDisabled());
  await ctx.close();
}

/* =========== P09 · Un solo reenvío activo =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const conReenvio = demo.envios.find((e) => e.estado === "devuelto" && demo.envios.some((x) => x.envioOrigen === e.codigoGuia));
  const reenvio = demo.envios.find((x) => x.envioOrigen === conReenvio.codigoGuia);
  await page.fill("#buscarEnvio", conReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${conReenvio.codigoGuia}"] button[data-accion="reenviar"]`);
  await page.waitForTimeout(80);
  verificar("P09 segundo reenvío activo bloqueado con el mensaje «Ya existe un reenvío activo: ENV-…»", (await textoToast(page)).some((t) => t === `Ya existe un reenvío activo: ${reenvio.codigoGuia}`), (await textoToast(page)).join("|"));
  const sinReenvio = demo.envios.find((e) => e.estado === "devuelto" && !demo.envios.some((x) => x.envioOrigen === e.codigoGuia));
  await page.fill("#buscarEnvio", sinReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${sinReenvio.codigoGuia}"] button[data-accion="reenviar"]`);
  await comparar(page);
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(150);
  const est = await estadoDe(page);
  const nuevoReenvio = est.envios.find((e) => e.envioOrigen === sinReenvio.codigoGuia);
  verificar("P09 el primer reenvío se registra con envioOrigen", !!nuevoReenvio && nuevoReenvio.estado === "registrado");
  await page.fill("#buscarEnvio", sinReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${sinReenvio.codigoGuia}"] button[data-accion="reenviar"]`);
  await page.waitForTimeout(80);
  verificar("P09 intentar de nuevo muestra el aviso con la guía del reenvío", (await textoToast(page)).some((t) => t.includes(`Ya existe un reenvío activo: ${nuevoReenvio.codigoGuia}`)));
  // si el reenvío se cancela, vuelve a permitirse
  await page.fill("#buscarEnvio", nuevoReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${nuevoReenvio.codigoGuia}"] button[data-accion="cancelar"]`);
  await page.fill("#motivoCancelacion", "Se registrará un reenvío distinto");
  await page.click("#confirmarCancelacion");
  await page.waitForTimeout(120);
  await page.fill("#buscarEnvio", sinReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${sinReenvio.codigoGuia}"] button[data-accion="reenviar"]`);
  await page.waitForTimeout(80);
  verificar("P09 con el reenvío cancelado se permite otro", (await page.locator("#guiaEdicion").inputValue()) === "" && (await page.locator("#btnComparar").innerText()).includes("reenviar"));
  // relaciones original↔reenvío en la ficha
  await page.fill("#buscarEnvio", conReenvio.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${conReenvio.codigoGuia}"] button[data-accion="detalle"]`);
  const enlace = page.locator(`#contenidoDetalleEnvio [data-ir-guia="${reenvio.codigoGuia}"]`);
  verificar("P09 la ficha del original enlaza al reenvío", await enlace.count() === 1);
  await enlace.click();
  verificar("P09 el enlace abre la ficha del reenvío con el enlace de vuelta al original", (await page.locator("#tituloDetalleEnvio").innerText()) === reenvio.codigoGuia && await page.locator(`#contenidoDetalleEnvio [data-ir-guia="${conReenvio.codigoGuia}"]`).count() === 1);
  await ctx.close();
}

/* =========== P10 · Capacidad de despacho según datos.json =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "rutas");
  for (const m of catalogo.modalidades) {
    await page.selectOption("#rutaModalidad", m.codigo);
    const v = Number(await page.inputValue("#rutaCapacidadPeso"));
    const max = Number(await page.getAttribute("#rutaCapacidadPeso", "max"));
    verificar(`P10 ${m.nombre}: capacidad máxima ${m.capacidadKg} kg tomada de datos.json`, v === m.capacidadKg && max === m.capacidadKg, `valor ${v}, max ${max}`);
  }
  const rutas0 = (await estadoDe(page)).rutas.length;
  const futuro = new Date(Date.now() + 2 * 86400000); futuro.setMinutes(futuro.getMinutes() - futuro.getTimezoneOffset());
  const fechaFutura = futuro.toISOString().slice(0, 16);
  await page.selectOption("#rutaDestino", "ALA-01");
  await page.selectOption("#rutaModalidad", "bicicleta");
  await page.fill("#rutaFechaSalida", fechaFutura);
  await page.fill("#rutaCapacidadPeso", "100");
  await page.fill("#rutaCapacidadCantidad", "5");
  await page.click("#formRuta button[type=submit]");
  await page.waitForTimeout(100);
  verificar("P10 capacidad operativa mayor que el máximo (100 > 40 kg) se rechaza con mensaje", (await estadoDe(page)).rutas.length === rutas0 && (await page.locator("#error-rutaCapacidadPeso").innerText()).includes("40"), await page.locator("#error-rutaCapacidadPeso").innerText());
  await page.fill("#rutaCapacidadPeso", "30");
  await page.click("#formRuta button[type=submit]");
  await page.waitForTimeout(150);
  const e2 = await estadoDe(page);
  verificar("P10 capacidad operativa menor o igual al máximo (30 ≤ 40 kg) crea la ruta", e2.rutas.length === rutas0 + 1 && e2.rutas.at(-1).capacidadPeso === 30);
  await page.selectOption("#rutaDestino", "ALA-01"); await page.selectOption("#rutaModalidad", "electrico");
  await page.fill("#rutaFechaSalida", "2020-01-01T10:00");
  await page.fill("#rutaCapacidadCantidad", "5");
  await page.click("#formRuta button[type=submit]");
  await page.waitForTimeout(100);
  verificar("P10 fecha de salida pasada se rechaza", (await estadoDe(page)).rutas.length === rutas0 + 1);
  // despachar ruta vacía deshabilitado
  const vacia = e2.rutas.at(-1).codigo;
  verificar("P10 «Cerrar y despachar» está deshabilitado en una ruta sin envíos", await page.locator(`#ruta-${vacia} button[data-accion="cerrar"]`).isDisabled());
  await ctx.close();
}

/* =========== P11 · Búsqueda global =========== */
{
  const { page, ctx } = await nueva();
  const guia = demo.envios.find((e) => e.estado === "en bodega").codigoGuia;
  await page.fill("#busquedaGlobal", guia);
  verificar("P11 la búsqueda por guía ofrece resultado de tipo Guía", await page.locator('#resultadosGlobales button:has(small:text-is("Guía"))').count() > 0);
  await page.click(`#resultadosGlobales button:has-text("${guia}")`);
  await page.waitForTimeout(100);
  verificar("P11 elegir una guía navega al Seguimiento y muestra su ficha", await page.locator("#seguimiento.activa").count() === 1 && (await page.locator("#resultadoSeguimiento").innerText()).includes(guia));
  const cli = demo.clientes[0];
  await page.fill("#busquedaGlobal", cli.nombre.split(" ")[0]);
  await page.click(`#resultadosGlobales button:has(small:text-is("Cliente"))`);
  await page.waitForTimeout(100);
  verificar("P11 elegir un cliente navega a Clientes y lo muestra filtrado", await page.locator("#clientes.activa").count() === 1 && (await page.locator("#listaClientes").innerText()).includes(cli.nombre));
  const ruta = demo.rutas[2].codigo;
  await page.fill("#busquedaGlobal", ruta);
  await page.click(`#resultadosGlobales button:has(small:text-is("Ruta"))`);
  await page.waitForTimeout(100);
  verificar("P11 elegir una ruta navega a Despacho y resalta la ruta", await page.locator("#rutas.activa").count() === 1 && await page.locator(`#ruta-${ruta}.resaltado`).count() === 1);
  await page.fill("#busquedaGlobal", "zzzzzzzzz");
  verificar("P11 sin coincidencias se informa", (await page.locator("#resultadosGlobales").innerText()).includes("No hay coincidencias"));
  await page.fill("#busquedaGlobal", demo.rutas[0].codigo);
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  verificar("P11 Escape cierra la lista de resultados", await page.locator("#resultadosGlobales").isHidden());
  await page.fill("#busquedaGlobal", guia);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(100);
  verificar("P11 Enter abre el primer resultado", await page.locator("#seguimiento.activa").count() === 1);
  await ctx.close();
}

/* =========== P12 · Rango de fechas =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  const hoy = await page.evaluate(() => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); });
  const ayer = (n) => { const d = new Date(`${hoy}T12:00:00`); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); };
  await page.fill("#filtroFechaDesde", ayer(5));
  verificar("P12 Hasta.min = Desde", (await page.getAttribute("#filtroFechaHasta", "min")) === ayer(5));
  await page.fill("#filtroFechaHasta", ayer(2));
  verificar("P12 Desde.max = Hasta", (await page.getAttribute("#filtroFechaDesde", "max")) === ayer(2));
  verificar("P12 Hasta.max es hoy", (await page.getAttribute("#filtroFechaHasta", "max")) === hoy);
  await page.fill("#filtroFechaHasta", ayer(8));
  verificar("P12 rango inválido muestra «Hasta no puede ser anterior a Desde.»", (await page.locator("#error-filtroFechaHasta").innerText()) === "Hasta no puede ser anterior a Desde.");
  verificar("P12 con rango inválido la tabla no muestra datos engañosos", (await page.locator("#tablaEnvios").innerText()).includes("Hasta no puede ser anterior a Desde."));
  await page.fill("#filtroFechaHasta", ayer(2));
  verificar("P12 al corregir el rango desaparece el error y vuelve la tabla", (await page.locator("#error-filtroFechaHasta").isHidden()) && await page.locator("#tablaEnvios tr[data-guia]").count() >= 0);
  await page.click("#limpiarFiltrosEnvios");
  verificar("P12 «Limpiar filtros» restablece las fechas y los límites", (await page.inputValue("#filtroFechaDesde")) === "" && (await page.getAttribute("#filtroFechaHasta", "min")) === "");
  // mismo rango en el panel
  await ir(page, "panel");
  await page.fill("#panelFechaDesde", ayer(3));
  verificar("P12 el panel también limita Hasta.min", (await page.getAttribute("#panelFechaHasta", "min")) === ayer(3));
  await ctx.close();
}

/* =========== P13 · Impresión A4 =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.evaluate(() => { window.print = () => {}; });
  const e = demo.envios.find((x) => x.estado === "entregado");
  await page.fill("#buscarEnvio", e.codigoGuia);
  await page.click(`#tablaEnvios tr[data-guia="${e.codigoGuia}"] button[data-accion="detalle"]`);
  await page.click("#imprimirDetalleEnvio");
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: FICHA_PDF, format: "A4", preferCSSPageSize: true, printBackground: true });
  const paginas = Number(execSync(`pdfinfo ${FICHA_PDF} | grep Pages | awk '{print $2}'`).toString().trim());
  const tamano = execSync(`pdfinfo ${FICHA_PDF} | grep 'Page size'`).toString();
  const textos = Array.from({ length: paginas }, (_, i) => execSync(`pdftotext -f ${i + 1} -l ${i + 1} ${FICHA_PDF} -`).toString());
  verificar("P13 la ficha se imprime en A4", tamano.includes("(A4)"), tamano.trim());
  verificar("P13 ninguna página queda en blanco", paginas >= 1 && textos.every((t) => t.trim().length > 40), `${paginas} página(s)`);
  verificar("P13 la primera hoja lleva fecha de impresión y la guía", textos[0].includes("Fecha de impresión") && textos[0].includes(e.codigoGuia));
  verificar("P13 la impresión contiene el desglose de tarifa y los tres pesos", textos.join("").includes("Desglose de la tarifa") && textos.join("").includes("Peso facturable") && textos.join("").includes("Peso volumétrico"));
  verificar("P13 no se imprime la interfaz (menú, buscador ni modal)", !textos.join("").includes("Sistema interno") && !textos.join("").includes("Despacho") && !textos.join("").includes("Cerrar"));
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  // guía de despacho
  await ir(page, "rutas");
  await page.evaluate(() => { window.print = () => {}; });
  await page.click(`#ruta-${demo.rutas[0].codigo} button[data-accion="imprimir"]`);
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: GUIA_PDF, format: "A4", preferCSSPageSize: true, printBackground: true });
  const pg2 = Number(execSync(`pdfinfo ${GUIA_PDF} | grep Pages | awk '{print $2}'`).toString().trim());
  const tg = execSync(`pdftotext ${GUIA_PDF} -`).toString();
  verificar("P13 la guía de despacho se imprime con fecha, envíos y firmas", pg2 >= 1 && tg.includes("Fecha de impresión") && tg.includes("Guía de despacho") && tg.includes("Despachó"), `${pg2} página(s)`);
  await ctx.close();
}

/* =========== P14 · Sintaxis de todos los archivos JavaScript =========== */
{
  const archivos = fs.readdirSync(`${RAIZ}/js`, { recursive: true }).filter((f) => f.endsWith(".js")).map((f) => path.join(RAIZ, "js", f));
  let fallos = [];
  for (const a of archivos) { try { execSync(`node --check ${a}`, { stdio: "pipe" }); } catch (err) { fallos.push(a); } }
  verificar(`P14 node --check pasa en los ${archivos.length} archivos JS`, fallos.length === 0, fallos.join(","));
}

/* =========== Extras: seguimiento, ficha, tarifas, tema, inserción dirigida =========== */
{
  const { page, ctx } = await nueva();
  await ir(page, "seguimiento");
  const guia = demo.envios.find((e) => e.estado === "en bodega").codigoGuia;
  await page.fill("#guiaSeguimiento", ` ${guia.toLowerCase()} `);
  verificar("E01 seguimiento: el código se normaliza a mayúsculas y sin espacios", (await page.inputValue("#guiaSeguimiento")) === guia);
  await page.click("#formSeguimiento button[type=submit]");
  const ficha = await page.locator("#resultadoSeguimiento").innerText();
  verificar("E01 la ficha trae los tres pesos, dimensiones en cm y desglose", ficha.includes("Peso real") && ficha.includes("Peso volumétrico") && ficha.includes("Peso facturable") && /\d+ × \d+ × \d+ cm/.test(ficha) && ficha.includes("Subtotal") && ficha.includes("Descuento ecológico"));
  verificar("E01 la ficha explica el peso facturable", ficha.includes("el mayor entre"));
  await page.fill("#guiaSeguimiento", guia.slice(0, -1));
  verificar("E01 al editar el código se limpia la ficha anterior", (await page.locator("#resultadoSeguimiento").innerText()).trim() === "");
  await page.fill("#guiaSeguimiento", "env202699999");
  verificar("E01 «env202699999» se formatea como ENV-2026-99999", (await page.inputValue("#guiaSeguimiento")) === "ENV-2026-99999");
  await page.click("#formSeguimiento button[type=submit]");
  verificar("E01 guía inexistente: mensaje claro y sin ficha", (await page.locator("#resultadoSeguimiento").innerText()).includes("No se encontró la guía ENV-2026-99999"));
  await page.fill("#guiaSeguimiento", "XYZ");
  await page.click("#formSeguimiento button[type=submit]");
  verificar("E01 formato inválido: mensaje de formato en español junto al campo", (await page.locator("#error-guiaSeguimiento").innerText()).includes("ENV-AAAA-00000") && (await page.locator("#resultadoSeguimiento").innerText()).trim() === "");
  await page.fill("#guiaSeguimiento", "");
  await page.click("#formSeguimiento button[type=submit]");
  verificar("E01 guía vacía: «Indique el código de guía.»", (await page.locator("#error-guiaSeguimiento").innerText()) === "Indique el código de guía.");
  await ctx.close();
}
{
  const { page, ctx } = await nueva();
  await ir(page, "registro");
  await page.evaluate(() => document.querySelector("#tablaEnvios tr").setAttribute("data-prueba", "marca"));
  const primera = await page.evaluate(() => document.querySelector("#tablaEnvios tr").dataset.guia);
  await llenarEnvio(page);
  await comparar(page);
  const desglose = await page.locator("#comparacion .opcion").first().innerText();
  verificar("E02 la comparación muestra resumen de la solicitud, menor emisión y desglose por componente", (await page.locator("#comparacion .resumen-solicitud").count()) === 1 && desglose.includes("Menor emisión") && desglose.includes("Ajuste por modalidad") && desglose.includes("Recargo urgente") && desglose.includes("No aplica"));
  await page.click('#comparacion button[data-opcion="0"]');
  await page.waitForTimeout(150);
  const guiaNueva = (await estadoDe(page)).envios.at(-1).codigoGuia;
  const marcaSigue = await page.evaluate((g) => document.querySelector(`#tablaEnvios tr[data-guia="${g}"]`)?.getAttribute("data-prueba"), primera);
  verificar("E02 7.3: registrar inserta solo la fila nueva (las filas existentes no se redibujan)", marcaSigue === "marca" && (await page.evaluate(() => document.querySelector("#tablaEnvios tr").dataset.guia)) === guiaNueva);
  const est = await estadoDe(page);
  const nuevo = est.envios.at(-1);
  verificar("E02 RF-23: se guarda la modalidad de menor emisión y si el agente la eligió", typeof nuevo.modalidadMenorEmision === "string" && typeof nuevo.eligioMenorEmision === "boolean");
  // 7.3: cancelar actualiza solo esa fila
  await page.evaluate(() => document.querySelectorAll("#tablaEnvios tr").forEach((t, i) => t.setAttribute("data-prueba", "fila" + i)));
  await page.click(`#tablaEnvios tr[data-guia="${guiaNueva}"] button[data-accion="cancelar"]`);
  await page.fill("#motivoCancelacion", "Prueba de actualización dirigida");
  await page.click("#confirmarCancelacion");
  await page.waitForTimeout(150);
  const otras = await page.evaluate((g) => [...document.querySelectorAll("#tablaEnvios tr")].filter((t) => t.dataset.guia !== g).every((t) => t.getAttribute("data-prueba")?.startsWith("fila")), guiaNueva);
  verificar("E02 7.3: cancelar un envío solo reemplaza su fila", otras);
  await ctx.close();
}
{
  // tema oscuro y contraste de componentes clave
  const { page, ctx } = await nueva({ esquema: "dark" });
  const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  verificar("E03 con el sistema en modo oscuro el tema automático se oscurece", fondo === "rgb(14, 25, 22)", fondo);
  await ir(page, "configuracion");
  await page.selectOption("#tema", "claro");
  const claro = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  verificar("E03 el tema «Claro» manual vence al modo oscuro del sistema", claro === "rgb(242, 246, 244)", claro);
  await page.reload(); await page.waitForSelector("#aplicacion:not([hidden])");
  verificar("E03 el tema elegido persiste", (await page.evaluate(() => document.documentElement.dataset.tema)) === "claro");
  await ctx.close();
}
{
  const { page, ctx } = await nueva();
  await ir(page, "configuracion");
  await page.fill("#umbralOcupacion", "20");
  await page.dispatchEvent("#umbralOcupacion", "change");
  verificar("E04 configuración fuera de rango se rechaza y conserva el valor", (await page.inputValue("#umbralOcupacion")) === String(demo.configuracion.umbralOcupacion));
  await page.fill("#diasRetencion", "5");
  await page.dispatchEvent("#diasRetencion", "change");
  verificar("E04 configuración válida se guarda", (await estadoDe(page)).configuracion.diasRetencion === 5);
  await ctx.close();
}
{
  // sin librerías ni CDN, peso total
  const html = fs.readFileSync(`${RAIZ}/index.html`, "utf8");
  verificar("E05 sin scripts ni estilos externos (CDN)", !/<(script|link)[^>]+(https?:)?\/\/(?!127)/.test(html.replace(/xmlns="[^"]+"/g, "")));
  // Peso de la aplicación: index.html, css/, js/ y datos/ (la documentación y las pruebas no se cargan en el navegador)
  const pesoDe = (r) => (fs.statSync(r).isDirectory() ? fs.readdirSync(r).reduce((s, n) => s + pesoDe(path.join(r, n)), 0) : fs.statSync(r).size);
  const bytes = ["index.html", "css", "js", "datos"].reduce((s, n) => s + pesoDe(path.join(RAIZ, n)), 0);
  verificar("E05 la aplicación pesa menos de 500 KB", Number(bytes) < 500 * 1024, `${(Number(bytes) / 1024).toFixed(0)} KB`);
  verificar("E05 la clave de localStorage no cambió", fs.readFileSync(`${RAIZ}/js/persistencia.js`, "utf8").includes('"ecoruta_estado_v5"'));
}

/* =========== E06 · Sin desbordamiento horizontal en ninguna vista ni ancho =========== */
for (const ancho of [390, 820, 1280]) {
  const { page, ctx } = await nueva({ ancho, alto: 900 });
  const malas = [];
  for (const v of ["panel", "registro", "clientes", "catalogo", "rutas", "seguimiento", "inventario", "configuracion"]) {
    await ir(page, v);
    if (v === "registro") { await llenarEnvio(page); await comparar(page); }
    if (v === "seguimiento") { await page.fill("#guiaSeguimiento", demo.envios[3].codigoGuia); await page.click("#formSeguimiento button[type=submit]"); }
    await page.waitForTimeout(60);
    if (!(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))) malas.push(v);
  }
  verificar(`E06 ${ancho}px: ninguna vista desborda horizontalmente`, malas.length === 0, malas.join(","));
  await ctx.close();
}

await browser.close();
srv.close();
fs.writeFileSync(path.join(import.meta.dirname, "resultados_pruebas.json"), JSON.stringify(resultados, null, 2));
process.exit(resumen() ? 1 : 0);
