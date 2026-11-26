// M1 + M5: registro de solicitudes, comparación de modalidades y tabla de envíos.
import { guardarEstado } from "../persistencia.js";
import { obtenerDistancia } from "../catalogo.js";
import {
  ESTADOS,
  ESTADO_CANCELADO,
  ESTADOS_ACTIVOS,
  DIMENSION_MAX_ABSOLUTA_CM,
  puedeCancelarse,
  clasificarEnvio,
  pesoVolumetrico,
  esSobredimensionado,
  modalidadesViables,
  calcularTarifa,
  calcularEmisiones,
  emisionesEvitadasLimpias,
  moneda,
} from "../reglas.js";
import { validarEnvioFormulario } from "../validaciones.js";
import { normalizarTexto, fechaLocal, escapar, etiquetaEstado, hoyISO } from "../utilidades.js";
import { activarValidacion, vincularRangoFechas } from "../formularios.js";
import { abrirDialogo, solicitarCancelacion } from "../modales.js";
import { imprimir } from "../impresion.js";
import { consultarGuia } from "./seguimiento.js";
import {
  htmlFichaEnvio,
  htmlDesglose,
  htmlDimensiones,
  htmlEstado,
  etiquetaContenido,
} from "../plantillas.js";

const IDS = [
  "formEnvio",
  "guiaEdicion",
  "buscarRemitente",
  "remitente",
  "datosRemitente",
  "buscarDestinatario",
  "destinatario",
  "datosDestinatario",
  "origen",
  "destino",
  "peso",
  "largo",
  "ancho",
  "alto",
  "contenido",
  "urgente",
  "autorizacionSobredimension",
  "responsableAutorizacion",
  "etiquetaResponsable",
  "btnComparar",
  "cancelarEdicionEnvio",
  "comparacion",
  "tablaEnvios",
  "buscarEnvio",
  "filtroModalidadEnvio",
  "filtroEstadoEnvio",
  "filtroSucursalEnvio",
  "filtroFechaDesde",
  "filtroFechaHasta",
  "cantidadEnviosPagina",
  "limpiarFiltrosEnvios",
  "paginaAnteriorEnvios",
  "paginaSiguienteEnvios",
  "informacionPaginaEnvios",
  "contadorSolicitudes",
  "conteoActivos",
  "conteoCancelados",
  "conteoHistoricos",
  "conteoTotal",
  "dialogoEnvio",
  "tituloDetalleEnvio",
  "contenidoDetalleEnvio",
  "cerrarDetalleEnvio",
  "imprimirDetalleEnvio",
  "irSeguimientoEnvio",
];

let estado, catalogo, avisar, actualizar;
let el = {};
let opciones = []; // modalidades calculadas en la última comparación
let firmaComparacion = ""; // datos del formulario con los que se calcularon
let guiaOrigenReenvio = "";
let guiaDetalle = "";
let pagina = 1;
let orden = { campo: "fecha", direccion: "desc" };
let validacion;
let rangoFechas;

const sucursal = (codigo) => catalogo.sucursales.find((s) => s.codigo === codigo);
const modalidad = (codigo) => catalogo.modalidades.find((m) => m.codigo === codigo);
const cliente = (id) => estado.clientes.find((c) => c.id === id);
const nombreCliente = (id) => cliente(id)?.nombre ?? "No disponible";
const envioPorGuia = (guia) => estado.envios.find((e) => e.codigoGuia === guia);
const contexto = () => ({ estado, catalogo });
const reenvioActivo = (guia) =>
  estado.envios.find((e) => e.envioOrigen === guia && ESTADOS_ACTIVOS.includes(e.estado));

/* ---------- Arranque ---------- */

