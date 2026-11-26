// M6: seguimiento por guía, ficha completa, línea de tiempo y cambios de estado.
import { guardarEstado } from "../persistencia.js";
import { TRANSICIONES, ESTADOS } from "../reglas.js";
import { etiquetaEstado } from "../utilidades.js";
import { escapar } from "../utilidades.js";
import { htmlFichaEnvio, htmlLineaTiempo } from "../plantillas.js";
import { activarValidacion } from "../formularios.js";

const FORMATO_GUIA = /^ENV-\d{4}-\d{5}$/;
// Progreso lineal del ciclo de vida normal (devuelto y cancelado quedan fuera del recorrido)
const RECORRIDO = ["registrado", "en bodega", "asignado a ruta", "en ruta", "entregado"];

let estado, catalogo, avisar, actualizar, confirmar;
let seleccionado = null;
let validacion;
const el = {};

/**
 * Normaliza lo que se escribe: sin espacios, en mayúsculas y con guiones en su lugar.
 *   " env-2026-00001 " → "ENV-2026-00001"      "env202600001" → "ENV-2026-00001"
 */
export function normalizarGuia(valor) {
  const limpio = String(valor ?? "")
    .replace(/\s+/g, "")
    .toUpperCase();
  const partes = limpio.match(/^ENV-?(\d{4})-?(\d{5})$/);
  return partes ? `ENV-${partes[1]}-${partes[2]}` : limpio;
}

/** Enlaza la búsqueda por guía y los botones de cambio de estado. */
export function iniciarSeguimiento(e, c, a, u, co) {
  estado = e;
  catalogo = c;
  avisar = a;
  actualizar = u;
  confirmar = co;
  ["formSeguimiento", "guiaSeguimiento", "resultadoSeguimiento", "historialSeguimiento"].forEach(
    (id) => (el[id] = document.getElementById(id)),
  );

  const MENSAJE_FORMATO = "Use el formato ENV-AAAA-00000, por ejemplo ENV-2026-00001.";
  validacion = activarValidacion(
    el.formSeguimiento,
    {
      guiaSeguimiento: (campo) =>
        campo.validity.valueMissing ? "Indique el código de guía." : MENSAJE_FORMATO,
    },
    {
      alInvalido: (_campo, mensaje) => {
        limpiarResultado();
        avisar(mensaje, true);
      },
    },
  );
  el.formSeguimiento.addEventListener("submit", buscar);
  el.guiaSeguimiento.addEventListener("input", () => {
    const normal = normalizarGuia(el.guiaSeguimiento.value);
    if (normal !== el.guiaSeguimiento.value) el.guiaSeguimiento.value = normal;
    // Al editar el código, la ficha anterior ya no corresponde a lo escrito
    limpiarResultado();
  });
  el.resultadoSeguimiento.addEventListener("click", (ev) => {
    const enlace = ev.target.closest("[data-ir-guia]");
    if (enlace) return consultarGuia(enlace.dataset.irGuia);
    const boton = ev.target.closest("button[data-estado]");
    if (boton) cambiarEstado(boton.dataset.estado);
  });
  // Si el envío cambia desde otro módulo, la ficha abierta se actualiza sola
  document.addEventListener("envioActualizado", (ev) => {
    if (seleccionado && ev.detail.guias.includes(seleccionado.codigoGuia)) mostrar();
  });
}

/** Quita la ficha y la línea de tiempo mostradas. */
function limpiarResultado() {
  seleccionado = null;
  el.resultadoSeguimiento.innerHTML = "";
  el.historialSeguimiento.innerHTML = "";
}

/** Muestra un mensaje en lugar de la ficha (guía inexistente o formato inválido). */
function mensajeVacio(texto) {
  limpiarResultado();
  el.resultadoSeguimiento.innerHTML = `<p class="vacio">${escapar(texto)}</p>`;
}

/** Consulta una guía y la muestra (la usan los enlaces de la ficha y la búsqueda global). */
export function consultarGuia(guia) {
  el.guiaSeguimiento.value = guia;
  validacion.reiniciar();
  buscar();
}

