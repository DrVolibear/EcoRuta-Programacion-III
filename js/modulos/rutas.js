// M4: rutas de despacho, asignación de envíos, consolidación y cierre.
import { guardarEstado } from "../persistencia.js";
import { calcularConsolidacion, furgonetaIndividual } from "../reglas.js";
import { escapar, fechaLocal, etiquetaEstado, ahoraLocalMinutos } from "../utilidades.js";
import { activarValidacion } from "../formularios.js";
import { solicitarCancelacion } from "../modales.js";
import { htmlGuiaDespacho, htmlEstado } from "../plantillas.js";
import { imprimir } from "../impresion.js";

let estado, catalogo, avisar, actualizar, confirmar;
let validacion;
const el = {};

const modalidad = (codigo) => catalogo.modalidades.find((m) => m.codigo === codigo);
const nombreSucursal = (codigo) =>
  catalogo.sucursales.find((s) => s.codigo === codigo)?.nombre ?? codigo;
const rutaPorCodigo = (codigo) => estado.rutas.find((r) => r.codigo === codigo);
const envioPorGuia = (guia) => estado.envios.find((e) => e.codigoGuia === guia);
const unicas = (lista = []) => [...new Set(lista.filter(Boolean))];
const avisarEnvios = (guias) =>
  document.dispatchEvent(new CustomEvent("envioActualizado", { detail: { guias } }));

const MENSAJE_FECHA = "La salida debe programarse para una fecha futura.";

/** Enlaza el formulario de rutas y las acciones de cada ruta. */
export function iniciarRutas(e, c, a, u, co) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  confirmar = co;
  [
    "formRuta",
    "rutaDestino",
    "rutaModalidad",
    "rutaFechaSalida",
    "rutaCapacidadPeso",
    "rutaCapacidadCantidad",
    "ayudaCapacidadRuta",
    "listaRutas",
    "enviosDisponiblesRuta",
  ].forEach((id) => (el[id] = document.getElementById(id)));

  el.rutaDestino.innerHTML =
    '<option value="">Seleccione</option>' +
    c.sucursales.map((s) => `<option value="${s.codigo}">${escapar(s.nombre)}</option>`).join("");
  el.rutaModalidad.innerHTML =
    '<option value="">Seleccione</option>' +
    c.modalidades.map((m) => `<option value="${m.codigo}">${escapar(m.nombre)}</option>`).join("");
  el.rutaFechaSalida.min = ahoraLocalMinutos(60_000);
  el.rutaFechaSalida.addEventListener("focus", () => {
    el.rutaFechaSalida.min = ahoraLocalMinutos(60_000);
  });

  // La capacidad máxima sale del catálogo (datos.json); la operativa puede ser menor, nunca mayor
  el.rutaModalidad.addEventListener("change", () => {
    const m = modalidad(el.rutaModalidad.value);
    el.rutaCapacidadPeso.value = m ? m.capacidadKg : "";
    if (m) el.rutaCapacidadPeso.max = m.capacidadKg;
    else el.rutaCapacidadPeso.removeAttribute("max");
    el.ayudaCapacidadRuta.textContent = m
      ? `Capacidad máxima para ${m.nombre}: ${m.capacidadKg.toLocaleString("es-CR")} kg. Puede usar una capacidad operativa menor.`
      : "Seleccione una modalidad para cargar su capacidad máxima.";
  });

  validacion = activarValidacion(
    el.formRuta,
    {
      rutaDestino: () => "Seleccione el destino.",
      rutaModalidad: () => "Seleccione la modalidad.",
      rutaFechaSalida: (campo) =>
        campo.validity.valueMissing || campo.validity.badInput
          ? "Indique la fecha y la hora de salida."
          : MENSAJE_FECHA,
      rutaCapacidadPeso: (campo) => {
        const m = modalidad(el.rutaModalidad.value);
        return campo.validity.rangeOverflow
          ? `La capacidad operativa no puede superar ${Number(campo.max).toLocaleString("es-CR")} kg, el máximo de ${m?.nombre ?? "la modalidad"}.`
          : campo.validity.rangeUnderflow
            ? "La capacidad operativa mínima es 1 kg."
            : "Indique la capacidad operativa en kg.";
      },
      rutaCapacidadCantidad: (campo) =>
        campo.validity.valueMissing
          ? "Indique la cantidad de paquetes."
          : campo.validity.rangeUnderflow
            ? "La ruta debe admitir al menos 1 paquete."
            : "Use un número entero de paquetes.",
    },
    {
      extras: {
        rutaFechaSalida: (campo) =>
          campo.value && new Date(campo.value).getTime() <= Date.now() ? MENSAJE_FECHA : "",
      },
      alInvalido: (_campo, mensaje) => avisar(mensaje, true),
    },
  );

  el.formRuta.addEventListener("submit", crear);
  el.listaRutas.addEventListener("click", accionRuta);
  el.enviosDisponiblesRuta.addEventListener("click", asignar);
  // Otros módulos (seguimiento, cancelación de envíos) avisan cuando cambian las rutas
  document.addEventListener("rutasActualizadas", render);
  document.addEventListener("inventarioActualizado", render);

  repararIntegridad();
  render();
}

