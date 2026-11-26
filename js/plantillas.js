// Plantillas HTML compartidas por varias vistas (detalle, seguimiento, impresión).
// Solo construyen texto a partir de los datos que reciben: no tocan el DOM.
import { desgloseTarifa, moneda, esRetenido, textoDias, diasEnBodega } from "./reglas.js";
import { escapar, etiquetaEstado, claseEstado, fechaLocal } from "./utilidades.js";

const CONTENIDOS = { general: "General", fragil: "Frágil", frio: "Cadena de frío" };
/** Nombre legible del tipo de contenido. */
export const etiquetaContenido = (c) => CONTENIDOS[c] ?? c;

const fila = (etiqueta, valor) => `<div class="dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`;

/** Largo × Ancho × Alto en ese orden, con la unidad (punto 2 y 13). */
export const htmlDimensiones = (d = {}) =>
  `${d.largo ?? "—"} × ${d.ancho ?? "—"} × ${d.alto ?? "—"} cm`;

/** Insignia de estado con su clase de color. */
export const htmlEstado = (estado) =>
  `<span class="estado ${claseEstado(estado)}">${escapar(etiquetaEstado(estado))}</span>`;

/** Tabla del desglose de la tarifa: un componente por fila con la regla aplicada (RF-32). */
export function htmlDesglose(catalogo, envio) {
  const modalidad = catalogo.modalidades.find((m) => m.codigo === envio.modalidad);
  const filas = desgloseTarifa(catalogo, envio, modalidad)
    .map(
      (f) =>
        `<tr class="${f.tipo ? `desglose-${f.tipo}` : ""}"><th scope="row">${escapar(f.etiqueta)}</th><td>${escapar(f.regla)}</td><td class="numero">${f.monto < 0 ? "−" : ""}${moneda(Math.abs(f.monto))}</td></tr>`,
    )
    .join("");
  return `<div class="tabla-scroll"><table class="desglose"><caption>Desglose de la tarifa</caption><thead><tr><th scope="col">Componente</th><th scope="col">Regla aplicada</th><th scope="col" class="numero">Monto</th></tr></thead><tbody>${filas}</tbody></table></div>`;
}

/** Pesos real, volumétrico y facturable, con el motivo del facturable. */
function htmlPesos(e) {
  return `<dl class="datos">${fila("Peso real", `${e.pesoReal} kg`)}${fila("Peso volumétrico", `${e.pesoVolumetrico} kg`)}${fila("Peso facturable", `<strong>${e.pesoFacturable} kg</strong>`)}</dl><p class="nota">El peso facturable es el mayor entre el real y el volumétrico.</p>`;
}

/** Línea de tiempo de trazabilidad: del evento más reciente al más antiguo (RF-36). */
export function htmlLineaTiempo(envio) {
  return (
    (envio.historial || [])
      .slice()
      .reverse()
      .map(
        (h) =>
          `<li class="linea-tiempo"><strong>${escapar(etiquetaEstado(h.estadoAnterior || "inicio"))} → ${escapar(etiquetaEstado(h.estado))}</strong><p>${escapar(h.detalle || "Cambio de estado")}</p><small>${fechaLocal(h.fecha)}</small></li>`,
      )
      .join("") || '<li class="vacio">Sin eventos.</li>'
  );
}

/**
 * Ficha completa de un envío. `contexto` aporta lo que no vive en el envío:
 * { estado, catalogo }. `opciones.lineaTiempo` incluye la trazabilidad en la ficha.
 */