/** Enlaza el formulario de solicitud, la comparación y la tabla de envíos. */
export function iniciarEnvios(e, c, a, u) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  el = Object.fromEntries(IDS.map((id) => [id, document.getElementById(id)]));

  // Los límites del formulario salen del catálogo, no del HTML
  const { reglas } = catalogo;
  el.peso.min = reglas.pesoMinKg;
  el.peso.max = reglas.pesoMaxKg;
  [el.largo, el.ancho, el.alto].forEach((campo) => (campo.max = DIMENSION_MAX_ABSOLUTA_CM));

  construirFiltros();
  configurarValidacion();
  rangoFechas = vincularRangoFechas(el.filtroFechaDesde, el.filtroFechaHasta, {
    hoy: hoyISO(),
    avisar,
  });

  el.formEnvio.addEventListener("submit", comparar);
  // Cualquier cambio en los datos obliga a comparar de nuevo
  el.formEnvio.addEventListener("input", invalidarComparacion);
  el.formEnvio.addEventListener("change", invalidarComparacion);
  el.autorizacionSobredimension.addEventListener("change", sincronizarResponsable);
  el.comparacion.addEventListener("click", (ev) => {
    const boton = ev.target.closest("button[data-opcion]");
    if (boton) confirmarOpcion(Number(boton.dataset.opcion));
  });

  // Delegación de eventos: un único escuchador atiende los botones de todas las filas
  el.tablaEnvios.addEventListener("click", accionTabla);
  document.querySelectorAll(".orden-columna").forEach((boton) =>
    boton.addEventListener("click", () => {
      orden =
        orden.campo === boton.dataset.orden
          ? { campo: orden.campo, direccion: orden.direccion === "asc" ? "desc" : "asc" }
          : { campo: boton.dataset.orden, direccion: "asc" };
      pagina = 1;
      renderEnvios();
    }),
  );
  [
    el.buscarEnvio,
    el.filtroModalidadEnvio,
    el.filtroEstadoEnvio,
    el.filtroSucursalEnvio,
    el.filtroFechaDesde,
    el.filtroFechaHasta,
    el.cantidadEnviosPagina,
  ].forEach((control) =>
    control.addEventListener(control === el.buscarEnvio ? "input" : "change", () => {
      pagina = 1;
      renderEnvios();
    }),
  );
  el.limpiarFiltrosEnvios.addEventListener("click", limpiarFiltros);
  el.paginaAnteriorEnvios.addEventListener("click", () => {
    if (pagina > 1) {
      pagina--;
      renderEnvios();
    }
  });
  el.paginaSiguienteEnvios.addEventListener("click", () => {
    pagina++;
    renderEnvios();
  });
  el.cancelarEdicionEnvio.addEventListener("click", cancelarEdicion);

  el.cerrarDetalleEnvio.addEventListener("click", () => el.dialogoEnvio.close());
  el.imprimirDetalleEnvio.addEventListener("click", imprimirFicha);
  el.irSeguimientoEnvio.addEventListener("click", irASeguimiento);
  el.contenidoDetalleEnvio.addEventListener("click", (ev) => {
    const enlace = ev.target.closest("[data-ir-guia]");
    if (enlace) abrirDetalleEnvio(enlace.dataset.irGuia);
  });

  el.buscarRemitente.addEventListener("input", () =>
    cargarClientes("remitente", el.buscarRemitente.value),
  );
  el.buscarDestinatario.addEventListener("input", () =>
    cargarClientes("destinatario", el.buscarDestinatario.value),
  );
  el.remitente.addEventListener("change", () => mostrarDatosCliente("remitente"));
  el.destinatario.addEventListener("change", () => mostrarDatosCliente("destinatario"));

  // Otros módulos avisan cuando cambian el estado de un envío
  document.addEventListener("envioActualizado", (ev) => ev.detail.guias.forEach(actualizarFila));

  actualizarSelectores();
  renderEnvios();
}

/* ---------- Selectores ---------- */

/** Llena los selectores de sucursal, modalidad y estado con datos del catálogo. */
function construirFiltros() {
  const opcionesSucursal = catalogo.sucursales
    .map((s) => `<option value="${s.codigo}">${escapar(s.nombre)}</option>`)
    .join("");
  el.origen.innerHTML = `<option value="">Seleccione</option>${opcionesSucursal}`;
  el.destino.innerHTML = `<option value="">Seleccione</option>${opcionesSucursal}`;
  el.filtroSucursalEnvio.innerHTML = `<option value="">Todas</option>${opcionesSucursal}`;
  el.filtroModalidadEnvio.innerHTML =
    '<option value="">Todas</option>' +
    catalogo.modalidades
      .map((m) => `<option value="${m.codigo}">${escapar(m.nombre)}</option>`)
      .join("");
  // Filtro histórico: incluye Cancelado (el inventario operativo no lo incluye)
  el.filtroEstadoEnvio.innerHTML =
    '<option value="">Todos</option>' +
    [...ESTADOS, ESTADO_CANCELADO]
      .map((e) => `<option value="${e}">${etiquetaEstado(e)}</option>`)
      .join("");
}

/** Solo los clientes activos se pueden usar en solicitudes nuevas. */
function cargarClientes(id, busqueda = "", forzarIds = []) {
  const selector = document.getElementById(id);
  const actual = selector.value;
  const texto = normalizarTexto(busqueda);
  const lista = estado.clientes.filter(
    (c) =>
      (c.estado === "activo" || forzarIds.includes(c.id)) &&
      normalizarTexto([c.nombre, c.identificacion, c.correo].join(" ")).includes(texto),
  );
  selector.innerHTML =
    '<option value="">Seleccione</option>' +
    lista
      .map(
        (c) =>
          `<option value="${c.id}">${escapar(c.nombre)} (${escapar(c.identificacion)})</option>`,
      )
      .join("");
  if (lista.some((c) => c.id === actual)) selector.value = actual;
  mostrarDatosCliente(id);
}

/** RF-10: al elegir un cliente se ven sus datos, sin volver a capturarlos. */
function mostrarDatosCliente(id) {
  const c = cliente(document.getElementById(id).value);
  document.getElementById(id === "remitente" ? "datosRemitente" : "datosDestinatario").textContent =
    c ? `${c.telefono} · ${c.correo} · ${c.provincia}` : "";
}

/** Rehace las listas de remitente y destinatario según el texto de búsqueda de cada una. */
export function actualizarSelectores() {
  if (!estado || !catalogo) return;
  cargarClientes("remitente", el.buscarRemitente.value);
  cargarClientes("destinatario", el.buscarDestinatario.value);
}

/* ---------- Validación del formulario ---------- */

const dimension = (nombre) => (campo) =>
  campo.validity.valueMissing
    ? `Indique el ${nombre} en cm.`
    : campo.validity.rangeUnderflow
      ? "La dimensión mínima es 1 cm."
      : campo.validity.rangeOverflow
        ? `El ${nombre} no puede superar ${campo.max} cm.`
        : "Las dimensiones deben ser números enteros.";