/** Un envío "asignado a ruta" debe estar en exactamente una ruta abierta; si no, vuelve a bodega. */
function repararIntegridad() {
  const enRutaAbierta = new Set(
    estado.rutas.filter((r) => r.estado === "abierta").flatMap((r) => unicas(r.envios)),
  );
  const huerfanos = estado.envios.filter(
    (e) => e.estado === "asignado a ruta" && !enRutaAbierta.has(e.codigoGuia),
  );
  huerfanos.forEach((e) => {
    const ahora = new Date().toISOString();
    e.estado = "en bodega";
    e.rutaAsignada = null;
    e.fechaIngresoBodega ||= ahora;
    e.historial.push({
      estadoAnterior: "asignado a ruta",
      estado: "en bodega",
      fecha: ahora,
      detalle: "Devuelto a bodega: ninguna ruta abierta lo contenía",
    });
  });
  if (huerfanos.length) guardarEstado(estado);
}

/** Crea una ruta abierta validando capacidad máxima (del catálogo) y fecha de salida futura. */
function crear(ev) {
  ev.preventDefault();
  const m = modalidad(el.rutaModalidad.value);
  const peso = Number(el.rutaCapacidadPeso.value);
  const cantidad = Number(el.rutaCapacidadCantidad.value);
  // Defensa adicional: los límites nunca dependen solo de los atributos del formulario
  if (!m) return avisar("Seleccione una modalidad válida.", true);
  if (!(peso > 0) || peso > m.capacidadKg)
    return avisar(`La capacidad operativa debe estar entre 1 y ${m.capacidadKg} kg.`, true);
  if (!Number.isInteger(cantidad) || cantidad < 1)
    return avisar("La cantidad de paquetes debe ser un entero positivo.", true);
  if (new Date(el.rutaFechaSalida.value).getTime() <= Date.now())
    return avisar(MENSAJE_FECHA, true);

  const codigo = `RUTA-${new Date().getFullYear()}-${String(estado.contadorRuta++).padStart(4, "0")}`;
  estado.rutas.push({
    codigo,
    sucursalDestino: el.rutaDestino.value,
    modalidad: m.codigo,
    fechaSalida: el.rutaFechaSalida.value,
    capacidadPeso: peso,
    capacidadCantidad: cantidad,
    envios: [],
    estado: "abierta",
    emisionesTotales: 0,
    ahorroConsolidacion: 0,
    fechaCreacion: new Date().toISOString(),
  });
  guardarEstado(estado);
  el.formRuta.reset();
  el.ayudaCapacidadRuta.textContent = "Seleccione una modalidad para cargar su capacidad máxima.";
  el.rutaCapacidadPeso.removeAttribute("max");
  validacion.reiniciar();
  render();
  actualizar();
  avisar(`Ruta ${codigo} creada.`);
}