export function htmlFichaEnvio(e, { estado, catalogo }, opciones = {}) {
  const cliente = (id) => {
    const c = estado.clientes.find((x) => x.id === id);
    return c
      ? `${escapar(c.nombre)} <small>(${escapar(c.identificacion)})</small>`
      : "No disponible";
  };
  const sucursal = (codigo) =>
    escapar(catalogo.sucursales.find((s) => s.codigo === codigo)?.nombre ?? codigo);
  const modalidad = catalogo.modalidades.find((m) => m.codigo === e.modalidad);
  const reenvios = estado.envios.filter((x) => x.envioOrigen === e.codigoGuia);
  const enlace = (guia) =>
    `<button type="button" class="enlace" data-ir-guia="${escapar(guia)}">${escapar(guia)}</button>`;

  const retenido = esRetenido(e, estado.configuracion);
  const bodega =
    e.estado === "en bodega"
      ? fila(
          "Tiempo en bodega",
          `${textoDias(diasEnBodega(e))}${retenido ? " · <strong>Retenido</strong>" : ""}`,
        )
      : "";

  const autorizacion = e.autorizacionSobredimension
    ? `Autorizada por <strong>${escapar(e.autorizacionSobredimension.responsable)}</strong>`
    : "No requiere autorización";
  const sobredimension = e.sobredimension ? "Sí (recargo aplicado)" : "No";

  const menorEmision = e.modalidadMenorEmision
    ? fila(
        "Menor emisión entre las viables",
        `${escapar(catalogo.modalidades.find((m) => m.codigo === e.modalidadMenorEmision)?.nombre ?? e.modalidadMenorEmision)} · ${e.eligioMenorEmision ? "el agente la eligió" : "el agente eligió otra modalidad"}`,
      )
    : "";

  const cancelacion =
    e.estado === "cancelado"
      ? `<section class="ficha-seccion ficha-cancelado"><h3>Cancelación</h3><dl class="datos">${fila("Estado anterior", escapar(etiquetaEstado(e.estadoAnterior || "")))}${fila("Fecha", fechaLocal(e.fechaCancelacion))}${fila("Motivo", escapar(e.motivoCancelacion || ""))}</dl></section>`
      : "";

  const relaciones =
    e.envioOrigen || reenvios.length
      ? `<section class="ficha-seccion"><h3>Relaciones</h3><dl class="datos">${e.envioOrigen ? fila("Guía original", enlace(e.envioOrigen)) : ""}${reenvios.map((r) => fila("Reenvío asociado", `${enlace(r.codigoGuia)} · ${htmlEstado(r.estado)}`)).join("")}</dl></section>`
      : "";

  return `<div class="ficha">
<section class="ficha-seccion"><h3>Identificación</h3><dl class="datos">${fila("Guía", `<strong>${escapar(e.codigoGuia)}</strong>`)}${fila("Estado", htmlEstado(e.estado))}${bodega}${fila("Registro", fechaLocal(e.fechaRegistro))}${fila("Ruta", e.rutaAsignada ? escapar(e.rutaAsignada) : "Sin asignar")}</dl></section>
<section class="ficha-seccion"><h3>Personas</h3><dl class="datos">${fila("Remitente", cliente(e.clienteRemitente))}${fila("Destinatario", cliente(e.clienteDestinatario))}</dl></section>
<section class="ficha-seccion"><h3>Trayecto</h3><dl class="datos">${fila("Origen", sucursal(e.sucursalOrigen))}${fila("Destino", sucursal(e.sucursalDestino))}${fila("Distancia", `${e.distanciaKm} km`)}${fila("Modalidad", escapar(modalidad?.nombre ?? e.modalidad))}${menorEmision}</dl></section>
<section class="ficha-seccion"><h3>Paquete</h3><dl class="datos">${fila("Contenido", escapar(etiquetaContenido(e.contenido)))}${fila("Largo × Ancho × Alto", htmlDimensiones(e.dimensiones))}${fila("Urgencia", e.urgente ? "Urgente" : "Normal")}${fila("Sobredimensión", sobredimension)}${fila("Responsable de autorización", autorizacion)}</dl>${htmlPesos(e)}</section>
<section class="ficha-seccion"><h3>Ambiental</h3><dl class="datos">${fila("Emisiones estimadas", `${e.emisionesKgCO2e} kg CO₂e`)}${fila("Evitadas por modalidad limpia", `${e.emisionesEvitadasLimpiasKgCO2e ?? 0} kg CO₂e`)}${fila("Evitadas por consolidación", `${e.emisionesEvitadasConsolidacionKgCO2e ?? 0} kg CO₂e`)}</dl></section>
${relaciones}${cancelacion}
<section class="ficha-seccion ficha-tarifa">${htmlDesglose(catalogo, e)}</section>
${opciones.lineaTiempo ? `<section class="ficha-seccion ficha-tiempo"><h3>Línea de tiempo</h3><ol class="lista-tiempo">${htmlLineaTiempo(e)}</ol></section>` : ""}
</div>`;
}

/** Guía de despacho imprimible de una ruta (7.2 impresión). */
export function htmlGuiaDespacho(ruta, calculo, { estado, catalogo }) {
  const nombreSucursal = (c) => catalogo.sucursales.find((s) => s.codigo === c)?.nombre ?? c;
  const modalidad = catalogo.modalidades.find((m) => m.codigo === ruta.modalidad);
  const cliente = (id) => estado.clientes.find((c) => c.id === id)?.nombre ?? "No disponible";
  const filas = calculo.envios
    .map(
      (e) =>
        `<tr><th scope="row">${escapar(e.codigoGuia)}</th><td>${escapar(cliente(e.clienteRemitente))} → ${escapar(cliente(e.clienteDestinatario))}</td><td>${escapar(etiquetaContenido(e.contenido))}</td><td>${htmlDimensiones(e.dimensiones)}</td><td class="numero">${e.pesoFacturable} kg</td></tr>`,
    )
    .join("");
  return `<article class="guia-despacho">
<h2>Guía de despacho ${escapar(ruta.codigo)}</h2>
<dl class="datos">${fila("Destino", escapar(nombreSucursal(ruta.sucursalDestino)))}${fila("Modalidad", escapar(modalidad?.nombre ?? ruta.modalidad))}${fila("Salida programada", fechaLocal(ruta.fechaSalida))}${fila("Estado de la ruta", escapar(etiquetaEstado(ruta.estado)))}${fila("Capacidad", `${ruta.capacidadPeso} kg · ${ruta.capacidadCantidad} paquetes`)}${fila("Cargado", `${calculo.peso.toFixed(1)} kg facturables · ${calculo.cantidad} paquetes`)}${fila("Emisiones en furgonetas individuales", `${calculo.emisionesIndividuales.toFixed(3)} kg CO₂e (${calculo.viajesIndividuales} viajes)`)}${fila("Emisiones consolidadas", `${calculo.emisionesConsolidadas.toFixed(3)} kg CO₂e (${calculo.viajesConsolidados} ${calculo.viajesConsolidados === 1 ? "viaje" : "viajes"})`)}${fila("Ahorro por consolidación", `${calculo.ahorro.toFixed(3)} kg CO₂e (${calculo.ahorroPorcentaje ?? 0} %) · ${calculo.viajesEvitados ?? 0} ${calculo.viajesEvitados === 1 ? "viaje evitado" : "viajes evitados"}`)}</dl>
<div class="tabla-scroll"><table class="desglose"><caption>Envíos de la ruta</caption><thead><tr><th scope="col">Guía</th><th scope="col">Remitente → Destinatario</th><th scope="col">Contenido</th><th scope="col">Largo × Ancho × Alto</th><th scope="col" class="numero">Peso facturable</th></tr></thead><tbody>${filas || '<tr><td colspan="5" class="vacio">Sin envíos.</td></tr>'}</tbody></table></div>
<div class="firmas"><p>Despachó: ____________________</p><p>Recibió: ____________________</p></div>
</article>`;
}