const MENSAJE_RESPONSABLE = "Indique el responsable que autorizó la sobredimensión.";

/** Mensajes en español por campo y reglas de negocio que se evalúan junto a la validación nativa. */
function configurarValidacion() {
  let avisoPendiente = false;
  validacion = activarValidacion(
    el.formEnvio,
    {
      remitente: () => "Seleccione el remitente.",
      destinatario: () => "Seleccione el destinatario.",
      origen: () => "Seleccione la sucursal de origen.",
      destino: () => "Seleccione la sucursal de destino.",
      peso: (c) =>
        c.validity.valueMissing || c.validity.badInput
          ? "Indique el peso real en kg."
          : c.validity.rangeUnderflow
            ? `El peso mínimo es ${c.min} kg.`
            : c.validity.rangeOverflow
              ? `El peso máximo es ${c.max} kg.`
              : "Use como máximo un decimal (por ejemplo 12.5).",
      largo: dimension("largo"),
      ancho: dimension("ancho"),
      alto: dimension("alto"),
      responsableAutorizacion: () => MENSAJE_RESPONSABLE,
    },
    {
      extras: {
        // El navegador acepta "   " como valor presente: aquí se rechaza
        responsableAutorizacion: (c) =>
          el.autorizacionSobredimension.checked && !c.value.trim() ? MENSAJE_RESPONSABLE : "",
        destinatario: (c) =>
          c.value && c.value === el.remitente.value
            ? "El remitente y el destinatario deben ser clientes diferentes."
            : "",
        destino: (c) =>
          c.value && c.value === el.origen.value
            ? "La sucursal de origen y la de destino deben ser diferentes."
            : "",
      },
      // Se avisa solo del primer campo inválido, para no apilar notificaciones
      alInvalido: (_campo, mensaje) => {
        if (avisoPendiente) return;
        avisoPendiente = true;
        avisar(mensaje, true);
        setTimeout(() => (avisoPendiente = false));
      },
    },
  );
}

/** Si la casilla está marcada, el responsable se habilita y es obligatorio; si no, se limpia. */
function sincronizarResponsable() {
  const marcada = el.autorizacionSobredimension.checked;
  el.responsableAutorizacion.disabled = !marcada;
  el.responsableAutorizacion.required = marcada;
  if (!marcada) el.responsableAutorizacion.value = "";
  el.etiquetaResponsable.textContent = marcada
    ? "Responsable de autorización *"
    : "Responsable de autorización";
}

/** Todos los datos que influyen en el cálculo (punto 4). */
function datosFormulario() {
  return {
    remitente: el.remitente.value,
    destinatario: el.destinatario.value,
    origen: el.origen.value,
    destino: el.destino.value,
    pesoReal: Number(el.peso.value),
    largo: Number(el.largo.value),
    ancho: Number(el.ancho.value),
    alto: Number(el.alto.value),
    contenido: el.contenido.value,
    urgente: el.urgente.checked,
    sobredimensionMarcada: el.autorizacionSobredimension.checked,
    responsableAutorizacion: el.responsableAutorizacion.value.trim(),
  };
}
const firmaActual = () => JSON.stringify(datosFormulario());

const MENSAJE_CAMBIO = "Los datos cambiaron. Vuelva a comparar las modalidades.";

/** Si los datos ya no coinciden con los comparados, se descartan las opciones calculadas. */
function invalidarComparacion() {
  if (!firmaComparacion || firmaComparacion === firmaActual()) return;
  opciones = [];
  firmaComparacion = "";
  el.comparacion.innerHTML = `<p class="vacio alerta">${MENSAJE_CAMBIO}</p>`;
}

/** Descarta las opciones calculadas: cualquier cambio en el formulario obliga a comparar de nuevo. */
function limpiarComparacion(mensaje = "Complete el formulario.") {
  opciones = [];
  firmaComparacion = "";
  el.comparacion.innerHTML = `<p class="vacio">${escapar(mensaje)}</p>`;
}

/** Muestra un error de regla de negocio junto a su campo y limpia la comparación. */
function rechazar({ campo, mensaje }) {
  limpiarComparacion("Corrija los datos indicados para comparar.");
  if (el[campo]) validacion.marcar(el[campo], mensaje);
  avisar(mensaje, true);
}

/* ---------- Comparación de modalidades (RF-21 a RF-23) ---------- */