/** Datos de una ruta: sus envíos vigentes, la carga y el resultado de la consolidación. */
function calculos(ruta) {
  ruta.envios = unicas(ruta.envios);
  const envios = ruta.envios
    .map(envioPorGuia)
    .filter(
      (e) =>
        e &&
        (ruta.estado !== "abierta" ||
          (e.estado === "asignado a ruta" && e.rutaAsignada === ruta.codigo)),
    );
  const vehiculo = modalidad(ruta.modalidad);
  const consolidacion = calcularConsolidacion(
    envios,
    vehiculo,
    furgonetaIndividual(catalogo, vehiculo),
  );
  return {
    ...consolidacion,
    envios,
    librePeso: ruta.capacidadPeso - consolidacion.peso,
    libreCantidad: ruta.capacidadCantidad - consolidacion.cantidad,
  };
}

/**
 * Resultado de consolidación (RF-26) que se muestra de una ruta: en una ruta ya
 * despachada es el que quedó guardado al salir; en una abierta, el cálculo vivo.
 */
const resultadoConsolidacion = (ruta, carga) =>
  ruta.estado !== "abierta" && ruta.consolidacion ? { ...carga, ...ruta.consolidacion } : carga;

/** Texto corto del ahorro: kg CO₂e, porcentaje y viajes evitados. */
const textoAhorro = (r) =>
  `${r.ahorro.toFixed(3)} kg CO₂e (${r.ahorroPorcentaje ?? 0} %) · ${r.viajesEvitados ?? 0} ${r.viajesEvitados === 1 ? "viaje evitado" : "viajes evitados"}`;

/** Asigna un envío en bodega a una ruta abierta compatible, sin exceder su capacidad (RN-10). */
function asignar(ev) {
  const boton = ev.target.closest("button[data-guia][data-ruta]");
  if (!boton) return;
  const ruta = rutaPorCodigo(boton.dataset.ruta);
  const envio = envioPorGuia(boton.dataset.guia);
  if (!ruta || !envio) return avisar("La ruta o el envío ya no están disponibles.", true);
  if (ruta.estado !== "abierta") return avisar("La ruta no admite cambios.", true);
  if (envio.estado !== "en bodega" || envio.rutaAsignada || ruta.envios.includes(envio.codigoGuia))
    return avisar("El envío ya está asignado o no está en bodega.", true);
  if (envio.sucursalDestino !== ruta.sucursalDestino || envio.modalidad !== ruta.modalidad)
    return avisar("El destino o la modalidad del envío no coinciden con la ruta.", true);
  // RF-25: se controla la capacidad en peso Y en cantidad de paquetes
  const carga = calculos(ruta);
  if (carga.librePeso < envio.pesoFacturable || carga.libreCantidad < 1)
    return avisar(
      `Capacidad insuficiente. Libre: ${carga.librePeso.toFixed(1)} kg y ${carga.libreCantidad} paquetes.`,
      true,
    );

  const ahora = new Date().toISOString();
  ruta.envios.push(envio.codigoGuia);
  envio.estado = "asignado a ruta";
  envio.rutaAsignada = ruta.codigo;
  envio.historial.push({
    estadoAnterior: "en bodega",
    estado: "asignado a ruta",
    fecha: ahora,
    detalle: `Asignado a ${ruta.codigo}`,
  });
  guardarEstado(estado);
  render();
  actualizar();
  avisarEnvios([envio.codigoGuia]);
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Envío asignado.");
}