/** Busca la guía escrita y muestra su ficha; informa si el formato es inválido o no existe. */
function buscar(ev) {
  ev?.preventDefault();
  const guia = normalizarGuia(el.guiaSeguimiento.value);
  el.guiaSeguimiento.value = guia;
  if (!FORMATO_GUIA.test(guia)) {
    // Defensa por si se llama sin pasar por la validación nativa del formulario
    const texto = guia
      ? "Use el formato ENV-AAAA-00000, por ejemplo ENV-2026-00001."
      : "Indique el código de guía.";
    validacion.marcar(el.guiaSeguimiento, texto);
    mensajeVacio(texto);
    return avisar(texto, true);
  }
  seleccionado = estado.envios.find((x) => x.codigoGuia === guia) ?? null;
  if (!seleccionado) {
    mensajeVacio(`No se encontró la guía ${guia}.`);
    return avisar("Guía no encontrada.", true);
  }
  mostrar();
}

/** Indicador visual del recorrido normal del envío. */
function htmlProgreso(e) {
  const actual = RECORRIDO.indexOf(e.estado);
  if (actual < 0) return ""; // devuelto o cancelado: ya no sigue el recorrido normal
  return `<ol class="progreso-envio" aria-label="Progreso del envío">${RECORRIDO.map(
    (paso, i) =>
      `<li class="${i < actual ? "completo" : i === actual ? "actual" : ""}"${i === actual ? ' aria-current="step"' : ""}>${etiquetaEstado(paso)}</li>`,
  ).join("")}</ol>`;
}

/** Pinta progreso, ficha, acciones permitidas y línea de tiempo del envío seleccionado. */
function mostrar() {
  const transiciones = TRANSICIONES[seleccionado.estado] ?? [];
  const acciones = transiciones.length
    ? `<div class="acciones">${transiciones
        .map(
          (siguiente) =>
            `<button type="button" data-estado="${siguiente}">Cambiar a ${etiquetaEstado(siguiente)}</button>`,
        )
        .join("")}</div>`
    : `<p class="nota">${
        seleccionado.estado === "cancelado"
          ? "Envío cancelado: no admite más cambios de estado."
          : "Estado final: no admite más cambios."
      }</p>`;
  el.resultadoSeguimiento.innerHTML =
    htmlProgreso(seleccionado) + htmlFichaEnvio(seleccionado, { estado, catalogo }) + acciones;
  el.historialSeguimiento.innerHTML = `<ol class="lista-tiempo">${htmlLineaTiempo(seleccionado)}</ol>`;
}

/** Aplica una transición válida de la tabla TRANSICIONES y la registra en el historial (RF-35, RF-36). */
async function cambiarEstado(nuevo) {
  const envio = seleccionado;
  if (!envio || !(TRANSICIONES[envio.estado] ?? []).includes(nuevo) || !ESTADOS.includes(nuevo))
    return avisar("Transición no válida.", true);
  const confirmado = await confirmar(
    "Cambiar estado",
    `¿Cambiar ${envio.codigoGuia} de ${etiquetaEstado(envio.estado)} a ${etiquetaEstado(nuevo)}?`,
  );
  if (!confirmado) return;
  // El estado pudo cambiar mientras el diálogo estaba abierto
  if (!(TRANSICIONES[envio.estado] ?? []).includes(nuevo)) {
    mostrar();
    return avisar("El envío cambió mientras confirmaba. Revise su estado actual.", true);
  }

  const anterior = envio.estado;
  const ahora = new Date().toISOString();
  let detalleRuta = "";
  if (anterior === "asignado a ruta" && nuevo === "en bodega") {
    const ruta = estado.rutas.find((r) => r.codigo === envio.rutaAsignada);
    if (ruta) {
      ruta.envios = ruta.envios.filter((guia) => guia !== envio.codigoGuia);
      detalleRuta = `; retirado automáticamente de ${ruta.codigo}`;
    }
    envio.rutaAsignada = null;
    envio.fechaIngresoBodega = ahora;
  }
  if (anterior === "registrado" && nuevo === "en bodega") envio.fechaIngresoBodega = ahora;
  envio.estado = nuevo;
  envio.historial.push({
    estadoAnterior: anterior,
    estado: nuevo,
    fecha: ahora,
    detalle: `Cambio manual de ${anterior} a ${nuevo}${detalleRuta}`,
  });
  guardarEstado(estado);
  mostrar();
  actualizar();
  document.dispatchEvent(
    new CustomEvent("envioActualizado", { detail: { guias: [envio.codigoGuia] } }),
  );
  document.dispatchEvent(new Event("inventarioActualizado"));
  document.dispatchEvent(new Event("rutasActualizadas"));
  avisar("Estado actualizado.");
}