/** Valida la solicitud y calcula tarifa y emisiones de cada modalidad viable (RF-21 a RF-23). */
function comparar(ev) {
  ev.preventDefault();
  const datos = datosFormulario();
  const errores = validarEnvioFormulario(datos, catalogo.reglas);
  if (errores.length) return rechazar(errores[0]);

  let distancia;
  try {
    distancia = obtenerDistancia(catalogo, datos.origen, datos.destino);
  } catch (error) {
    return avisar(error.message, true);
  }

  const dimensiones = { largo: datos.largo, ancho: datos.ancho, alto: datos.alto };
  const pv = pesoVolumetrico(
    datos.largo,
    datos.ancho,
    datos.alto,
    catalogo.reglas.divisorVolumetrico,
  );
  const paquete = {
    pesoReal: datos.pesoReal,
    pesoVolumetrico: pv,
    pesoFacturable: Math.max(datos.pesoReal, pv), // RN-01
    dimensiones,
    contenido: datos.contenido,
    urgente: datos.urgente,
    sobredimension: esSobredimensionado(dimensiones, catalogo.reglas),
    autorizacionSobredimension: datos.sobredimensionMarcada
      ? { autorizada: true, responsable: datos.responsableAutorizacion }
      : null,
  };
  const origenSucursal = sucursal(datos.origen);
  opciones = modalidadesViables(catalogo, paquete, origenSucursal, distancia)
    .map((m) => ({
      modalidad: m,
      tarifa: calcularTarifa(catalogo, origenSucursal, paquete, distancia, m),
      emisiones: calcularEmisiones(distancia, paquete.pesoFacturable, m),
      paquete,
      distancia,
      origen: datos.origen,
      destino: datos.destino,
    }))
    .sort((a, b) => a.emisiones - b.emisiones); // la primera es la de menor emisión
  firmaComparacion = JSON.stringify(datos);

  el.comparacion.innerHTML =
    htmlResumenSolicitud(datos, paquete, distancia) +
    (opciones.length
      ? opciones.map(htmlOpcion).join("")
      : `<p class="vacio alerta error">${
          paquete.contenido === "frio"
            ? "No existe una modalidad refrigerada compatible con el peso, la distancia y la sucursal de origen."
            : "No existe modalidad viable para el peso, las dimensiones, la distancia y la sucursal seleccionados."
        }</p>`);
}

/** RF-06: resumen de la solicitud antes de confirmar. */
function htmlResumenSolicitud(datos, paquete, distancia) {
  const dato = (etiqueta, valor) => `<div class="dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`;
  return `<section class="resumen-solicitud"><h3>Resumen de la solicitud</h3><dl class="datos">${dato(
    "Remitente",
    escapar(nombreCliente(datos.remitente)),
  )}${dato("Destinatario", escapar(nombreCliente(datos.destinatario)))}${dato(
    "Trayecto",
    `${escapar(sucursal(datos.origen).nombre)} → ${escapar(sucursal(datos.destino).nombre)} (${distancia} km)`,
  )}${dato("Contenido", escapar(etiquetaContenido(datos.contenido)))}${dato(
    "Largo × Ancho × Alto",
    htmlDimensiones(paquete.dimensiones),
  )}${dato("Peso real", `${paquete.pesoReal} kg`)}${dato("Peso volumétrico", `${paquete.pesoVolumetrico} kg`)}${dato(
    "Peso facturable",
    `<strong>${paquete.pesoFacturable} kg</strong>`,
  )}${dato("Urgencia", datos.urgente ? "Urgente" : "Normal")}${dato(
    "Sobredimensión",
    paquete.sobredimension ? "Sí (recargo aplicado)" : "No",
  )}${
    datos.sobredimensionMarcada
      ? dato("Responsable de autorización", escapar(datos.responsableAutorizacion))
      : ""
  }</dl><p class="nota">El peso facturable es el mayor entre el peso real y el volumétrico.</p></section>`;
}

/** Tarjeta de una opción de modalidad con su desglose de tarifa y emisiones. */
function htmlOpcion(o, i) {
  const horas = Math.max(1, Math.ceil(o.distancia / o.modalidad.velocidadKmH));
  const comoEnvio = {
    tarifa: o.tarifa,
    pesoFacturable: o.paquete.pesoFacturable,
    distanciaKm: o.distancia,
    urgente: o.paquete.urgente,
    contenido: o.paquete.contenido,
    sobredimension: o.paquete.sobredimension,
    modalidad: o.modalidad.codigo,
  };
  return `<article class="opcion ${i === 0 ? "recomendada" : ""}">
<header><strong>${escapar(o.modalidad.nombre)}</strong>${i === 0 ? '<span class="etiqueta-menor">Menor emisión</span>' : ""}</header>
<dl class="datos"><div class="dato"><dt>Total</dt><dd><strong>${moneda(o.tarifa.total)}</strong></dd></div><div class="dato"><dt>Emisiones</dt><dd>${o.emisiones} kg CO₂e</dd></div><div class="dato"><dt>Entrega estimada</dt><dd>${horas} h</dd></div></dl>
<details ${i === 0 ? "open" : ""}><summary>Desglose de la tarifa</summary>${htmlDesglose(catalogo, comoEnvio)}</details>
<button type="button" data-opcion="${i}">${el.guiaEdicion.value ? "Guardar corrección" : "Elegir y registrar"}</button>
</article>`;
}

/* ---------- Registro y corrección (RF-01, RF-02, RF-08, RF-23) ---------- */