/** Retira un envío de una ruta que aún no salió y lo devuelve a «en bodega» (RF-27). */
function retirar(ruta, guia) {
  if (ruta.estado !== "abierta") return avisar("Solo se retira un envío antes de la salida.", true);
  const envio = envioPorGuia(guia);
  if (!envio) return avisar("El envío ya no existe.", true);
  const ahora = new Date().toISOString();
  ruta.envios = ruta.envios.filter((g) => g !== guia);
  const anterior = envio.estado;
  envio.estado = "en bodega";
  envio.rutaAsignada = null;
  envio.fechaIngresoBodega = ahora;
  envio.historial.push({
    estadoAnterior: anterior,
    estado: "en bodega",
    fecha: ahora,
    detalle: `Retirado de ${ruta.codigo}`,
  });
  guardarEstado(estado);
  render();
  actualizar();
  avisarEnvios([guia]);
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Envío retirado y devuelto a bodega.");
}

/** Cierra la ruta: cambia en bloque el estado de sus envíos y calcula el ahorro por consolidación (RF-28). */
async function despachar(ruta) {
  const carga = calculos(ruta);
  ruta.envios = carga.envios.map((e) => e.codigoGuia);
  if (!carga.cantidad) return avisar("La ruta no tiene envíos válidos.", true);
  if (carga.peso > ruta.capacidadPeso || carga.cantidad > ruta.capacidadCantidad)
    return avisar("La ruta excede su capacidad.", true);

  const resumen = `${ruta.codigo} hacia ${nombreSucursal(ruta.sucursalDestino)} en ${modalidad(ruta.modalidad)?.nombre}. ${carga.cantidad} paquetes, ${carga.peso.toFixed(1)} kg, salida ${fechaLocal(ruta.fechaSalida)}, emisiones consolidadas ${carga.emisionesConsolidadas.toFixed(3)} kg CO₂e frente a ${carga.emisionesIndividuales.toFixed(3)} kg CO₂e en furgonetas individuales. Ahorro por consolidación: ${textoAhorro(carga)}. No podrá modificarse después.`;
  if (!(await confirmar("Confirmar despacho", resumen))) return;
  if (ruta.estado !== "abierta") return avisar("La ruta ya no está abierta.", true);

  const ahora = new Date().toISOString();
  ruta.estado = "en ruta";
  ruta.emisionesTotales = carga.emisionesConsolidadas;
  ruta.ahorroConsolidacion = carga.ahorro;
  ruta.consolidacion = {
    emisionesIndividuales: carga.emisionesIndividuales,
    emisionesConsolidadas: carga.emisionesConsolidadas,
    ahorro: carga.ahorro,
    ahorroPorcentaje: carga.ahorroPorcentaje,
    viajesIndividuales: carga.viajesIndividuales,
    viajesConsolidados: carga.viajesConsolidados,
    viajesEvitados: carga.viajesEvitados,
    kmEvitados: carga.kmEvitados,
  };
  ruta.fechaSalidaReal = ahora;
  carga.envios.forEach((e) => {
    const anterior = e.estado;
    e.estado = "en ruta";
    e.emisionesEvitadasConsolidacionKgCO2e = Number(
      (carga.ahorro / carga.envios.length).toFixed(3),
    );
    e.historial.push({
      estadoAnterior: anterior,
      estado: "en ruta",
      fecha: ahora,
      detalle: `Salida en ${ruta.codigo}`,
    });
  });
  guardarEstado(estado);
  render();
  actualizar();
  avisarEnvios(carga.envios.map((e) => e.codigoGuia));
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar("Ruta despachada.");
}