/** Registra o corrige la solicitud solo si los datos actuales son exactamente los que se compararon. */
function confirmarOpcion(indice) {
  const opcion = opciones[indice];
  if (!opcion) return;

  // 1. Validación nativa del formulario tal como está ahora
  validacion.evaluarTodos();
  if (!el.formEnvio.checkValidity()) {
    el.formEnvio.reportValidity();
    return avisar("Corrija los datos del formulario antes de registrar.", true);
  }
  // 2. Reglas de negocio con los datos actuales
  const errores = validarEnvioFormulario(datosFormulario(), catalogo.reglas);
  if (errores.length) return rechazar(errores[0]);
  // 3. Los datos actuales deben ser exactamente los que se compararon
  if (firmaComparacion !== firmaActual()) {
    invalidarComparacion();
    return avisar(MENSAJE_CAMBIO, true);
  }

  const existente = envioPorGuia(el.guiaEdicion.value);
  if (!existente) {
    // Solicitud nueva o reenvío: los clientes deben estar activos
    for (const id of [el.remitente.value, el.destinatario.value]) {
      const c = cliente(id);
      if (c?.estado !== "activo")
        return avisar(
          `El cliente ${c?.nombre ?? ""} está ${c?.estado ?? "no disponible"} y no puede usarse en registros nuevos.`,
          true,
        );
    }
    // Punto 7: un solo reenvío activo por guía original
    const activo = guiaOrigenReenvio && reenvioActivo(guiaOrigenReenvio);
    if (activo) return avisar(`Ya existe un reenvío activo: ${activo.codigoGuia}`, true);
  }

  const datos = datosFormulario();
  const ahora = new Date().toISOString();
  const responsable = opcion.paquete.autorizacionSobredimension?.responsable;
  const anotaciones = [
    responsable ? `sobredimensión autorizada por ${responsable}` : "",
    opcion === opciones[0] ? "" : "el agente no eligió la modalidad de menor emisión",
  ].filter(Boolean);
  const campos = {
    clienteRemitente: datos.remitente,
    clienteDestinatario: datos.destinatario,
    sucursalOrigen: opcion.origen,
    sucursalDestino: opcion.destino,
    ...opcion.paquete,
    distanciaKm: opcion.distancia,
    modalidad: opcion.modalidad.codigo,
    tarifa: opcion.tarifa,
    emisionesKgCO2e: opcion.emisiones,
    // RF-23: se registra cuál era la de menor emisión y si el agente la eligió
    modalidadMenorEmision: opciones[0].modalidad.codigo,
    eligioMenorEmision: opcion === opciones[0],
  };

  let guia;
  if (existente) {
    if (existente.estado !== "registrado")
      return avisar("Solo se corrigen envíos registrados.", true);
    Object.assign(existente, campos, { fechaModificacion: ahora });
    existente.historial.push({
      estadoAnterior: "registrado",
      estado: "registrado",
      fecha: ahora,
      detalle: ["Solicitud corregida conservando la guía", ...anotaciones].join("; "),
    });
    guia = existente.codigoGuia;
    avisar(`Envío ${guia} corregido.`);
  } else {
    guia = `ENV-${new Date().getFullYear()}-${String(estado.contadorGuia++).padStart(5, "0")}`;
    estado.envios.push({
      codigoGuia: guia,
      ...campos,
      emisionesEvitadasLimpiasKgCO2e: emisionesEvitadasLimpias(
        catalogo,
        opcion.distancia,
        opcion.paquete.pesoFacturable,
        opcion.emisiones,
      ),
      emisionesEvitadasConsolidacionKgCO2e: 0,
      estado: "registrado",
      rutaAsignada: null,
      envioOrigen: guiaOrigenReenvio || null,
      historial: [
        {
          estadoAnterior: null,
          estado: "registrado",
          fecha: ahora,
          detalle: [
            guiaOrigenReenvio
              ? `Reenvío creado desde ${guiaOrigenReenvio}`
              : "Solicitud registrada",
            ...anotaciones,
          ].join("; "),
        },
      ],
      fechaRegistro: ahora,
    });
    avisar(`Envío ${guia} registrado.`);
  }

  guardarEstado(estado);
  cancelarEdicion();
  pagina = 1;
  insertarFila(guia);
  actualizar();
  document.dispatchEvent(new Event("inventarioActualizado"));
}

/** Sale del modo edición o reenvío y deja el formulario como solicitud nueva. */
function cancelarEdicion() {
  el.formEnvio.reset();
  el.guiaEdicion.value = "";
  guiaOrigenReenvio = "";
  el.cancelarEdicionEnvio.hidden = true;
  el.btnComparar.textContent = "Comparar modalidades";
  sincronizarResponsable();
  validacion.reiniciar();
  limpiarComparacion();
  actualizarSelectores();
}

/** Copia un envío al formulario para corregirlo o reenviarlo. */
function cargarFormulario(e) {
  limpiarComparacion();
  cargarClientes("remitente", "", [e.clienteRemitente]);
  cargarClientes("destinatario", "", [e.clienteDestinatario]);
  el.remitente.value = e.clienteRemitente;
  el.destinatario.value = e.clienteDestinatario;
  mostrarDatosCliente("remitente");
  mostrarDatosCliente("destinatario");
  el.origen.value = e.sucursalOrigen;
  el.destino.value = e.sucursalDestino;
  el.peso.value = e.pesoReal;
  el.largo.value = e.dimensiones.largo;
  el.ancho.value = e.dimensiones.ancho;
  el.alto.value = e.dimensiones.alto;
  el.contenido.value = e.contenido;
  el.urgente.checked = e.urgente;
  el.autorizacionSobredimension.checked = Boolean(e.autorizacionSobredimension);
  sincronizarResponsable();
  el.responsableAutorizacion.value = e.autorizacionSobredimension?.responsable ?? "";
  validacion.reiniciar();
  el.cancelarEdicionEnvio.hidden = false;
  el.formEnvio.scrollIntoView({ behavior: "smooth" });
}

/* ---------- Acciones de la tabla ---------- */

/** Delegación de eventos: ver detalle, editar, reenviar o cancelar desde cualquier fila. */
function accionTabla(ev) {
  const boton = ev.target.closest("button[data-accion]");
  if (!boton) return;
  const e = envioPorGuia(boton.dataset.guia);
  if (!e) return;

  if (boton.dataset.accion === "detalle") return abrirDetalleEnvio(e.codigoGuia, boton);

  if (boton.dataset.accion === "reenviar") {
    if (e.estado !== "devuelto") return avisar("Solo se reenvían solicitudes devueltas.", true);
    const activo = reenvioActivo(e.codigoGuia);
    if (activo) return avisar(`Ya existe un reenvío activo: ${activo.codigoGuia}`, true);
    cargarFormulario(e);
    guiaOrigenReenvio = e.codigoGuia;
    el.guiaEdicion.value = "";
    el.btnComparar.textContent = "Comparar para reenviar";
    el.comparacion.innerHTML = `<p class="alerta">Reenvío basado en ${escapar(e.codigoGuia)}. Se generará una guía nueva.</p>`;
    return avisar("Datos copiados. Revise y compare las modalidades.");
  }

  if (boton.dataset.accion === "editar") {
    if (e.estado !== "registrado") return avisar("Solo se editan envíos registrados.", true);
    cargarFormulario(e);
    el.guiaEdicion.value = e.codigoGuia;
    el.btnComparar.textContent = "Recalcular y guardar";
    return;
  }

  if (boton.dataset.accion === "cancelar") cancelarEnvio(e);
}