/** Cancelar una ruta abierta devuelve todos sus envíos a bodega. */
async function cancelarRuta(ruta) {
  if (ruta.estado !== "abierta") return avisar("Solo se cancela una ruta que aún no salió.", true);
  const carga = calculos(ruta);
  const dato = (etiqueta, valor) => `<div class="dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`;
  const motivo = await solicitarCancelacion({
    titulo: "Cancelar ruta",
    resumenHTML: `<dl class="datos">${dato("Ruta", `<strong>${escapar(ruta.codigo)}</strong>`)}${dato("Destino", escapar(nombreSucursal(ruta.sucursalDestino)))}${dato("Modalidad", escapar(modalidad(ruta.modalidad)?.nombre ?? ruta.modalidad))}${dato("Estado actual", htmlEstado(ruta.estado))}${dato("Envíos asignados", String(carga.cantidad))}</dl>`,
    impacto: [
      carga.cantidad
        ? `${carga.cantidad} ${carga.cantidad === 1 ? "envío volverá" : "envíos volverán"} a bodega y quedará${carga.cantidad === 1 ? "" : "n"} disponible${carga.cantidad === 1 ? "" : "s"} para otra ruta.`
        : "La ruta no tiene envíos asignados.",
      "La ruta se conserva como Cancelada para auditoría.",
    ],
    etiquetaConfirmar: "Confirmar cancelación",
  });
  if (motivo === null) return;

  const ahora = new Date().toISOString();
  carga.envios.forEach((e) => {
    e.estado = "en bodega";
    e.rutaAsignada = null;
    e.fechaIngresoBodega = ahora;
    e.historial.push({
      estadoAnterior: "asignado a ruta",
      estado: "en bodega",
      fecha: ahora,
      detalle: `Ruta ${ruta.codigo} cancelada: ${motivo}`,
    });
  });
  ruta.envios = [];
  ruta.estado = "cancelada";
  ruta.fechaCancelacion = ahora;
  ruta.motivoCancelacion = motivo;
  guardarEstado(estado);
  render();
  actualizar();
  avisarEnvios(carga.envios.map((e) => e.codigoGuia));
  document.dispatchEvent(new Event("inventarioActualizado"));
  avisar(`Ruta ${ruta.codigo} cancelada.`);
}

/** Delegación de eventos de las tarjetas de ruta. */
function accionRuta(ev) {
  const boton = ev.target.closest("button[data-accion]");
  const ruta = boton && rutaPorCodigo(boton.dataset.ruta);
  if (!ruta) return;
  switch (boton.dataset.accion) {
    case "retirar":
      return retirar(ruta, boton.dataset.guia);
    case "cerrar":
      return despachar(ruta);
    case "cancelar":
      return cancelarRuta(ruta);
    case "imprimir":
      return imprimir(
        htmlGuiaDespacho(ruta, resultadoConsolidacion(ruta, calculos(ruta)), { estado, catalogo }),
        `Guía de despacho ${ruta.codigo}`,
      );
  }
}

/** Envíos en bodega con el mismo destino y modalidad que la ruta. */
function htmlEnviosCompatibles(ruta) {
  const compatibles = estado.envios.filter(
    (e) =>
      e.estado === "en bodega" &&
      !e.rutaAsignada &&
      e.sucursalDestino === ruta.sucursalDestino &&
      e.modalidad === ruta.modalidad,
  );
  return `<section class="grupo-ruta"><h3>${escapar(ruta.codigo)}: ${escapar(nombreSucursal(ruta.sucursalDestino))} · ${escapar(modalidad(ruta.modalidad)?.nombre ?? "")}</h3>${
    compatibles
      .map(
        (e) =>
          `<p class="fila-asignar"><span>${escapar(e.codigoGuia)} · ${e.pesoFacturable} kg</span><button type="button" data-ruta="${escapar(ruta.codigo)}" data-guia="${escapar(e.codigoGuia)}" aria-label="Asignar ${escapar(e.codigoGuia)} a ${escapar(ruta.codigo)}">Asignar</button></p>`,
      )
      .join("") ||
    '<p class="vacio">No hay envíos en bodega compatibles con el destino y la modalidad.</p>'
  }</section>`;
}