/** RF-41 y puntos 9-10: cancelación lógica con resumen, impacto y motivo obligatorio. */
async function cancelarEnvio(e) {
  if (!puedeCancelarse(e))
    return avisar(
      e.estado === ESTADO_CANCELADO
        ? "El envío ya está cancelado."
        : "No se cancela un envío en ruta o entregado.",
      true,
    );

  const ruta = e.rutaAsignada ? estado.rutas.find((r) => r.codigo === e.rutaAsignada) : null;
  const reenvio = reenvioActivo(e.codigoGuia);
  const dato = (etiqueta, valor) => `<div class="dato"><dt>${etiqueta}</dt><dd>${valor}</dd></div>`;
  const resumenHTML = `<dl class="datos">${dato("Guía", `<strong>${escapar(e.codigoGuia)}</strong>`)}${dato(
    "Cliente",
    `${escapar(nombreCliente(e.clienteRemitente))} → ${escapar(nombreCliente(e.clienteDestinatario))}`,
  )}${dato("Estado actual", htmlEstado(e.estado))}${dato(
    "Trayecto",
    `${escapar(sucursal(e.sucursalOrigen)?.nombre)} → ${escapar(sucursal(e.sucursalDestino)?.nombre)}`,
  )}${dato(
    "Relaciones",
    [
      ruta ? `Ruta ${escapar(ruta.codigo)}` : "Sin ruta",
      e.envioOrigen ? `Guía original ${escapar(e.envioOrigen)}` : "",
      reenvio ? `Reenvío activo ${escapar(reenvio.codigoGuia)}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  )}</dl>`;
  const impacto = [
    "El envío pasará a estado Cancelado y dejará de aparecer en el inventario y en el despacho.",
    ruta ? `Se retirará de la ruta ${ruta.codigo}.` : "",
    e.estado === "en bodega" ? `Se liberarán ${e.pesoFacturable} kg de capacidad en bodega.` : "",
    reenvio ? `Su reenvío ${reenvio.codigoGuia} sigue activo y no se modifica.` : "",
    "La guía, el historial y el motivo se conservan para auditoría. La guía no se reutiliza.",
  ].filter(Boolean);

  const motivo = await solicitarCancelacion({
    titulo: "Cancelar envío",
    resumenHTML,
    impacto,
    etiquetaConfirmar: "Confirmar cancelación",
  });
  if (motivo === null) return; // se cerró el diálogo: no cambia nada ni se notifica

  const ahora = new Date().toISOString();
  e.estadoAnterior = e.estado;
  e.estado = ESTADO_CANCELADO;
  e.fechaCancelacion = ahora;
  e.motivoCancelacion = motivo;
  if (ruta) {
    ruta.envios = ruta.envios.filter((guia) => guia !== e.codigoGuia);
    e.rutaAnterior = ruta.codigo;
  }
  e.rutaAsignada = null;
  e.historial.push({
    estadoAnterior: e.estadoAnterior,
    estado: ESTADO_CANCELADO,
    fecha: ahora,
    detalle: `Cancelado: ${motivo}`,
  });
  guardarEstado(estado);
  actualizar();
  // Avisa a la tabla, al seguimiento, al inventario y al despacho (cada uno actualiza lo suyo)
  document.dispatchEvent(
    new CustomEvent("envioActualizado", { detail: { guias: [e.codigoGuia] } }),
  );
  document.dispatchEvent(new Event("inventarioActualizado"));
  document.dispatchEvent(new Event("rutasActualizadas"));
  avisar(`Envío ${e.codigoGuia} cancelado. La guía se conserva para auditoría.`);
}

/* ---------- Detalle e impresión ---------- */

/** Abre la ficha completa del envío en un diálogo. */
export function abrirDetalleEnvio(guia, origen) {
  const e = envioPorGuia(guia);
  if (!e) return avisar("Envío no encontrado.", true);
  guiaDetalle = guia;
  el.tituloDetalleEnvio.textContent = guia;
  el.contenidoDetalleEnvio.innerHTML = htmlFichaEnvio(e, contexto(), { lineaTiempo: true });
  if (!el.dialogoEnvio.open)
    abrirDialogo(el.dialogoEnvio, { origen, enfocar: el.cerrarDetalleEnvio });
}

/** Imprime la ficha del envío abierto (A4, sin la interfaz). */
function imprimirFicha() {
  const e = envioPorGuia(guiaDetalle);
  if (!e) return;
  imprimir(
    `<article class="ficha-impresa"><h2>Ficha del envío ${escapar(e.codigoGuia)}</h2>${htmlFichaEnvio(e, contexto(), { lineaTiempo: true })}</article>`,
    `Ficha ${e.codigoGuia}`,
  );
}

/** Cierra el detalle y abre el seguimiento de esa guía. */
function irASeguimiento() {
  const guia = guiaDetalle;
  el.dialogoEnvio.close();
  document.querySelector('[data-vista="seguimiento"]').click();
  consultarGuia(guia);
}

/* ---------- Tabla: filtros, orden y paginación (RF-38 a RF-40) ---------- */

/** Devuelve el predicado que combina texto, modalidad, estado, sucursal y fechas. */
function crearFiltro() {
  const q = normalizarTexto(el.buscarEnvio.value);
  const desde = el.filtroFechaDesde.value
    ? new Date(`${el.filtroFechaDesde.value}T00:00:00`).getTime()
    : 0;
  const hasta = el.filtroFechaHasta.value
    ? new Date(`${el.filtroFechaHasta.value}T23:59:59`).getTime()
    : Infinity;
  return (e) => {
    const fecha = new Date(e.fechaRegistro).getTime();
    const texto = normalizarTexto(
      [
        e.codigoGuia,
        e.envioOrigen,
        e.sucursalOrigen,
        e.sucursalDestino,
        sucursal(e.sucursalOrigen)?.nombre,
        sucursal(e.sucursalDestino)?.nombre,
        modalidad(e.modalidad)?.nombre,
        e.estado,
        nombreCliente(e.clienteRemitente),
        nombreCliente(e.clienteDestinatario),
      ].join(" "),
    );
    return (
      texto.includes(q) &&
      (!el.filtroModalidadEnvio.value || e.modalidad === el.filtroModalidadEnvio.value) &&
      (!el.filtroEstadoEnvio.value || e.estado === el.filtroEstadoEnvio.value) &&
      (!el.filtroSucursalEnvio.value ||
        e.sucursalOrigen === el.filtroSucursalEnvio.value ||
        e.sucursalDestino === el.filtroSucursalEnvio.value) &&
      fecha >= desde &&
      fecha <= hasta
    );
  };
}

const valorOrden = (e, campo) =>
  ({
    guia: e.codigoGuia,
    trayecto: `${e.sucursalOrigen}-${e.sucursalDestino}`,
    modalidad: modalidad(e.modalidad)?.nombre ?? "",
    total: e.tarifa?.total ?? 0,
    estado: e.estado,
    fecha: new Date(e.fechaRegistro).getTime(),
  })[campo];

/** Orden de la tabla: numérico para totales y alfabético con números naturales para texto. */
function comparador(x, y) {
  const a = valorOrden(x, orden.campo);
  const b = valorOrden(y, orden.campo);
  const resultado =
    typeof a === "number" ? a - b : String(a).localeCompare(String(b), "es", { numeric: true });
  return orden.direccion === "asc" ? resultado : -resultado;
}

/** Devuelve los envíos filtrados y ordenados, o null si el rango de fechas es inválido. */
function listaFiltrada() {
  if (!rangoFechas.esValido()) return null;
  return estado.envios.filter(crearFiltro()).sort(comparador);
}

/** Una fila de la tabla de envíos; Editar o Reenviar según el estado. */
function htmlFila(e) {
  const guia = escapar(e.codigoGuia);
  const accionPrincipal =
    e.estado === "devuelto"
      ? `<button type="button" data-accion="reenviar" data-guia="${guia}" aria-label="Reenviar ${guia}">Reenviar</button>`
      : `<button type="button" data-accion="editar" data-guia="${guia}" aria-label="Editar ${guia}" ${e.estado === "registrado" ? "" : "disabled"}>Editar</button>`;
  return `<tr data-guia="${guia}" class="${e.estado === ESTADO_CANCELADO ? "fila-cancelada" : ""}"><td><strong>${guia}</strong></td><td>${escapar(e.sucursalOrigen)} → ${escapar(e.sucursalDestino)}</td><td>${escapar(modalidad(e.modalidad)?.nombre ?? e.modalidad)}</td><td>${moneda(e.tarifa?.total || 0)}</td><td>${htmlEstado(e.estado)}</td><td>${fechaLocal(e.fechaRegistro)}</td><td><div class="acciones"><button type="button" data-accion="detalle" data-guia="${guia}" aria-label="Ver detalle de ${guia}">Ver</button>${accionPrincipal}<button type="button" class="peligro" data-accion="cancelar" data-guia="${guia}" aria-label="Cancelar ${guia}" ${puedeCancelarse(e) ? "" : "disabled"}>Cancelar</button></div></td></tr>`;
}

/** Actualiza contadores y paginación sin tocar las filas (RF-40). */
function actualizarMarcadores(lista = listaFiltrada()) {
  const tamano = Number(el.cantidadEnviosPagina.value);
  const total = lista ? lista.length : 0;
  const paginas = Math.ceil(total / tamano);
  pagina = Math.max(1, Math.min(pagina, paginas || 1));

  el.contadorSolicitudes.textContent = !lista
    ? "Rango de fechas inválido"
    : total === estado.envios.length
      ? `${total} solicitudes`
      : `${total} de ${estado.envios.length} solicitudes`;
  el.informacionPaginaEnvios.textContent = paginas
    ? `Página ${pagina} de ${paginas}`
    : "Página 0 de 0";
  el.paginaAnteriorEnvios.disabled = pagina <= 1;
  el.paginaSiguienteEnvios.disabled = !paginas || pagina >= paginas;

  // Conteos separados (punto 26): activos + cancelados + históricos = total general
  const conteo = estado.envios.reduce(
    (acum, e) => ({ ...acum, [clasificarEnvio(e)]: acum[clasificarEnvio(e)] + 1 }),
    { activo: 0, cancelado: 0, historico: 0 },
  );
  el.conteoActivos.textContent = conteo.activo;
  el.conteoCancelados.textContent = conteo.cancelado;
  el.conteoHistoricos.textContent = conteo.historico;
  el.conteoTotal.textContent = estado.envios.length;
  return { tamano, total };
}

/** Muestra la columna ordenada (▲/▼) y actualiza aria-sort. */
function marcarOrden() {
  document.querySelectorAll(".orden-columna").forEach((boton) => {
    const activa = boton.dataset.orden === orden.campo;
    boton.querySelector("span").textContent = activa ? (orden.direccion === "asc" ? "▲" : "▼") : "";
    boton
      .closest("th")
      .setAttribute(
        "aria-sort",
        activa ? (orden.direccion === "asc" ? "ascending" : "descending") : "none",
      );
  });
}

/** Tres situaciones distintas de tabla vacía, cada una con su propio mensaje. */
function mensajeSinFilas(lista) {
  if (!lista) return "Corrija el rango de fechas: Hasta no puede ser anterior a Desde.";
  if (!estado.envios.length) return "Todavía no hay solicitudes registradas.";
  return "No hay solicitudes que coincidan con los filtros.";
}

/** Redibujado total: se reserva para filtrar, ordenar y paginar (7.3). */
export function renderEnvios() {
  if (!estado) return;
  const lista = listaFiltrada();
  const { tamano } = actualizarMarcadores(lista);
  const visibles = lista ? lista.slice((pagina - 1) * tamano, pagina * tamano) : [];
  el.tablaEnvios.innerHTML = visibles.length
    ? visibles.map(htmlFila).join("")
    : `<tr><td colspan="7" class="vacio">${mensajeSinFilas(lista)}</td></tr>`;
  marcarOrden();
}

/**
 * Actualización dirigida (7.3): al registrar se inserta solo la fila nueva.
 * Si el orden activo o los filtros impiden saber dónde va, se redibuja.
 */
export function insertarFila(guia) {
  const e = envioPorGuia(guia);
  const lista = listaFiltrada();
  if (!e || !lista) return renderEnvios();
  const coincide = lista.some((x) => x.codigoGuia === guia);
  if (!coincide) return actualizarMarcadores(lista);
  if (orden.campo !== "fecha" || orden.direccion !== "desc" || pagina !== 1) return renderEnvios();

  const { tamano } = actualizarMarcadores(lista);
  el.tablaEnvios.querySelector("td.vacio")?.closest("tr").remove();
  el.tablaEnvios.insertAdjacentHTML("afterbegin", htmlFila(e));
  while (el.tablaEnvios.rows.length > tamano) el.tablaEnvios.deleteRow(-1);
}

/** Reemplaza únicamente la fila de un envío cuyo estado u otros datos cambiaron. */
function actualizarFila(guia) {
  if (!estado) return;
  const e = envioPorGuia(guia);
  const fila = el.tablaEnvios.querySelector(`tr[data-guia="${CSS.escape(guia)}"]`);
  const lista = listaFiltrada();
  const coincide = Boolean(e && lista?.some((x) => x.codigoGuia === guia));
  if (fila && coincide && orden.campo !== "estado") {
    fila.outerHTML = htmlFila(e);
    return actualizarMarcadores(lista);
  }
  // La fila aparece, desaparece o cambia de lugar: hay que redibujar
  if (fila || coincide) return renderEnvios();
  actualizarMarcadores(lista);
}

/** Restablece todos los filtros y los límites del rango de fechas. */
function limpiarFiltros() {
  [
    el.buscarEnvio,
    el.filtroModalidadEnvio,
    el.filtroEstadoEnvio,
    el.filtroSucursalEnvio,
    el.filtroFechaDesde,
    el.filtroFechaHasta,
  ].forEach((control) => (control.value = ""));
  rangoFechas.sincronizar();
  rangoFechas.esValido();
  pagina = 1;
  renderEnvios();
}