/** Tarjeta de una ruta con su carga, capacidad libre y acciones. */
function htmlRuta(ruta) {
  const carga = calculos(ruta);
  const consolidacion = resultadoConsolidacion(ruta, carga);
  const porcentaje = Math.min(100, (carga.peso / ruta.capacidadPeso) * 100);
  const abierta = ruta.estado === "abierta";
  const codigo = escapar(ruta.codigo);
  const botones = `${
    abierta
      ? `<button type="button" data-accion="cerrar" data-ruta="${codigo}" ${carga.cantidad ? "" : 'disabled title="Agregue al menos un envío antes de despachar"'}>Cerrar y despachar</button>`
      : ""
  }<button type="button" class="secundario" data-accion="imprimir" data-ruta="${codigo}" aria-label="Imprimir guía de despacho de ${codigo}">Imprimir guía</button>${
    abierta
      ? `<button type="button" class="peligro" data-accion="cancelar" data-ruta="${codigo}" aria-label="Cancelar ${codigo}">Cancelar ruta</button>`
      : ""
  }`;
  return `<article id="ruta-${codigo}" class="tarjeta ${ruta.estado === "cancelada" ? "ruta-cancelada" : ""}"><header class="fila"><div><h3>${codigo}</h3><p>${escapar(nombreSucursal(ruta.sucursalDestino))} · ${escapar(modalidad(ruta.modalidad)?.nombre ?? "")} · <span class="estado estado-ruta-${escapar(ruta.estado.replace(/\s+/g, "-"))}">${escapar(etiquetaEstado(ruta.estado))}</span></p></div><div class="acciones">${botones}</div></header><p>Peso facturable ${carga.peso.toFixed(1)}/${ruta.capacidadPeso} kg · Paquetes ${carga.cantidad}/${ruta.capacidadCantidad} · Libre ${carga.librePeso.toFixed(1)} kg y ${carga.libreCantidad} paquetes</p><progress max="100" value="${porcentaje}" aria-label="Ocupación de ${codigo}"></progress><dl class="datos consolidacion" aria-label="Ahorro por consolidación de ${codigo}"><div class="dato"><dt>En furgonetas individuales</dt><dd>${consolidacion.emisionesIndividuales.toFixed(3)} kg CO₂e · ${consolidacion.viajesIndividuales} ${consolidacion.viajesIndividuales === 1 ? "viaje" : "viajes"}</dd></div><div class="dato"><dt>Consolidado</dt><dd>${consolidacion.emisionesConsolidadas.toFixed(3)} kg CO₂e · ${consolidacion.viajesConsolidados} ${consolidacion.viajesConsolidados === 1 ? "viaje" : "viajes"}</dd></div><div class="dato"><dt>Ahorro por consolidación</dt><dd><strong>${textoAhorro(consolidacion)}</strong> · ${Math.round(consolidacion.kmEvitados)} km evitados</dd></div></dl>${
    ruta.estado === "cancelada"
      ? `<p class="nota">Cancelada: ${escapar(ruta.motivoCancelacion ?? "")}</p>`
      : ""
  }${carga.envios
    .map(
      (e) =>
        `<p class="fila-asignar"><span>${escapar(e.codigoGuia)}</span>${abierta ? `<button type="button" class="secundario" data-accion="retirar" data-ruta="${codigo}" data-guia="${escapar(e.codigoGuia)}" aria-label="Retirar ${escapar(e.codigoGuia)} de ${codigo}">Retirar</button>` : ""}</p>`,
    )
    .join("")}</article>`;
}

/** Pinta los envíos disponibles y la lista de rutas. */
function render() {
  const abiertas = estado.rutas.filter((r) => r.estado === "abierta");
  el.enviosDisponiblesRuta.innerHTML =
    abiertas.map(htmlEnviosCompatibles).join("") ||
    '<p class="vacio">Cree una ruta abierta para consultar envíos compatibles.</p>';
  el.listaRutas.innerHTML = estado.rutas.length
    ? estado.rutas.map(htmlRuta).join("")
    : '<p class="vacio">Todavía no hay rutas creadas.</p>';
}
